// First-run setup (Linux + Windows). Runs automatically after `npm install`.
// Safe to run again: never overwrites an existing .env or data.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env');
const ENV_TEMPLATE = path.join(ROOT, '.env.example');


let env = '';
let created = false;
if (fs.existsSync(ENV_FILE)) {
  env = fs.readFileSync(ENV_FILE, 'utf8');
} else {
  env = fs.readFileSync(ENV_TEMPLATE, 'utf8');
  created = true;
}

const hasValue = key => new RegExp(`^${key}=.+`, 'm').test(env);
const setValue = (key, value) => {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  env = re.test(env) ? env.replace(re, line) : env.replace(/\s*$/, '\n') + line + '\n';
};

if (!hasValue('SESSION_SECRET')) setValue('SESSION_SECRET', crypto.randomBytes(32).toString('hex'));

fs.writeFileSync(ENV_FILE, env);

// data/ and logs/ folders plus default data files (also done on every server start)
require('../src/datafiles').ensureDataFiles();

if (created) {
  const port = (env.match(/^PORT=(\d+)/m) || [])[1] || '3000';
  console.log('');
  console.log('[setup] Created .env from .env.example');
  console.log(`[setup] Next: run "npm start" and open http://localhost:${port} to finish setup in your browser.`);
  console.log('');
}
