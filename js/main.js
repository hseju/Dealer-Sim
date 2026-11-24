'use strict';
/* =====================================================================
   Dealer Empire — game shell: title screen, save slots, HUD, toolbar,
   management windows, goals, time, input handling.
   ===================================================================== */

const PANELS = {
  dashboard: ['GM Office', 'dashboard'], showroom: ['Showroom', 'showroom'], inventory: ['New Cars', 'car'], used: ['Pre-Owned', 'used'],
  customers: ['Customers', 'customers'], service: ['Service', 'service'], parts: ['Parts', 'parts'], retention: ['Loyalty', 'retention'],
  employees: ['Staff', 'employees'], finance: ['Finance', 'finance'], oem: ['Aurex', 'oem'], market: ['Market', 'market'], group: ['Empire', 'group'],
};
const TITLES = Object.fromEntries(Object.entries(PANELS).map(([k, v]) => [k, v[0]]));
const LEGACY_KEY = 'dealer-empire-save-v3';
const SIGN_COLORS = [['#0a7480', 'Teal'], ['#b3332c', 'Red'], ['#2556a3', 'Blue'], ['#c47f12', 'Amber'], ['#2f3a45', 'Graphite']];

/* ---------- Goals: the career ---------- */
const GOALS = [
  { id: 'order', title: 'Stock the lot', desc: 'Order 10 new vehicles from Aurex.', reward: 10000, done: () => (S.flags.ordered || 0) >= 10, prog: () => [(S.flags.ordered || 0), 10] },
  { id: 'deal', title: 'Close your first deal', desc: 'Click a customer in the showroom and sell them a car yourself.', reward: 15000, done: () => S.deals.some(d => d.by === 'You') },
  { id: 'team', title: 'Grow the team', desc: 'Hire someone new. A BDC agent pays for itself in retention.', reward: 10000, done: () => S.emps.some(e => e.hired >= 0 && e.status !== 'gone') },
  { id: 'program', title: 'Keep them coming back', desc: 'Launch a customer loyalty program.', reward: 10000, done: () => Object.values(S.programs).some(Boolean) },
  { id: 'sold25', title: 'Move the metal', desc: 'Sell 25 vehicles.', reward: 25000, done: () => (S.flags.totalSold || 0) >= 25, prog: () => [(S.flags.totalSold || 0), 25] },
  { id: 'profit', title: 'Back in the black', desc: 'Finish a month with a net profit.', reward: 40000, done: () => S.fin.hist.some(h => !h.prior && statementNet(h) > 0) },
  { id: 'target', title: 'Make Aurex happy', desc: 'Hit the monthly new-vehicle sales target.', reward: 50000, done: () => S.oem.hist.some(h => h.units >= h.target) },
  { id: 'preferred', title: 'Preferred dealer', desc: 'Reach Preferred standing with Aurex (60+).', reward: 50000, done: () => S.oem.standing >= 60 && S.oem.hist.length > 0, prog: () => [S.oem.standing, 60] },
  { id: 'retention', title: 'Customers for life', desc: 'Reach 65% owner retention.', reward: 60000, done: () => S.kpiCache.ret && S.kpiCache.ret.owner >= 0.65, prog: () => [Math.round((S.kpiCache.ret ? S.kpiCache.ret.owner : 0) * 100), 65] },
  { id: 'expand', title: 'Build it bigger', desc: 'Open your first expansion project.', reward: 100000, done: () => S.exp.owned.length > 0 },
  { id: 'million', title: 'Seven figures', desc: 'Earn $1,000,000 in total net profit.', reward: 150000, done: () => sum(S.fin.hist.filter(h => !h.prior), statementNet) >= 1e6, prog: () => [Math.round(sum(S.fin.hist.filter(h => !h.prior), statementNet) / 1000), 1000] },
  { id: 'group', title: 'Dealer group', desc: 'Own a second rooftop.', reward: 250000, done: () => S.stores.length > 0 },
];
function currentGoal() { S.flags.goals = S.flags.goals || []; return GOALS.find(g => !S.flags.goals.includes(g.id)); }
function checkGoals() {
  if (!S || UI.screen !== 'game') return;
  S.flags.goals = S.flags.goals || [];
  for (const g of GOALS) {
    if (S.flags.goals.includes(g.id)) continue;
    let ok = false; try { ok = g.done(); } catch (e) { ok = false; }
    if (ok) {
      S.flags.goals.push(g.id); S.cash += g.reward;
      logEvent('good', 'gm', `Goal complete: ${g.title}. Aurex sends a ${money(g.reward)} performance grant.`);
      UI.celebrate = { title: g.title, reward: g.reward, t: Date.now() };
      setTimeout(() => { UI.celebrate = null; renderHud(); }, 4200);
    }
    break; // goals unlock in order
  }
}

