// TCP/IP (pull) connector for ZKTeco devices without ADMS.
// The binary protocol is handled by the zkteco-js library (TCP with UDP
// fallback). This file adds what the bridge needs on top of it: one queue per
// device, automatic reconnects, the comm-key login, and user writes that follow
// the device's 72-byte user record (zkteco-js limits UIDs to 3000).
const ZktecoJs = require('zkteco-js');
const logger = require('../logger');
const { addDevice, updateDevice, addAttendanceLog, addSyncLog } = require('../store');

let io = null;
function setSocketIO(socketio) { io = socketio; }
function emit(event, data) { if (io) io.emit(event, data); }

const CMD = {
  AUTH: 1102,
  USER_WRQ: 8,
  DELETE_USER: 18,
  REFRESHDATA: 1013,
  ACK_OK: 2000,
  ACK_UNAUTH: 2005,
};

const VERIFY_METHODS = { 0: 'password', 1: 'fingerprint', 2: 'card', 3: 'card', 4: 'card', 15: 'face' };
const DEFAULT_TIMEOUT = 10000;

// deviceId -> { config, zk, queue }
const tcpDevices = {};

// ── Protocol helpers ───────────────────────────────────────────────

// Comm key ("communication password") scrambled with the session id, as the
// device expects for CMD_AUTH (same algorithm as pyzk's make_commkey)
function makeCommKey(key, sessionId, ticks = 50) {
  key = parseInt(key, 10) >>> 0;
  let k = 0;
  for (let i = 0; i < 32; i++) k = ((key & (1 << i)) ? ((k << 1) | 1) : (k << 1)) >>> 0;
  k = (k + (sessionId >>> 0)) >>> 0;
  const b = Buffer.alloc(4);
  b.writeUInt32LE(k, 0);
  const x = Buffer.from([b[0] ^ 0x5a, b[1] ^ 0x4b, b[2] ^ 0x53, b[3] ^ 0x4f]); // 'Z' 'K' 'S' 'O'
  const swapped = Buffer.alloc(4);
  swapped.writeUInt16LE(x.readUInt16LE(2), 0);
  swapped.writeUInt16LE(x.readUInt16LE(0), 2);
  const t = ticks & 0xff;
  return Buffer.from([swapped[0] ^ t, swapped[1] ^ t, t, swapped[3] ^ t]);
}

function replyCode(reply) {
  return reply && reply.length >= 2 ? reply.readUInt16LE(0) : null;
}

const pad = n => String(n).padStart(2, '0');
function formatTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// 72-byte user record: uid(2) privilege(1) password(8) name(24) card(4) pad(1)
// group(7) pad(1) user_id(24)
function userRecord(emp) {
  const uid = parseInt(emp.uid, 10);
  if (!(uid >= 1 && uid <= 65535)) throw new Error(`UID must be 1-65535 (got ${emp.uid})`);
  const buf = Buffer.alloc(72);
  buf.writeUInt16LE(uid, 0);
  buf.writeUInt8(parseInt(emp.privilege, 10) || 0, 2);
  buf.write(String(emp.password || '').slice(0, 8), 3, 8, 'ascii');
  buf.write(String(emp.name || '').slice(0, 24), 11, 24, 'utf8');
  buf.writeUInt32LE((parseInt(emp.card_no, 10) || 0) >>> 0, 35);
  buf.write('1', 40, 7, 'ascii');
  buf.write(String(emp.employee_id || emp.employeeId || uid).slice(0, 24), 48, 24, 'ascii');
  return buf;
}

// ── Connection management ─────────────────────────────────────────

function isOpen(zk) {
  return !!(zk && ((zk.connectionType === 'tcp' && zk.ztcp.socket) || (zk.connectionType === 'udp' && zk.zudp.socket)));
}

async function openConnection(entry) {
  const { config } = entry;
  const zk = new ZktecoJs(config.ip, config.port, config.timeout || DEFAULT_TIMEOUT);
  // Devices close idle sockets; that is normal, so the device keeps its status and
  // the next operation reconnects (withDevice). Real failures set status "error".
  await zk.createSocket(null, () => {});

  if (config.password && zk.connectionType === 'tcp') {
    const reply = await zk.ztcp.executeCmd(CMD.AUTH, makeCommKey(config.password, zk.ztcp.sessionId));
    if (replyCode(reply) !== CMD.ACK_OK) {
      try { await zk.disconnect(); } catch {}
      throw new Error('Device rejected the comm key (password)');
    }
  }
  entry.zk = zk;
  return zk;
}

