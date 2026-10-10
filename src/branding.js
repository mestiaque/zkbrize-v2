const fs = require('fs');
const path = require('path');

const DATA_DIR     = path.join(__dirname, '../data');
const BRANDING_FILE = path.join(DATA_DIR, 'branding.json');
const LOGO_DIR     = path.join(DATA_DIR, 'branding');
const DEFAULT_LOGO = path.join(__dirname, '../public/logo.png');

const DEFAULTS = {
  appName: 'AttendBridge',
  tagline: 'Attendance ↔ ERP Bridge',
  primaryColor: '#3b82f6',
  companyName: '',
  companyUrl: '',
};

const LOGO_TYPES = {
  'image/png':     'png',
  'image/jpeg':    'jpg',
  'image/webp':    'webp',
  'image/svg+xml': 'svg',
};
const MAX_LOGO_BYTES = 1024 * 1024;

function getBranding() {
  try {
    if (fs.existsSync(BRANDING_FILE)) {
      return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(BRANDING_FILE, 'utf8')) };
    }
  } catch {}
  return { ...DEFAULTS };
}

function cleanText(v, max) {
  return String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
}

function validateBranding(input) {
  const out = {};
  if (input.appName !== undefined) {
    out.appName = cleanText(input.appName, 40);
    if (!out.appName) return { error: 'App name is required' };
  }
  if (input.tagline !== undefined) out.tagline = cleanText(input.tagline, 60);
  if (input.companyName !== undefined) out.companyName = cleanText(input.companyName, 60);
  if (input.companyUrl !== undefined) {
    out.companyUrl = cleanText(input.companyUrl, 200);
    if (out.companyUrl && !/^https?:\/\/[^\s"']+$/i.test(out.companyUrl)) return { error: 'Company URL must start with http:// or https://' };
  }
  if (input.primaryColor !== undefined) {
    out.primaryColor = String(input.primaryColor).trim();
    if (!/^#[0-9a-f]{6}$/i.test(out.primaryColor)) return { error: 'Color must be a hex value like #3b82f6' };
  }
  return { value: out };
}

function saveBranding(input) {
  const { value, error } = validateBranding(input);
  if (error) return { success: false, error };
  const next = { ...getBranding(), ...value };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(BRANDING_FILE, JSON.stringify(next, null, 2));
  return { success: true, branding: next };
}

function findCustomLogo() {
  if (!fs.existsSync(LOGO_DIR)) return null;
  const f = fs.readdirSync(LOGO_DIR).find(n => n.startsWith('logo.'));
  return f ? path.join(LOGO_DIR, f) : null;
}

function logoPath() {
  return findCustomLogo() || DEFAULT_LOGO;
}

// dataUrl: "data:image/png;base64,...."
function saveLogo(dataUrl) {
  const m = /^data:([a-z+/]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m || !LOGO_TYPES[m[1]]) return { success: false, error: 'Logo must be a PNG, JPG, WEBP or SVG image' };
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_LOGO_BYTES) return { success: false, error: 'Logo must be smaller than 1 MB' };
  if (m[1] === 'image/svg+xml' && /<script|on\w+\s*=|javascript:/i.test(buf.toString('utf8'))) {
    return { success: false, error: 'SVG logo must not contain scripts' };
  }
  removeLogo();
  fs.mkdirSync(LOGO_DIR, { recursive: true });
  fs.writeFileSync(path.join(LOGO_DIR, 'logo.' + LOGO_TYPES[m[1]]), buf);
  return { success: true };
}

function removeLogo() {
  const f = findCustomLogo();
  if (f) fs.unlinkSync(f);
  return { success: true };
}

function publicBranding() {
  const b = getBranding();
  return { ...b, customLogo: !!findCustomLogo() };
}

module.exports = { getBranding, saveBranding, validateBranding, saveLogo, removeLogo, logoPath, publicBranding, DEFAULTS };
