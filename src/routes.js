const express = require('express');
const router = express.Router();
const os = require('os');
const cron = require('node-cron');
const { exec } = require('child_process');
const { store, getState, clearLogs, upsertEmployee, deleteEmployee, markAttendancePushed, markEmployeesSynced, savePermissions, DEFAULT_PERMISSIONS, saveConfigFile } = require('./store');
const { testConnection, fetchEmployees, pushAttendance } = require('./laravel/api');
const { connectTCPDevice, fetchAttendanceFromTCP, disconnectTCPDevice, syncEmployeesToTCP, getEmployeesFromDevice, setEmployeeOnDevice, deleteEmployeeFromDevice } = require('./tcpip/connector');
const { requestSetUserOnADMS, requestDeleteUserOnADMS, requestUsersFromADMS, requestAttLogsFromADMS, pendingOptionPush, restartADMSServer, deviceUserCache } = require('./adms/server');
const { runEmployeeSync, runAttendanceFetch, updateSchedule, getSchedulerStatus } = require('./scheduler');
const logger = require('./logger');
const { requirePerm, requireSuperAdmin, getEffectivePermissions } = require('./auth');
const { restartProcess } = require('./restart');
const { setEnvValues } = require('./envfile');
const branding = require('./branding');
const fs = require('fs');
const path = require('path');

function parseEmpUid(emp) {
  const raw = String(emp.uid || emp.id || emp.employee_id || emp.pin || '');
  return parseInt(raw) || parseInt(raw.replace(/\D/g, '')) || 0;
}

// ── Permissions ────────────────────────────────────────────────────
router.get('/permissions', (req, res) => {
  res.json({
    permissions: getEffectivePermissions(req.session.user), // what this user may do
    global: store.permissions,                               // UI-wide settings (permissions page)
    defaults: DEFAULT_PERMISSIONS,
  });
});

router.post('/permissions', requireSuperAdmin, (req, res) => {
  const perms = req.body;
  if (!perms || typeof perms !== 'object') return res.status(400).json({ success: false, error: 'Invalid permissions' });
  savePermissions(perms);
  res.json({ success: true });
});

// ── State ──────────────────────────────────────────────────────────
router.get('/state', (req, res) => {
  res.json(getState());
});

// ── Config ─────────────────────────────────────────────────────────
router.get('/config', (req, res) => {
  const ifaces = os.networkInterfaces();
  let serverIp = '';
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        serverIp = iface.address;
        break;
      }
    }
    if (serverIp) break;
  }

  const canSettings = getEffectivePermissions(req.session.user).nav?.settings === true;
  res.json({
    laravelApiUrl: canSettings ? store.config.laravelApiUrl : '',
    fetchEmployeeUrl: canSettings ? store.config.fetchEmployeeUrl : '',
    syncAttendanceUrl: canSettings ? store.config.syncAttendanceUrl : '',
    admsPort: store.config.admsPort,
    syncSchedule: store.config.syncSchedule,
    attendanceFetchSchedule: store.config.attendanceFetchSchedule,
    employeeSyncEnabled: store.config.employeeSyncEnabled !== false,
    attendanceSyncEnabled: store.config.attendanceSyncEnabled !== false,
    hasToken: !!store.config.laravelApiToken,
    serverIp,
    schedulerStatus: getSchedulerStatus(),
  });
});

const CONTROL_CHARS = /[\r\n\0]/;

function isHttpUrl(v) {
  if (!v) return true;
  try { return ['http:', 'https:'].includes(new URL(v).protocol); } catch { return false; }
}

