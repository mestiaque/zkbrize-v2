const { store } = require('./store');

// Attendance analytics for the dashboard. Punch times are the device's local
// time ("YYYY-MM-DD HH:MM:SS"), so dates are taken from the string directly —
// never converted through a timezone.

const pad = n => String(n).padStart(2, '0');
const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const METHOD_NAMES = { '0': 'Password', '1': 'Fingerprint', '2': 'Face', '3': 'Card', '4': 'Fingerprint', '15': 'Face' };

function minutesOf(time) {
  const m = /(\d{1,2}):(\d{2})/.exec(String(time).slice(11));
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null;
}

function lateThreshold() {
  const m = /^(\d{1,2}):(\d{2})$/.exec(store.config.workStartTime || '09:00');
  const start = m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 540;
  return start + (parseInt(store.config.lateGraceMinutes) || 0);
}

// Known employees by the ID they punch with (employee_id, falling back to uid)
function employeeIndex() {
  const byId = new Map();
  for (const e of Object.values(store.employees)) {
    const id = String(e.employee_id || e.uid || '');
    if (id) byId.set(id, e);
  }
  return byId;
}

function buildAnalytics(days = 7) {
  days = Math.min(Math.max(parseInt(days) || 7, 1), 90);
  const today = dateStr(new Date());
  const dates = [];
  for (let i = days - 1; i >= 0; i--) dates.push(dateStr(new Date(Date.now() - i * 86400000)));
  const first = dates[0];
  const threshold = lateThreshold();
  const employees = employeeIndex();

  // First punch per employee per day, plus counters
  const firstPunch = new Map();          // `${date}|${emp}` -> record
  const hourly = Array(24).fill(0);      // today's first punches by hour
  const methods = {};
  const devices = {};
  let punchesToday = 0;

  for (const r of store.attendanceLogs) {
    const date = String(r.time).slice(0, 10);
    if (date < first || date > today) continue;
    const key = `${date}|${r.employeeId}`;
    const prev = firstPunch.get(key);
    if (!prev || String(r.time) < String(prev.time)) firstPunch.set(key, r);
    const method = r.verifyMethod
      ? r.verifyMethod.charAt(0).toUpperCase() + r.verifyMethod.slice(1)
      : (METHOD_NAMES[String(r.verify)] || 'Unknown');
    methods[method] = (methods[method] || 0) + 1;
    if (date === today) {
      punchesToday++;
      const name = store.devices[r.deviceId]?.name || r.deviceId;
      devices[name] = (devices[name] || 0) + 1;
    }
  }

  const perDay = Object.fromEntries(dates.map(d => [d, { date: d, onTime: 0, late: 0 }]));
  const lateToday = [];
  const presentToday = new Set();
  for (const [key, r] of firstPunch) {
    const [date, emp] = key.split('|');
    const mins = minutesOf(r.time);
    const late = mins !== null && mins > threshold;
    perDay[date][late ? 'late' : 'onTime']++;
    if (date === today) {
      presentToday.add(emp);
      if (mins !== null) hourly[Math.floor(mins / 60)]++;
      if (late) {
        const e = employees.get(String(emp));
        lateToday.push({
          employeeId: emp,
          name: e?.name || '',
          time: String(r.time).slice(11, 16),
          minutesLate: mins - threshold + (parseInt(store.config.lateGraceMinutes) || 0),
        });
      }
    }
  }
  lateToday.sort((a, b) => b.minutesLate - a.minutesLate);

  const knownPresent = [...presentToday].filter(id => employees.has(String(id))).length;
  const totalEmployees = employees.size;
  const pending = store.attendanceLogs.filter(r => !r.pushedToERP).length;

  return {
    today,
    rules: { workStartTime: store.config.workStartTime || '09:00', lateGraceMinutes: parseInt(store.config.lateGraceMinutes) || 0 },
    summary: {
      present: presentToday.size,
      late: lateToday.length,
      onTime: presentToday.size - lateToday.length,
      totalEmployees,
      absent: totalEmployees ? Math.max(totalEmployees - knownPresent, 0) : null,
      punchesToday,
      pendingPush: pending,
    },
    hourly,
    daily: dates.map(d => perDay[d]),
    methods: Object.entries(methods).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    devices: Object.entries(devices).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    lateToday: lateToday.slice(0, 50),
  };
}

module.exports = { buildAnalytics };
