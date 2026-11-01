// TCP/IP (pull) connector for ZKTeco devices without ADMS. The protocol is in
// zkclient.js. Like the standalone sync app, every operation opens its own
// session: connect, disable the device, do the work, enable it, disconnect.
// Devices drop idle sockets and allow few sessions, so none is held open.
// The device list is saved to data/tcp-devices.json and restored on start.
const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const { DATA_DIR } = require('../datafiles');
const { store, addDevice, updateDevice, addAttendanceLog, addSyncLog } = require('../store');
const { ZKClient, makeCommKey, userRecord } = require('./zkclient');

let io = null;
function setSocketIO(socketio) { io = socketio; }
function emit(event, data) { if (io) io.emit(event, data); }

const VERIFY_METHODS = { 0: 'password', 1: 'fingerprint', 2: 'card', 3: 'card', 4: 'card', 15: 'face' };
const DEFAULT_TIMEOUT = 10000;

// deviceId -> { config, queue, userPacketSize }
const tcpDevices = {};

const DEVICES_FILE = path.join(DATA_DIR, 'tcp-devices.json');

function saveDeviceList() {
  const list = Object.values(tcpDevices).map(({ config: { id, ip, port, password, name, sn } }) => ({ id, ip, port, password, name, sn }));
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DEVICES_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
    fs.renameSync(tmp, DEVICES_FILE);
  } catch (e) { logger.error('Failed to save tcp-devices.json: ' + e.message); }
}

// Registers the TCP devices saved before the last restart and connects to them
async function restoreTCPDevices() {
  let list = [];
  try {
    if (fs.existsSync(DEVICES_FILE)) list = JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf8'));
  } catch (e) { logger.error('Failed to load tcp-devices.json: ' + e.message); }
  if (!Array.isArray(list) || !list.length) return;
  logger.info(`Reconnecting ${list.length} saved TCP device(s)`);
  for (const config of list) {
    if (config && config.ip) await connectTCPDevice(config);
  }
}

// ── Sessions ──────────────────────────────────────────────────────

// Runs fn(client) in a fresh device session, one operation per device at a time
function withDevice(deviceId, fn) {
  const entry = tcpDevices[deviceId];
  if (!entry) return Promise.reject(new Error('Device not connected'));
  const run = async () => {
    const { ip, port, password, timeout } = entry.config;
    const client = new ZKClient({ ip, port, password, timeout: timeout || DEFAULT_TIMEOUT });
    if (entry.userPacketSize) client.userPacketSize = entry.userPacketSize;
    try {
      await client.connect();
      await client.disableDevice();
      try {
        return await fn(client);
      } finally {
        entry.userPacketSize = client.userPacketSize;
        try { await client.enableDevice(); } catch {}
      }
    } catch (err) {
      updateDevice(deviceId, { status: 'error', error: errorMessage(err) });
      emit('state_update', { type: 'device_update' });
      throw err;
    } finally {
      await client.disconnect();
    }
  };
  const next = entry.queue.then(run, run);
  entry.queue = next.catch(() => {});
  return next.then(result => {
    updateDevice(deviceId, { status: 'connected', error: null });
    return result;
  });
}

function errorMessage(err) {
  if (err?.code === 'ECONNREFUSED') return 'Connection refused (is the device on port 4370 / TCP enabled?)';
  if (err?.code === 'EHOSTUNREACH' || err?.code === 'ENETUNREACH') return 'Device unreachable on the network';
  return err?.message || String(err);
}

// ── Public API (used by routes.js and scheduler.js) ───────────────

// The bridge's device entry: updated in place when it exists, so its counters stay
function registerDevice(info, extra = {}) {
  if (store.devices[info.id]) updateDevice(info.id, { ...info, ...extra, status: 'connected', error: null });
  else addDevice({ ...info, ...extra });
}

// Another registered TCP device with this serial number (the same device, now at another IP)
function findBySerial(serial, exceptId) {
  if (!serial) return null;
  const saved = Object.values(tcpDevices).find(e => e.config.id !== exceptId && e.config.sn === serial);
  if (saved) return saved.config.id;
  const known = Object.values(store.devices).find(d => d.type === 'tcp' && d.id !== exceptId && d.sn === serial);
  return known ? known.id : null;
}