router.post('/config', requirePerm('nav.settings'), (req, res) => {
  const body = req.body || {};
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === 'string' && CONTROL_CHARS.test(v)) {
      return res.status(400).json({ success: false, error: `Invalid characters in ${k}` });
    }
  }
  for (const k of ['laravelApiUrl', 'fetchEmployeeUrl', 'syncAttendanceUrl']) {
    if (body[k] !== undefined && !isHttpUrl(String(body[k]).trim())) {
      return res.status(400).json({ success: false, error: `${k} must be an http(s) URL` });
    }
  }
  for (const k of ['syncSchedule', 'attendanceFetchSchedule']) {
    if (body[k] !== undefined && !cron.validate(String(body[k]))) {
      return res.status(400).json({ success: false, error: `${k} is not a valid cron expression` });
    }
  }
  if (body.admsPort !== undefined) {
    const p = parseInt(body.admsPort);
    if (!(p >= 1024 && p <= 65535)) return res.status(400).json({ success: false, error: 'ADMS port must be 1024-65535' });
  }

  const { laravelApiUrl, laravelApiToken, fetchEmployeeUrl, syncAttendanceUrl, syncSchedule, attendanceFetchSchedule, employeeSyncEnabled, attendanceSyncEnabled, admsPort } = req.body;
  if (laravelApiUrl !== undefined) store.config.laravelApiUrl = laravelApiUrl.trim();
  if (laravelApiToken !== undefined && laravelApiToken !== '••••••••') {
    store.config.laravelApiToken = laravelApiToken.trim();
  }
  if (fetchEmployeeUrl !== undefined) store.config.fetchEmployeeUrl = fetchEmployeeUrl.trim();
  if (syncAttendanceUrl !== undefined) store.config.syncAttendanceUrl = syncAttendanceUrl.trim();
  if (syncSchedule !== undefined) store.config.syncSchedule = syncSchedule;
  if (attendanceFetchSchedule !== undefined) store.config.attendanceFetchSchedule = attendanceFetchSchedule;
  if (employeeSyncEnabled !== undefined) store.config.employeeSyncEnabled = Boolean(employeeSyncEnabled);
  if (attendanceSyncEnabled !== undefined) store.config.attendanceSyncEnabled = Boolean(attendanceSyncEnabled);
  if (admsPort !== undefined) {
    const newPort = parseInt(admsPort);
    if (newPort && newPort !== store.config.admsPort) {
      store.config.admsPort = newPort;
      restartADMSServer(newPort).catch(e => logger.error('ADMS restart failed: ' + e.message));
    }
  }

  // Apply schedule changes live (no restart needed)
  const scheduleChanged = syncSchedule !== undefined || attendanceFetchSchedule !== undefined ||
                          employeeSyncEnabled !== undefined || attendanceSyncEnabled !== undefined;
  if (scheduleChanged) updateSchedule();

  try {
    setEnvValues({
      LARAVEL_API_URL: laravelApiUrl ? store.config.laravelApiUrl : undefined,
      LARAVEL_API_TOKEN: laravelApiToken && laravelApiToken !== '••••••••' ? store.config.laravelApiToken : undefined,
      FETCH_EMPLOYEE_URL: fetchEmployeeUrl !== undefined ? store.config.fetchEmployeeUrl : undefined,
      SYNC_ATTENDANCE_URL: syncAttendanceUrl !== undefined ? store.config.syncAttendanceUrl : undefined,
      SYNC_SCHEDULE: syncSchedule !== undefined ? store.config.syncSchedule : undefined,
      ATTENDANCE_FETCH_SCHEDULE: attendanceFetchSchedule !== undefined ? store.config.attendanceFetchSchedule : undefined,
      EMPLOYEE_SYNC_ENABLED: employeeSyncEnabled !== undefined ? String(store.config.employeeSyncEnabled) : undefined,
      ATTENDANCE_SYNC_ENABLED: attendanceSyncEnabled !== undefined ? String(store.config.attendanceSyncEnabled) : undefined,
      ADMS_PORT: admsPort !== undefined ? store.config.admsPort : undefined,
    });
  } catch (e) {
    logger.warn('Could not persist config to .env: ' + e.message);
  }

  // Always save schedule/toggle state to data/config.json (more reliable than .env)
  saveConfigFile();

  res.json({ success: true, message: 'Config updated', schedulerStatus: getSchedulerStatus() });
});

// ── Branding (white-label) ──────────────────────────────────────
router.post('/branding', requireSuperAdmin, (req, res) => {
  const result = branding.saveBranding(req.body || {});
  if (!result.success) return res.status(400).json(result);
  res.json({ success: true, branding: branding.publicBranding() });
});

router.post('/branding/logo', requireSuperAdmin, (req, res) => {
  const result = branding.saveLogo(req.body?.dataUrl);
  if (!result.success) return res.status(400).json(result);
  res.json({ success: true, branding: branding.publicBranding() });
});

router.delete('/branding/logo', requireSuperAdmin, (req, res) => {
  branding.removeLogo();
  res.json({ success: true, branding: branding.publicBranding() });
});

