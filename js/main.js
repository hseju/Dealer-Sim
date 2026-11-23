'use strict';
/* =====================================================================
   Dealer Empire — shell, routing, input handling, time controls, saves
   ===================================================================== */

const NAV = [
  ['Overview', [['dashboard', 'Dashboard', 'dashboard']]],
  ['Sales', [['showroom', 'Showroom', 'showroom'], ['inventory', 'Vehicle Inventory', 'car'], ['used', 'Used Vehicles', 'used'], ['customers', 'Customers', 'customers']]],
  ['Fixed operations', [['service', 'Service', 'service'], ['parts', 'Parts', 'parts'], ['retention', 'Retention', 'retention']]],
  ['Management', [['employees', 'Employees', 'employees'], ['finance', 'Finance', 'finance'], ['oem', 'OEM', 'oem'], ['market', 'Market', 'market'], ['group', 'Dealer Group', 'group']]],
];
const TITLES = Object.fromEntries(NAV.flatMap(g => g[1]).map(([k, l]) => [k, l]));
const SAVE_KEY = 'dealer-empire-save-v3';

/* ---------- Shell ---------- */
function buildShell() {
  const root = document.getElementById('app');
  root.innerHTML = `<div class="app" id="app-shell">
    <aside class="nav" id="nav" aria-label="Main navigation"></aside>
    <div class="nav-scrim" data-act="navToggle"></div>
    <div class="main"><header class="top" id="top"></header><main class="view" id="view" tabindex="-1"></main></div>
  </div><div id="overlay"></div><div id="drawer"></div><div id="toasts" aria-live="polite"></div><div id="tip" role="tooltip"></div>`;
}
function renderNav() {
  const appr = S.used.filter(u => u.status === 'appraisal').length;
  const waiting = S.showroom.filter(v => v.state === 'waiting' || v.state === 'negotiating').length;
  const parts = S.svc.ros.filter(r => r.status === 'parts').length;
  const risk = S.emps.filter(e => e.status !== 'gone' && e.morale < 38).length;
  const badges = { showroom: waiting, used: appr, service: parts, employees: risk };
  document.getElementById('nav').innerHTML = `
    <div class="brand"><svg class="logo" viewBox="0 0 40 40" aria-hidden="true"><rect x="1" y="1" width="38" height="38" rx="9" class="logo-bg"/><path d="M9 27a11 11 0 1 1 22 0" class="logo-arc"/><path d="m20 27 6-8" class="logo-needle"/><circle cx="20" cy="27" r="2.2" class="logo-hub"/></svg>
      <div><div class="brand-name">Dealer Empire</div><div class="brand-sub">${esc(S.dealerName)}</div></div></div>
    <nav class="nav-groups">${NAV.map(([g, items]) => `<div class="nav-g"><div class="nav-gl">${g}</div>${items.map(([k, l, ic]) => `<a href="#${k}" class="nav-i ${UI.route === k ? 'on' : ''}" data-act="go" data-to="${k}" ${UI.route === k ? 'aria-current="page"' : ''}>${icon(ic)}<span>${l}</span>${badges[k] ? `<b class="nav-badge">${badges[k]}</b>` : ''}</a>`).join('')}</div>`).join('')}</nav>
    <div class="nav-foot">
      <button type="button" class="nav-i" data-act="theme">${icon(currentTheme() === 'dark' ? 'moon' : 'sun')}<span>Theme: ${{ system: 'System', light: 'Light', dark: 'Dark' }[UI.themePref || 'system']}</span></button>
      <button type="button" class="nav-i" data-act="saveNow">${icon('save')}<span>Save game</span></button>
      <button type="button" class="nav-i" data-act="openNewGame">${icon('refresh')}<span>New game</span></button>
    </div>`;
}
function renderTop() {
  const p = dparts(S.day), t = S.oem.targets.units;
  const blockedNow = blocked() || UI.modal === 'neg';
  document.getElementById('top').innerHTML = `
    <button class="icon-btn nav-toggle" data-act="navToggle" aria-label="Open navigation">${icon('menu')}</button>
    <div class="top-title"><h1>${esc(TITLES[UI.route] || '')}</h1><div class="top-date"><b>${DOW_LONG[p.dow]}, ${MONTHS_LONG[p.m]} ${p.dom}, ${p.y}</b><span>Day ${S.day + 1}${p.dow === 0 ? ' · Closed' : ''}</span></div></div>
    <div class="clock" role="group" aria-label="Time controls">
      <button type="button" class="ck ${UI.playing ? 'on' : ''}" data-act="${UI.playing ? 'pause' : 'play'}" ${blockedNow && !UI.playing ? 'disabled' : ''} data-tip="${UI.playing ? 'Pause' : 'Play — one day every ' + (S.settings.pace / 1000).toFixed(1) + ' s'}" aria-label="${UI.playing ? 'Pause' : 'Play'}">${icon(UI.playing ? 'pause' : 'play')}</button>
      <button type="button" class="ck" data-act="step1" ${blockedNow ? 'disabled' : ''}>${icon('step')}<span>Day</span></button>
      <button type="button" class="ck" data-act="step7" ${blockedNow ? 'disabled' : ''}>${icon('week')}<span>Week</span></button>
      <button type="button" class="ck" data-act="stepMonth" ${blockedNow ? 'disabled' : ''} data-tip="Run to the end of the month (stops for decisions)">${icon('month')}<span>Month</span></button>
    </div>
    <div class="top-stats">
      <div class="ts ${S.cash < 0 ? 't-bad' : ''}" data-act="go" data-to="finance" role="button" tabindex="0"><small>Cash</small><b>${moneyK(S.cash)}</b></div>
      <div class="ts" data-act="go" data-to="finance" role="button" tabindex="0"><small>MTD gross</small><b>${moneyK(stGross(S.fin.mtd))}</b></div>
      <div class="ts" data-act="go" data-to="oem" role="button" tabindex="0"><small>Aurex target</small><b>${S.oem.mtdNew}/${t}</b></div>
    </div>`;
}
function renderView() {
  const el = document.getElementById('view');
  const fn = VIEWS[UI.route] || VIEWS.dashboard;
  try { el.innerHTML = fn(); }
  catch (e) { console.error(e); el.innerHTML = panel('Something went wrong', `<p>${esc(e.message)}</p>`); }
}
function renderOverlay() {
  const o = document.getElementById('overlay');
  let html = '', cls = '';
  if (S.over) { html = gameOverModal(); cls = 'md'; }
  else if (UI.modal === 'newgame') { html = newGameModal(); cls = 'sm'; }
  else if (UI.modal === 'neg') { html = renderNegotiation(); cls = UI.neg && UI.neg.done ? 'lg' : 'xl neg-modal'; }
  else if (S.report) { html = reportModal(); cls = 'lg'; }
  else if (S.decisions.length) { html = decisionModal(); cls = 'md'; }
  else if (UI.modal === 'order') { html = orderModal(); cls = 'lg'; }
  else if (UI.modal === 'hire') { html = hireModal(); cls = 'lg'; }
  else if (UI.modal && UI.modal.kind) { html = empModal(UI.modal.kind, UI.modal.id); cls = 'sm'; }
  const prev = o.querySelector('.modal');
  const keepScroll = prev && prev.dataset.key === (cls + (UI.modal && UI.modal.kind || UI.modal || '')) ? prev.querySelector('.modal-b, .neg')?.scrollTop : 0;
  o.innerHTML = html ? `<div class="scrim"></div><div class="modal ${cls}" role="dialog" aria-modal="true" data-key="${cls + (UI.modal && UI.modal.kind || UI.modal || '')}">${html}</div>` : '';
  if (keepScroll) { const b = o.querySelector('.modal-b, .neg'); if (b) b.scrollTop = keepScroll; }
  document.body.classList.toggle('has-modal', !!html);
  const d = document.getElementById('drawer');
  if (UI.drawer && !html) {
    const inner = UI.drawer.type === 'veh' ? vehDrawer(UI.drawer.id) : custDrawer(UI.drawer.id);
    const prevB = d.querySelector('.drawer-b'); const st = prevB && d.dataset.key === UI.drawer.type + UI.drawer.id ? prevB.scrollTop : 0;
    d.innerHTML = inner ? `<div class="scrim" data-act="closeDrawer"></div><aside class="drawer" role="dialog" aria-modal="true">${inner}</aside>` : '';
    d.dataset.key = UI.drawer.type + UI.drawer.id;
    const nb = d.querySelector('.drawer-b'); if (nb && st) nb.scrollTop = st;
  } else d.innerHTML = '';
}
function render() {
  renderNav(); renderTop(); renderView(); renderOverlay(); renderToasts();
  document.getElementById('app-shell').classList.toggle('nav-open', UI.navOpen);
  if (UI.focus) { const el = document.getElementById(UI.focus); if (el) { el.focus(); if (el.setSelectionRange && el.type === 'search') { const n = el.value.length; el.setSelectionRange(n, n); } } UI.focus = null; }
}