async function connectTCPDevice(config) {
  const port = parseInt(config.port, 10) || 4370;
  let deviceId = config.id || `${config.ip}:${port}`;
  const deviceInfo = {
    id: deviceId,
    sn: config.sn || deviceId,
    type: 'tcp',
    name: config.name || `TCP Device (${config.ip})`,
    ip: config.ip,
    port,
    model: 'ZKTeco (TCP/IP)',
  };

  if (tcpDevices[deviceId]) await disconnectTCPDevice(deviceId);

  // Stays registered even if this first attempt fails, so later syncs retry it
  tcpDevices[deviceId] = {
    config: { id: deviceId, ip: config.ip, port, password: config.password || 0, name: config.name || '', sn: config.sn || '', timeout: config.timeout },
    queue: Promise.resolve(),
    userPacketSize: null,
  };
  saveDeviceList();

  try {
    const extra = await withDevice(deviceId, async client => {
      const ask = async fn => { try { return String(await fn() || '').trim(); } catch { return ''; } };
      const info = {};
      const serial = await ask(() => client.getSerialNumber());
      const model = await ask(() => client.getDeviceName());
      const firmware = await ask(() => client.getFirmware());
      if (serial) info.sn = serial;
      if (model) info.model = model;
      if (firmware) info.firmware = firmware;
      return info;
    });

    // Same serial as a device added before (its IP changed): keep the old entry and
    // its ID, so its records are not imported and pushed to the ERP a second time
    const sameId = findBySerial(extra.sn, deviceId);
    if (sameId) {
      const entry = tcpDevices[deviceId];
      delete tcpDevices[deviceId];
      delete store.devices[deviceId];
      const old = tcpDevices[sameId];
      if (old) await old.queue;
      entry.config.id = sameId;
      if (!config.name && old?.config.name) entry.config.name = old.config.name;
      tcpDevices[sameId] = entry;
      logger.info(`TCP device ${deviceId} is ${sameId} (SN ${extra.sn}) at a new address; updated it`);
      deviceInfo.id = sameId;
      deviceInfo.name = entry.config.name || store.devices[sameId]?.name || deviceInfo.name;
      deviceId = sameId;
    }
    if (extra.sn) tcpDevices[deviceId].config.sn = extra.sn;
    saveDeviceList();

    registerDevice(deviceInfo, extra);
    logger.info(`TCP device connected: ${deviceId}${extra.sn ? ` (SN ${extra.sn})` : ''}`);
    emit('device_connected', { deviceId, type: 'tcp' });
    emit('state_update', { type: 'device_update' });
    return { success: true, deviceId, ...(sameId ? { matched: true } : {}) };
  } catch (err) {
    const msg = errorMessage(err);
    logger.error(`Failed to connect TCP device ${deviceId}: ${msg}`);
    if (!store.devices[deviceId]) addDevice(deviceInfo);
    updateDevice(deviceId, { ...deviceInfo, status: 'error', error: msg });
    emit('state_update', { type: 'device_update' });
    return { success: false, error: msg };
  }
}

// First day kept by the retention setting, counted back from `from` (as
// pruneAttendance does from today). A device holds its whole history; without a
// date range only this period is taken, so the first fetch does not flood the
// ERP push and records that were pushed and pruned are not imported again.
function retentionStart(from = new Date()) {
  const days = parseInt(store.config.attendanceRetentionDays) || 90;
  const cutoff = new Date(from.getTime() - days * 86400000);
  const pad = n => String(n).padStart(2, '0');
  return `${cutoff.getFullYear()}-${pad(cutoff.getMonth() + 1)}-${pad(cutoff.getDate())}`;
}