// ── ERP ────────────────────────────────────────────────────────
router.post('/laravel/test', requirePerm('nav.settings'), async (req, res) => {
  const result = await testConnection();
  res.json(result);
});

// Fetch employees from API and return to UI (no device push)
router.get('/laravel/employees', requirePerm('employees.btn_load_laravel'), async (req, res) => {
  const result = await fetchEmployees();
  res.json(result);
});

// Push employee list to a specific device
router.post('/laravel/set-employees', requirePerm('employees.btn_set_device'), async (req, res) => {
  const { deviceId } = req.body;
  const empResult = await fetchEmployees();
  if (!empResult.success) return res.json({ success: false, error: empResult.error });

  const device = deviceId ? store.devices[deviceId] : null;
  const targets = device ? [device] : Object.values(store.devices).filter(d => d.status === 'connected');

  if (targets.length === 0) return res.json({ success: false, error: 'No connected devices found' });

  // Import fetched employees into bridge store so ADMS can pick them up
  for (const emp of empResult.employees) {
    const uid = parseInt(emp.uid || emp.id || emp.employee_id || emp.pin || 0);
    if (!uid) continue;
    upsertEmployee({
      uid,
      employee_id: String(emp.employee_id || emp.pin || emp.card_no || uid),
      name: emp.name || (emp.first_name ? emp.first_name + (emp.last_name ? ' ' + emp.last_name : '') : '') || '',
      password: emp.password || '',
      privilege: parseInt(emp.privilege || 0) || 0,
    });
  }

  const results = [];
  for (const d of targets) {
    if (d.type === 'tcp') {
      const r = await syncEmployeesToTCP(d.id, empResult.employees);
      results.push({ deviceId: d.id, ...r });
    } else if (d.type === 'adms') {
      // Queue DATA UPDATE command — device receives it on next heartbeat
      requestSetUserOnADMS(d.id, null)
        .then(() => logger.info(`ADMS ${d.id}: bulk employee sync OK`))
        .catch(e => logger.warn(`ADMS ${d.id}: bulk employee sync failed: ${e.message}`));
      results.push({ deviceId: d.id, success: true, queued: true, count: empResult.employees.length });
    }
  }
  res.json({ success: true, results, total: empResult.employees.length });
});

router.post('/laravel/sync-employees', requirePerm('employees.btn_set_device'), async (req, res) => {
  const result = await runEmployeeSync();
  res.json({ success: true, message: 'Employee sync triggered' });
});

router.post('/laravel/fetch-attendance', requirePerm('attendance.btn_push_laravel'), async (req, res) => {
  await runAttendanceFetch();
  res.json({ success: true, message: 'Attendance fetch triggered' });
});

router.post('/laravel/push-attendance', requirePerm('attendance.btn_push_laravel'), async (req, res) => {
  const allRecords = store.attendanceLogs;
  const unpushed   = allRecords.filter(r => !r.pushedToERP);
  const records    = req.body.onlyNew !== false ? unpushed : allRecords;
  if (!records.length) return res.json({ success: true, count: 0, message: 'All records already pushed' });
  logger.info(`Push to ERP: sending ${records.length} records in one request`);
  const result = await pushAttendance(records);
  if (result.success) markAttendancePushed(records.map(r => r.id));
  res.json({
    ...result,
    total: allRecords.length,
    pushed: records.length,
    alreadyPushed: allRecords.length - unpushed.length,
  });
});

// Full sync: TCP fetch → push all to ERP
router.post('/laravel/sync-all', requirePerm('attendance.btn_push_laravel'), async (req, res) => {
  const steps = [];

  // Step 1: fetch from TCP devices
  const tcpDevices = Object.values(store.devices).filter(d => d.type === 'tcp' && d.status === 'connected');
  let tcpFetched = 0;
  for (const d of tcpDevices) {
    try {
      const r = await fetchAttendanceFromTCP(d.id);
      tcpFetched += r.count || 0;
      steps.push({ step: 'tcp_fetch', device: d.id, success: r.success, count: r.count || 0, error: r.error });
    } catch (e) {
      steps.push({ step: 'tcp_fetch', device: d.id, success: false, error: e.message });
    }
  }

  // ADMS data is already in store (pushed in real-time)
  const admsRecords = store.attendanceLogs.filter(r => r.source === 'adms').length;

  // Step 2: push all unpushed records to ERP
  const unpushed = store.attendanceLogs.filter(r => !r.pushedToERP);
  let pushResult = { success: true, count: 0 };
  if (unpushed.length) {
    pushResult = await pushAttendance(unpushed);
    if (pushResult.success) markAttendancePushed(unpushed.map(r => r.id));
  }
  steps.push({ step: 'laravel_push', success: pushResult.success, count: pushResult.count || 0, error: pushResult.error });

  res.json({
    success: true,
    tcpFetched,
    admsRecords,
    pushed: pushResult.count || 0,
    alreadyPushed: store.attendanceLogs.length - unpushed.length,
    total: store.attendanceLogs.length,
    steps,
  });
});

