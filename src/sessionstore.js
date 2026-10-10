const fs = require('fs');
const path = require('path');
const session = require('express-session');

// Sessions kept in memory and saved to data/sessions.json, so signed-in users
// stay signed in when the server restarts. Expired sessions are pruned.
class FileSessionStore extends session.Store {
  constructor({ file = path.join(__dirname, '../data/sessions.json'), pruneMs = 60 * 60 * 1000 } = {}) {
    super();
    this.file = file;
    this.sessions = new Map(); // sid -> { sess, expires }
    this.timer = null;
    try {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const [sid, v] of Object.entries(saved)) this.sessions.set(sid, v);
    } catch {}
    this.prune();
    setInterval(() => this.prune(), pruneMs).unref();
  }

  expiresOf(sess) {
    const e = sess?.cookie?.expires;
    return e ? new Date(e).getTime() : Date.now() + 24 * 60 * 60 * 1000;
  }

  prune() {
    const now = Date.now();
    let changed = false;
    for (const [sid, v] of this.sessions) if (v.expires <= now) { this.sessions.delete(sid); changed = true; }
    if (changed) this.save();
  }

  save() {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 1000);
  }

  flush() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.sessions)));
      fs.renameSync(tmp, this.file);
    } catch (e) { console.error('Failed to save sessions:', e.message); }
  }

  get(sid, cb) {
    const v = this.sessions.get(sid);
    if (!v) return cb(null, null);
    if (v.expires <= Date.now()) { this.destroy(sid, () => cb(null, null)); return; }
    cb(null, v.sess);
  }

  set(sid, sess, cb) {
    this.sessions.set(sid, { sess, expires: this.expiresOf(sess) });
    this.save();
    cb && cb(null);
  }

  touch(sid, sess, cb) {
    const v = this.sessions.get(sid);
    if (v) { v.expires = this.expiresOf(sess); v.sess.cookie = sess.cookie; this.save(); }
    cb && cb(null);
  }

  destroy(sid, cb) {
    this.sessions.delete(sid);
    this.save();
    cb && cb(null);
  }
}

module.exports = { FileSessionStore };
