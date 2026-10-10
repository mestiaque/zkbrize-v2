// Users & Roles and Interface Permissions pages (superadmin only).
// Uses api(), toast() and closeModal() from app.js.

const PERM_SCHEMA = {
  nav: {
    label: 'Pages',
    items: {
      dashboard:  { label: 'Dashboard',  hint: 'Overview stats and activity' },
      devices:    { label: 'Devices',    hint: 'Device management page' },
      employees:  { label: 'Employees',  hint: 'Employee management page' },
      attendance: { label: 'Attendance', hint: 'Attendance records page' },
      logs:       { label: 'Logs',       hint: 'Server log page' },
      settings:   { label: 'Settings',   hint: 'ERP connection, schedules, ADMS port' },
      guide:      { label: 'User Guide', hint: 'Built-in help page' },
    },
  },
  employees: {
    label: 'Employees page',
    items: {
      btn_load_laravel:    { label: 'Load from ERP',        hint: 'Import employees from the ERP API' },
      btn_load_machine:    { label: 'Load from Machine',    hint: 'Read users stored on a device' },
      btn_set_device:      { label: 'Set to Device',        hint: 'Send employees to connected devices' },
      btn_add_employee:    { label: 'Add Employee',         hint: 'Create a new employee' },
      btn_edit_employee:   { label: 'Edit Employee',        hint: 'Change an employee' },
      btn_delete_employee: { label: 'Delete Employee',      hint: 'Remove an employee from bridge and devices' },
      export_csv:          { label: 'Export CSV',           hint: 'Download for ZKTeco desktop software' },
      export_dat:          { label: 'Export DAT (USB)',     hint: 'Download user.dat for USB import' },
      card_export_guide:   { label: 'Export guide card',    hint: 'Instructions for CSV/DAT export' },
      card_api_docs:       { label: 'ERP API card',         hint: 'API example for developers' },
    },
  },
  devices: {
    label: 'Devices page',
    items: {
      card_add_tcp:   { label: 'Add TCP/IP Device', hint: 'Connect and disconnect TCP/IP devices' },
      card_adms_info: { label: 'ADMS Push Server',  hint: 'Address and port for ADMS devices' },
      card_ping_test: { label: 'Network Ping Test', hint: 'Check if a device is reachable' },
    },
  },
  attendance: {
    label: 'Attendance page',
    items: {
      date_range:       { label: 'Date range',  hint: 'From / To date inputs' },
      btn_fetch:        { label: 'Fetch TCP',   hint: 'Read punches from TCP/IP devices' },
      btn_fetch_adms:   { label: 'Fetch ADMS',  hint: 'Ask ADMS devices to upload their history' },
      btn_push_laravel: { label: 'Push to ERP', hint: 'Send records to the ERP (also Sync Now)' },
    },
  },
};

const BUILT_IN_ROLES = ['superadmin', 'admin', 'viewer'];
let adminRoles = [];
let adminMe = null;
let editingUserId = null;
let editingRoleId = null;
let interfacePerms = {};
let interfaceDefaults = {};

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function roleTag(role) {
  const cls = { superadmin: 'tag-blue', admin: 'tag-green', viewer: 'tag' }[role] || 'tag-amber';
  return `<span class="tag ${cls}">${esc(role)}</span>`;
}

// ── Permission editor (shared by roles and interface permissions) ──

function renderPermEditor(containerId, perms, asCards) {
  const box = document.getElementById(containerId);
  box.innerHTML = Object.entries(PERM_SCHEMA).map(([section, schema]) => {
    const rows = Object.entries(schema.items).map(([key, meta]) => `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-size:13px;font-weight:500">${esc(meta.label)}</div>
          <div class="field-hint">${esc(meta.hint)}</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" data-section="${section}" data-key="${key}" ${perms?.[section]?.[key] !== false ? 'checked' : ''}>
          <span class="toggle-track"><span class="toggle-thumb"></span></span>
        </label>
      </div>`).join('');
    const head = `
      <div class="card-header" style="margin-bottom:4px">
        <div class="card-title" style="font-size:14px">${esc(schema.label)}</div>
        <div style="display:flex;gap:6px">
          <button class="btn-sm" onclick="setPermSection('${containerId}','${section}',true)">All on</button>
          <button class="btn-sm" onclick="setPermSection('${containerId}','${section}',false)">All off</button>
        </div>
      </div>`;
    return asCards
      ? `<div class="card mt">${head}${rows}</div>`
      : `<div style="margin-top:14px">${head}${rows}</div>`;
  }).join('');
}