// ── Ping Test ──────────────────────────────────────────────────────
router.get('/devices/ping', requirePerm('devices.card_ping_test'), (req, res) => {
  const ip = req.query.ip;
  if (!ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || ip.split('.').some(o => +o > 255)) {
    return res.status(400).json({ success: false, error: 'Invalid IP address' });
  }
  const start = Date.now();
  // IP is validated above, so it is safe to pass to the shell
  const cmd = process.platform === 'win32' ? `ping -n 1 -w 3000 ${ip}` : `ping -c 1 -W 3 ${ip}`;
  exec(cmd, { timeout: 5000, windowsHide: true }, (error, stdout) => {
    const elapsed = Date.now() - start;
    // Windows ping can exit 0 on "Destination host unreachable" — require a TTL in the reply
    if (error || (process.platform === 'win32' && !/TTL=/i.test(stdout))) {
      logger.info(`Ping failed for ${ip}`);
      return res.json({ success: true, reachable: false, ip, error: 'Host unreachable' });
    }
    const match = stdout.match(/time[=<]([\d.]+)\s*ms/);
    const rtt = match ? parseFloat(match[1]) : elapsed;
    res.json({ success: true, reachable: true, ip, rtt });
  });
});

// ── Devices ────────────────────────────────────────────────────────
router.get('/devices', (req, res) => {
  res.json({ devices: Object.values(store.devices) });
});

router.post('/devices/tcp/connect', requirePerm('devices.card_add_tcp'), async (req, res) => {
  const { ip, port, name, password } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP address required' });

  const result = await connectTCPDevice({ ip, port: port || 4370, name, password });
  res.json(result);
});

router.post('/devices/tcp/disconnect', requirePerm('devices.card_add_tcp'), async (req, res) => {
  const { deviceId } = req.body;
  await disconnectTCPDevice(deviceId);
  res.json({ success: true });
});

router.post('/devices/:deviceId/fetch-attendance', requirePerm('attendance.btn_fetch'), async (req, res) => {
  const { deviceId } = req.params;
  const device = store.devices[deviceId];
  if (!device) return res.status(404).json({ error: 'Device not found' });

  if (device.type === 'tcp') {
    const { fromDate, toDate } = req.body || {};
    const result = await fetchAttendanceFromTCP(deviceId, fromDate || null, toDate || null);
    return res.json(result);
  }
  res.json({ success: false, error: 'ADMS devices push automatically' });
});

// ── Push bridge employees to all ADMS/TCP devices ──────────────
// Only pushes employees not yet synced to device (syncedToDevice !== true)
router.post('/employees/push-to-devices', requirePerm('employees.btn_set_device'), async (req, res) => {
  const allEmps  = Object.values(store.employees);
  const unsynced = allEmps.filter(e => !e.syncedToDevice);

  if (!allEmps.length) return res.json({ success: false, error: 'No employees in bridge store. Add employees first.' });

  const connected = Object.values(store.devices).filter(d => d.status === 'connected');
  if (!connected.length) return res.json({ success: false, error: 'No connected devices found.' });

  if (!unsynced.length) {
    return res.json({ success: true, total: 0, skipped: allEmps.length, message: 'All employees already synced to device.' });
  }

  const results = [];
  for (const d of connected) {
    if (d.type === 'adms') {
      // Pass only unsynced employees, treat as new (isNew=true → DELETE+INSERT)
      requestSetUserOnADMS(d.id, null, true, unsynced)
        .then(synced => {
          const uids = (synced || unsynced).map(e => String(e.uid));
          markEmployeesSynced(uids);
          logger.info(`ADMS ${d.id}: ${uids.length} employees synced`);
        })
        .catch(e => logger.warn(`ADMS ${d.id}: push-to-devices failed: ${e.message}`));
      results.push({ deviceId: d.id, type: 'adms', queued: true, count: unsynced.length });
    } else if (d.type === 'tcp') {
      try {
        const r = await syncEmployeesToTCP(d.id, unsynced);
        if (r.success) markEmployeesSynced(unsynced.map(e => String(e.uid)));
        results.push({ deviceId: d.id, type: 'tcp', ...r });
      } catch (e) {
        results.push({ deviceId: d.id, type: 'tcp', success: false, error: e.message });
      }
    }
  }
  res.json({ success: true, total: unsynced.length, skipped: allEmps.length - unsynced.length, results });
});