/* ---------- Shell ---------- */
function buildShell() {
  document.getElementById('app').innerHTML = `<div class="game" id="game">
    <canvas id="world" aria-label="Your dealership. Click customers, cars and buildings."></canvas>
    <div class="hud" id="hud"></div>
    <div id="pwin"></div>
  </div><div id="story"></div><div id="title"></div><div id="overlay"></div><div id="drawer"></div><div id="toasts" aria-live="polite"></div><div id="tip" role="tooltip"></div>`;
}
function renderHud() {
  const hud = document.getElementById('hud'); if (!hud || !S) return;
  if (UI.screen !== 'game') { hud.innerHTML = ''; return; }
  const p = dparts(S.day), t = S.oem.targets.units;
  const waiting = visibleVisits().length, appr = S.used.filter(u => u.status === 'appraisal').length;
  const badges = { showroom: waiting, used: appr, service: S.svc.ros.filter(r => r.status === 'parts').length, employees: S.emps.filter(e => e.status !== 'gone' && e.morale < 38).length, retention: 0 };
  const g = currentGoal();
  const gp = g && g.prog ? g.prog() : null;
  const alerts = computeAlerts().filter(a => a.tone !== 'good' && !/OEM sales target/.test(a.text)).slice(0, 3);
  const wasOpen = [...hud.querySelectorAll('details')].map(d => d.open);
  hud.innerHTML = `
    <div class="hud-top">
      <div class="hud-card hud-brand" data-act="go" data-to="dashboard" role="button" tabindex="0" data-tip="GM office">
        <svg class="logo" viewBox="0 0 40 40" aria-hidden="true"><rect x="1" y="1" width="38" height="38" rx="9" fill="${S.color || '#0a7480'}"/><path d="M9 27a11 11 0 1 1 22 0" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="m20 27 6-8" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="20" cy="27" r="2.2" fill="#fff"/></svg>
        <div><b>${esc(S.dealerName)}</b><small>${DOW_LONG[p.dow]} · ${MONTHS[p.m]} ${p.dom}, ${p.y}${p.dow === 0 ? ' · closed' : ''}</small></div>
      </div>
      <div class="hud-card hud-res">
        <span class="res ${S.cash < 0 ? 'neg' : ''}" data-act="go" data-to="finance" role="button" tabindex="0" data-tip="Cash in the bank">${icon('dollar')}<b>${moneyK(S.cash)}</b></span>
        <span class="res" data-act="go" data-to="finance" role="button" tabindex="0" data-tip="Gross profit this month">${icon('trendup')}<b>${moneyK(stGross(S.fin.mtd))}</b><small>this month</small></span>
        <span class="res" data-act="go" data-to="oem" role="button" tabindex="0" data-tip="New cars sold vs the Aurex target this month">${icon('flag')}<b>${S.oem.mtdNew}/${t}</b><small>Aurex</small></span>
        <span class="res" data-act="go" data-to="retention" role="button" tabindex="0" data-tip="Customer satisfaction, sales / service">${icon('star')}<b>${Math.round(kpiSalesCsi())}</b><small>CSI</small></span>
      </div>
      <div class="hud-card hud-time">
        <details class="skip"><summary class="sp" aria-label="Menu" data-tip="Menu">${icon('menu')}</summary><div class="skip-menu">
          <button type="button" data-act="saveNow">${icon('save')} Save game</button>
          <button type="button" data-act="toTitle">${icon('left')} Main menu</button>
          <button type="button" data-act="recenter">${icon('search')} Re-center view</button>
          <button type="button" data-act="theme">${icon(currentTheme() === 'dark' ? 'moon' : 'sun')} Window theme: ${{ system: 'System', light: 'Light', dark: 'Dark' }[UI.themePref || 'system']}</button></div></details>
      </div>
    </div>
    ${UI.panel ? '' : `<div class="hud-left">
      ${g ? `<div class="goal" data-act="go" data-to="dashboard" role="button" tabindex="0"><span class="goal-k">Goal ${S.flags.goals.length + 1} of ${GOALS.length}</span><b>${esc(g.title)}</b><small>${esc(g.desc)}</small>${gp ? bar(gp[0] / gp[1], 'accent') : ''}<span class="goal-r">Reward ${moneyK(g.reward)}</span></div>` : `<div class="goal"><span class="goal-k">Career</span><b>Every goal complete</b><small>You built a dealer group. Keep growing it.</small></div>`}
    </div>
    <div class="hud-right">${alerts.map(a => `<button type="button" class="note note-${a.tone}" ${a.link ? `data-act="go" data-to="${a.link}" ${a.filter ? `data-filter="${a.filter}"` : ''}` : `data-act="${a.act}"`}>${icon(a.icon)}<span>${esc(a.text)}</span></button>`).join('')}</div>`}
    ${UI.celebrate ? `<div class="celebrate"><span>Goal complete</span><b>${esc(UI.celebrate.title)}</b><small>+${money(UI.celebrate.reward)} from Aurex</small></div>` : ''}
    <nav class="toolbar" aria-label="Departments">${Object.entries(PANELS).map(([k, [lab, ic]]) => `<button type="button" class="tool ${UI.panel === k ? 'on' : ''}" data-act="go" data-to="${k}">${icon(ic)}<span>${lab}</span>${badges[k] ? `<b class="tool-badge">${badges[k]}</b>` : ''}</button>`).join('')}</nav>`;
  hud.querySelectorAll('details').forEach((d, i) => { if (wasOpen[i]) d.open = true; });
}
function renderHudSoon() { /* the menu state feeds canRun(); nothing to redraw */ }
function pauseReason() {
  if (S.over) return 'Game over';
  if (S.report) return 'Paused — month-end results';
  if (S.decisions.length) return 'Paused — a decision needs you';
  if (UI.modal === 'neg') return 'Paused — talking to a customer';
  if (UI.modal) return 'Paused';
  return 'Paused';
}
function openPanel(k) { if (!PANELS[k]) return; UI.panel = k; UI.route = k; UI.drawer = null; render(); }
function renderPanel() {
  const el = document.getElementById('pwin'); if (!el) return;
  if (!UI.panel || UI.screen !== 'game') { el.innerHTML = ''; return; }
  const [lab, ic] = PANELS[UI.panel];
  const prev = el.querySelector('#view'); const st = prev && el.dataset.k === UI.panel ? prev.scrollTop : 0;
  el.dataset.k = UI.panel;
  el.innerHTML = `<div class="pwin-scrim" data-act="closePanel"></div><section class="pwin" role="dialog" aria-label="${esc(lab)}">
    <header class="pwin-h"><span class="pwin-ic">${icon(ic)}</span><h2>${esc(lab)}</h2><span class="muted pwin-sub">${esc(S.dealerName)} · ${fmtDate(S.day)}</span><button type="button" class="icon-btn" data-act="closePanel" aria-label="Close window">${icon('x')}</button></header>
    <div class="view" id="view"></div></section>`;
  renderView();
  const nv = el.querySelector('#view'); if (nv && st) nv.scrollTop = st;
}
function renderView() {
  const el = document.getElementById('view'); if (!el) return;
  const fn = VIEWS[UI.panel] || VIEWS.dashboard;
  try { el.innerHTML = fn(); } catch (e) { console.error(e); el.innerHTML = panel('Something went wrong', `<p>${esc(e.message)}</p>`); }
}
function renderOverlay() {
  const o = document.getElementById('overlay');
  let html = '', cls = '';
  if (UI.screen === 'game') {
    if (S.over) { html = gameOverModal(); cls = 'md'; }
    else if (UI.modal === 'neg') { html = renderDealScene(); cls = 'scene-modal' + (UI.neg && UI.neg.done ? ' done' : ''); }
    else if (S.report) { html = reportModal(); cls = 'lg'; }
    else if (S.decisions.length) { html = decisionModal(); cls = 'md call'; }
    else if (UI.modal === 'order') { html = orderModal(); cls = 'lg'; }
    else if (UI.modal === 'hire') { html = hireModal(); cls = 'lg'; }
    else if (UI.modal && UI.modal.kind) { html = empModal(UI.modal.kind, UI.modal.id); cls = 'sm'; }
  }
  const key = cls + (UI.modal && UI.modal.kind || UI.modal || '');
  const prev = o.querySelector('.modal');
  const sc = prev && prev.dataset.key === key ? (prev.querySelector('.modal-b, .scene-desk') || {}).scrollTop : 0;
  o.innerHTML = html ? `<div class="scrim"></div><div class="modal ${cls}" role="dialog" aria-modal="true" data-key="${key}">${html}</div>` : '';
  if (sc) { const b = o.querySelector('.modal-b, .scene-desk'); if (b) b.scrollTop = sc; }
  const d = document.getElementById('drawer');
  if (UI.drawer && !html && UI.screen === 'game') {
    const inner = UI.drawer.type === 'veh' ? vehDrawer(UI.drawer.id) : custDrawer(UI.drawer.id);
    const prevB = d.querySelector('.drawer-b'); const st = prevB && d.dataset.key === UI.drawer.type + UI.drawer.id ? prevB.scrollTop : 0;
    d.innerHTML = inner ? `<div class="scrim light" data-act="closeDrawer"></div><aside class="drawer" role="dialog" aria-modal="true">${inner}</aside>` : '';
    d.dataset.key = UI.drawer.type + UI.drawer.id;
    const nb = d.querySelector('.drawer-b'); if (nb && st) nb.scrollTop = st;
  } else d.innerHTML = '';
}
function render() {
  renderTitle(); renderHud(); renderPanel(); renderOverlay(); renderStory(); renderToasts();
  if (UI.focus) { const el = document.getElementById(UI.focus); if (el) { el.focus(); if (el.setSelectionRange && el.type === 'search') { const n = el.value.length; el.setSelectionRange(n, n); } } UI.focus = null; }
}
function renderViewSafe() {
  const a = document.activeElement;
  if (a && a.closest && a.closest('#view') && a.matches('input, select, textarea')) { UI.viewDirty = true; return; }
  UI.viewDirty = false; renderView();
}

