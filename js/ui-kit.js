'use strict';
/* =====================================================================
   Dealer Empire — UI building blocks and charts
   ===================================================================== */

const tone = t => ({ good: 'good', bad: 'bad', warn: 'warn', info: 'info', neutral: 'neutral' }[t] || 'neutral');
function pill(text, t = 'neutral', ic) { return `<span class="pill pill-${tone(t)}">${ic ? icon(ic) : ''}${esc(text)}</span>`; }
function chip(text, cls = '') { return `<span class="chip ${cls}">${esc(text)}</span>`; }
function delta(cur, prev, opt = {}) {
  if (prev == null || !isFinite(prev) || prev === 0 || !isFinite(cur)) return '';
  if (opt.pace && dparts(S.day).dom < 4) return '';
  const d = (cur - prev) / Math.abs(prev);
  const good = opt.inverse ? d < 0 : d > 0;
  const t = Math.abs(d) < 0.005 ? 'neutral' : good ? 'good' : 'bad';
  return `<span class="delta delta-${t}">${d > 0 ? '▲' : d < 0 ? '▼' : '•'} ${Math.abs(d * 100).toFixed(Math.abs(d) < 0.1 ? 1 : 0)}%</span>`;
}
function kpi(label, value, sub = '', opt = {}) {
  return `<div class="kpi ${opt.cls || ''} ${opt.tone ? 'kpi-' + opt.tone : ''}" ${opt.link ? `data-act="go" data-to="${opt.link}" role="button" tabindex="0"` : ''} ${opt.tip ? `data-tip="${esc(opt.tip)}"` : ''}>
    <div class="kpi-label">${esc(label)}</div>
    <div class="kpi-value">${value}</div>
    <div class="kpi-sub">${sub}</div>
    ${opt.spark ? `<div class="kpi-spark">${opt.spark}</div>` : ''}
  </div>`;
}
function panel(title, body, opt = {}) {
  return `<section class="panel ${opt.cls || ''}" ${opt.id ? `id="${opt.id}"` : ''}>
    ${title != null ? `<header class="panel-h"><div><h3>${title}</h3>${opt.sub ? `<p class="panel-sub">${opt.sub}</p>` : ''}</div>${opt.actions ? `<div class="panel-actions">${opt.actions}</div>` : ''}</header>` : ''}
    <div class="panel-b ${opt.flush ? 'flush' : ''}">${body}</div>
  </section>`;
}
function btn(label, act, data = {}, opt = {}) {
  const attrs = Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
  return `<button class="btn ${opt.cls || ''}" data-act="${act}" ${attrs} ${opt.disabled ? 'disabled' : ''} ${opt.tip ? `data-tip="${esc(opt.tip)}"` : ''} type="button">${opt.icon ? icon(opt.icon) : ''}<span>${label}</span></button>`;
}
function seg(name, options, value, opt = {}) {
  return `<div class="seg ${opt.cls || ''}" role="group" aria-label="${esc(opt.label || name)}">${options.map(([v, l, tip]) =>
    `<button type="button" class="seg-b ${String(v) === String(value) ? 'on' : ''}" data-act="${opt.act || 'set'}" data-key="${name}" data-val="${v}" ${tip ? `data-tip="${esc(tip)}"` : ''}>${l}</button>`).join('')}</div>`;
}
function bar(frac, t = 'accent', opt = {}) {
  const w = clamp(frac, 0, 1) * 100;
  return `<div class="bar ${opt.cls || ''}" ${opt.tip ? `data-tip="${esc(opt.tip)}"` : ''}><span class="bar-f bar-${t}" style="width:${w.toFixed(1)}%"></span>${opt.mark != null ? `<i class="bar-mark" style="left:${clamp(opt.mark, 0, 1) * 100}%"></i>` : ''}</div>`;
}
function meter(lvl, t) { return `<span class="meter meter-${tone(t)}">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= lvl ? 'on' : ''}"></i>`).join('')}</span>`; }
function empty(text, ic = 'info') { return `<div class="empty">${icon(ic)}<p>${text}</p></div>`; }
function moraleTone(m) { return m >= 65 ? 'good' : m >= 45 ? 'warn' : 'bad'; }
function condLabel(c) { return ['', 'Rough', 'Fair', 'Average', 'Good', 'Excellent'][c]; }
function fitLabel(f) { if (f >= 0.8) return ['Strong match', 'good']; if (f >= 0.65) return ['Good match', 'good']; if (f >= 0.5) return ['Partial match', 'warn']; return ['Poor match', 'bad']; }
function srcLabel(s) { return { 'walk-in': 'Walk-in', internet: 'Internet lead', phone: 'Phone-up', repeat: 'Repeat customer', service: 'Service-to-sales', returning: 'Returning', 'follow-up': 'Follow-up', bdc: 'BDC appointment' }[s] || s; }
function statusLabel(c) { return { owner: 'Owner', service: 'Service only', prospect: 'Prospect', lost: 'Lost to competitor' }[c.status]; }
function pager(key, total, per) {
  const pages = Math.max(1, Math.ceil(total / per)); const p = Math.min(UI.page[key] || 0, pages - 1);
  if (pages <= 1) return '';
  return `<div class="pager"><button class="btn sm ghost" data-act="page" data-key="${key}" data-val="${p - 1}" ${p <= 0 ? 'disabled' : ''}>${icon('left')}<span>Prev</span></button>
    <span class="muted">Page ${p + 1} of ${pages} · ${num(total)} records</span>
    <button class="btn sm ghost" data-act="page" data-key="${key}" data-val="${p + 1}" ${p >= pages - 1 ? 'disabled' : ''}><span>Next</span>${icon('right')}</button></div>`;
}
function pageSlice(key, arr, per) { const pages = Math.max(1, Math.ceil(arr.length / per)); const p = Math.min(UI.page[key] || 0, pages - 1); return arr.slice(p * per, p * per + per); }
function stars(n) { return `<span class="cond" data-tip="Condition ${n}/5 — ${condLabel(n)}">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`; }

/* ---------- Charts (inline SVG, drawn to scale) ---------- */
function niceTicks(min, max, n = 4) {
  if (min === max) { max = min + 1; }
  const span = max - min, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) || mag * 10;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const t = []; for (let v = lo; v <= hi + step / 2; v += step) t.push(round2(v));
  return t;
}
/* series: [{name, color: css var, values: [numbers], dash, area}] ; labels: x labels */
function lineChart(series, labels, opt = {}) {
  const W = opt.w || 560, H = opt.h || 190, padL = opt.padL || 52, padR = 14, padT = 12, padB = 24;
  const all = series.flatMap(s => s.values.filter(v => v != null));
  if (!all.length) return empty('No data yet');
  let min = Math.min(...all, opt.zero !== false ? 0 : Infinity), max = Math.max(...all, opt.min != null ? opt.min : -Infinity);
  if (opt.zero === false) { const pad = (max - min) * 0.15 || 1; min -= pad; max += pad; }
  const ticks = niceTicks(min, max); const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const n = labels.length, xs = i => padL + (n <= 1 ? 0 : i * (W - padL - padR) / (n - 1)), ys = v => padT + (1 - (v - y0) / (y1 - y0)) * (H - padT - padB);
  const fmt = opt.fmt || (v => num(v));
  let g = ticks.map(t => `<line x1="${padL}" x2="${W - padR}" y1="${ys(t)}" y2="${ys(t)}" class="grid ${t === 0 ? 'zero' : ''}"/><text x="${padL - 8}" y="${ys(t) + 4}" class="ax" text-anchor="end">${esc(fmt(t))}</text>`).join('');
  const every = Math.max(1, Math.ceil(n / (opt.maxLabels || 7)));
  g += labels.map((l, i) => (i % every === 0 || i === n - 1) && (i === n - 1 || n - 1 - i >= every / 2) ? `<text x="${xs(i)}" y="${H - 6}" class="ax" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${esc(l)}</text>` : '').join('');
  for (const s of series) {
    const pts = s.values.map((v, i) => v == null ? null : [xs(i), ys(v)]).filter(Boolean);
    if (!pts.length) continue;
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    if (s.area) g += `<path d="${d} L${pts[pts.length - 1][0].toFixed(1)} ${ys(Math.max(y0, 0))} L${pts[0][0].toFixed(1)} ${ys(Math.max(y0, 0))} Z" style="fill:var(${s.color});opacity:.12"/>`;
    g += `<path d="${d}" class="ln ${s.dash ? 'dash' : ''}" style="stroke:var(${s.color})"/>`;
    if (!s.dash) { const e = pts[pts.length - 1]; g += `<circle cx="${e[0]}" cy="${e[1]}" r="4" class="dot" style="fill:var(${s.color})"/>`; }
  }
  // hover columns
  const colW = n > 1 ? (W - padL - padR) / (n - 1) : W - padL - padR;
  g += labels.map((l, i) => {
    const tip = `<b>${esc(l)}</b>` + series.map(s => s.values[i] == null ? '' : `<br>${esc(s.name)}: ${esc(fmt(s.values[i]))}`).join('');
    return `<rect x="${xs(i) - colW / 2}" y="${padT}" width="${colW}" height="${H - padT - padB}" class="hit" data-tip="${esc(tip)}"/>`;
  }).join('');
  const legend = series.length > 1 ? `<div class="legend">${series.map(s => `<span><i style="background:var(${s.color})" class="${s.dash ? 'dash' : ''}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `${legend}<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label || 'chart')}">${g}</svg>`;
}
/* items: [{label, value, tip, tone}] */
function colChart(items, opt = {}) {
  const W = opt.w || 560, H = opt.h || 180, padL = opt.padL || 48, padR = 8, padT = 10, padB = 24;
  if (!items.length) return empty('No data yet');
  const vals = items.map(i => i.value).concat(opt.ref != null ? [opt.ref] : []);
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(...vals, 1));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const ys = v => padT + (1 - (v - y0) / (y1 - y0)) * (H - padT - padB);
  const n = items.length, slot = (W - padL - padR) / n, bw = Math.max(3, Math.min(34, slot - 3));
  const fmt = opt.fmt || (v => num(v));
  let g = ticks.map(t => `<line x1="${padL}" x2="${W - padR}" y1="${ys(t)}" y2="${ys(t)}" class="grid ${t === 0 ? 'zero' : ''}"/><text x="${padL - 8}" y="${ys(t) + 4}" class="ax" text-anchor="end">${esc(fmt(t))}</text>`).join('');
  const every = Math.max(1, Math.ceil(n / (opt.maxLabels || 10)));
  items.forEach((it, i) => {
    const x = padL + i * slot + (slot - bw) / 2, yv = ys(it.value), yz = ys(Math.max(0, y0));
    const top = Math.min(yv, yz), h = Math.max(0, Math.abs(yz - yv));
    const r = Math.min(4, bw / 2, h);
    const pathUp = `M${x} ${yz} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + bw - r} Q${x + bw} ${top} ${x + bw} ${top + r} V${yz} Z`;
    const pathDn = `M${x} ${yz} V${top + h - r} Q${x} ${top + h} ${x + r} ${top + h} H${x + bw - r} Q${x + bw} ${top + h} ${x + bw} ${top + h - r} V${yz} Z`;
    const col = it.tone ? `var(--${it.tone})` : `var(${opt.color || '--accent'})`;
    g += h > 0 ? `<path d="${it.value >= 0 ? pathUp : pathDn}" style="fill:${col}" class="col ${it.dim ? 'dim' : ''}"/>` : '';
    g += `<rect x="${padL + i * slot}" y="${padT}" width="${slot}" height="${H - padT - padB}" class="hit" data-tip="${esc(it.tip || `<b>${esc(it.label)}</b><br>${esc(fmt(it.value))}`)}"/>`;
    if (i % every === 0) g += `<text x="${x + bw / 2}" y="${H - 6}" class="ax" text-anchor="middle">${esc(it.label)}</text>`;
  });
  if (opt.ref != null) g += `<line x1="${padL}" x2="${W - padR}" y1="${ys(opt.ref)}" y2="${ys(opt.ref)}" class="ref"/><text x="${W - padR}" y="${ys(opt.ref) - 5}" class="ax" text-anchor="end">${esc(opt.refLabel || '')}</text>`;
  if (opt.line) {
    const pts = opt.line.map((v, i) => [padL + i * slot + slot / 2, ys(v)]);
    g += `<path d="${pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')}" class="ln dash" style="stroke:var(--fg-3)"/>`;
  }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label || 'chart')}">${g}</svg>`;
}
/* HTML horizontal bars: items [{label, value, sub}] */
function barsH(items, opt = {}) {
  if (!items.length) return empty('No data yet');
  const max = Math.max(...items.map(i => Math.abs(i.value)), 1);
  const fmt = opt.fmt || money;
  return `<div class="hbars">${items.map(i => `<div class="hb" data-tip="${esc(`<b>${esc(i.label)}</b><br>${esc(fmt(i.value))}${i.sub ? '<br>' + esc(i.sub) : ''}`)}">
    <span class="hb-l">${esc(i.label)}</span>
    <span class="hb-t"><span class="hb-f ${i.value < 0 ? 'neg' : ''}" style="width:${(Math.abs(i.value) / max * 100).toFixed(1)}%;${i.color ? `background:var(${i.color})` : ''}"></span></span>
    <span class="hb-v">${esc(fmt(i.value))}</span></div>`).join('')}</div>`;
}
function sparkline(values, opt = {}) {
  const v = values.filter(x => x != null);
  if (v.length < 2) return '';
  const W = opt.w || 120, H = opt.h || 30, min = Math.min(...v), max = Math.max(...v), span = max - min || 1;
  const pts = v.map((y, i) => [i * (W - 4) / (v.length - 1) + 2, H - 3 - (y - min) / span * (H - 6)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const e = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d} L${e[0]} ${H} L2 ${H} Z" style="fill:var(${opt.color || '--accent'});opacity:.1"/><path d="${d}" style="stroke:var(${opt.color || '--accent'})" class="ln thin"/><circle cx="${e[0]}" cy="${e[1]}" r="2.6" style="fill:var(${opt.color || '--accent'})" class="dot"/></svg>`;
}
function gauge(val, max = 100, opt = {}) {
  const f = clamp(val / max, 0, 1), R = 70, cx = 90, cy = 86;
  const a0 = Math.PI, a1 = Math.PI * (1 - f);
  const p = a => [cx + R * Math.cos(a), cy - R * Math.sin(a)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1), [xe, ye] = p(0);
  const marks = (opt.marks || []).map(m => { const a = Math.PI * (1 - m / max); const [ax, ay] = [cx + (R + 9) * Math.cos(a), cy - (R + 9) * Math.sin(a)]; const [bx, by] = [cx + (R - 9) * Math.cos(a), cy - (R - 9) * Math.sin(a)]; return `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" class="gmark"/>`; }).join('');
  return `<svg class="gauge" viewBox="0 0 180 100" role="img" aria-label="${esc(opt.label || 'gauge')}">
    <path d="M${x0} ${y0} A${R} ${R} 0 0 1 ${xe} ${ye}" class="g-track"/>
    <path d="M${x0} ${y0} A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}" class="g-fill g-${opt.tone || 'accent'}"/>${marks}
    <text x="${cx}" y="${cy - 8}" text-anchor="middle" class="g-val">${esc(opt.text != null ? opt.text : Math.round(val))}</text>
    <text x="${cx}" y="${cy + 10}" text-anchor="middle" class="g-sub">${esc(opt.sub || '')}</text></svg>`;
}
