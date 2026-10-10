require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const { store, loadConfigFile } = require('./store');
const routes = require('./routes');
const authRoutes = require('./authRoutes');
const { requireAuth, requireSuperAdmin } = require('./auth');
const { installRouter, isInstalled } = require('./install');
const branding = require('./branding');
const { setEnvValues } = require('./envfile');
const { onShutdown, closeAll } = require('./restart');
const { startADMSServer, stopADMSServer, setSocketIO: admsSetIO } = require('./adms/server');
const { setSocketIO: tcpSetIO } = require('./tcpip/connector');
const { startScheduler, setSocketIO: schedSetIO } = require('./scheduler');

// Load config from env
store.config.laravelApiUrl = process.env.LARAVEL_API_URL || '';
store.config.laravelApiToken = process.env.LARAVEL_API_TOKEN || '';
store.config.fetchEmployeeUrl = process.env.FETCH_EMPLOYEE_URL || '';
store.config.syncAttendanceUrl = process.env.SYNC_ATTENDANCE_URL || '';
store.config.admsPort = parseInt(process.env.ADMS_PORT) || 5015;
store.config.syncSchedule = process.env.SYNC_SCHEDULE || '*/30 * * * *';
store.config.attendanceFetchSchedule = process.env.ATTENDANCE_FETCH_SCHEDULE || '*/15 * * * *';
store.config.employeeSyncEnabled     = process.env.EMPLOYEE_SYNC_ENABLED !== 'false';
store.config.attendanceSyncEnabled   = process.env.ATTENDANCE_SYNC_ENABLED !== 'false';
loadConfigFile();

const PORT = parseInt(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Keep one secret across restarts so users stay signed in
let SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  try { setEnvValues({ SESSION_SECRET }); } catch (e) { logger.warn('Could not save SESSION_SECRET to .env: ' + e.message); }
}

const app = express();
const server = http.createServer(app);
app.disable('x-powered-by');

const sessionMiddleware = session({
  name: 'zkb.sid',
  secret: SESSION_SECRET,
  store: new MemoryStore({ checkPeriod: 60 * 60 * 1000 }),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 },
});

// Socket.IO: same-origin only, and only for signed-in users
const io = new Server(server);
io.engine.use(sessionMiddleware);
io.use((socket, next) => {
  if (socket.request.session?.user) return next();
  next(new Error('Unauthorized'));
});
admsSetIO(io);
tcpSetIO(io);
schedSetIO(io);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(sessionMiddleware);

// ── Public routes (no auth required) ──────────────────────────────
const publicDir = path.join(__dirname, '../public');
const sendLogo = (req, res) => res.sendFile(branding.logoPath());
app.get('/brand/logo', sendLogo);
app.get('/logo.png',    sendLogo);
app.get('/favicon.png', sendLogo);
app.get('/favicon.ico', sendLogo);
app.get('/api/branding', (req, res) => res.json(branding.publicBranding()));
app.get('/js/branding.js', (req, res) => res.sendFile(path.join(publicDir, 'js/branding.js')));

// ── First-run install wizard ──────────────────────────────────────
app.use('/api/install', installRouter);
app.get('/install', (req, res) => {
  if (isInstalled()) return res.redirect('/login');
  res.sendFile(path.join(publicDir, 'install.html'));
});
app.use((req, res, next) => {
  if (isInstalled()) return next();
  if (req.originalUrl.startsWith('/api/')) return res.status(503).json({ success: false, error: 'Setup not completed', install: true });
  res.redirect('/install');
});

app.get('/login', (req, res) => {
  if (req.session?.user) return res.redirect('/');
  res.sendFile(path.join(publicDir, 'login.html'));
});
app.use('/api/auth', authRoutes);

// ── Everything below requires login ───────────────────────────────
app.use(requireAuth);

app.use(express.static(publicDir, { index: 'index.html' }));
app.use('/api', routes);
app.get('/permissions', requireSuperAdmin, (req, res) => res.sendFile(path.join(__dirname, '../public/permissions.html')));
app.get('/users', requireSuperAdmin, (req, res) => res.sendFile(path.join(__dirname, '../public/users.html')));

// ── Socket.IO ──────────────────────────────────────────────────────
io.on('connection', (socket) => {
  logger.info(`UI connected: ${socket.id}`);
  const { getState } = require('./store');
  socket.emit('init', getState());
  socket.on('disconnect', () => logger.info(`UI disconnected: ${socket.id}`));
});

// ── Start services ─────────────────────────────────────────────────
startADMSServer(store.config.admsPort);
logger.info(`ADMS server started on port ${store.config.admsPort}`);
startScheduler();

const G = '\x1b[32m', R = '\x1b[0m';
function printBanner() {
  const { appName } = branding.getBranding();
  const url = 'http://localhost:' + PORT;
  const lines = [
    '',
    `  ${appName} is running`,
    `  Open:       ${url}${isInstalled() ? '' : '   (first run — complete the setup wizard)'}`,
    `  ADMS port:  ${store.config.admsPort}`,
    '  Developed by M. Estiaque — https://mestiaque.com',
    '',
  ];
  lines.forEach(l => process.stdout.write(G + l + R + '\n'));
}

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use. Stop the other program or change PORT in .env`);
    process.exit(1);
  }
  throw err;
});

const PID_FILE = path.join(__dirname, '../logs/server.pid');

server.listen(PORT, HOST, () => {
  try { fs.writeFileSync(PID_FILE, String(process.pid)); } catch {}
  logger.info(`Bridge running at http://localhost:${PORT}`);
  logger.info(`ADMS listener on port ${store.config.admsPort}`);
  printBanner();
});

onShutdown(() => {
  try { if (fs.readFileSync(PID_FILE, 'utf8').trim() === String(process.pid)) fs.unlinkSync(PID_FILE); } catch {}
});
onShutdown(() => stopADMSServer());
onShutdown(() => new Promise(resolve => {
  io.close();
  server.close(() => resolve());
  server.closeAllConnections?.();
}));

function shutdown(signal) {
  logger.info(`${signal} received — shutting down`);
  Promise.race([closeAll(), new Promise(res => setTimeout(res, 3000))]).then(() => process.exit(0));
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

if (process.platform !== 'win32') {
  process.on('SIGUSR2', () => {
    logger.info('Banner requested via signal');
    printBanner();
  });
}

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', { error: err.message, stack: err.stack });
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', { reason: String(reason) });
});
