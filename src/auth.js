const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, '../data/users.json');
const ROLES_FILE = path.join(__dirname, '../data/roles.json');
const MASTER_USERNAME = process.env.MASTER_USERNAME || 'superadmin';
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || '';

// ── Default roles ──────────────────────────────────────────────────

const { DEFAULT_PERMISSIONS } = require('./store');

// Built from the complete permission list so no key is ever left out
function permissionsWith(fn) {
  const out = {};
  for (const [section, items] of Object.entries(DEFAULT_PERMISSIONS)) {
    out[section] = {};
    for (const key of Object.keys(items)) out[section][key] = fn(section, key);
  }
  return out;
}

const VIEWER_ALLOWED = ['nav.dashboard', 'nav.employees', 'nav.attendance', 'nav.guide', 'attendance.date_range'];
const FULL_PERMISSIONS = permissionsWith(() => true);
const VIEWER_PERMISSIONS = permissionsWith((section, key) => VIEWER_ALLOWED.includes(`${section}.${key}`));

const DEFAULT_ROLES = [
  { id: 'superadmin', name: 'superadmin', locked: true,  permissions: JSON.parse(JSON.stringify(FULL_PERMISSIONS)) },
  { id: 'admin',      name: 'admin',      locked: false, permissions: JSON.parse(JSON.stringify(FULL_PERMISSIONS)) },
  { id: 'viewer',     name: 'viewer',     locked: false, permissions: JSON.parse(JSON.stringify(VIEWER_PERMISSIONS)) },
];

// ── Role store ─────────────────────────────────────────────────────

function loadRoles() {
  try {
    if (fs.existsSync(ROLES_FILE)) return JSON.parse(fs.readFileSync(ROLES_FILE, 'utf8'));
  } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_ROLES));
}

function saveRoles(roles) {
  const dir = path.dirname(ROLES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ROLES_FILE, JSON.stringify(roles, null, 2));
}

function createRole(name, permissions) {
  const roles = loadRoles();
  const slug = name.toLowerCase().replace(/\s+/g, '_');
  if (roles.find(r => r.id === slug)) return { success: false, error: 'Role already exists' };
  const role = { id: slug, name: slug, locked: false, permissions: permissions || {} };
  roles.push(role);
  saveRoles(roles);
  return { success: true, role };
}

function updateRole(id, fields) {
  const roles = loadRoles();
  const idx = roles.findIndex(r => r.id === id);
  if (idx === -1) return { success: false, error: 'Role not found' };
  if (roles[idx].locked) return { success: false, error: 'This role cannot be edited' };
  if (fields.permissions) roles[idx].permissions = { ...roles[idx].permissions, ...fields.permissions };
  if (fields.name) roles[idx].name = fields.name;
  saveRoles(roles);
  return { success: true, role: roles[idx] };
}

function deleteRole(id) {
  const roles = loadRoles();
  const idx = roles.findIndex(r => r.id === id);
  if (idx === -1) return { success: false, error: 'Role not found' };
  if (roles[idx].locked || ['admin', 'viewer'].includes(id)) return { success: false, error: 'Built-in role cannot be deleted' };
  const inUse = loadUsers().filter(u => u.role === id).length;
  if (inUse) return { success: false, error: `${inUse} user(s) still have this role. Change their role first.` };
  roles.splice(idx, 1);
  saveRoles(roles);
  return { success: true };
}

// ── User store ─────────────────────────────────────────────────────

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch {}
  return [];
}

function saveUsers(users) {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function findUserById(id) {
  return loadUsers().find(u => u.id === id);
}

function findUser(username) {
  return loadUsers().find(u => u.username.toLowerCase() === username.toLowerCase());
}

function roleExists(role) {
  return loadRoles().some(r => r.id === role);
}

function createUser(username, password, role = 'admin', { owner = false } = {}) {
  const users = loadUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, error: 'Username already exists' };
  }
  const hash = bcrypt.hashSync(password, 10);
  const user = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    username, password: hash, role,
    ...(owner ? { owner: true } : {}),
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);
  return { success: true, user: safeUser(user) };
}

function updateUser(id, fields) {
  const users = loadUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return { success: false, error: 'User not found' };
  const changes = {};
  if (fields.role) changes.role = fields.role;
  if (fields.password) changes.password = bcrypt.hashSync(fields.password, 10);
  users[idx] = { ...users[idx], ...changes };
  saveUsers(users);
  return { success: true, user: safeUser(users[idx]) };
}

function deleteUser(id) {
  const users = loadUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return { success: false, error: 'User not found' };
  users.splice(idx, 1);
  saveUsers(users);
  return { success: true };
}

function listUsers() { return loadUsers().map(safeUser); }
function safeUser(u) { return { id: u.id, username: u.username, role: u.role, owner: !!u.owner, createdAt: u.createdAt }; }

// ── Owner (the account created by the setup wizard) ────────────────
// Only the owner — and the optional .env emergency login, needed to recover a
// lost owner password — may use Administration (users, roles, permissions).

function isOwner(user) {
  return !!user && (user.id === 'master' || user.owner === true);
}

// Installs from before the owner flag: the oldest superadmin becomes the owner
function ensureOwner() {
  const users = loadUsers();
  if (!users.length || users.some(u => u.owner)) return;
  const oldest = users
    .filter(u => u.role === 'superadmin')
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0];
  if (!oldest) return;
  oldest.owner = true;
  saveUsers(users);
}