/* ---------- Toasts & tooltips ---------- */
function toast(msg, t = 'info') {
  const id = Math.random().toString(36).slice(2);
  UI.toasts.push({ id, msg, t });
  if (UI.toasts.length > 4) UI.toasts.shift();
  renderToasts();
  setTimeout(() => { UI.toasts = UI.toasts.filter(x => x.id !== id); renderToasts(); }, 4200);
  return false;
}
function renderToasts() {
  const el = document.getElementById('toasts'); if (!el) return;
  el.innerHTML = UI.toasts.map(x => `<div class="toast toast-${tone(x.t)}">${icon(x.t === 'good' ? 'check' : x.t === 'bad' ? 'alert' : 'info')}<span>${esc(x.msg)}</span></div>`).join('');
}
function initTooltips() {
  const tip = document.getElementById('tip');
  let cur = null;
  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-tip]');
    if (el === cur) return;
    cur = el;
    if (!el || !el.dataset.tip) { tip.classList.remove('on'); return; }
    tip.innerHTML = el.dataset.tip; tip.classList.add('on');
  });
  document.addEventListener('mousemove', e => {
    if (!cur) return;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 16;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = e.clientY - h - 12;
    tip.style.transform = `translate(${Math.max(4, x)}px, ${Math.max(4, y)}px)`;
  });
  document.addEventListener('scroll', () => { tip.classList.remove('on'); cur = null; }, true);
}