// Changes a device's address, name or comm key and keeps its ID (and records).
// An empty comm key keeps the current one; 0 means none.
async function updateTCPDevice(deviceId, changes) {
  const entry = tcpDevices[deviceId];
  const known = store.devices[deviceId];
  if (!entry && known?.type !== 'tcp') return { success: false, error: 'Device not found' };
  const current = entry ? entry.config : { ip: known.ip, port: known.port, name: known.name, password: 0, sn: known.sn };
  const password = changes.password !== undefined && String(changes.password).trim() !== ''
    ? String(changes.password).trim() : current.password;
  return connectTCPDevice({
    id: deviceId,
    ip: changes.ip || current.ip,
    port: changes.port || current.port,
    name: changes.name !== undefined ? changes.name : current.name,
    password,
    sn: current.sn && current.sn !== deviceId ? current.sn : '',
  });
}

async function fetchAttendanceFromTCP(deviceId, fromDate = null, toDate = null) {
  if (!tcpDevices[deviceId]) return { success: false, error: 'Device not connected' };
  try {
    const records = await withDevice(deviceId, client => client.getAttendance());
    logger.info(`Fetched ${records.length} attendance records from TCP device ${deviceId}`);

    // Also count back from the device's newest punch, so a device whose clock
    // is wrong (e.g. reset to an old year) never has its new punches left out
    let newest = '';
    for (const rec of records) if (typeof rec.time === 'string' && rec.time > newest) newest = rec.time;
    const newestDate = newest ? new Date(`${newest.slice(0, 10)}T00:00:00`) : null;
    const byToday = retentionStart();
    const byDevice = newestDate && !isNaN(newestDate) ? retentionStart(newestDate) : byToday;
    const since = fromDate || (byDevice < byToday ? byDevice : byToday);
    let saved = 0, skipped = 0, older = 0;
    for (const rec of records) {
      const employeeId = String(rec.userId ?? '').trim();
      if (!employeeId || !/^\d{4}-\d\d-\d\d /.test(rec.time)) { skipped++; continue; }
      const date = rec.time.slice(0, 10);
      if (date < since) { if (!fromDate) older++; continue; }
      if (toDate && date > toDate) continue;
      const verify = String(rec.status);
      const record = {
        deviceId,
        employeeId,
        time: rec.time,
        status: String(rec.punch ?? 0),
        verify,
        verifyMethod: VERIFY_METHODS[verify] || 'fingerprint',
        source: 'tcp',
      };
      if (addAttendanceLog(record)) {
        emit('attendance', record);
        saved++;
      }
    }
    if (skipped) logger.warn(`TCP ${deviceId}: skipped ${skipped} unreadable attendance records`);
    if (older) logger.info(`TCP ${deviceId}: ${older} records before ${since} left out (retention period; use a date range to fetch them)`);

    addSyncLog({
      type: 'tcp_attendance_fetch',
      status: 'success',
      deviceId,
      count: saved,
      message: `Fetched ${saved} new records from ${deviceId} (${records.length} on device)`,
    });
    emit('state_update', { type: 'attendance', count: saved });
    return { success: true, count: saved, total: records.length, older };
  } catch (err) {
    const msg = errorMessage(err);
    logger.error(`Failed to fetch attendance from ${deviceId}: ${msg}`);
    addSyncLog({ type: 'tcp_attendance_fetch', status: 'error', deviceId, message: msg });
    return { success: false, error: msg };
  }
}

async function syncEmployeesToTCP(deviceId, employees) {
  if (!tcpDevices[deviceId]) return { success: false, error: 'Device not connected' };
  const syncedUids = [];
  const failed = [];
  try {
    await withDevice(deviceId, async client => {
      for (const emp of employees) {
        const e = { ...emp, uid: emp.uid || emp.id, employee_id: emp.employee_id || emp.pin || emp.uid || emp.id };
        try {
          await client.setUser(e);
          syncedUids.push(String(e.uid));
        } catch (err) {
          if (!client.socket) throw err;
          failed.push(`${e.uid}: ${errorMessage(err)}`);
        }
      }
      try { await client.refreshData(); } catch {}
    });
  } catch (err) {
    // Users written before the connection broke are on the device
    return { success: false, error: errorMessage(err), synced: syncedUids.length, syncedUids };
  }
  const synced = syncedUids.length;
  if (failed.length) logger.warn(`TCP ${deviceId}: ${failed.length} employee(s) not synced — ${failed.slice(0, 5).join('; ')}`);

  updateDevice(deviceId, { employeesSynced: synced });
  addSyncLog({
    type: 'employee_sync_tcp',
    status: failed.length ? 'partial' : 'success',
    deviceId,
    count: synced,
    message: `Synced ${synced}/${employees.length} employees to ${deviceId}`,
  });
  return { success: synced > 0 || employees.length === 0, synced, syncedUids, total: employees.length, failed: failed.length };
}