// ── ERP → Bridge import ────────────────────────────────────────
// Fetch employees from ERP and save them all to bridge store
router.post('/employees/import-from-laravel', requirePerm('employees.btn_load_laravel'), async (req, res) => {
  const result = await fetchEmployees();
  if (!result.success) return res.json({ success: false, error: result.error });

  let imported = 0;
  for (const emp of result.employees) {
    const uid = parseEmpUid(emp);
    if (!uid) continue;
    upsertEmployee({
      uid,
      employee_id: String(emp.employee_id || emp.pin || emp.card_no || uid),
      name: emp.name || (emp.first_name ? (emp.first_name + (emp.last_name ? ' ' + emp.last_name : '')) : '') || '',
      password: emp.password || '',
      privilege: parseInt(emp.privilege || emp.role || 0) || 0,
    });
    imported++;
  }
  res.json({ success: true, imported, total: result.employees.length });
});

// ── Export employees ───────────────────────────────────────────────
// CSV format — importable by ZKBio Security / ZKTime.Net software
router.get('/employees/export.csv', requirePerm('employees.export_csv'), (req, res) => {
  const employees = Object.values(store.employees);
  const lines = ['Employee No,First Name,Last Name,Department,Card No,Password,Privilege'];
  for (const e of employees) {
    const nameParts = (e.name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName  = nameParts.slice(1).join(' ') || '';
    const pin       = e.employee_id || e.uid || '';
    const card      = e.card_no || '';
    const pass      = e.password || '';
    const priv      = e.privilege || 0;
    lines.push(`"${pin}","${firstName}","${lastName}","Default","${card}","${pass}",${priv}`);
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="employees.csv"');
  res.end('﻿' + lines.join('\r\n')); // BOM for Excel UTF-8 compatibility
});

// DAT format — ZKTeco USB drive import (user.dat)
router.get('/employees/export.dat', requirePerm('employees.export_dat'), (req, res) => {
  const employees = Object.values(store.employees);
  const lines = ['PIN\tName\tPri\tPasswd\tCard\tGrpTmp\tTimeZone\tVerify\tViceCard'];
  for (const e of employees) {
    const pin  = String(e.employee_id || e.uid || '');
    const name = (e.name || '').replace(/\t/g, ' ');
    const pri  = e.privilege || 0;
    const pass = e.password || '';
    lines.push(`${pin}\t${name}\t${pri}\t${pass}\t0\t1\t0000111100000000\t0\t0`);
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="user.dat"');
  res.end(lines.join('\r\n'));
});

// ── Bridge Employee Store (persisted, device-agnostic) ─────────────
// List all bridge-managed employees
router.get('/employees', requirePerm('nav.employees'), (req, res) => {
  res.json({ success: true, employees: Object.values(store.employees), total: Object.keys(store.employees).length });
});

// Load employees from device (or bridge store if device doesn't push)
router.post('/employees/load-from-device', requirePerm('employees.btn_load_machine'), async (req, res) => {
  const admsDevices = Object.values(store.devices).filter(d => d.type === 'adms' && d.status === 'connected');
  if (!admsDevices.length) {
    const synced = Object.values(store.employees).filter(e => e.syncedToDevice);
    return res.json({ success: true, employees: synced, source: 'bridge', total: synced.length, warning: 'No ADMS device connected — showing bridge-synced employees' });
  }

  const sn = admsDevices[0].id;

  // Always force a fresh device query — clear stale cache so edits/deletes are reflected
  delete deviceUserCache[sn];

  try {
    const result = await requestUsersFromADMS(sn);
    const employees = Array.isArray(result) ? result : (result.employees || []);

    // Import device employees into bridge store.
    // This is the authoritative import point — OPERLOG handler intentionally skips upsert.
    for (const e of employees) {
      if (e.uid > 0) upsertEmployee({ ...e, syncedToDevice: true });
    }
    if (employees.length > 0) markEmployeesSynced(employees.map(e => String(e.uid)));

    // Return bridge store versions (which have syncedToDevice, syncedAt, etc. set correctly)
    const bridgeEmps = employees
      .map(e => store.employees[String(e.uid)])
      .filter(Boolean);

    res.json({ success: true, employees: bridgeEmps, source: 'device', total: bridgeEmps.length });
  } catch (e) {
    const synced = Object.values(store.employees).filter(e => e.syncedToDevice);
    logger.warn(`Load from device failed (${e.message}), returning ${synced.length} bridge-synced employees`);
    res.json({
      success: true,
      employees: synced,
      source: 'bridge',
      total: synced.length,
      warning: `Device did not push user list. Showing ${synced.length} employee(s) confirmed synced to device.`,
    });
  }
});

// Create or update a bridge employee, then try to push to device
router.post('/employees', requirePerm('employees.btn_add_employee', 'employees.btn_edit_employee'), async (req, res) => {
  const emp = req.body;
  logger.info(`POST /employees body: uid=${emp.uid} name=${emp.name} employee_id=${emp.employee_id}`);
  if (!emp.uid || !emp.name) return res.status(400).json({ success: false, error: 'uid and name required' });

  // Only use UPDATE (tablename=UserInfo, preserves biometrics) when we have DIRECT
  // device confirmation via deviceUserCache (populated by Load from Machine).
  // syncedToDevice flag alone is unreliable — it can be stale if device was reset or
  // the user was deleted directly on the device. Any other case: DELETE+INSERT.
  const inDeviceCache = Object.values(deviceUserCache).some(
    c => c.employees && c.employees.some(e => String(e.uid) === String(emp.uid))
  );
  const isNew = !inDeviceCache;
  upsertEmployee(emp);

  const connectedDevices = Object.values(store.devices).filter(d => d.status === 'connected');

  // For TCP devices, wait for result (fast). For ADMS, fire-and-forget (takes up to 20s).
  const syncResults = [];
  const admsDevices = connectedDevices.filter(d => d.type === 'adms');
  const tcpDevices  = connectedDevices.filter(d => d.type === 'tcp');

  for (const device of tcpDevices) {
    try {
      const r = await setEmployeeOnDevice(device.id, emp);
      syncResults.push({ deviceId: device.id, synced: r.success, error: r.error });
    } catch (e) {
      syncResults.push({ deviceId: device.id, synced: false, error: e.message });
    }
  }

  // Respond immediately — don't block on ADMS round-trip
  res.json({ success: true, syncResults, admsQueued: admsDevices.length });

  // Sync ADMS devices in background
  for (const device of admsDevices) {
    requestSetUserOnADMS(device.id, emp, isNew)
      .then(() => {
        markEmployeesSynced([String(emp.uid)]);
        logger.info(`ADMS ${device.id}: employee ${emp.uid} synced OK`);
      })
      .catch(e => logger.warn(`ADMS ${device.id}: employee sync failed: ${e.message}`));
  }
});

// Delete a bridge employee, then try to remove from device
router.delete('/employees/:uid', requirePerm('employees.btn_delete_employee'), async (req, res) => {
  const { uid } = req.params;
  deleteEmployee(uid);

  const connectedDevices = Object.values(store.devices).filter(d => d.status === 'connected');
  const admsDevices = connectedDevices.filter(d => d.type === 'adms');
  const tcpDevices  = connectedDevices.filter(d => d.type === 'tcp');

  const syncResults = [];
  for (const device of tcpDevices) {
    try {
      const r = await deleteEmployeeFromDevice(device.id, uid);
      syncResults.push({ deviceId: device.id, synced: r.success });
    } catch (e) {
      syncResults.push({ deviceId: device.id, synced: false, error: e.message });
    }
  }

  // Respond immediately
  res.json({ success: true, syncResults, admsQueued: admsDevices.length });

  // Sync ADMS in background
  for (const device of admsDevices) {
    requestDeleteUserOnADMS(device.id, uid)
      .then(() => logger.info(`ADMS ${device.id}: employee ${uid} deleted OK`))
      .catch(e => logger.warn(`ADMS ${device.id}: employee delete sync failed: ${e.message}`));
  }
});

router.post('/devices/:deviceId/sync-employees', requirePerm('employees.btn_set_device'), async (req, res) => {
  const { deviceId } = req.params;
  const device = store.devices[deviceId];
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const empResult = await fetchEmployees();
  if (!empResult.success) return res.json({ success: false, error: empResult.error });

  if (device.type === 'tcp') {
    const result = await syncEmployeesToTCP(deviceId, empResult.employees);
    return res.json(result);
  }

  if (device.type === 'adms') {
    // Import fetched employees into bridge store first
    for (const emp of empResult.employees) {
      const uid = parseEmpUid(emp);
      if (!uid) continue;
      upsertEmployee({
        uid,
        employee_id: String(emp.employee_id || emp.pin || emp.card_no || uid),
        name: emp.name || (emp.first_name ? emp.first_name + (emp.last_name ? ' ' + emp.last_name : '') : '') || '',
        password: emp.password || '',
        privilege: parseInt(emp.privilege || 0) || 0,
      });
    }
    // Queue the sync — device picks it up on next heartbeat (within ~30s)
    requestSetUserOnADMS(deviceId, null)
      .then(() => logger.info(`ADMS ${deviceId}: sync-employees OK`))
      .catch(e => logger.warn(`ADMS ${deviceId}: sync-employees failed: ${e.message}`));
    return res.json({ success: true, queued: true, count: empResult.employees.length, message: 'Sync queued — device will update on next heartbeat' });
  }

  res.json({ success: false, error: 'Unknown device type' });
});

// Fetch all historical attendance from ADMS device
router.post('/devices/:deviceId/fetch-attlogs', requirePerm('attendance.btn_fetch_adms'), async (req, res) => {
  const { deviceId } = req.params;
  const device = store.devices[deviceId];
  if (!device) return res.status(404).json({ error: 'Device not found' });
  if (device.type !== 'adms') return res.json({ success: false, error: 'Only ADMS devices support this' });
  const { fromDate, toDate } = req.body || {};
  try {
    await requestAttLogsFromADMS(deviceId, fromDate || null, toDate || null);
    res.json({ success: true, message: 'Attendance fetch queued. Device will push logs on next heartbeat (within 10s).' });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ── Attendance Logs ────────────────────────────────────────────────
router.get('/attendance', requirePerm('nav.attendance'), (req, res) => {
  const limit    = parseInt(req.query.limit) || 5000;
  const deviceId = req.query.deviceId;
  const fromDate = req.query.fromDate || null;
  const toDate   = req.query.toDate   || null;
  let logs = store.attendanceLogs;
  if (deviceId) logs = logs.filter(l => l.deviceId === deviceId);
  if (fromDate) {
    const from = new Date(fromDate + 'T00:00:00');
    logs = logs.filter(l => new Date(l.time) >= from);
  }
  if (toDate) {
    const to = new Date(toDate + 'T23:59:59');
    logs = logs.filter(l => new Date(l.time) <= to);
  }
  res.json({ records: logs.slice(0, limit), total: store.attendanceLogs.length, filtered: logs.length });
});

// ── Sync Log ───────────────────────────────────────────────────────
router.get('/sync-log', (req, res) => {
  res.json({ log: store.syncLog });
});

// ── Server restart ─────────────────────────────────────────────────
router.post('/server/restart', requirePerm('nav.settings'), (req, res) => {
  res.json({ success: true, message: 'Restarting...' });
  setTimeout(restartProcess, 300);
});

// ── Clear Logs ─────────────────────────────────────────────────────
router.post('/logs/clear', requirePerm('nav.logs'), (req, res) => {
  clearLogs();
  // Also truncate the log file
  try {
    const logPath = path.join(__dirname, '../logs/combined.log');
    if (fs.existsSync(logPath)) fs.writeFileSync(logPath, '');
  } catch (e) {
    logger.warn('Could not clear log file: ' + e.message);
  }
  res.json({ success: true, message: 'Logs cleared' });
});

// ── Logs (file) ────────────────────────────────────────────────────
router.get('/logs', requirePerm('nav.logs'), (req, res) => {
  const logPath = path.join(__dirname, '../logs/combined.log');
  try {
    if (!fs.existsSync(logPath)) return res.json({ lines: [] });
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.trim().split('\n').slice(-100).reverse();
    res.json({ lines });
  } catch {
    res.json({ lines: [] });
  }
});

module.exports = router;