// Runs fn(zk) for one device at a time, reconnecting first when the device
// has dropped the connection (devices close idle sockets)
function withDevice(deviceId, fn) {
  const entry = tcpDevices[deviceId];
  if (!entry) return Promise.reject(new Error('Device not connected'));
  const run = async () => {
    try {
      const zk = isOpen(entry.zk) ? entry.zk : await openConnection(entry);
      const result = await fn(zk);
      updateDevice(deviceId, { status: 'connected', error: null });
      return result;
    } catch (err) {
      updateDevice(deviceId, { status: 'error', error: err.message });
      emit('state_update', { type: 'device_update' });
      try { if (entry.zk) await entry.zk.disconnect(); } catch {}
      entry.zk = null;
      throw err;
    }
  };
  const next = entry.queue.then(run, run);
  entry.queue = next.catch(() => {});
  return next;
}

function errorMessage(err) {
  return err?.err?.message || err?.message || String(err);
}

// ── Public API (used by routes.js and scheduler.js) ───────────────

async function connectTCPDevice(config) {
  const port = parseInt(config.port, 10) || 4370;
  const deviceId = config.id || `${config.ip}:${port}`;
  const deviceInfo = {
    id: deviceId,
    sn: deviceId,
    type: 'tcp',
    name: config.name || `TCP Device (${config.ip})`,
    ip: config.ip,
    port,
    model: 'ZKTeco (TCP/IP)',
  };

  if (tcpDevices[deviceId]) await disconnectTCPDevice(deviceId);

  const entry = {
    config: { id: deviceId, ip: config.ip, port, password: config.password || '', timeout: config.timeout },
    zk: null,
    queue: Promise.resolve(),
  };
  tcpDevices[deviceId] = entry;

  try {
    const zk = await openConnection(entry);
    // Device details (TCP only; one request at a time on the same socket)
    const extra = {};
    if (zk.connectionType === 'tcp') {
      const ask = async fn => { try { return String(await fn() || '').trim(); } catch { return ''; } };
      const serial = await ask(() => zk.getSerialNumber());
      const model = await ask(() => zk.getDeviceName());
      const firmware = await ask(() => zk.getFirmware());
      if (serial) extra.sn = serial;
      if (model) extra.model = model;
      if (firmware) extra.firmware = firmware;
    }

    addDevice({ ...deviceInfo, ...extra });
    logger.info(`TCP device connected: ${deviceId} (${zk.connectionType.toUpperCase()})`);
    emit('device_connected', { deviceId, type: 'tcp' });
    emit('state_update', { type: 'device_update' });
    return { success: true, deviceId };
  } catch (err) {
    const msg = errorMessage(err);
    delete tcpDevices[deviceId];
    logger.error(`Failed to connect TCP device ${deviceId}: ${msg}`);
    addDevice({ ...deviceInfo, status: 'error', error: msg });
    emit('state_update', { type: 'device_update' });
    return { success: false, error: msg };
  }
}

async function fetchAttendanceFromTCP(deviceId, fromDate = null, toDate = null) {
  if (!tcpDevices[deviceId]) return { success: false, error: 'Device not connected' };
  try {
    const result = await withDevice(deviceId, zk => zk.getAttendances());
    const records = result?.data || [];
    logger.info(`Fetched ${records.length} attendance records from TCP device ${deviceId}`);

    let saved = 0, skipped = 0;
    for (const rec of records) {
      const time = formatTime(rec.record_time);
      const employeeId = String(rec.user_id ?? '').trim();
      if (!time || !employeeId) { skipped++; continue; }
      const date = time.slice(0, 10);
      if (fromDate && date < fromDate) continue;
      if (toDate && date > toDate) continue;
      const verify = rec.type !== undefined ? String(rec.type) : '';
      const record = {
        deviceId,
        employeeId,
        time,
        status: String(rec.state ?? 0),
        ...(verify ? { verify, verifyMethod: VERIFY_METHODS[verify] || 'fingerprint' } : {}),
        source: 'tcp',
      };
      if (addAttendanceLog(record)) {
        emit('attendance', record);
        saved++;
      }
    }
    if (skipped) logger.warn(`TCP ${deviceId}: skipped ${skipped} unreadable attendance records`);

    addSyncLog({
      type: 'tcp_attendance_fetch',
      status: 'success',
      deviceId,
      count: saved,
      message: `Fetched ${saved} new records from ${deviceId} (${records.length} on device)`,
    });
    emit('state_update', { type: 'attendance', count: saved });
    return { success: true, count: saved, total: records.length };
  } catch (err) {
    const msg = errorMessage(err);
    logger.error(`Failed to fetch attendance from ${deviceId}: ${msg}`);
    addSyncLog({ type: 'tcp_attendance_fetch', status: 'error', deviceId, message: msg });
    return { success: false, error: msg };
  }
}