async function getEmployeesFromDevice(deviceId) {
  if (!tcpDevices[deviceId]) return { success: false, error: 'Device not connected' };
  try {
    const users = await withDevice(deviceId, client => client.getUsers());
    const employees = users.map(u => ({
      uid: u.uid,
      employee_id: String(u.userId || u.uid),
      name: u.name || '',
      password: u.password || '',
      privilege: u.privilege || 0,
      card_no: u.card ? String(u.card) : '',
    }));
    return { success: true, employees };
  } catch (err) {
    const msg = errorMessage(err);
    logger.error(`Failed to get employees from ${deviceId}: ${msg}`);
    return { success: false, error: msg };
  }
}

async function setEmployeeOnDevice(deviceId, emp) {
  if (!tcpDevices[deviceId]) return { success: false, error: 'Device not connected' };
  try {
    await withDevice(deviceId, async client => {
      await client.setUser(emp);
      try { await client.refreshData(); } catch {}
    });
    addSyncLog({ type: 'employee_set', status: 'success', deviceId, message: `Set employee UID=${emp.uid} on ${deviceId}` });
    return { success: true };
  } catch (err) {
    const msg = errorMessage(err);
    logger.error(`Failed to set employee on ${deviceId}: ${msg}`);
    return { success: false, error: msg };
  }
}

async function deleteEmployeeFromDevice(deviceId, uid) {
  if (!tcpDevices[deviceId]) return { success: false, error: 'Device not connected' };
  try {
    await withDevice(deviceId, async client => {
      await client.deleteUser(uid);
      try { await client.refreshData(); } catch {}
    });
    addSyncLog({ type: 'employee_delete', status: 'success', deviceId, message: `Deleted employee UID=${uid} from ${deviceId}` });
    return { success: true };
  } catch (err) {
    const msg = errorMessage(err);
    logger.error(`Failed to delete employee UID=${uid} from ${deviceId}: ${msg}`);
    return { success: false, error: msg };
  }
}

// forget=false (shutdown) keeps the device in the saved list for the next start
async function disconnectTCPDevice(deviceId, forget = true) {
  const entry = tcpDevices[deviceId];
  if (!entry) return;
  delete tcpDevices[deviceId];
  if (forget) saveDeviceList();
  // Let a running operation finish its session first
  await entry.queue;
  updateDevice(deviceId, { status: 'disconnected' });
  emit('state_update', { type: 'device_update' });
}

// Fetch from every TCP device the bridge knows (used by the schedule and Sync Now)
async function fetchAllTCP() {
  let fetched = 0;
  const results = [];
  for (const deviceId of Object.keys(tcpDevices)) {
    const r = await fetchAttendanceFromTCP(deviceId);
    fetched += r.count || 0;
    results.push({ deviceId, ...r });
  }
  return { fetched, results };
}

async function disconnectAllTCP() {
  await Promise.all(Object.keys(tcpDevices).map(id => disconnectTCPDevice(id, false)));
}

module.exports = {
  connectTCPDevice,
  updateTCPDevice,
  fetchAttendanceFromTCP,
  syncEmployeesToTCP,
  getEmployeesFromDevice,
  setEmployeeOnDevice,
  deleteEmployeeFromDevice,
  disconnectTCPDevice,
  disconnectAllTCP,
  restoreTCPDevices,
  fetchAllTCP,
  setSocketIO,
  tcpDevices,
  makeCommKey,
  userRecord,
};
