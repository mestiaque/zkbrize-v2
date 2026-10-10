// Small dependency-free SVG charts for the dashboard (works offline).
// Marks follow fixed specs: columns <= 24px wide with a 4px rounded top and a
// square base, 2px surface gap between stacked segments, hairline grid, and a
// hover tooltip on every mark. Text always uses ink colors, never series colors.

const vizTooltip = (() => {
  let el = null;
  function node() {
    if (!el) {
      el = document.createElement('div');
      el.className = 'viz-tooltip';
      el.setAttribute('role', 'tooltip');
      document.body.appendChild(el);
    }
    return el;
  }
  return {
    // rows: [{ label, value, color? }]
    show(evt, title, rows) {
      const t = node();
      t.replaceChildren();
      const h = document.createElement('div');
      h.className = 'viz-tooltip-title';
      h.textContent = title;
      t.appendChild(h);
      for (const r of rows) {
        const row = document.createElement('div');
        row.className = 'viz-tooltip-row';
        if (r.color) {
          const key = document.createElement('span');
          key.className = 'viz-key-line';
          key.style.background = r.color;
          row.appendChild(key);
        }
        const v = document.createElement('strong');
        v.textContent = r.value;
        const l = document.createElement('span');
        l.textContent = r.label;
        row.append(v, l);
        t.appendChild(row);
      }
      t.style.display = 'block';
      const pad = 12;
      const rect = t.getBoundingClientRect();
      let x = evt.clientX + pad, y = evt.clientY + pad;
      if (x + rect.width > window.innerWidth - 8) x = evt.clientX - rect.width - pad;
      if (y + rect.height > window.innerHeight - 8) y = evt.clientY - rect.height - pad;
      t.style.left = x + 'px';
      t.style.top = y + 'px';
    },
    hide() { if (el) el.style.display = 'none'; },
  };
})();

// Whole-number axis: a 1/2/5 step that gives at most 5 intervals
function niceScale(v) {
  v = Math.max(v, 1);
  let step = 1;
  for (let pow = 1; ; pow *= 10) {
    const s = [1, 2, 5].map(m => m * pow).find(c => v / c <= 5);
    if (s) { step = s; break; }
  }
  return { max: Math.ceil(v / step) * step, step };
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs, parent) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