/* ---------- Title screen & save slots ---------- */
function slotSummary() { return { name: S.dealerName, day: S.day, cash: Math.round(S.cash), months: monthsPlayed(), color: S.color || '#0a7480', saved: Date.now() }; }
function renderTitle() {
  const el = document.getElementById('title'); if (!el) return;
  if (UI.screen !== 'title') { el.innerHTML = ''; return; }
  const meta = UI.meta || { slots: {} };
  const act = meta.active && meta.slots[meta.active];
  let body;
  if (UI.titleView === 'new') {
    const free = [1, 2, 3].find(n => !meta.slots[n]) || meta.active || 1;
    body = `<form class="title-form" data-form="create">
      <h2>Open a new dealership</h2>
      <label class="fl"><span>Dealership name</span><input class="txt" name="name" id="ng-name" maxlength="28" value="Lakeshore Aurex" required></label>
      <label class="fl"><span>Your name (general manager)</span><input class="txt" name="gm" id="ng-gm" maxlength="28" placeholder="Optional"></label>
      <div class="fl"><span>Sign colour</span><div class="swatches">${SIGN_COLORS.map(([c, n], i) => `<label class="sw"><input type="radio" name="color" value="${c}" ${i === 0 ? 'checked' : ''}><i style="background:${c}"></i><span>${n}</span></label>`).join('')}</div></div>
      <label class="fl"><span>Difficulty</span><select class="sel" name="difficulty" id="ng-diff"><option value="standard">Standard — start with $2,000,000</option><option value="hard">Challenging — start with $1,400,000</option></select></label>
      <label class="fl"><span>Save slot</span><select class="sel" name="slot" id="ng-slot">${[1, 2, 3].map(n => `<option value="${n}" ${n === free ? 'selected' : ''}>Slot ${n}${meta.slots[n] ? ` — replaces ${esc(meta.slots[n].name)}` : ' — empty'}</option>`).join('')}</select></label>
      <div class="title-actions"><button type="button" class="btn ghost" data-act="titleView" data-val="main">Back</button><button type="submit" class="btn primary big">${icon('key')}<span>Open for business</span></button></div>
    </form>`;
  } else if (UI.titleView === 'load') {
    body = `<div class="title-form"><h2>Load a game</h2><div class="slots">${[1, 2, 3].map(n => { const s = meta.slots[n]; return s ? `<div class="slot"><i style="background:${s.color}"></i><div><b>${esc(s.name)}</b><small>${fmtDate(s.day)} · ${moneyK(s.cash)} · ${plural(s.months, 'month')} as GM</small></div><button type="button" class="btn primary sm" data-act="loadSlot" data-val="${n}">Play</button><button type="button" class="btn ghost sm" data-act="delSlot" data-val="${n}" aria-label="Delete slot ${n}">${icon('trash')}</button></div>` : `<div class="slot empty"><i></i><div><b>Slot ${n}</b><small>Empty</small></div></div>`; }).join('')}</div>
      <div class="title-actions"><button type="button" class="btn ghost" data-act="titleView" data-val="main">Back</button></div></div>`;
  } else {
    body = `<div class="title-menu">
      <span class="title-k">Story · learn the business</span>
      <button type="button" class="tbtn primary" data-act="storyStart"><b>Save Aunt May's dealership</b><small>${esc(storyProgressLabel())}</small></button>
      <span class="title-k">Free play · run the whole dealership</span>
      ${act ? `<button type="button" class="tbtn" data-act="loadSlot" data-val="${meta.active}"><b>Continue</b><small>${esc(act.name)} · ${fmtDate(act.day)} · ${moneyK(act.cash)}</small></button>` : ''}
      <div class="tbtn-row"><button type="button" class="tbtn" data-act="titleView" data-val="new"><b>New dealership</b><small>Every department at once</small></button>
      <button type="button" class="tbtn" data-act="titleView" data-val="load" ${Object.keys(meta.slots).length ? '' : 'disabled'}><b>Load game</b><small>${Object.keys(meta.slots).length} saved</small></button></div>
    </div>`;
  }
  el.innerHTML = `<div class="title-screen"><div class="title-card">
    <div class="title-logo"><svg viewBox="0 0 40 40" aria-hidden="true"><rect x="1" y="1" width="38" height="38" rx="9" fill="#0a7480"/><path d="M9 27a11 11 0 1 1 22 0" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="m20 27 6-8" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="20" cy="27" r="2.2" fill="#fff"/></svg><div><h1>Dealer Empire</h1><p>Sell cars. Fix cars. Keep customers for life.</p></div></div>
    ${body}
    <p class="title-foot">Your games save in this browser.</p></div></div>`;
}
async function loadMeta() {
  let meta = null;
  try { meta = await idbGet('meta'); } catch (e) { meta = null; }
  if (!meta) {
    meta = { active: null, slots: {} };
    let legacy = null;
    try { legacy = await idbGet(LEGACY_KEY); } catch (e) { /* none */ }
    if (!legacy) { try { const raw = localStorage.getItem(LEGACY_KEY); legacy = raw ? JSON.parse(raw) : null; } catch (e) { /* none */ } }
    if (legacy && legacy.v === 3 && legacy.customers) {
      const keep = S; S = legacy; meta.slots[1] = slotSummary(); meta.active = 1; S = keep;
      try { await idbPut('slot1', legacy); await idbPut('meta', meta); } catch (e) { /* ignore */ }
    }
  }
  UI.meta = meta;
  return meta;
}
async function loadSlot(n) {
  let s = null;
  try { s = await idbGet('slot' + n); } catch (e) { s = null; }
  if (!s) { toast('That save could not be read.', 'bad'); return; }
  enterGame(s, n);
}
function prepareState() {
  rebuildIndex(); MODS = null; refreshMods(); computeKpis();
  if (S.clock == null) S.clock = 0;
  if (!S.color) S.color = '#0a7480';
  for (const v of S.showroom) if (v.shown == null) v.shown = arrMin(v.time) <= S.clock;
}
function enterGame(state, slot) {
  S = state; prepareState();
  UI.slot = slot; UI.meta.active = slot; UI.screen = 'game'; UI.panel = null; UI.modal = null; UI.drawer = null; UI.neg = null; UI.filters = {}; UI.page = {};
  resetWorld(); fitCamera();
  revealArrivals();
  saveGame();
  render();
}
function saveGame(manual) {
  UI.daysSinceSave = 0;
  if (UI.screen !== 'game' || !UI.slot) return;
  const meta = UI.meta; meta.slots[UI.slot] = slotSummary(); meta.active = UI.slot;
  const done = () => { if (manual) toast(`Saved to slot ${UI.slot}.`, 'good'); };
  try { idbPut('slot' + UI.slot, S).then(() => idbPut('meta', meta)).then(done, () => { if (manual) toast('Saving failed — browser storage is unavailable or full.', 'bad'); }); }
  catch (e) { if (manual) toast('Saving failed — browser storage is unavailable.', 'bad'); }
}
let _db = null;
function idbOpen() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    try { const r = indexedDB.open('dealer-empire', 1); r.onupgradeneeded = () => r.result.createObjectStore('saves'); r.onsuccess = () => { _db = r.result; res(_db); }; r.onerror = () => rej(r.error); }
    catch (e) { rej(e); }
  });
}
function idbPut(key, val) { return idbOpen().then(db => new Promise((res, rej) => { const tx = db.transaction('saves', 'readwrite'); tx.objectStore('saves').put(val, key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); })); }
function idbGet(key) { return idbOpen().then(db => new Promise((res, rej) => { const rq = db.transaction('saves', 'readonly').objectStore('saves').get(key); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => rej(rq.error); })); }
function idbDel(key) { return idbOpen().then(db => new Promise((res, rej) => { const tx = db.transaction('saves', 'readwrite'); tx.objectStore('saves').delete(key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); })); }