async function writeUser(zk, emp) {
  if (zk.connectionType !== 'tcp') throw new Error('Writing users needs a TCP connection');
  const reply = await zk.ztcp.executeCmd(CMD.USER_WRQ, userRecord(emp));
  if (replyCode(reply) !== CMD.ACK_OK) throw new Error(`Device refused user ${emp.uid}`);
}

async function refreshData(zk) {
  if (zk.connectionType === 'tcp') {
    try { await zk.ztcp.executeCmd(CMD.REFRESHDATA, ''); } catch {}
  }
}

async function syncEmployeesToTCP(deviceId, employees) {
  if (!tcpDevices[deviceId]) return { success: false, error: 'Device not connected' };
  let synced = 0;
  const failed = [];
  try {
    await withDevice(deviceId, async zk => {
      for (const emp of employees) {
        const e = { ...emp, uid: emp.uid || emp.id, employee_id: emp.employee_id || emp.pin || emp.uid || emp.id };
        try {
          await writeUser(zk, e);
          synced++;
        } catch (err) {
          failed.push(`${e.uid}: ${errorMessage(err)}`);
        }
      }
      await refreshData(zk);
    });
  } catch (err) {
    return { success: false, error: errorMessage(err), synced };
  }
  if (failed.length) logger.warn(`TCP ${deviceId}: ${failed.length} employee(s) not synced — ${failed.slice(0, 5).join('; ')}`);

  updateDevice(deviceId, { employeesSynced: synced });
  addSyncLog({
    type: 'employee_sync_tcp',
    status: failed.length ? 'partial' : 'success',
    deviceId,
    count: synced,
    message: `Synced ${synced}/${employees.length} employees to ${deviceId}`,
  });
  return { success: synced > 0 || employees.length === 0, synced, total: employees.length, failed: failed.length };
}

async function getEmployeesFromDevice(deviceId) {
  if (!tcpDevices[deviceId]) return { success: false, error: 'Device not connected' };
  try {
    const result = await withDevice(deviceId, zk => zk.getUsers());
    const employees = (result?.data || []).map(u => ({
      uid: u.uid,
      employee_id: String(u.userId || u.uid),
      name: u.name || '',
      password: u.password || '',
      privilege: u.role || 0,
      card_no: u.cardno ? String(u.cardno) : '',
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
    await withDevice(deviceId, async zk => { await writeUser(zk, emp); await refreshData(zk); });
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
    await withDevice(deviceId, async zk => {
      if (zk.connectionType !== 'tcp') throw new Error('Deleting users needs a TCP connection');
      const buf = Buffer.alloc(2);
      buf.writeUInt16LE(parseInt(uid, 10), 0);
      const reply = await zk.ztcp.executeCmd(CMD.DELETE_USER, buf);
      if (replyCode(reply) !== CMD.ACK_OK) throw new Error(`Device refused to delete user ${uid}`);
      await refreshData(zk);
    });
    addSyncLog({ type: 'employee_delete', status: 'success', deviceId, message: `Deleted employee UID=${uid} from ${deviceId}` });
    return { success: true };
  } catch (err) {
    const msg = errorMessage(err);
    logger.error(`Failed to delete employee UID=${uid} from ${deviceId}: ${msg}`);
    return { success: false, error: msg };
  }
}

async function disconnectTCPDevice(deviceId) {
  const entry = tcpDevices[deviceId];
  if (!entry) return;
  delete tcpDevices[deviceId];
  try { if (entry.zk) await entry.zk.disconnect(); } catch {}
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
  await Promise.all(Object.keys(tcpDevices).map(disconnectTCPDevice));
}

module.exports = {
  connectTCPDevice,
  fetchAttendanceFromTCP,
  syncEmployeesToTCP,
  getEmployeesFromDevice,
  setEmployeeOnDevice,
  deleteEmployeeFromDevice,
  disconnectTCPDevice,
  disconnectAllTCP,
  fetchAllTCP,
  setSocketIO,
  tcpDevices,
  makeCommKey,
  userRecord,
};