// Column path with a 4px rounded top and a square base
function columnPath(x, y, w, h, r) {
  r = Math.min(r, w / 2, h);
  if (h <= 0) return '';
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/**
 * Vertical column chart (optionally stacked).
 * opts: { labels: [..], series: [{ name, color, values: [..] }], tooltipTitle(i), height, ariaLabel }
 */
function renderColumnChart(container, opts) {
  const { labels, series } = opts;
  const height = opts.height || 220;
  const width = Math.max(container.clientWidth || 600, 280);
  const m = { top: 12, right: 8, bottom: 26, left: 32 };
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;
  const totals = labels.map((_, i) => series.reduce((s, ser) => s + (ser.values[i] || 0), 0));
  const { max, step } = niceScale(Math.max(...totals));

  const svg = svgEl('svg', { width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': opts.ariaLabel || '' });
  svg.classList.add('viz-svg');

  // Gridlines + y ticks (clean whole numbers)
  for (let v = 0; v <= max; v += step) {
    const y = m.top + plotH - (v / max) * plotH;
    svgEl('line', { x1: m.left, x2: width - m.right, y1: y, y2: y, class: v === 0 ? 'viz-baseline' : 'viz-grid' }, svg);
    const t = svgEl('text', { x: m.left - 6, y: y + 4, 'text-anchor': 'end', class: 'viz-tick' }, svg);
    t.textContent = v.toLocaleString();
  }

  const band = plotW / labels.length;
  const colW = Math.min(24, Math.max(4, band * 0.6));
  const labelEvery = Math.ceil(labels.length / Math.max(1, Math.floor(plotW / 44)));

  labels.forEach((label, i) => {
    const cx = m.left + band * i + band / 2;
    let yCursor = m.top + plotH;
    const nonZero = series.filter(s => (s.values[i] || 0) > 0);
    series.forEach(ser => {
      const v = ser.values[i] || 0;
      if (!v) return;
      const h = (v / max) * plotH;
      const isTop = ser === nonZero[nonZero.length - 1];
      const gap = isTop ? 0 : 2; // surface gap between stacked segments
      const y = yCursor - h;
      const segH = Math.max(h - gap, 1);
      if (isTop) svgEl('path', { d: columnPath(cx - colW / 2, y, colW, segH, 4), fill: ser.color, class: 'viz-mark' }, svg);
      else svgEl('rect', { x: cx - colW / 2, y: y + gap, width: colW, height: segH, fill: ser.color, class: 'viz-mark' }, svg);
      yCursor = y;
    });

    if (i % labelEvery === 0) {
      const t = svgEl('text', { x: cx, y: height - 8, 'text-anchor': 'middle', class: 'viz-tick' }, svg);
      t.textContent = label;
    }

    // Hit target: the whole band, taller than the mark
    const hit = svgEl('rect', { x: m.left + band * i, y: m.top, width: band, height: plotH, fill: 'transparent', tabindex: 0, class: 'viz-hit' }, svg);
    const show = evt => {
      const rows = series.map(s => ({ label: s.name, value: (s.values[i] || 0).toLocaleString(), color: s.color }));
      if (series.length > 1) rows.push({ label: 'Total', value: totals[i].toLocaleString() });
      const e = evt.clientX ? evt : (() => { const r = hit.getBoundingClientRect(); return { clientX: r.left + r.width / 2, clientY: r.top }; })();
      vizTooltip.show(e, opts.tooltipTitle ? opts.tooltipTitle(i) : label, rows);
      hit.classList.add('is-hover');
    };
    hit.addEventListener('pointermove', show);
    hit.addEventListener('focus', show);
    hit.addEventListener('pointerleave', () => { vizTooltip.hide(); hit.classList.remove('is-hover'); });
    hit.addEventListener('blur', () => { vizTooltip.hide(); hit.classList.remove('is-hover'); });
  });

  container.replaceChildren(svg);
}

/**
 * Horizontal bar list: one series, value at the bar tip.
 * items: [{ name, count }], color
 */
function renderBarList(container, items, color, emptyText) {
  container.replaceChildren();
  if (!items.length) {
    const e = document.createElement('div');
    e.className = 'empty-state';
    e.textContent = emptyText || 'No data yet';
    container.appendChild(e);
    return;
  }
  const max = Math.max(...items.map(i => i.count));
  const total = items.reduce((s, i) => s + i.count, 0);
  for (const it of items) {
    const row = document.createElement('div');
    row.className = 'viz-barrow';
    row.tabIndex = 0;
    const name = document.createElement('div');
    name.className = 'viz-barrow-name';
    name.textContent = it.name;
    name.title = it.name;
    const track = document.createElement('div');
    track.className = 'viz-barrow-track';
    const bar = document.createElement('div');
    bar.className = 'viz-barrow-bar';
    bar.style.width = Math.max((it.count / max) * 100, 1.5) + '%';
    bar.style.background = color;
    const val = document.createElement('span');
    val.className = 'viz-barrow-value';
    val.textContent = it.count.toLocaleString();
    track.append(bar, val);
    row.append(name, track);
    const pct = total ? Math.round((it.count / total) * 100) : 0;
    const show = evt => {
      const e = evt.clientX ? evt : (() => { const r = row.getBoundingClientRect(); return { clientX: r.right - 40, clientY: r.top }; })();
      vizTooltip.show(e, it.name, [{ label: `punches · ${pct}%`, value: it.count.toLocaleString(), color }]);
    };
    row.addEventListener('pointermove', show);
    row.addEventListener('focus', show);
    row.addEventListener('pointerleave', () => vizTooltip.hide());
    row.addEventListener('blur', () => vizTooltip.hide());
    container.appendChild(row);
  }
}
