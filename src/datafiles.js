const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const LOGS_DIR = path.join(ROOT, 'logs');

// Creates the data/ and logs/ folders and every data file the app reads or
// writes, with default contents. Existing files are never touched.
function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(LOGS_DIR, { recursive: true });

  const { DEFAULT_PERMISSIONS, store } = require('./store');
  const { DEFAULT_ROLES } = require('./auth');
  const { DEFAULTS: BRANDING_DEFAULTS } = require('./branding');

  const files = {
    'users.json':       [],
    'roles.json':       DEFAULT_ROLES,
    'permissions.json': DEFAULT_PERMISSIONS,
    'employees.json':   {},
    'branding.json':    BRANDING_DEFAULTS,
    'config.json': {
      syncSchedule: store.config.syncSchedule,
      attendanceFetchSchedule: store.config.attendanceFetchSchedule,
      employeeSyncEnabled: store.config.employeeSyncEnabled !== false,
      attendanceSyncEnabled: store.config.attendanceSyncEnabled !== false,
    },
  };

  for (const [name, value] of Object.entries(files)) {
    const file = path.join(DATA_DIR, name);
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(value, null, 2));
  }
}

module.exports = { ensureDataFiles, DATA_DIR, LOGS_DIR };
