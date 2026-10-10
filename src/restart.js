const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// Under a process manager (PM2, or our Windows service / systemd unit, which set
// ZKB_SERVICE) exiting is enough — the manager starts us again. Otherwise we spawn
// a detached copy first. (INVOCATION_ID is not used: it leaks into every process
// started from any systemd unit, including desktop terminals.)
function isManaged() {
  return !!(process.env.pm_id || process.env.ZKB_SERVICE);
}

let shutdownHooks = [];
function onShutdown(fn) { shutdownHooks.push(fn); }

async function closeAll() {
  for (const fn of shutdownHooks) {
    try { await fn(); } catch (e) { logger.warn('Shutdown hook failed: ' + e.message); }
  }
}

async function restartProcess() {
  logger.info('Restart requested');
  await closeAll();
  if (!isManaged()) {
    const root = path.join(__dirname, '..');
    const out = fs.openSync(path.join(root, 'logs', 'server.log'), 'a');
    // Drop values that came from .env so the new process re-reads the saved file
    const env = { ...process.env };
    try {
      const fromFile = require('dotenv').parse(fs.readFileSync(path.join(root, '.env')));
      for (const k of Object.keys(fromFile)) delete env[k];
    } catch {}
    const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
      cwd: root, env, detached: true, stdio: ['ignore', out, out], windowsHide: true,
    });
    child.unref();
  }
  setTimeout(() => process.exit(0), 200);
}

module.exports = { restartProcess, onShutdown, closeAll, isManaged };
