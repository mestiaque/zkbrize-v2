const express = require('express');
const router = express.Router();
const {
  verifyLogin, createUser, updateUser, deleteUser, listUsers,
  createRole, updateRole, deleteRole, loadRoles,
  requireAdmin, requireSuperAdmin, MASTER_USERNAME,
  loginLockedFor, recordLoginFailure, clearLoginFailures,
  findUserById, roleExists, getEffectivePermissions,
} = require('./auth');

const USERNAME_RE = /^[A-Za-z0-9._@-]{3,32}$/;
const MIN_PASSWORD = 8;

function validPassword(p) { return typeof p === 'string' && p.length >= MIN_PASSWORD && p.length <= 128; }

// Admins may manage everyone except superadmins; only a superadmin can touch a superadmin
function canManageUser(actor, target) {
  if (!target) return true;
  return target.role !== 'superadmin' || actor.role === 'superadmin';
}

// ── Auth ───────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.json({ success: false, error: 'Username and password required' });
  const lockedMs = loginLockedFor(req.ip, username);
  if (lockedMs) {
    return res.status(429).json({ success: false, error: `Too many failed attempts. Try again in ${Math.ceil(lockedMs / 60000)} minute(s).` });
  }
  const user = await verifyLogin(String(username), String(password));
  if (!user) {
    recordLoginFailure(req.ip, username);
    return res.json({ success: false, error: 'Invalid username or password' });
  }
  clearLoginFailures(req.ip, username);
  // New session id on login (prevents session fixation)
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ success: false, error: 'Session error' });
    req.session.user = user;
    res.json({ success: true, user: { username: user.username, role: user.role } });
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

router.get('/me', (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ ...req.session.user, permissions: getEffectivePermissions(req.session.user) });
});

// ── Users (admin + superadmin) ─────────────────────────────────────

router.get('/users', requireAdmin, (req, res) => {
  res.json({ users: listUsers(), masterUser: MASTER_USERNAME });
});

router.post('/users/create', requireAdmin, (req, res) => {
  const { username, password, role = 'admin' } = req.body || {};
  if (!USERNAME_RE.test(username || '')) return res.json({ success: false, error: 'Username must be 3-32 characters (letters, numbers, . _ @ -)' });
  if (!validPassword(password)) return res.json({ success: false, error: `Password must be at least ${MIN_PASSWORD} characters` });
  if (!roleExists(role)) return res.json({ success: false, error: 'Unknown role' });
  if (role === 'superadmin' && req.session.user.role !== 'superadmin')
    return res.json({ success: false, error: 'Only superadmin can assign superadmin role' });
  if (username.toLowerCase() === MASTER_USERNAME.toLowerCase())
    return res.json({ success: false, error: 'Username is reserved' });
  res.json(createUser(username, password, role));
});

router.post('/users/update', requireAdmin, (req, res) => {
  const { id, role, password } = req.body || {};
  if (!id) return res.json({ success: false, error: 'ID required' });
  const target = findUserById(id);
  if (!target) return res.json({ success: false, error: 'User not found' });
  if (!canManageUser(req.session.user, target))
    return res.json({ success: false, error: 'Only superadmin can modify a superadmin' });
  if (role && !roleExists(role)) return res.json({ success: false, error: 'Unknown role' });
  if (role === 'superadmin' && req.session.user.role !== 'superadmin')
    return res.json({ success: false, error: 'Only superadmin can assign superadmin role' });
  if (password && !validPassword(password))
    return res.json({ success: false, error: `Password must be at least ${MIN_PASSWORD} characters` });
  res.json(updateUser(id, { role, password }));
});

router.post('/users/delete', requireAdmin, (req, res) => {
  const { id } = req.body || {};
  if (!id) return res.json({ success: false, error: 'ID required' });
  if (id === req.session.user.id) return res.json({ success: false, error: 'You cannot delete your own account' });
  const target = findUserById(id);
  if (!canManageUser(req.session.user, target))
    return res.json({ success: false, error: 'Only superadmin can delete a superadmin' });
  res.json(deleteUser(id));
});

// ── Roles (admin + superadmin) ─────────────────────────────────────

router.get('/roles', requireAdmin, (req, res) => {
  res.json({ roles: loadRoles() });
});

router.post('/roles/create', requireAdmin, (req, res) => {
  const { name, permissions } = req.body || {};
  if (!name || !/^[A-Za-z0-9 _-]{2,32}$/.test(name)) return res.json({ success: false, error: 'Role name must be 2-32 characters (letters, numbers, space, _ -)' });
  res.json(createRole(name, permissions));
});

router.post('/roles/update', requireAdmin, (req, res) => {
  const { id, name, permissions } = req.body || {};
  if (!id) return res.json({ success: false, error: 'Role ID required' });
  res.json(updateRole(id, { name, permissions }));
});

router.post('/roles/delete', requireAdmin, (req, res) => {
  const { id } = req.body || {};
  if (!id) return res.json({ success: false, error: 'Role ID required' });
  res.json(deleteRole(id));
});

module.exports = router;