/* ---------- Time ---------- */
function canAdvance() { return S && !blocked() && UI.modal !== 'neg' && UI.modal !== 'newgame'; }
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
  UI.daysSinceSave = (UI.daysSinceSave || 0) + i;
  if (n !== 1 || UI.daysSinceSave >= 7 || S.report) { saveGame(); }
  if (UI.drawer) UI.drawer = null;
  render();
}
function startPlay() {
  if (!canAdvance()) return;
  UI.playing = true;
  clearInterval(UI.timer);
  UI.timer = setInterval(() => { if (!canAdvance()) { stopPlay(); render(); return; } step(1); }, S.settings.pace);
  render();
}
function stopPlay() { UI.playing = false; clearInterval(UI.timer); UI.timer = null; }

/* ---------- Save / load (IndexedDB, falling back to localStorage) ---------- */
let _db = null;
function idbOpen() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open('dealer-empire', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('saves');
      r.onsuccess = () => { _db = r.result; res(_db); };
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
}
function idbPut(key, val) {
  return idbOpen().then(db => new Promise((res, rej) => {
    const tx = db.transaction('saves', 'readwrite');
    tx.objectStore('saves').put(val, key); // structured clone happens now, so later changes don't leak in
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
  }));
}
function idbGet(key) {
  return idbOpen().then(db => new Promise((res, rej) => {
    const rq = db.transaction('saves', 'readonly').objectStore('saves').get(key);
    rq.onsuccess = () => res(rq.result || null); rq.onerror = () => rej(rq.error);
  }));
}
function saveGame(manual) {
  UI.daysSinceSave = 0;
  const done = () => { if (manual) toast('Game saved in this browser.', 'good'); };
  const fallback = () => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); done(); }
    catch (e) { if (manual) toast('Saving failed — browser storage is unavailable or full.', 'bad'); }
  };
  try { idbPut(SAVE_KEY, S).then(done, fallback); } catch (e) { fallback(); }
}
async function loadGame() {
  try { const s = await idbGet(SAVE_KEY); if (s) return s; } catch (e) { /* try localStorage */ }
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}