function setPermSection(containerId, section, on) {
  document.querySelectorAll(`#${containerId} input[data-section="${section}"]`).forEach(cb => { cb.checked = on; });
}

function readPermEditor(containerId) {
  const perms = {};
  document.querySelectorAll(`#${containerId} input[type=checkbox]`).forEach(cb => {
    (perms[cb.dataset.section] ||= {})[cb.dataset.key] = cb.checked;
  });
  return perms;
}

// ── Users & Roles page ────────────────────────────────────────────

async function loadUsersPage() {
  adminMe = adminMe || await api('/auth/me', null, 'GET');
  await loadRoles();
  await loadUsers();
}

async function loadRoles() {
  const data = await api('/auth/roles', null, 'GET');
  adminRoles = data?.roles || [];
  // Allowed / total for one section; keys not saved in a role count as allowed
  const count = (perms, section) => {
    const keys = Object.keys(PERM_SCHEMA[section].items);
    return `${keys.filter(k => perms?.[section]?.[k] !== false).length}/${keys.length}`;
  };
  document.getElementById('roles-tbody').innerHTML = adminRoles.length
    ? adminRoles.map(r => {
        const p = r.permissions || {};
        return `<tr>
          <td>${roleTag(r.name)} ${r.locked ? '<span style="font-size:11px;color:var(--text-3)">built-in</span>' : ''}</td>
          <td>${count(p, 'nav')}</td><td>${count(p, 'employees')}</td><td>${count(p, 'devices')}</td><td>${count(p, 'attendance')}</td>
          <td>${r.locked ? '<span style="font-size:12px;color:var(--text-3)">Full access</span>' : `
            <button class="btn-sm" onclick="openRoleModal('${esc(r.id)}')">Edit</button>
            ${BUILT_IN_ROLES.includes(r.id) ? '' : `<button class="btn-sm" style="color:var(--red)" onclick="deleteRole('${esc(r.id)}')">Delete</button>`}`}
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="6" class="empty-cell">No roles</td></tr>';
}

async function loadUsers() {
  const data = await api('/auth/users', null, 'GET');
  const rows = [];
  if (data?.masterUser && data.masterEnabled) {
    rows.push(`<tr>
      <td><strong>${esc(data.masterUser)}</strong> <span class="tag tag-amber">emergency login (.env)</span></td>
      <td>${roleTag('superadmin')}</td><td>—</td>
      <td><span style="font-size:12px;color:var(--text-3)">Set in .env</span></td>
    </tr>`);
  }
  for (const u of data?.users || []) {
    const self = adminMe && u.id === adminMe.id;
    rows.push(`<tr>
      <td><strong>${esc(u.username)}</strong> ${self ? '<span class="tag">you</span>' : ''}</td>
      <td>${roleTag(u.role)}</td>
      <td style="color:var(--text-2)">${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
      <td>
        <button class="btn-sm" onclick="openUserModal('${esc(u.id)}')">Edit</button>
        ${self ? '' : `<button class="btn-sm" style="color:var(--red)" onclick="deleteUser('${esc(u.id)}')">Delete</button>`}
      </td>
    </tr>`);
  }
  window._adminUsers = data?.users || [];
  document.getElementById('users-tbody').innerHTML = rows.join('') || '<tr><td colspan="4" class="empty-cell">No users yet</td></tr>';
}

function showErr(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg || '';
  el.style.display = msg ? 'block' : 'none';
}

function openUserModal(id) {
  const user = id ? (window._adminUsers || []).find(u => u.id === id) : null;
  editingUserId = user ? user.id : null;
  document.getElementById('user-modal-title').textContent = user ? `Edit User: ${user.username}` : 'Add User';
  const name = document.getElementById('f-username');
  name.value = user ? user.username : '';
  name.disabled = !!user;
  document.getElementById('f-password').value = '';
  document.getElementById('f-pass-label').textContent = user ? 'New Password (leave blank to keep)' : 'Password';
  document.getElementById('f-role').innerHTML = adminRoles
    .map(r => `<option value="${esc(r.id)}" ${r.id === (user ? user.role : 'admin') ? 'selected' : ''}>${esc(r.name)}</option>`)
    .join('');
  showErr('user-err', '');
  document.getElementById('modal-user').style.display = 'flex';
}

async function saveUser() {
  const username = document.getElementById('f-username').value.trim();
  const password = document.getElementById('f-password').value;
  const role = document.getElementById('f-role').value;
  if (!editingUserId && password.length < 8) return showErr('user-err', 'Password must be at least 8 characters');
  if (editingUserId && password && password.length < 8) return showErr('user-err', 'Password must be at least 8 characters');
  const res = editingUserId
    ? await api('/auth/users/update', { id: editingUserId, role, ...(password ? { password } : {}) })
    : await api('/auth/users/create', { username, password, role });
  if (!res?.success) return showErr('user-err', res?.error || 'Could not save user');
  closeModal('modal-user');
  toast(editingUserId ? 'User updated' : 'User created', 'success');
  loadUsers();
}

async function deleteUser(id) {
  const user = (window._adminUsers || []).find(u => u.id === id);
  if (!user || !confirm(`Delete user "${user.username}"?`)) return;
  const res = await api('/auth/users/delete', { id });
  if (res?.success) { toast('User deleted', 'success'); loadUsers(); }
  else toast(res?.error || 'Could not delete user', 'error');
}

function openRoleModal(id) {
  const role = id ? adminRoles.find(r => r.id === id) : null;
  editingRoleId = role ? role.id : null;
  document.getElementById('role-modal-title').textContent = role ? `Edit Role: ${role.name}` : 'Add Role';
  document.getElementById('f-role-name').value = '';
  document.getElementById('role-name-group').style.display = role ? 'none' : '';
  renderPermEditor('role-perm-editor', role ? role.permissions : null, false);
  showErr('role-err', '');
  document.getElementById('modal-role').style.display = 'flex';
}

async function saveRole() {
  const permissions = readPermEditor('role-perm-editor');
  let res;
  if (editingRoleId) {
    res = await api('/auth/roles/update', { id: editingRoleId, permissions });
  } else {
    const name = document.getElementById('f-role-name').value.trim();
    if (!name) return showErr('role-err', 'Role name is required');
    res = await api('/auth/roles/create', { name, permissions });
  }
  if (!res?.success) return showErr('role-err', res?.error || 'Could not save role');
  closeModal('modal-role');
  toast(editingRoleId ? 'Role updated' : 'Role created', 'success');
  loadRoles();
}

async function deleteRole(id) {
  const role = adminRoles.find(r => r.id === id);
  if (!role || !confirm(`Delete role "${role.name}"?`)) return;
  const res = await api('/auth/roles/delete', { id });
  if (res?.success) { toast('Role deleted', 'success'); loadRoles(); }
  else toast(res?.error || 'Could not delete role', 'error');
}

// ── Interface Permissions page ────────────────────────────────────

async function loadInterfacePermsPage() {
  const data = await api('/permissions', null, 'GET');
  interfacePerms = data?.global || {};
  interfaceDefaults = data?.defaults || {};
  renderPermEditor('iperm-editor', interfacePerms, true);
}

function resetInterfacePerms() {
  renderPermEditor('iperm-editor', interfaceDefaults, true);
  toast('Defaults restored — click Save Permissions to apply', 'info');
}

async function saveInterfacePerms() {
  const res = await api('/permissions', readPermEditor('iperm-editor'));
  if (res?.success) { toast('Permissions saved', 'success'); applyPermissions(); }
  else toast(res?.error || 'Could not save permissions', 'error');
}
