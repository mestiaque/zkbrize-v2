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
const NAME = 'AttendBridge';
const DESCRIPTION = 'ZKTeco attendance device to ERP bridge';
const UNIT_NAME = 'attendbridge';
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

const WIN_ID = 'attendbridge';                 // service name is "attendbridge.exe"
const WIN_SERVICE = WIN_ID + '.exe';

// node-windows only builds the WinSW config + exe here. Install/start are run
// directly (we are already elevated), because node-windows' own "elevate" helper
// returns before the command has finished.
function windowsService() {
  let Service, winsw;
  try {
    ({ Service } = require('node-windows'));
    winsw = require('node-windows/lib/winsw');
  } catch { fail('node-windows is not installed. Run "npm install" first.'); }
  const svc = new Service({
    name: NAME,
    description: DESCRIPTION,
    script: SCRIPT,
    workingDirectory: ROOT,
    maxRestarts: 10,
    env: [{ name: 'ATTENDBRIDGE_SERVICE', value: '1' }],
  });
  return { svc, winsw, dir: svc.directory() };
}

function winServiceState() {
  try { return execSync(`sc query "${WIN_SERVICE}"`, { encoding: 'utf8' }); } catch { return null; }
}

function run(cmd) {
  try { execSync(cmd, { stdio: 'inherit' }); return true; } catch { return false; }
}

function windows() {
  if (action === 'status') {
    const state = winServiceState();
    console.log(state ? state : `[service] "${NAME}" is not installed.`);
    return;
  }
  if (!isWindowsAdmin()) {
    fail('Administrator rights are required. Right-click install-service.bat and choose "Run as administrator".');
  }
  const { svc, winsw, dir } = windowsService();
  const exe = path.join(dir, WIN_SERVICE);

  if (action === 'install') {
    if (!winServiceState()) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, WIN_ID + '.xml'), svc._xml);
      winsw.createExe(WIN_ID, dir);
      if (!run(`"${exe}" install`)) fail('Could not register the Windows service.');
    } else {
      console.log(`[service] "${NAME}" is already installed.`);
    }
    if (!/RUNNING/.test(winServiceState() || '') && !run(`net start "${WIN_SERVICE}"`)) {
      fail(`The service was installed but did not start. See the logs in ${dir}`);
    }
    console.log(`[service] "${NAME}" is running and will start automatically with Windows.`);
    console.log(`[service] Open http://localhost:${readPort()}`);
  } else {
    if (!winServiceState()) { console.log(`[service] "${NAME}" is not installed.`); return; }
    if (/RUNNING/.test(winServiceState() || '')) run(`net stop "${WIN_SERVICE}"`);
    if (fs.existsSync(exe)) run(`"${exe}" uninstall`);
    else run(`sc delete "${WIN_SERVICE}"`);
    for (const f of [WIN_SERVICE, WIN_SERVICE + '.config', WIN_ID + '.xml']) {
      try { fs.unlinkSync(path.join(dir, f)); } catch {}
    }
    console.log(`[service] Removed "${NAME}".`);
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
Environment=ATTENDBRIDGE_SERVICE=1
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