/* ---------- Toasts & tooltips ---------- */
function toast(msg, t = 'info', action) {
  const id = Math.random().toString(36).slice(2);
  UI.toasts.push({ id, msg, t, action });
  if (UI.toasts.length > 3) UI.toasts.shift();
  renderToasts();
  setTimeout(() => { UI.toasts = UI.toasts.filter(x => x.id !== id); renderToasts(); }, 4200);
  return false;
}
function renderToasts() {
  const el = document.getElementById('toasts'); if (!el) return;
  el.innerHTML = UI.toasts.map(x => `<div class="toast toast-${tone(x.t)}">${icon(x.t === 'good' ? 'check' : x.t === 'bad' ? 'alert' : 'info')}<span>${esc(x.msg)}</span>${x.action ? `<button type="button" class="toast-a" data-act="${x.action.act}" data-id="${esc(x.action.id)}">${esc(x.action.label)}</button>` : ''}</div>`).join('');
}
function initTooltips() {
  const tip = document.getElementById('tip');
  let cur = null;
  document.addEventListener('mouseover', e => {
    if (e.target.id === 'world') return;
    const el = e.target.closest('[data-tip]');
    if (el === cur) return;
    cur = el;
    if (!el || !el.dataset.tip) { tip.classList.remove('on'); return; }
    tip.innerHTML = el.dataset.tip; tip.classList.add('on');
  });
  document.addEventListener('mousemove', e => {
    if (!cur || e.target.id === 'world') return;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 16;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = e.clientY - h - 12;
    tip.style.transform = `translate(${Math.max(4, x)}px, ${Math.max(4, y)}px)`;
  });
  document.addEventListener('scroll', () => { tip.classList.remove('on'); cur = null; }, true);
}