/* ---------- Theme ---------- */
function currentTheme() {
  const a = document.documentElement.getAttribute('data-theme');
  if (a) return a;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme() {
  const pref = UI.themePref || 'system';
  if (pref === 'system') { if (UI.hostTheme) document.documentElement.setAttribute('data-theme', UI.hostTheme); else document.documentElement.removeAttribute('data-theme'); }
  else document.documentElement.setAttribute('data-theme', pref);
}

/* ---------- Actions ---------- */
function setPath(obj, path, val) { const ks = path.split('.'); let o = obj; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = val; }
const ACT = {
  go(d) {
    UI.route = d.to; UI.navOpen = false; UI.drawer = null;
    if (d.filter && d.to === 'customers') { UI.filters.cust = { seg: 'all', q: '', quick: d.filter }; UI.page.cust = 0; }
    try { if (location.hash !== '#' + d.to) history.replaceState(null, '', '#' + d.to); } catch (e) { /* hash routing unavailable */ }
    window.scrollTo(0, 0);
  },
  navToggle() { UI.navOpen = !UI.navOpen; },
  set(d) { const v = isNaN(+d.val) || d.val === '' ? d.val : +d.val; setPath(S.settings, d.key, v); if (d.key === 'usedPlan') toast('Default trade plan updated.', 'info'); },
  filterSeg(d) { const [a, b] = d.key.split('.'); UI.filters[a][b] = d.val; UI.page[a] = 0; },
  sortSeg(d) { UI.sort[d.key] = d.val; UI.page[d.key] = 0; },
  tabSeg(d) { UI.tab[d.key] = d.val; },
  page(d) { UI.page[d.key] = Math.max(0, +d.val); },
  dismissIntro() { S.flags.intro = false; },
  openOrder() { UI.modal = 'order'; UI.order = UI.order || { mid: 'terra', ti: 0, color: 'any', qty: 2 }; },
  orderModel(d) { UI.order.mid = d.id; UI.order.ti = 0; UI.order.qty = Math.min(UI.order.qty, MODEL[d.id].exclusive ? Math.max(1, S.oem.exclusiveAlloc) : 20); },
  orderQty(d) { UI.order.qty = clamp(UI.order.qty + +d.val, 1, 20); },
  placeOrder() { const o = UI.order; if (orderVehicles(o.mid, o.ti, o.color, o.qty) === true) toast(`Ordered ${o.qty} × ${MODEL[o.mid].name}. Arriving in 1–3 weeks.`, 'good'); },
  openVeh(d) { UI.drawer = { type: 'veh', id: d.id }; },
  wholesaleNew(d) { const v = vehById(d.id); if (v) wholesaleNew(v); UI.drawer = null; },
  negotiate(d) { openNegotiation(d.id); return 'skip'; },
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
    deal.type = d.val;
    if (d.val === 'lease') { deal.term = 36; deal.rate = round2(buyRate(c.credit, 36, false) - 0.6 + S.settings.desk.markup); deal.prod = deal.prod.filter(p => p !== 'gap'); }
    else if (d.val === 'finance') { deal.term = veh.kind === 'new' ? 72 : 60; deal.rate = round2(buyRate(c.credit, deal.term, veh.kind === 'used') + S.settings.desk.markup); }
    else { deal.rate = 0; deal.prod = []; }
  },
  negAppraise() { const v = negVisit(); if (!v) return; v.appraised = true; v.mood = clamp(v.mood - 2, 0, 100); v.log.push({ who: 'system', text: `Used manager appraised the ${v.trade.spec.model}: ACV ${money(v.trade.acv)}, estimated recon ${money(v.trade.recon)}.` }); },
  negTD() {
    const v = negVisit(); if (!v || v.td) return;
    const r = evalDeal(v, UI.neg.deal); v.td = true;
    v.boost = (v.boost || 0) + (r.fit > 0.65 ? 0.35 : 0.1); v.mood = clamp(v.mood + 4, 0, 100);
    v.log.push({ who: 'customer', text: r.fit > 0.75 ? 'That drove really nicely. I could see myself in this.' : r.fit > 0.55 ? "It's nice. Not sure it's exactly right, but nice." : "Hmm. It's not really what I pictured." });
  },
  negTO() {
    const v = negVisit(), g = present('gsm')[0]; if (!v || v.to || !g) return;
    v.to = true; v.boost = (v.boost || 0) + 0.15 + (g.skill - 50) / 120; v.patience++;
    v.log.push({ who: 'system', text: `${empName(g)} joins the table and resets the conversation. The customer gives you another round.` });
  },
  negPresent() { negPresent(); return 'skip'; },
  negAcceptCounter() {
    const v = negVisit(); if (!v || !v.counter) return;
    UI.neg.deal = { ...v.counter.deal, acc: v.counter.deal.acc.slice(), prod: v.counter.deal.prod.slice() };
    const r = evalDeal(v, UI.neg.deal);
    if (!r.approved) { v.log.push({ who: 'system', text: 'The lender would not approve their counter structure.' }); v.counter = null; return; }
    v.log.push({ who: 'customer', text: pick(LINES.accept) });
    UI.neg.done = finalizeSale(v, UI.neg.deal, null, 'manual');
  },
  closeNeg() {
    const v = negVisit();
    if (v) { if (v.state === 'negotiating') v.state = 'waiting'; if (v.state === 'sold' || v.state === 'left') S.showroom = S.showroom.filter(x => x !== v); }
    UI.modal = null; UI.neg = null;
  },
  closeModal() { UI.modal = null; },
  closeDrawer() { UI.drawer = null; },
  openCustomer(d) { UI.drawer = { type: 'cust', id: d.id }; if (UI.modal === 'neg') UI.modal = UI.modal; },
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
  hire(d) { hireCandidate(d.role, d.id); },
  empTrain(d) { UI.modal = { kind: 'train', id: d.id }; },
  empComp(d) { UI.modal = { kind: 'comp', id: d.id }; },
  empPromote(d) { UI.modal = { kind: 'promote', id: d.id }; },
  empFire(d) { UI.modal = { kind: 'fire', id: d.id }; },
  train(d) { trainEmployee(d.id, d.course); UI.modal = null; },
  promote(d) { promoteEmployee(d.id, d.to); UI.modal = null; },
  fire(d) { fireEmployee(d.id); UI.modal = null; },
  upgradeFacility() { upgradeFacility(); },
  decide(d) { resolveDecision(d.id, +d.val); saveGame(); },
  openDecision() { },
  closeReport() { S.report = null; saveGame(); },
  startExp(d) { startExpansion(d.id); },
  storeInvest(d) { storeInvest(d.id); },
  storeGm(d) { storeReplaceGm(d.id); },
  storeSell(d) { storeSell(d.id); },
  play() { startPlay(); return 'skip'; },
  pause() { stopPlay(); },
  step1() { stopPlay(); step(1); return 'skip'; },
  step7() { stopPlay(); step(7); return 'skip'; },
  stepMonth() { stopPlay(); step('month'); return 'skip'; },
  openNewGame() { stopPlay(); UI.modal = 'newgame'; },
  saveNow() { saveGame(true); },
  theme() {
    const order = ['system', 'light', 'dark'];
    UI.themePref = order[(order.indexOf(UI.themePref || 'system') + 1) % 3];
    try { localStorage.setItem('de-theme', UI.themePref); } catch (e) { /* ignore */ }
    applyTheme();
  },
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
    if (el.checked) { S.progStats[id].since = S.day; logEvent('info', 'retention', `Launched ${p.name}${p.monthly ? ` (${money(p.monthly)}/month)` : ''}.`); toast(`${p.name} is now active.`, 'good'); }
    else { logEvent('info', 'retention', `Discontinued ${p.name}.`); toast(`${p.name} turned off.`, 'info'); }
  },
  finMonth(el) { UI.finMonth = el.value; },
};

