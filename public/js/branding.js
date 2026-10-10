// Applies white-label branding to any page.
//   data-brand="appName|tagline|companyName"  → text content
//   data-brand-logo                            → <img> src
//   data-brand-title="Page name"  (on <html>)  → document title "Page name — App"
//   #dev-credit                                → developer credit link
(function () {
  const DEV_NAME = 'M. Estiaque';
  const DEV_URL = 'https://mestiaque.com';

  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const c = v => Math.max(0, Math.min(255, Math.round(v * (1 + amount))));
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => c(v).toString(16).padStart(2, '0')).join('');
  }

  function apply(b) {
    window.BRANDING = b;
    document.querySelectorAll('[data-brand]').forEach(el => {
      const v = b[el.dataset.brand];
      if (v !== undefined) el.textContent = v;
      if (el.dataset.brand === 'companyName') el.style.display = v ? '' : 'none';
    });
    document.querySelectorAll('[data-brand-logo]').forEach(el => {
      el.src = '/brand/logo?v=' + (b.customLogo ? Date.now() : '0');
    });
    const page = document.documentElement.dataset.brandTitle;
    document.title = page ? `${page} — ${b.appName}` : b.appName;

    if (/^#[0-9a-f]{6}$/i.test(b.primaryColor || '')) {
      const root = document.documentElement.style;
      root.setProperty('--primary', b.primaryColor);
      root.setProperty('--primary-dk', shade(b.primaryColor, -0.15));
    }

    document.querySelectorAll('#dev-credit').forEach(el => {
      el.innerHTML = '';
      el.append('Developed by ');
      const a = document.createElement('a');
      a.href = DEV_URL; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = DEV_NAME;
      el.append(a);
    });
    document.dispatchEvent(new CustomEvent('branding', { detail: b }));
  }

  window.loadBranding = function () {
    return fetch('/api/branding')
      .then(r => r.json())
      .then(apply)
      .catch(() => {});
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.loadBranding);
  else window.loadBranding();
})();