/* ---------- Time ----------
   The world keeps moving: a business day runs from opening to close, customers
   arrive while it runs, and it stops for decisions, results and conversations. */
const DAY_MIN = 660;
const DAY_MS = 14000; // one business day, opening to close
const TICK = 100;
function canAdvance() { return S && !blocked() && UI.modal !== 'neg'; }
function canRun() { return S && UI.screen === 'game' && canAdvance() && !UI.modal && !UI.panel && !UI.drawer && !document.querySelector('.hud details[open]') && document.visibilityState !== 'hidden'; }
function arrMin(t) { const [h, m] = t.split(':').map(Number); return (h - 9) * 60 + m; }
function step(n) {
  if (!canAdvance()) { render(); return; }
  const startKey = S.fin.mtd.key;
  let i = 0;
  const t0 = performance.now();
  while (advanceDay()) {
    i++;
    if (blocked()) break;
    if (n === 'month' ? S.fin.mtd.key !== startKey : i >= n) break;
    if (performance.now() - t0 > 8000) break;
  }
  S.clock = 0; revealArrivals(); checkGoals();
  saveGame();
  UI.drawer = null;
  render();
}
function startClock() { clearInterval(UI.timer); UI.timer = setInterval(tick, TICK); }
function stopPlay() { /* the clock checks canRun() every tick */ }
function tick() {
  const running = canRun();
  if (running !== UI.wasRunning) { UI.wasRunning = running; renderHud(); }
  if (!running) return;
  const sunday = dparts(S.day).dow === 0;
  S.clock = (S.clock || 0) + DAY_MIN * TICK / (DAY_MS * (sunday ? 0.15 : 1));
  revealArrivals();
  if (S.clock >= DAY_MIN) closeDayLive();
}
function visibleVisits() { return S.showroom.filter(v => v.shown && (v.state === 'waiting' || v.state === 'negotiating')); }
function revealArrivals() {
  const now = S.clock || 0, fresh = [];
  for (const v of S.showroom) if (!v.shown && arrMin(v.time) <= now) { v.shown = true; fresh.push(v); }
  if (!fresh.length) return;
  renderHud();
  if (UI.panel === 'showroom' || UI.panel === 'dashboard') renderViewSafe();
  if (UI.panel && UI.panel !== 'showroom') {
    UI.toasts = UI.toasts.filter(x => !x.arrival);
    const c = cust(fresh[0].cid), n = visibleVisits().length;
    toast(n > 1 ? `${fullName(c)} just walked in. ${n} customers are waiting.` : `${fullName(c)} just walked into the showroom.`, 'info', { act: 'negotiate', id: fresh[0].id, label: 'Talk to them' });
    UI.toasts[UI.toasts.length - 1].arrival = true;
  }
}
function closeDayLive() {
  const day = S.day;
  advanceDay();
  S.clock = 0;
  Wd.night = 1;
  const d = S.fin.daily[S.fin.daily.length - 1];
  if (d && d.d === day && dparts(day).dow !== 0 && d.units) toast(`${DOW_LONG[dparts(day).dow]} closed: ${plural(d.units, 'car')} sold, ${moneyK(d.gross)} gross profit.`, d.gross >= 0 ? 'good' : 'bad');
  UI.daysSinceSave = (UI.daysSinceSave || 0) + 1;
  if (UI.daysSinceSave >= 7 || S.report || S.decisions.length) saveGame();
  revealArrivals(); checkGoals();
  renderHud(); if (UI.panel) { renderViewSafe(); const sub = document.querySelector('.pwin-sub'); if (sub) sub.textContent = `${S.dealerName} · ${fmtDate(S.day)}`; } renderOverlay();
}

