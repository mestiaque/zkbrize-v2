// Demo mode (DEMO_MODE=true in .env): a public showcase without real devices,
// e.g. on shared hosting. It keeps a demo company's employees, devices and punches
// up to date — today's punches appear as their time passes — and adds a read-only
// account that the sign-in page shows. Nothing here runs unless DEMO_MODE is on.
const logger = require('./logger');
const {
  store, addDevice, updateDevice, addAttendanceLog, markAttendancePushed,
  upsertEmployee, markEmployeesSynced, addSyncLog,
} = require('./store');
const { loadUsers, createUser } = require('./auth');

const enabled = process.env.DEMO_MODE === 'true';
const USERNAME = process.env.DEMO_USERNAME || 'demo';
const PASSWORD = process.env.DEMO_PASSWORD || 'demo1234';
const REFRESH_MS = 5 * 60 * 1000;

const DEVICES = [
  { id: 'CQZ7224460123', sn: 'CQZ7224460123', type: 'adms', name: 'Main Entrance', ip: '192.168.1.201', model: 'SpeedFace-V5L' },
  { id: 'CQZ7224460456', sn: 'CQZ7224460456', type: 'adms', name: 'Factory Floor', ip: '192.168.1.202', model: 'MB460' },
  { id: '192.168.1.210:4370', sn: 'BWXP201760042', type: 'tcp', name: 'Warehouse Gate', ip: '192.168.1.210', port: 4370, model: 'K40' },
];
const DEVICE_IDS = new Set(DEVICES.map(d => d.id));

const EMPLOYEES = ['Ayesha Rahman', 'Tanvir Hasan', 'Farhana Akter', 'Mahmudul Hasan', 'Nusrat Jahan', 'Rakibul Islam',
  'Sharmin Sultana', 'Kamal Uddin', 'Shirin Akter', 'Rafiq Islam', 'Jannat Ara', 'Sohel Rana']
  .map((name, i) => ({ uid: i + 1, employee_id: String(1001 + i), name, privilege: i === 7 ? 14 : 0, password: '' }));

const VERIFY = { '1': 'fingerprint', '2': 'face', '3': 'card' };

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const stamp = d => `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

// Same date → same punches, so refreshing never adds duplicates
function rng(seedText) {
  let h = 2166136261;
  for (const c of seedText) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function punchesFor(date) {
  const day = ymd(date);
  const r = rng(day);
  const at = minutes => `${day} ${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:${pad(Math.floor(r() * 60))}`;
  const punches = [];
  EMPLOYEES.forEach((e, i) => {
    if (r() < 0.07) return; // the odd absence
    const late = r() < 0.2;
    const arrive = late ? 9 * 60 + 16 + Math.floor(r() * 40) : 8 * 60 + 30 + Math.floor(r() * 30);
    const leave = 17 * 60 + Math.floor(r() * 45);
    const device = DEVICES[i % DEVICES.length];
    const verify = ['1', '2', '3', '1', '2'][i % 5];
    for (const [status, minutes] of [['0', arrive], ['1', leave]]) {
      punches.push({
        deviceId: device.id,
        employeeId: e.employee_id,
        time: at(minutes),
        status,
        verify,
        verifyMethod: VERIFY[verify],
        source: device.type,
      });
    }
  });
  return punches;
}

// The read-only account is added only after the setup wizard created the owner,
// so it never counts as "installed" or becomes the owner itself
function ensureDemoUser() {
  if (!enabled) return;
  const users = loadUsers();
  if (!users.some(u => u.owner)) return;
  if (users.some(u => u.username.toLowerCase() === USERNAME.toLowerCase())) return;
  const r = createUser(USERNAME, PASSWORD, 'admin');
  if (r.success) logger.info(`Demo mode: read-only account "${USERNAME}" created`);
}

function refresh() {
  for (const d of DEVICES) {
    if (store.devices[d.id]) updateDevice(d.id, { status: 'connected', error: null });
    else addDevice({ ...d });
  }

  const now = new Date();
  const nowText = stamp(now);
  let added = 0;
  for (let back = 6; back >= 0; back--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    for (const p of punchesFor(date)) {
      if (p.time <= nowText && addAttendanceLog(p)) added++;
    }
  }

  // Earlier days count as delivered to the ERP; today's punches wait for the next push
  const today = ymd(now);
  const delivered = store.attendanceLogs
    .filter(r => !r.pushedToERP && DEVICE_IDS.has(r.deviceId) && String(r.time).slice(0, 10) < today)
    .map(r => r.id);
  if (delivered.length) {
    markAttendancePushed(delivered);
    addSyncLog({ type: 'attendance_push', status: 'success', count: delivered.length, message: `Pushed ${delivered.length} attendance records` });
  }
  if (added) logger.info(`Demo mode: ${added} punches added`);
  ensureDemoUser();
}

function start() {
  if (!enabled) return;
  logger.info(`Demo mode is on: demo data, read-only account "${USERNAME}", no ADMS listener`);
  for (const e of EMPLOYEES) {
    if (!store.employees[String(e.uid)]) upsertEmployee(e);
  }
  markEmployeesSynced(EMPLOYEES.slice(0, 10).map(e => String(e.uid)));
  addSyncLog({ type: 'employee_fetch', status: 'success', count: EMPLOYEES.length, message: `Fetched ${EMPLOYEES.length} employees` });
  refresh();
  setInterval(refresh, REFRESH_MS).unref();
}

// The demo account may look at everything but change nothing
function isReadOnly(req) {
  return enabled && String(req.session?.user?.username || '').toLowerCase() === USERNAME.toLowerCase();
}

function publicInfo() {
  ensureDemoUser();
  return enabled ? { enabled: true, username: USERNAME, password: PASSWORD } : { enabled: false };
}

module.exports = { enabled, start, isReadOnly, publicInfo };