// ── Auth verify ────────────────────────────────────────────────────

// Constant-time string compare (avoids leaking the master password via timing)
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

async function verifyLogin(username, password) {
  if (MASTER_PASSWORD && username === MASTER_USERNAME && safeEqual(password, MASTER_PASSWORD)) {
    return { id: 'master', username: MASTER_USERNAME, role: 'superadmin' };
  }
  const user = findUser(username);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return null;
  return safeUser(user);
}

function masterEnabled() { return !!MASTER_PASSWORD; }

function hasAnyLogin() {
  return !!MASTER_PASSWORD || loadUsers().length > 0;
}

// ── Login rate limit (per IP + username) ───────────────────────────

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const loginAttempts = new Map(); // key -> { count, first }

function loginKey(ip, username) { return `${ip}|${String(username).toLowerCase()}`; }

function loginLockedFor(ip, username) {
  const a = loginAttempts.get(loginKey(ip, username));
  if (!a || a.count < LOGIN_MAX_ATTEMPTS) return 0;
  const left = a.first + LOGIN_LOCK_MS - Date.now();
  if (left <= 0) { loginAttempts.delete(loginKey(ip, username)); return 0; }
  return left;
}

function recordLoginFailure(ip, username) {
  const key = loginKey(ip, username);
  const a = loginAttempts.get(key);
  if (!a || Date.now() - a.first > LOGIN_LOCK_MS) loginAttempts.set(key, { count: 1, first: Date.now() });
  else a.count++;
}

function clearLoginFailures(ip, username) { loginAttempts.delete(loginKey(ip, username)); }

setInterval(() => {
  const now = Date.now();
  for (const [k, a] of loginAttempts) if (now - a.first > LOGIN_LOCK_MS) loginAttempts.delete(k);
}, 60 * 1000).unref();

// ── Effective permissions (role ∧ global UI permissions) ───────────

function allTrue(defaults) {
  const out = {};
  for (const [section, items] of Object.entries(defaults)) {
    out[section] = {};
    for (const key of Object.keys(items)) out[section][key] = true;
  }
  return out;
}

// The role's permissions with every key filled in (same fallback rules as below)
function resolveRolePermissions(role) {
  const builtIn = DEFAULT_ROLES.find(r => r.id === role.id)?.permissions;
  return permissionsWith((section, key) => {
    const saved = role.permissions?.[section]?.[key];
    return typeof saved === 'boolean' ? saved : builtIn?.[section]?.[key] === true;
  });
}

function getEffectivePermissions(user) {
  const { store } = require('./store');
  if (!user) return {};
  if (user.role === 'superadmin') return allTrue(DEFAULT_PERMISSIONS);
  const role = loadRoles().find(r => r.id === user.role);
  if (!role) return permissionsWith(() => false);
  // A key missing from a saved role (e.g. added in a later version) falls back to
  // the built-in role's default, and is denied for custom roles
  const rolePerms = resolveRolePermissions(role);
  const globalPerms = store.permissions || {};
  return permissionsWith((section, key) => rolePerms[section][key] && globalPerms[section]?.[key] !== false);
}

// ── Middleware ─────────────────────────────────────────────────────

function isApi(req) { return req.originalUrl.startsWith('/api/'); }

function deny(req, res, status) {
  if (isApi(req)) return res.status(status).json({ success: false, error: status === 401 ? 'Unauthorized' : 'Forbidden' });
  if (status === 401) return res.redirect('/login');
  res.status(status).send('Forbidden');
}

// Re-reads the user on every request so role changes / deletions apply immediately
function refreshSessionUser(req) {
  const u = req.session?.user;
  if (!u) return null;
  if (u.id === 'master') return MASTER_PASSWORD ? u : null;
  const fresh = loadUsers().find(x => x.id === u.id);
  if (!fresh) return null;
  req.session.user = safeUser(fresh);
  return req.session.user;
}

function requireAuth(req, res, next) {
  if (refreshSessionUser(req)) return next();
  if (req.session?.user) req.session.user = null;
  deny(req, res, 401);
}

function requireAdmin(req, res, next) {
  const role = req.session?.user?.role;
  if (role === 'superadmin' || role === 'admin') return next();
  deny(req, res, 403);
}

function requireOwner(req, res, next) {
  if (isOwner(req.session?.user)) return next();
  deny(req, res, 403);
}

function requireSuperAdmin(req, res, next) {
  if (req.session?.user?.role === 'superadmin') return next();
  deny(req, res, 403);
}

// Allows the request if the user has ANY of the given "section.key" permissions
function requirePerm(...keys) {
  return (req, res, next) => {
    const perms = getEffectivePermissions(req.session?.user);
    const ok = keys.some(k => {
      const [section, key] = k.split('.');
      return perms[section]?.[key] === true;
    });
    if (ok) return next();
    deny(req, res, 403);
  };
}

module.exports = {
  requireAuth, requireAdmin, requireSuperAdmin, requireOwner, requirePerm, isOwner, ensureOwner,
  verifyLogin, hasAnyLogin, masterEnabled, getEffectivePermissions,
  loginLockedFor, recordLoginFailure, clearLoginFailures,
  findUserById, roleExists, DEFAULT_ROLES, resolveRolePermissions,
  createUser, updateUser, deleteUser, listUsers, loadUsers,
  createRole, updateRole, deleteRole, loadRoles,
  MASTER_USERNAME,
};