/* ---------- Theme ---------- */
function currentTheme() { const a = document.documentElement.getAttribute('data-theme'); if (a) return a; return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
function applyTheme() {
  const pref = UI.themePref || 'system';
  if (pref === 'system') { if (UI.hostTheme) document.documentElement.setAttribute('data-theme', UI.hostTheme); else document.documentElement.removeAttribute('data-theme'); }
  else document.documentElement.setAttribute('data-theme', pref);
}

/* ---------- Actions ---------- */
function setPath(obj, path, val) { const ks = path.split('.'); let o = obj; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = val; }
const ACT = {
  go(d) {
    if (d.filter && d.to === 'customers') { UI.filters.cust = { seg: 'all', q: '', quick: d.filter }; UI.page.cust = 0; }
    UI.panel = UI.panel === d.to && !d.filter ? null : d.to; UI.route = d.to; UI.drawer = null;
  },
  closePanel() { UI.panel = null; },
  set(d) { const v = isNaN(+d.val) || d.val === '' ? d.val : +d.val; setPath(S.settings, d.key, v); if (d.key === 'usedPlan') toast('Default trade plan updated.', 'info'); },
  filterSeg(d) { const [a, b] = d.key.split('.'); UI.filters[a][b] = d.val; UI.page[a] = 0; },
  sortSeg(d) { UI.sort[d.key] = d.val; UI.page[d.key] = 0; },
  tabSeg(d) { UI.tab[d.key] = d.val; },
  page(d) { UI.page[d.key] = Math.max(0, +d.val); },
  dismissIntro() { S.flags.intro = false; },
  openOrder() { UI.modal = 'order'; UI.order = UI.order || { mid: 'terra', ti: 0, color: 'any', qty: 2 }; },
  orderModel(d) { UI.order.mid = d.id; UI.order.ti = 0; UI.order.qty = Math.min(UI.order.qty, MODEL[d.id].exclusive ? Math.max(1, S.oem.exclusiveAlloc) : 20); },
  orderQty(d) { UI.order.qty = clamp(UI.order.qty + +d.val, 1, 20); },
  placeOrder() { const o = UI.order; if (orderVehicles(o.mid, o.ti, o.color, o.qty) === true) { toast(`Ordered ${o.qty} × ${MODEL[o.mid].name}. Watch for the car carrier in 1–3 weeks.`, 'good'); checkGoals(); } },
  openVeh(d) { UI.drawer = { type: 'veh', id: d.id }; },
  wholesaleNew(d) { const v = vehById(d.id); if (v) wholesaleNew(v); UI.drawer = null; },
  negotiate(d) { UI.panel = null; openNegotiation(d.id); return 'skip'; },
  negVeh(d) {
    const v = negVisit(); const veh = vehById(d.id); if (!v || !veh) return;
    const old = UI.neg.deal; const nd = defaultDeal(v, veh);
    if (old) { nd.down = old.down; if (old.trade && v.trade) nd.trade = old.trade; if (old.type !== 'lease' || veh.kind === 'new') { nd.type = old.type; nd.term = old.term; nd.rate = old.type === 'cash' ? 0 : nd.rate; } }
    if (nd.type === 'finance' && veh.kind === 'used' && nd.term > 84) nd.term = 72;
    UI.neg.deal = nd; UI.neg.suggest = null;
  },
  negFilter(d) { UI.neg.filter = d.val; },
  negType(d) {
    const v = negVisit(), deal = UI.neg.deal; if (!v || !deal) return;
    const c = cust(v.cid), veh = vehById(deal.vid);
    if (d.val === 'lease' && veh.kind !== 'new') return;
    deal.type = d.val;
    if (d.val === 'lease') { deal.term = 36; deal.rate = round2(buyRate(c.credit, 36, false) - 0.6 + S.settings.desk.markup); deal.prod = deal.prod.filter(p => p !== 'gap'); }
    else if (d.val === 'finance') { deal.term = veh.kind === 'new' ? 72 : 60; deal.rate = round2(buyRate(c.credit, deal.term, veh.kind === 'used') + S.settings.desk.markup); }
    else { deal.rate = 0; deal.prod = []; }
  },
  negAppraise() { const v = negVisit(); if (!v) return; v.appraised = true; v.mood = clamp(v.mood - 2, 0, 100); v.log.push({ who: 'system', text: `Your used manager walked the ${v.trade.spec.model}: worth ${money(v.trade.acv)} to you, needs about ${money(v.trade.recon)} of work.` }); },
  negTD() {
    const v = negVisit(); if (!v || v.td) return;
    const r = evalDeal(v, UI.neg.deal); v.td = true;
    v.boost = (v.boost || 0) + (r.fit > 0.65 ? 0.35 : 0.1); v.mood = clamp(v.mood + 4, 0, 100);
    v.log.push({ who: 'customer', text: r.fit > 0.75 ? 'That drove really nicely. I could see myself in this.' : r.fit > 0.55 ? "It's nice. Not sure it's exactly right, but nice." : "Hmm. It's not really what I pictured." });
  },
  negTO() {
    const v = negVisit(), g = present('gsm')[0]; if (!v || v.to || !g) return;
    v.to = true; v.boost = (v.boost || 0) + 0.15 + (g.skill - 50) / 120; v.patience++;
    v.log.push({ who: 'system', text: `${empName(g)} sits down and resets the conversation. You get another round.` });
  },
  negPresent() { negPresent(); return 'skip'; },
  negAcceptCounter() {
    const v = negVisit(); if (!v || !v.counter) return;
    UI.neg.deal = { ...v.counter.deal, acc: v.counter.deal.acc.slice(), prod: v.counter.deal.prod.slice() };
    const r = evalDeal(v, UI.neg.deal);
    if (!r.approved) { v.log.push({ who: 'system', text: 'The bank will not approve their counter.' }); v.counter = null; return; }
    v.log.push({ who: 'you', text: 'Deal. Let\'s get the paperwork going.' });
    v.log.push({ who: 'customer', text: pick(LINES.accept) });
    UI.neg.done = finalizeSale(v, UI.neg.deal, null, 'manual');
    checkGoals();
  },
  closeNeg() {
    const v = negVisit();
    if (v) { if (v.state === 'negotiating') v.state = 'waiting'; if (v.state === 'sold' || v.state === 'left') S.showroom = S.showroom.filter(x => x !== v); }
    UI.modal = null; UI.neg = null;
  },
  closeModal() { UI.modal = null; },
  closeDrawer() { UI.drawer = null; },
  openCustomer(d) { UI.drawer = { type: 'cust', id: d.id }; },
  invite(d) { inviteCustomer(d.id); },
  callBook(d) { callToBook(d.id); },
  upgradeOffers() { sendUpgradeOffers(); },
  callOverdue() { callOverdue(); },
  winBack() { winBackCampaign(); },
  usedPlan(d) {
    const u = S.used.find(x => x.id === d.id); if (!u) return;
    if (d.val === 'recon') { sendToRecon(u); toast(`${u.stock} sent to the shop for reconditioning.`, 'info'); }
    else if (d.val === 'asis') { retailAsIs(u); toast(`${u.stock} is on the lot as-is at ${money(u.ask)}.`, 'info'); }
    else if (d.val === 'wholesale') wholesaleUnit(u);
    else if (d.val === 'auction') { auctionUnit(u); toast(`${u.stock} consigned to next week's auction.`, 'info'); }
  },
  usedMarket(d) { const u = S.used.find(x => x.id === d.id); if (u) { u.ask = roundTo(usedRetail(u), 100) - 5; toast(`${u.stock} repriced to ${money(u.ask)}.`, 'info'); } },
  usedWs(d) { const u = S.used.find(x => x.id === d.id); if (u) wholesaleUnit(u); },
  usedAuc(d) { const u = S.used.find(x => x.id === d.id); if (u) auctionUnit(u); },
  buyLot(d) { buyAuction(d.id); },
  loaners(d) { S.settings.loaners = clamp(S.settings.loaners + +d.val, 0, 30); },
  addBay() { addServiceBay(); },
  partOrder(d) { const p = partByPn(d.pn); if (!p) return; const q = Math.max(p.max - p.qoh - p.onOrder, Math.max(2, p.min)); stockOrder(p, q); toast(`Ordered ${Math.round(q)} × ${p.desc} (${money(q * p.cost)}), arriving in ${partLead(p)} days.`, 'info'); },
  partReturn(d) { const p = partByPn(d.pn); if (p) returnParts(p); },
  openHire() { UI.modal = 'hire'; UI.hireRole = UI.hireRole || 'sales'; },
  hireRole(d) { UI.hireRole = d.val; },
  hire(d) { hireCandidate(d.role, d.id); checkGoals(); },
  empTrain(d) { UI.modal = { kind: 'train', id: d.id }; },
  empComp(d) { UI.modal = { kind: 'comp', id: d.id }; },
  empPromote(d) { UI.modal = { kind: 'promote', id: d.id }; },
  empFire(d) { UI.modal = { kind: 'fire', id: d.id }; },
  train(d) { trainEmployee(d.id, d.course); UI.modal = null; },
  promote(d) { promoteEmployee(d.id, d.to); UI.modal = null; },
  fire(d) { fireEmployee(d.id); UI.modal = null; },
  upgradeFacility() { upgradeFacility(); },
  decide(d) { resolveDecision(d.id, +d.val); checkGoals(); saveGame(); },
  openDecision() { },
  openNewGame() { UI.screen = 'title'; UI.titleView = 'new'; },
  closeReport() { S.report = null; checkGoals(); saveGame(); },
  startExp(d) { startExpansion(d.id); checkGoals(); },
  storeInvest(d) { storeInvest(d.id); },
  storeGm(d) { storeReplaceGm(d.id); },
  storeSell(d) { storeSell(d.id); },
  step1() { step(1); return 'skip'; },
  step7() { step(7); return 'skip'; },
  stepMonth() { step('month'); return 'skip'; },
  saveNow() { saveGame(true); },
  toTitle() { saveGame(); UI.screen = 'title'; UI.titleView = 'main'; UI.panel = null; UI.drawer = null; UI.modal = null; ST.menu = false; ST.modal = null; ST.run = null; fitCamera(); loadMeta().then(render); return 'skip'; },
  recenter() { if (isStory()) stFitCamera(); else fitCamera(); },
  titleView(d) { UI.titleView = d.val; },
  loadSlot(d) { loadSlot(+d.val); return 'skip'; },
  delSlot(d) {
    const n = +d.val;
    if (UI.confirmDel !== n) { UI.confirmDel = n; toast(`Click delete again to erase slot ${n}.`, 'bad'); setTimeout(() => { UI.confirmDel = null; }, 4000); return 'skip'; }
    UI.confirmDel = null; delete UI.meta.slots[n]; if (UI.meta.active === n) UI.meta.active = null;
    idbDel('slot' + n).then(() => idbPut('meta', UI.meta)).then(render, render);
    return 'skip';
  },
  theme() {
    const order = ['system', 'light', 'dark'];
    UI.themePref = order[(order.indexOf(UI.themePref || 'system') + 1) % 3];
    try { localStorage.setItem('de-theme', UI.themePref); } catch (e) { /* ignore */ }
    applyTheme();
  },
  ...DEAL_ACT,
  ...STORY_ACT,
};
const CHG = {
  ad(el) { S.settings.ad = +el.value; },
  assign(el) { if (el.value) assignVisit(el.dataset.id, el.value); },
  filter(el) { const [a, b] = el.dataset.key.split('.'); UI.filters[a][b] = el.value; UI.page[a] = 0; UI.focus = el.id; },
  vehDisc(el) { const v = vehById(el.dataset.id); if (v) v.discount = +el.value; },
  orderTrim(el) { UI.order.ti = +el.value; },
  orderColor(el) { UI.order.color = el.value; },
  usedAsk(el) { const u = S.used.find(x => x.id === el.dataset.id); if (u && +el.value > 500) u.ask = Math.round(+el.value); },
  laborRate(el) { S.settings.laborRate = +el.value; },
  oilPrice(el) { S.settings.oilPrice = +el.value; },
  partMin(el) { const p = partByPn(el.dataset.pn); if (p) p.min = Math.max(0, Math.round(+el.value)); if (p.max < p.min) p.max = p.min; },
  partMax(el) { const p = partByPn(el.dataset.pn); if (p) p.max = Math.max(p.min, Math.round(+el.value)); },
  partAuto(el) { const p = partByPn(el.dataset.pn); if (p) p.auto = el.checked; },
  autoReorder(el) { S.settings.autoReorder = el.checked; },
  program(el) {
    const id = el.dataset.id, p = PROGRAM[id];
    S.programs[id] = el.checked;
    if (el.checked) { S.progStats[id].since = S.day; logEvent('info', 'retention', `Launched ${p.name}${p.monthly ? ` (${money(p.monthly)}/month)` : ''}.`); toast(`${p.name} is now active.`, 'good'); checkGoals(); }
    else { logEvent('info', 'retention', `Discontinued ${p.name}.`); toast(`${p.name} turned off.`, 'info'); }
  },
  finMonth(el) { UI.finMonth = el.value; },
};

function onClick(e) {
  const a = e.target.closest('[data-act]');
  if (!a || a.disabled) return;
  if (a.tagName === 'A' || a.tagName === 'BUTTON' || a.getAttribute('role') === 'button') e.preventDefault();
  const fn = ACT[a.dataset.act]; if (!fn) return;
  const sk = a.closest('details.skip'); if (sk && a.tagName === 'BUTTON') sk.open = false;
  const r = fn(a.dataset, a, e);
  if (r !== 'skip') render();
}
function onChange(e) {
  const el = e.target;
  if (el.dataset.chg && CHG[el.dataset.chg]) { CHG[el.dataset.chg](el); render(); return; }
  if (el.dataset.negchk && UI.neg && UI.neg.deal) {
    const arr = UI.neg.deal[el.dataset.negchk];
    const i = arr.indexOf(el.value);
    if (el.checked && i < 0) arr.push(el.value); else if (!el.checked && i >= 0) arr.splice(i, 1);
    renderOverlay(); return;
  }
  if (el.dataset.neg === 'term' && UI.neg && UI.neg.deal) {
    const v = negVisit(), deal = UI.neg.deal, c = cust(v.cid), veh = vehById(deal.vid);
    const oldBuy = deal.type === 'lease' ? buyRate(c.credit, deal.term, false) - 0.6 : buyRate(c.credit, deal.term, veh.kind === 'used');
    const mk = deal.rate - oldBuy;
    deal.term = +el.value;
    const nb = deal.type === 'lease' ? buyRate(c.credit, deal.term, false) - 0.6 : buyRate(c.credit, deal.term, veh.kind === 'used');
    deal.rate = round2(nb + mk);
    renderOverlay();
  }
}
function onInput(e) {
  const el = e.target;
  if (el.dataset.neg && UI.neg && UI.neg.deal && el.dataset.neg !== 'term') {
    const k = el.dataset.neg, val = +el.value;
    if (!isFinite(val)) return;
    UI.neg.deal[k] = k === 'rate' ? round2(Math.max(0, val)) : Math.max(0, Math.round(val));
    document.querySelectorAll(`[data-neg="${k}"]`).forEach(x => { if (x !== el) x.value = UI.neg.deal[k]; });
    negUpdateLive();
    return;
  }
  if (el.dataset.chg === 'filter') { clearTimeout(UI.searchT); UI.searchT = setTimeout(() => { CHG.filter(el); render(); }, 260); }
  if (el.type === 'range' && el.dataset.chg) {
    const lbl = el.closest('.fl, .row2'); const b = lbl && lbl.querySelector('b');
    if (b && ['ad', 'laborRate', 'oilPrice', 'vehDisc'].includes(el.dataset.chg)) b.textContent = money(+el.value) + (el.dataset.chg === 'ad' ? '/mo' : el.dataset.chg === 'laborRate' ? '/hr' : '');
  }
}
function onSubmit(e) {
  const f = e.target.closest('form[data-form]'); if (!f) return;
  e.preventDefault();
  const fd = new FormData(f);
  if (f.dataset.form === 'comp') {
    const emp = empById(f.dataset.id);
    if (emp.role === 'tech') setCompensation(emp.id, null, null, +fd.get('flat'));
    else setCompensation(emp.id, +fd.get('salary'), fd.get('comm') != null ? +fd.get('comm') / 100 : null);
    UI.modal = null;
  }
  if (f.dataset.form === 'create') {
    const name = String(fd.get('name') || '').trim() || 'Lakeshore Aurex';
    newGame({ name, difficulty: fd.get('difficulty') });
    S.color = fd.get('color') || '#0a7480'; S.gmName = String(fd.get('gm') || '').trim();
    S.clock = 0;
    enterGame(S, +fd.get('slot') || 1);
    toast(`Welcome to ${name}${S.gmName ? ', ' + S.gmName : ''}. Customers are on their way.`, 'good');
    return;
  }
  render();
}
function onKey(e) {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); return; }
  if (e.key === 'Escape' && isStory()) { if (ST.modal === 'playbook' || ST.modal === 'parts' || (ST.modal && ST.modal.kind === 'writeup')) { ST.modal = null; render(); } else if (ST.menu) { ST.menu = false; render(); } return; }
  if (e.key === 'Escape') {
    if (UI.drawer) { UI.drawer = null; render(); }
    else if (UI.modal) { if (UI.modal === 'neg') ACT.closeNeg(); else UI.modal = null; render(); }
    else if (UI.panel) { UI.panel = null; render(); }
    return;
  }
  if (UI.screen !== 'game' || e.target.matches('input, select, textarea, button, summary') || UI.modal || blocked()) return;
}

