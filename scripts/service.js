// Install / uninstall the bridge as a background service that starts with the computer.
//   Windows: Windows Service (via node-windows) — run from an Administrator prompt
//   Linux:   systemd unit — run with sudo
//
//   node scripts/service.js install | uninstall | status
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'src', 'server.js');
const NAME = 'ZK Bridge';
const DESCRIPTION = 'ZKTeco attendance device to ERP bridge';
const UNIT_NAME = 'zk-bridge';
const UNIT_FILE = `/etc/systemd/system/${UNIT_NAME}.service`;

const action = process.argv[2];

function fail(msg) {
  console.error('[service] ' + msg);
  process.exit(1);
}

function readPort() {
  try {
    const m = fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(/^PORT=(\d+)/m);
    if (m) return m[1];
  } catch {}
  return '3000';
}

// ── Windows ────────────────────────────────────────────────────────

function isWindowsAdmin() {
  try { execSync('net session', { stdio: 'ignore' }); return true; } catch { return false; }
}

function windowsService() {
  let Service;
  try { ({ Service } = require('node-windows')); }
  catch { fail('node-windows is not installed. Run "npm install" first.'); }
  return new Service({
    name: NAME,
    description: DESCRIPTION,
    script: SCRIPT,
    workingDirectory: ROOT,
    maxRestarts: 10,
    env: [{ name: 'ZKB_SERVICE', value: '1' }],
  });
}

function windows() {
  if (action !== 'status' && !isWindowsAdmin()) {
    fail('Administrator rights are required. Right-click install-service.bat and choose "Run as administrator".');
  }
  const svc = windowsService();

  if (action === 'status') {
    console.log(svc.exists ? `[service] "${NAME}" is installed.` : `[service] "${NAME}" is not installed.`);
    return;
  }

  if (action === 'install') {
    svc.on('install', () => {
      svc.start();
      console.log(`[service] Installed and started "${NAME}". It will start automatically with Windows.`);
      console.log(`[service] Open http://localhost:${readPort()}`);
    });
    svc.on('alreadyinstalled', () => {
      console.log(`[service] "${NAME}" is already installed. Starting it...`);
      svc.start();
    });
    svc.on('error', e => fail(String(e)));
    svc.install();
  } else {
    svc.on('uninstall', () => console.log(`[service] Removed "${NAME}".`));
    svc.on('alreadyuninstalled', () => console.log(`[service] "${NAME}" is not installed.`));
    svc.on('error', e => fail(String(e)));
    svc.uninstall();
  }
}

// ── Linux (systemd) ────────────────────────────────────────────────

function sh(cmd) { execSync(cmd, { stdio: 'inherit' }); }

function linux() {
  if (action === 'status') {
    try { sh(`systemctl --no-pager status ${UNIT_NAME}`); } catch {}
    return;
  }
  if (process.getuid() !== 0) fail('Root rights are required. Run: sudo node scripts/service.js ' + action);
  try { execSync('systemctl --version', { stdio: 'ignore' }); }
  catch { fail('systemd was not found. Use PM2 instead: npm i -g pm2 && pm2 start ecosystem.config.js && pm2 save && pm2 startup'); }

  if (action === 'install') {
    // Run as the user who called sudo, so data/ and logs/ keep the right owner
    const user = process.env.SUDO_USER && process.env.SUDO_USER !== 'root' ? process.env.SUDO_USER : 'root';
    const unit = `[Unit]
Description=${DESCRIPTION}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${user}
WorkingDirectory=${ROOT}
ExecStart=${process.execPath} ${SCRIPT}
Environment=ZKB_SERVICE=1
Environment=NODE_ENV=production
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
`;
    fs.writeFileSync(UNIT_FILE, unit);
    sh('systemctl daemon-reload');
    sh(`systemctl enable --now ${UNIT_NAME}`);
    console.log(`[service] Installed and started "${UNIT_NAME}" (runs as ${user}). It will start automatically on boot.`);
    console.log(`[service] Open http://localhost:${readPort()}   Logs: journalctl -u ${UNIT_NAME} -f`);
  } else {
    if (!fs.existsSync(UNIT_FILE)) { console.log(`[service] "${UNIT_NAME}" is not installed.`); return; }
    try { sh(`systemctl disable --now ${UNIT_NAME}`); } catch {}
    fs.unlinkSync(UNIT_FILE);
    sh('systemctl daemon-reload');
    console.log(`[service] Removed "${UNIT_NAME}".`);
  }
}

if (!['install', 'uninstall', 'status'].includes(action)) {
  console.log('Usage: node scripts/service.js install | uninstall | status');
  process.exit(1);
}

if (process.platform === 'win32') windows();
else if (process.platform === 'linux') linux();
else fail('Service install is supported on Windows and Linux. On macOS use PM2.');