function onClick(e) {
  const a = e.target.closest('[data-act]');
  if (!a || a.disabled) return;
  if (a.tagName === 'A' || a.tagName === 'BUTTON' || a.getAttribute('role') === 'button') e.preventDefault();
  const fn = ACT[a.dataset.act]; if (!fn) return;
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
  if (el.dataset.chg === 'filter') {
    clearTimeout(UI.searchT);
    UI.searchT = setTimeout(() => { CHG.filter(el); render(); }, 260);
  }
  if (el.type === 'range' && el.dataset.chg) {
    const lbl = el.closest('.fl, .row2'); const b = lbl && lbl.querySelector('b');
    if (b && (el.dataset.chg === 'ad' || el.dataset.chg === 'laborRate' || el.dataset.chg === 'oilPrice' || el.dataset.chg === 'vehDisc')) b.textContent = money(+el.value) + (el.dataset.chg === 'ad' ? '/mo' : el.dataset.chg === 'laborRate' ? '/hr' : '');
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
  if (f.dataset.form === 'newgame') {
    stopPlay();
    newGame({ name: String(fd.get('name') || 'Lakeshore Aurex').trim() || 'Lakeshore Aurex', difficulty: fd.get('difficulty') });
    UI.modal = null; UI.route = 'dashboard'; UI.drawer = null; UI.neg = null; UI.filters = {}; UI.page = {};
    try { history.replaceState(null, '', '#dashboard'); } catch (e) { /* ignore */ }
    saveGame();
  }
  render();
}
function onKey(e) {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
  if (e.key === 'Escape') {
    if (UI.drawer) { UI.drawer = null; render(); }
    else if (UI.modal && UI.modal !== 'newgame') { if (UI.modal === 'neg') ACT.closeNeg(); else UI.modal = null; render(); }
  }
  if (e.target.matches('input, select, textarea') || UI.modal || blocked()) return;
  if (e.key === 'd' || e.key === 'D') { step(1); }
  if (e.key === 'w' || e.key === 'W') { step(7); }
}

/* ---------- Boot ---------- */
async function start(data) {
  UI.hostTheme = document.documentElement.getAttribute('data-theme');
  try { UI.themePref = localStorage.getItem('de-theme') || 'system'; } catch (e) { UI.themePref = 'system'; }
  applyTheme();
  const saved = data && data.state ? data.state : await loadGame();
  if (saved && saved.v === 3 && saved.customers) { S = saved; rebuildIndex(); MODS = null; refreshMods(); computeKpis(); }
  else newGame({});
  const h = location.hash.replace('#', '');
  if (TITLES[h]) UI.route = h;
  buildShell();
  initTooltips();
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
  document.addEventListener('submit', onSubmit);
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', () => { const k = location.hash.replace('#', ''); if (TITLES[k] && k !== UI.route) { UI.route = k; render(); } });
  window.addEventListener('pagehide', () => saveGame());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveGame(); });
  if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => ({ state: S }));
  render();
}
document.addEventListener('DOMContentLoaded', () => {
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
});