/* ---------- Boot ---------- */
async function start(data) {
  UI.hostTheme = document.documentElement.getAttribute('data-theme');
  try { UI.themePref = localStorage.getItem('de-theme') || 'system'; } catch (e) { UI.themePref = 'system'; }
  applyTheme();
  UI.panel = null;
  buildShell();
  const meta = await loadMeta();
  await storyLoad();
  let bg = null;
  if (data && data.state) { S = data.state; UI.slot = data.slot || meta.active || 1; UI.screen = 'game'; prepareState(); }
  else {
    if (meta.active) { try { bg = await idbGet('slot' + meta.active); } catch (e) { bg = null; } }
    if (bg) { S = bg; prepareState(); } else { newGame({ seed: 20270301 }); S.clock = 300; }
    UI.screen = 'title'; UI.titleView = 'main';
  }
  initWorld(document.getElementById('world'));
  initTooltips();
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
  document.addEventListener('submit', onSubmit);
  document.addEventListener('keydown', onKey);
  document.addEventListener('toggle', () => renderHudSoon(), true);
  document.addEventListener('focusout', () => setTimeout(() => { if (UI.viewDirty) renderViewSafe(); }, 0));
  window.addEventListener('pagehide', () => saveGame());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveGame(); });
  if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => (UI.screen === 'game' ? { state: S, slot: UI.slot } : {}));
  render();
  startClock();
}
document.addEventListener('DOMContentLoaded', () => {
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
});
