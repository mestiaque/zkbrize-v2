const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '../.env');

// Updates (or appends) KEY=value lines in .env, keeping comments and other keys intact
function setEnvValues(values) {
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  for (const [key, raw] of Object.entries(values)) {
    if (raw === undefined) continue;
    const value = String(raw);
    if (/[\r\n\0]/.test(value)) throw new Error(`Invalid value for ${key}`);
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    content = re.test(content) ? content.replace(re, () => line) : content.replace(/\s*$/, '\n') + line + '\n';
  }
  fs.writeFileSync(ENV_PATH, content);
}

module.exports = { setEnvValues };
