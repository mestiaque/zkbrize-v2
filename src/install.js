const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const logger = require('./logger');
const { store } = require('./store');
const { createUser, hasAnyLogin } = require('./auth');
const { setEnvValues } = require('./envfile');
const branding = require('./branding');
const { testConnectionWith } = require('./laravel/api');
const { restartADMSServer } = require('./adms/server');

const ROOT = path.join(__dirname, '..');
const LOCK_FILE = path.join(ROOT, 'data', 'installed.json');

// Existing deployments (users or MASTER_PASSWORD already set) count as installed
function isInstalled() {
  return fs.existsSync(LOCK_FILE) || hasAnyLogin();
}

function writable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch { return false; }
}

function lanIp() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) return i.address;
  }
  return '';
}

const router = express.Router();

// Every install endpoint is closed for good once setup has finished
router.use((req, res, next) => {
  if (isInstalled()) return res.status(403).json({ success: false, error: 'Already installed' });
  next();
});

router.get('/status', (req, res) => {
  const major = parseInt(process.versions.node);
  res.json({
    installed: false,
    checks: [
      { name: `Node.js ${process.versions.node}`, ok: major >= 20, hint: 'Node.js 20 or newer is required' },
      { name: 'data/ folder is writable', ok: writable(path.join(ROOT, 'data')), hint: 'Give the app write access to the data folder' },
      { name: 'logs/ folder is writable', ok: writable(path.join(ROOT, 'logs')), hint: 'Give the app write access to the logs folder' },
    ],
    admsPort: store.config.admsPort,
    serverIp: lanIp(),
    branding: branding.getBranding(),
  });
});

router.post('/test-erp', async (req, res) => {
  const { url, token } = req.body || {};
  if (!/^https?:\/\//i.test(url || '')) return res.json({ success: false, message: 'Enter a valid http(s) URL' });
  res.json(await testConnectionWith(url, token));
});

router.post('/', async (req, res) => {
  const { admin = {}, erp = {}, brand = {}, admsPort } = req.body || {};

  // ── Validate everything before writing anything ──
  if (!/^[A-Za-z0-9._@-]{3,32}$/.test(admin.username || '')) {
    return res.status(400).json({ success: false, error: 'Username must be 3-32 characters (letters, numbers, . _ @ -)' });
  }
  if (typeof admin.password !== 'string' || admin.password.length < 8) {
    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
  }
  for (const k of ['url', 'fetchEmployeeUrl', 'syncAttendanceUrl']) {
    if (erp[k] && !/^https?:\/\/\S+$/i.test(erp[k])) {
      return res.status(400).json({ success: false, error: 'ERP URLs must start with http:// or https://' });
    }
  }
  if (Object.values(erp).some(v => /[\r\n\0]/.test(String(v ?? '')))) {
    return res.status(400).json({ success: false, error: 'Invalid characters in ERP settings' });
  }
  const port = parseInt(admsPort) || store.config.admsPort;
  if (!(port >= 1024 && port <= 65535)) {
    return res.status(400).json({ success: false, error: 'ADMS port must be 1024-65535' });
  }

  const brandErr = branding.validateBranding(brand || {}).error;
  if (brandErr) return res.status(400).json({ success: false, error: brandErr });

  // ── Apply ──
  const created = createUser(admin.username, admin.password, 'superadmin', { owner: true });
  if (!created.success) return res.status(400).json(created);

  if (brand && Object.keys(brand).length) {
    branding.saveBranding(brand);
  }

  store.config.laravelApiUrl     = (erp.url || '').trim();
  store.config.laravelApiToken   = (erp.token || '').trim();
  store.config.fetchEmployeeUrl  = (erp.fetchEmployeeUrl || '').trim();
  store.config.syncAttendanceUrl = (erp.syncAttendanceUrl || '').trim();
  try {
    setEnvValues({
      LARAVEL_API_URL: store.config.laravelApiUrl,
      LARAVEL_API_TOKEN: store.config.laravelApiToken,
      FETCH_EMPLOYEE_URL: store.config.fetchEmployeeUrl,
      SYNC_ATTENDANCE_URL: store.config.syncAttendanceUrl,
      ADMS_PORT: port,
    });
  } catch (e) {
    logger.warn('Install: could not write .env: ' + e.message);
  }
  if (port !== store.config.admsPort) {
    store.config.admsPort = port;
    restartADMSServer(port).catch(e => logger.error('ADMS restart failed: ' + e.message));
  }

  fs.writeFileSync(LOCK_FILE, JSON.stringify({ installedAt: new Date().toISOString() }, null, 2));
  logger.info(`Installation completed — superadmin "${admin.username}" created`);

  // Sign the new admin straight in
  req.session.regenerate(err => {
    if (!err) req.session.user = created.user;
    res.json({ success: true });
  });
});

module.exports = { installRouter: router, isInstalled };
