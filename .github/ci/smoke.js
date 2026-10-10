// End-to-end smoke test used by CI on Windows and Linux.
//   node .github/ci/smoke.js full      → starts the server itself, runs the install wizard, tests, stops it
//   node .github/ci/smoke.js running   → server is already running (e.g. as a service): login + restart test
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const PORT = (env.match(/^PORT=(\d+)/m) || [])[1] || '3000';
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN = { username: 'ciadmin', password: 'CiPassword123' };
const ADMS_PORT = 7201;

const mode = process.argv[2] || 'full';
let cookie = '';
let failures = 0;

function ok(cond, msg) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) {
    failures++;
    if (process.env.GITHUB_ACTIONS) console.log(`::error title=smoke (${mode})::${msg}`);
  }
}

async function req(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data, location: res.headers.get('location') };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitUp(timeoutMs = 30000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { await fetch(BASE + '/api/branding'); return true; } catch {}
    await sleep(500);
  }
  return false;
}

async function waitDown(timeoutMs = 15000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { await fetch(BASE + '/api/branding'); } catch { return true; }
    await sleep(200);
  }
  return false;
}

async function login() {
  cookie = '';
  const r = await req('POST', '/api/auth/login', ADMIN);
  return r.data?.success === true;
}

async function admsUp() {
  try {
    const r = await fetch(`http://127.0.0.1:${ADMS_PORT}/iclock/cdata?SN=CI0001&options=all`);
    return r.status === 200;
  } catch { return false; }
}

async function restartTest() {
  const r = await req('POST', '/api/server/restart', {});
  ok(r.data?.success, 'restart accepted');
  // The server may come back quickly; give it time to go down first
  await waitDown(5000);
  ok(await waitUp(), 'server is back after restart');
  ok(await login(), 'login after restart');
  ok(await admsUp(), `ADMS port ${ADMS_PORT} listening after restart`);
}

async function full() {
  const child = spawn(process.execPath, [path.join(ROOT, 'src', 'server.js')], { cwd: ROOT, stdio: 'inherit' });
  ok(await waitUp(), 'server started');

  const home = await req('GET', '/');
  ok(home.status === 302 && /\/install$/.test(home.location || ''), 'redirects to /install before setup');

  const status = await req('GET', '/api/install/status');
  ok(status.data?.checks?.every(c => c.ok), 'system checks pass: ' + JSON.stringify(status.data?.checks?.map(c => c.name)));

  const bad = await req('POST', '/api/install', { admin: { username: 'x', password: '1' } });
  ok(bad.status === 400, 'install rejects invalid admin');

  const inst = await req('POST', '/api/install', {
    admin: ADMIN, erp: { url: '' }, brand: { appName: 'CI Bridge', companyName: 'CI' }, admsPort: ADMS_PORT,
  });
  ok(inst.data?.success, 'install completes');
  const again = await req('POST', '/api/install', { admin: ADMIN });
  ok(again.status === 403, 'install is closed after setup');

  const me = await req('GET', '/api/auth/me');
  ok(me.data?.role === 'superadmin', 'signed in as superadmin after install');

  const brand = await req('GET', '/api/branding');
  ok(brand.data?.appName === 'CI Bridge', 'branding saved');

  const ping = await req('GET', '/api/devices/ping?ip=127.0.0.1');
  ok(ping.data?.reachable === true, `ping 127.0.0.1 (${process.platform})`);

  const badCron = await req('POST', '/api/config', { syncSchedule: 'not a cron' });
  ok(badCron.status === 400, 'invalid cron rejected');

  ok(await admsUp(), `ADMS port ${ADMS_PORT} listening`);

  // Permissions: a viewer must not change settings
  await req('POST', '/api/auth/users/create', { username: 'civiewer', password: 'Viewer12345', role: 'viewer' });
  const adminCookie = cookie;
  cookie = '';
  await req('POST', '/api/auth/login', { username: 'civiewer', password: 'Viewer12345' });
  const forbidden = await req('POST', '/api/config', { syncSchedule: '*/5 * * * *' });
  ok(forbidden.status === 403, 'viewer cannot change settings');
  const delEmp = await req('DELETE', '/api/employees/1');
  ok(delEmp.status === 403, 'viewer cannot delete employees');
  cookie = adminCookie;

  const anon = await fetch(BASE + '/api/state');
  ok(anon.status === 401, 'API requires login');

  await restartTest();

  // Stop the (restarted, detached) server via its pid file
  await sleep(500);
  const pid = parseInt(fs.readFileSync(path.join(ROOT, 'logs', 'server.pid'), 'utf8'));
  try { process.kill(pid); } catch {}
  try { child.kill(); } catch {}
  ok(await waitDown(), 'server stopped');
}

async function running() {
  ok(await waitUp(60000), 'service is answering');
  ok(await login(), 'login against service');
  await restartTest();
}

(mode === 'full' ? full() : running())
  .catch(e => { console.error(e); failures++; })
  .finally(() => {
    console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
    process.exit(failures ? 1 : 0);
  });
