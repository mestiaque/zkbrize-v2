// Builds the CodeCanyon upload: dist/zk-bridge-v<version>.zip
// Uses `git archive`, so only committed files are packed (never .env, data/,
// logs/ or node_modules). Paths marked export-ignore in .gitattributes are left out.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { version } = require('../package.json');
const run = cmd => execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();

if (run('git status --porcelain') && !process.argv.includes('--allow-dirty')) {
  console.error('[package] Commit your changes first (or pass --allow-dirty to pack the last commit anyway).');
  process.exit(1);
}

const name = `zk-bridge-v${version}`;
const out = path.join(ROOT, 'dist', `${name}.zip`);
fs.mkdirSync(path.dirname(out), { recursive: true });
if (fs.existsSync(out)) fs.unlinkSync(out);

run(`git archive --format=zip --prefix=${name}/ -o "${out}" HEAD`);

// Screenshots for the CodeCanyon upload form, as their own ZIP
const shots = path.join(ROOT, 'dist', `${name}-screenshots.zip`);
if (fs.existsSync(shots)) fs.unlinkSync(shots);
run(`git archive --format=zip -o "${shots}" HEAD:marketing/screenshots`);
console.log(`[package] ${path.relative(ROOT, shots)}`);
const files = run(`git archive --format=tar HEAD | tar -t`).split('\n').filter(f => f && !f.endsWith('/')).length;
console.log(`[package] ${path.relative(ROOT, out)}  (${files} files, ${(fs.statSync(out).size / 1024 / 1024).toFixed(1)} MB)`);
