'use strict';
/* =====================================================================
   Dealer Empire — market, competitors, OEM, finance, decisions, time
   ===================================================================== */

/* ---------- Finance primitives ---------- */
function book(dept, rev, cogs) { const L = S.fin.mtd; L.rev[dept] += rev; L.cogs[dept] += cogs; }
function expense(cat, amt) { S.fin.mtd.exp[cat] += amt; S.cash -= amt; }
function stRevenue(L) { return sum(DEPTS, d => L.rev[d.id]); }
function stGross(L) { return sum(DEPTS, d => L.rev[d.id] - L.cogs[d.id]); }
function stDeptGross(L, id) { return L.rev[id] - L.cogs[id]; }
function stExpenses(L) { return sum(Object.values(L.exp)); }
function statementNet(L) { return stGross(L) - stExpenses(L); }
function lastMonth() { return S.fin.hist[S.fin.hist.length - 1]; }

function dailyExpenses() {
  const dim = daysInMonthOf(S.day), m = dparts(S.day).m;
  const salaries = sum(S.emps.filter(e => e.status !== 'gone'), e => e.salary) / 365 * 1.12;
  expense('payroll', salaries + FIXED_EXPENSES.admin / dim);
  expense('advertising', S.settings.ad / dim);
  expense('rent', (FIXED_EXPENSES.rent + (hasExp('bigstore') ? 0 : 0)) / dim);
  expense('utilities', FIXED_EXPENSES.utilities * ([1.35, 1.3, 1.15, 1, 0.9, 0.95, 1.05, 1.05, 0.95, 1, 1.15, 1.3][m]) / dim);
  expense('insurance', (FIXED_EXPENSES.insurance + S.inv.length * 18) / dim);
  expense('technology', FIXED_EXPENSES.technology / dim);
  expense('maintenance', (FIXED_EXPENSES.maintenance + bayCount() * 380) / dim);
  expense('oem', FIXED_EXPENSES.oem / dim);
  expense('other', FIXED_EXPENSES.other / dim);
  expense('loaners', S.settings.loaners * 650 / dim);
  for (const p of PROGRAMS) if (S.programs[p.id] && p.monthly) { expense('programs', p.monthly / dim); S.progStats[p.id].cost += p.monthly / dim; }
  const expCost = sum(S.exp.owned, id => EXPANSION[id].monthly);
  if (expCost) expense('expansion', expCost / dim);
  if (S.cash < 0) expense('interest', -S.cash * (S.mkt.prime + 2.5) / 100 / 365);
}

/* ---------- Market modifiers from active events ---------- */
let MODS = null;
function mods() { return MODS || refreshMods(); }
function refreshMods() {
  const m = { traffic: 1, inMarket: 1, rateAdj: 0, seg: {}, alloc: 1, transit: 1, partsLead: 1, evRebate: 0, indyPull: 0, indyRate: 1, tireDemand: 0, fuel: 0, conf: null, usedIdx: 0, supply: 1 };
  for (const e of (S.mkt ? S.mkt.events : [])) {
    const x = e.fx || {};
    if (x.traffic) m.traffic *= x.traffic; if (x.inMarket) m.inMarket *= x.inMarket; if (x.rateAdj) m.rateAdj += x.rateAdj;
    if (x.seg) for (const [k, v] of Object.entries(x.seg)) m.seg[k] = (m.seg[k] || 1) * v;
    if (x.alloc) m.alloc *= x.alloc; if (x.transit) m.transit *= x.transit; if (x.partsLead) m.partsLead *= x.partsLead;
    if (x.evRebate) m.evRebate += x.evRebate; if (x.tireDemand) m.tireDemand = 1; if (x.fuel) m.fuel += x.fuel;
    if (x.conf != null) m.conf = x.conf; if (x.usedIdx) m.usedIdx += x.usedIdx; if (x.supply) m.supply *= x.supply;
  }
  m.indyPull = S.flags && S.flags.indyPull || 0;
  m.indyRate = S.flags && S.flags.indyRate || 1;
  MODS = m;
  return m;
}
function compPressure() {
  let p = 0;
  for (const c of S.comps) {
    if (c.campaign && c.campaign.until >= S.day) p += c.campaign.matched ? 0.015 : (c.brand === 'Aurex' ? 0.07 : 0.045);
    if (c.isNew) p += 0.025;
  }
  return clamp(p, 0, 0.3);
}
function intraBrandPressure() {
  const n = S.comps.find(c => c.id === 'northgate');
  return n && n.campaign && n.campaign.until >= S.day && !n.campaign.matched ? 0.015 : 0;
}
function pushMarketHist(d) {
  const h = S.mkt.hist;
  for (const k of ['prime', 'fuel', 'conf', 'ev', 'usedIdx']) { h[k].push([d, round2(S.mkt[k])]); if (h[k].length > 400) h[k].shift(); }
}
function news(tone, title, text) {
  S.mkt.news.unshift({ day: S.day, tone, title, text });
  if (S.mkt.news.length > 60) S.mkt.news.length = 60;
  logEvent(tone, 'market', title);
}

const EVENT_DEFS = {
  rateUp: { w: 3, run() { const x = pick([0.25, 0.25, 0.5]); S.mkt.prime = round2(S.mkt.prime + x); news('warn', `Central bank raises its policy rate by ${x.toFixed(2)} points`, `Prime is now ${S.mkt.prime.toFixed(2)}%. Lender buy rates and your floorplan cost rise with it. Payment-sensitive buyers will feel it.`); } },
  rateDown: { w: 2, run() { if (S.mkt.prime < 2.5) return false; S.mkt.prime = round2(S.mkt.prime - 0.25); news('good', 'Central bank cuts rates by 0.25 points', `Prime is now ${S.mkt.prime.toFixed(2)}%. Cheaper credit lifts showroom traffic and trims floorplan interest.`); } },
  fuelSpike: { w: 3, dur: [35, 80], fx: { fuel: 0.38, seg: { hybrid: 1.12, small: 1.06 } }, title: 'Fuel prices jump on refinery outages', text: 'Pickup and large SUV shoppers hesitate; hybrid and EV interest climbs.', tone: 'warn' },
  fuelDrop: { w: 1.5, dur: [35, 70], fx: { fuel: -0.22 }, title: 'Fuel prices fall sharply', text: 'Truck and SUV demand firms up; efficiency is less of a talking point.', tone: 'info' },
  evSurge: { w: 2, dur: [45, 90], fx: { seg: { ev: 1.25, hybrid: 1.08 } }, title: 'EV demand surges after charging network expansion', text: 'Volta leads and internet inquiries are up. EV inventory turns faster.', tone: 'good' },
  recession: { w: 0.8, dur: [90, 170], fx: { traffic: 0.8, inMarket: 0.75, rateAdj: 0.35, conf: 42, usedIdx: 4 }, title: 'Economy slips into recession', text: 'Consumer confidence drops. Fewer shoppers, tighter credit and more interest in used vehicles. Fixed operations becomes your stabiliser.', tone: 'bad' },
  boom: { w: 1, dur: [60, 120], fx: { traffic: 1.12, inMarket: 1.1, conf: 76 }, title: 'Strong jobs report lifts consumer confidence', text: 'Traffic and in-market activity are up across the region.', tone: 'good' },
  shortage: { w: 1.6, dur: [45, 90], fx: { alloc: 0.65, supply: 0.75, transit: 1.4 }, title: 'Semiconductor shortage cuts Aurex production', text: 'Allocation is reduced and transit times lengthen. Transaction prices move closer to MSRP.', tone: 'warn' },
  supplyChain: { w: 1.5, dur: [30, 60], fx: { transit: 1.8 }, title: 'Rail and port disruption delays vehicle shipments', text: 'Vehicles in transit will take longer to arrive.', tone: 'warn' },
  partsShortage: { w: 1.8, dur: [30, 60], fx: { partsLead: 2.6 }, title: 'Parts distribution centre backlog', text: 'Supplier lead times have more than doubled. Repair orders waiting on parts will pile up unless stock is on hand.', tone: 'warn' },
  usedUp: { w: 1.5, dur: [30, 60], fx: { usedIdx: 8 }, title: 'Used vehicle values climb at auction', text: 'Wholesale prices are rising. Trade-ins are worth more, and aged used units are easier to move.', tone: 'good' },
  usedDown: { w: 1.5, dur: [30, 60], fx: { usedIdx: -8 }, title: 'Used vehicle values soften', text: 'Auction prices are falling. Inventory you hold loses value every week.', tone: 'warn' },
  taxIncentive: { w: 1.1, dur: [90, 160], fx: { evRebate: 4000, seg: { ev: 1.1 } }, title: 'Government announces $4,000 EV purchase rebate', text: 'Eligible electric vehicles receive a point-of-sale rebate, shown as an incentive on your Volta inventory.', tone: 'good', decision: 'evRebate' },
  compCampaign: { w: 3, run() { const list = S.comps.filter(c => c.type === 'dealer' && !(c.campaign && c.campaign.until >= S.day)); if (!list.length) return false; const c = pickW(list, x => x.aggr); c.campaign = { until: S.day + randi(21, 40), matched: false }; news('warn', `${c.name} launches an "${pick(['Employee Pricing', 'Red Tag Days', 'No-Haggle Event', 'Year-End Blowout'])}" campaign`, `${c.name} is advertising aggressive discounts. Expect more shoppers to compare quotes${c.brand === 'Aurex' ? ' on the same Aurex models' : ''}.`); queueDecision('compCampaign', { comp: c.id }); } },
  newCompetitor: { w: 0.5, run() { if (S.comps.find(c => c.id === 'solenne')) return false; S.comps.push({ id: 'solenne', name: 'Solenne Studio', type: 'dealer', brand: 'Solenne', dist: 5, disc: 0, svcRate: 0, vol: 30, quality: 0.7, aggr: 0.5, isNew: true, campaign: null, units: 0, hist: [] }); news('warn', 'Solenne opens a direct-sales EV studio downtown', 'A new EV brand with no-haggle pricing enters your market, competing directly for EV and tech-focused shoppers.'); } },
  indyExpansion: { w: 1, run() { if ((S.flags.indyPull || 0) >= 0.3) return false; S.flags.indyPull = round2((S.flags.indyPull || 0) + 0.15); const p = S.comps.find(c => c.id === 'precision'); if (p) p.svcRate = Math.round(p.svcRate * 0.95); refreshMods(); news('warn', 'Precision Auto Care opens a second location nearby', `Independent labour rate is now about ${money(indyRate())}/hr. Out-of-warranty customers have a cheaper, closer option.`); } },
  recall: { w: 1.4, run() { if (S.flags.recallActive) return false; const m = pick(MODELS.filter(x => !x.exclusive && x.id !== 'voltagt')); S.flags.recallActive = { model: m.name, until: S.day + 150 }; let n = 0; for (const c of S.customers) if (c.veh && c.veh.make === 'Aurex' && c.veh.model === m.name && c.status !== 'lost') { c.recall = true; n++; } news('warn', `Aurex issues a safety recall on ${m.name} fuel pump relays`, `${n} customers in your database are affected. Recall work is paid by Aurex at warranty rates, and every visit is a chance to win back lapsed customers.`); queueDecision('recall', { model: m.name, n }); } },
};
function startEvent(type) {
  const d = EVENT_DEFS[type];
  if (d.run) { return d.run() !== false; }
  if (S.mkt.events.find(e => e.type === type)) return false;
  S.mkt.events.push({ id: nextId('EV'), type, title: d.title, text: d.text, tone: d.tone, start: S.day, end: S.day + randi(d.dur[0], d.dur[1]), fx: d.fx });
  news(d.tone, d.title, d.text);
  refreshMods();
  if (d.decision) queueDecision(d.decision, {});
  return true;
}
function randomEvents() {
  const p = dparts(S.day);
  // scheduled: model year changeover and winter tire season
  if (p.m === 8 && p.dom === 1 && S.oem.my <= p.y) {
    S.oem.my = p.y + 1;
    news('info', `${S.oem.my} model year vehicles begin shipping`, `New orders are now ${S.oem.my} models. Remaining ${S.oem.my - 1} units carry an extra $1,500 closeout incentive but are valued lower by shoppers.`);
  }
  if (p.m === 9 && p.dom === 1) {
    S.mkt.events.push({ id: nextId('EV'), type: 'winter', title: 'Winter tire season', text: 'Tire changeovers and winter packages spike through November.', tone: 'info', start: S.day, end: S.day + 60, fx: { tireDemand: 1, seg: { pickup: 1.04 } } });
    refreshMods(); queueDecision('winterTires', {});
  }
  if (p.dow === 0) return;
  if (chance(0.021)) {
    const types = Object.keys(EVENT_DEFS);
    for (let i = 0; i < 4; i++) if (startEvent(pickW(types, t => EVENT_DEFS[t].w))) break;
  }
  if (p.dom === 9 && chance(0.4)) fleetOpportunity();
  if (p.dom === 17 && chance(0.3)) oemOffer();
  if (p.dom === 23 && chance(0.25)) poachAttempt();
}
function marketDaily() {
  const m = S.mkt, md = mods();
  m.fuel = clamp(m.fuel + gauss(0, 0.01) + (1.57 + md.fuel - m.fuel) * 0.045, 1.1, 2.6);
  m.conf = clamp(m.conf + gauss(0, 0.55) + ((md.conf != null ? md.conf : 63) - m.conf) * 0.03, 25, 92);
  m.usedIdx = clamp(m.usedIdx + gauss(0, 0.25) + (100 + md.usedIdx - m.usedIdx) * 0.035, 78, 125);
  m.ev = clamp(m.ev + gauss(0.0005, 0.003), 0.7, 1.8);
  m.supply = clamp(m.supply + (md.supply - m.supply) * 0.06, 0.6, 1.2);
  m.partsLead = 1;
  // expire events
  const ended = m.events.filter(e => e.end < S.day);
  if (ended.length) { m.events = m.events.filter(e => e.end >= S.day); ended.forEach(e => logEvent('info', 'market', `Ended: ${e.title}.`)); refreshMods(); }
  for (const c of S.comps) if (c.campaign && c.campaign.until < S.day) { logEvent('info', 'market', `${c.name}'s discount campaign has ended.`); c.campaign = null; }
  if (S.flags.recallActive && S.flags.recallActive.until < S.day) S.flags.recallActive = null;
  pushMarketHist(S.day);
}

/* ---------- Competitors ---------- */
function competitorsMonthly(ourNew) {
  const conf = S.mkt.conf / 63;
  for (const c of S.comps) {
    if (c.type === 'dealer' || c.type === 'used') {
      const units = Math.round(c.vol * conf * randf(0.88, 1.12) * (c.campaign ? 1.15 : 1)) + (c.mtdWins || 0);
      c.hist.push(units); if (c.hist.length > 24) c.hist.shift();
      c.units = units; c.mtdWins = 0;
      // react to our share gains
      if (ourNew > c.vol * 0.7) c.aggr = clamp(c.aggr + 0.03, 0.2, 0.95); else c.aggr = clamp(c.aggr - 0.01, 0.2, 0.95);
    }
    if (c.type === 'indy' || c.type === 'lube') c.svcRate = round2(c.svcRate * 1.0025);
    if (c.oil) c.oil = round2(c.oil * 1.002);
  }
}
function marketShare() {
  const L = lastMonth(); if (!L) return 0;
  const ours = L.units.new + L.units.used;
  const theirs = sum(S.comps.filter(c => c.type === 'dealer' || c.type === 'used'), c => c.hist.length ? c.hist[c.hist.length - 1] : c.vol);
  return ours / Math.max(1, ours + theirs);
}

/* ---------- OEM relationship ---------- */
function setOemTargets() {
  const m = dparts(S.day + 1).m;
  const season = [0.78, 0.85, 1.08, 1.1, 1.12, 1.06, 1.0, 1.02, 0.98, 0.98, 0.9, 0.86][m];
  const months = S.fin ? S.fin.hist.filter(h => !h.prior).length : 0;
  const base = 47 * (hasExp('bigstore') ? 1.25 : 1) * (S.oem.standing >= 75 ? 1.08 : 1);
  S.oem.targets = {
    units: Math.round(base * season), ev: round2(Math.min(0.3, 0.15 + months * 0.004)), csi: 84, training: 0.7, facility: 90, dsupply: 75,
  };
  const sf = 0.72 + S.oem.standing / 180;
  S.oem.alloc = Math.round(S.oem.targets.units * 1.3 * sf * (MODS ? mods().alloc : 1));
  S.oem.exclusiveAlloc = S.oem.standing >= 80 ? randi(2, 4) : S.oem.standing >= 68 ? randi(1, 2) : 0;
}
function setOemIncentives(initial) {
  const inc = {};
  for (const m of MODELS) {
    if (m.exclusive) { inc[m.id] = 0; continue; }
    const dem = S.mkt ? segDemand(m.seg) : 1;
    let x = 0;
    if (chance(0.55 + (1 - dem) * 1.2)) x = roundTo(clamp((1.15 - dem) * 4500 + randf(-400, 700), 0, 4000), 250);
    if (m.pt === 'ev') x = Math.max(x, 1500);
    inc[m.id] = x;
  }
  S.oem.incentives = inc;
}
function trainingCompletion() {
  const pool = S.emps.filter(e => e.status !== 'gone' && ['sales', 'gsm', 'fi', 'advisor', 'svcmgr', 'tech'].includes(e.role));
  return pool.length ? pool.filter(e => e.certs.length > 0).length / pool.length : 0;
}
function daysSupply() {
  const units = S.inv.filter(v => v.status === 'available').length;
  const recent = S.deals.filter(d => d.kind === 'new' && d.day > S.day - 30).length;
  const rate = Math.max(recent, (lastMonth() ? lastMonth().units.new : 30) * 0.6) / 30;
  return units / Math.max(0.3, rate);
}
function evaluateOem(L) {
  const t = S.oem.targets, units = S.oem.mtdNew;
  const evMix = units ? S.oem.mtdEv / units : 0;
  const csi = (avg(L.csiSales) || 80) * 0.5 + (avg(L.csiService) || 80) * 0.5;
  const res = [
    { k: 'units', label: 'New vehicle sales', val: units, target: t.units, met: units >= t.units, fmt: 'n', wt: units >= t.units ? 5 : units >= t.units * 0.85 ? -2 : -5 },
    { k: 'ev', label: 'Electrified sales mix', val: evMix, target: t.ev, met: evMix >= t.ev, fmt: 'pct', wt: evMix >= t.ev ? 3 : -2 },
    { k: 'csi', label: 'Customer satisfaction (CSI)', val: csi, target: t.csi, met: csi >= t.csi, fmt: 'n1', wt: csi >= t.csi ? 3 : -3 },
    { k: 'training', label: 'Training completion', val: trainingCompletion(), target: t.training, met: trainingCompletion() >= t.training, fmt: 'pct', wt: trainingCompletion() >= t.training ? 2 : -2 },
    { k: 'facility', label: 'Facility compliance', val: S.oem.facility / 100, target: t.facility / 100, met: S.oem.facility >= t.facility, fmt: 'pct', wt: S.oem.facility >= t.facility ? 2 : -1 },
    { k: 'dsupply', label: 'Inventory days supply', val: daysSupply(), target: t.dsupply, met: daysSupply() <= t.dsupply, fmt: 'days', wt: daysSupply() <= t.dsupply ? 2 : -2 },
  ];
  let delta = sum(res, r => r.wt);
  const before = S.oem.standing;
  S.oem.standing = clamp(Math.round(S.oem.standing + delta * 0.8), 0, 100);
  // stair-step volume bonus
  let perUnit = 0;
  for (const [ratio, amt] of S.oem.stair) if (units >= t.units * ratio) perUnit = amt;
  const bonus = perUnit * units;
  if (bonus > 0) { S.cash += bonus; book('oemInc', bonus, 0); }
  S.oem.hist.push({ key: L.key, units, target: t.units, evMix, csi, standing: S.oem.standing, bonus, met: res.filter(r => r.met).length });
  S.oem.facility = Math.max(40, S.oem.facility - 1);
  return { res, delta: S.oem.standing - before, bonus, perUnit };
}
function standingTier(s = S.oem.standing) {
  if (s >= 80) return { n: 'Elite', tone: 'good' }; if (s >= 60) return { n: 'Preferred', tone: 'good' };
  if (s >= 35) return { n: 'Standard', tone: 'neutral' }; return { n: 'At risk', tone: 'bad' };
}
function upgradeFacility() {
  const cost = Math.round((100 - S.oem.facility) * 11000 + 60000);
  if (S.oem.facility >= 99) return toast('Facility is already fully compliant.', 'info');
  S.cash -= cost; S.fin.mtd.cf.capex += cost; S.oem.facility = 100;
  S.oem.standing = clamp(S.oem.standing + 2, 0, 100);
  logEvent('good', 'oem', `Completed facility image upgrade for ${money(cost)}. Compliance now 100%.`);
}
function addServiceBay() {
  if (S.svc.bays >= 10) return toast('No room for more bays in the current building. The Larger dealership expansion adds six.', 'bad');
  S.cash -= 95000; S.fin.mtd.cf.capex += 95000; S.svc.bays++;
  logEvent('good', 'service', `Installed service bay ${bayCount()} (hoist, tooling, air) for $95,000.`);
}

/* ---------- Decisions (interrupt time) ---------- */
function queueDecision(type, data) {
  const def = DECISIONS[type]; if (!def) return;
  const built = def.build(data);
  if (!built) return;
  S.decisions.push({ id: nextId('D'), type, data, day: S.day, ...built });
  if (UI.playing) stopPlay();
}
function resolveDecision(id, idx) {
  const d = S.decisions.find(x => x.id === id); if (!d) return;
  S.decisions = S.decisions.filter(x => x !== d);
  const msg = DECISIONS[d.type].resolve(d.data, idx, d);
  if (msg) logEvent('info', 'gm', msg);
}
function fleetOpportunity() {
  const groups = {};
  for (const v of availableNew()) { const m = MODEL[v.modelId]; if (['pickup', 'compactSUV', 'small'].includes(m.seg)) (groups[v.modelId] = groups[v.modelId] || []).push(v); }
  const ok = Object.entries(groups).filter(([, a]) => a.length >= 3);
  if (!ok.length) return;
  const [mid, units] = pick(ok);
  const n = Math.min(units.length, randi(3, 5));
  queueDecision('fleet', { mid, n, biz: pick(['Harbour Plumbing & Heating', 'Northline Electrical', 'Greenway Landscaping', 'Coastal Property Management', 'Metro Home Care', 'Ridgeline Construction']), disc: round2(randf(0.055, 0.075)) });
}
function oemOffer() {
  const slow = MODELS.filter(m => !m.exclusive && segDemand(m.seg) < 1.0);
  if (!slow.length) return;
  const m = pick(slow);
  queueDecision('oemOffer', { mid: m.id, n: randi(6, 10), cash: roundTo(randf(900, 1600), 100) });
}
function poachAttempt() {
  const stars = S.emps.filter(e => e.status === 'active' && (e.skill >= 68 || e.tier >= 4) && e.morale < 78);
  if (!stars.length) return;
  const e = pick(stars), comp = pick(S.comps.filter(c => c.type === 'dealer'));
  queueDecision('poach', { eid: e.id, comp: comp.name });
}
function queueComplaint(c, ro) {
  if (S.decisions.some(d => d.type === 'complaint')) return;
  queueDecision('complaint', { cid: c.id, desc: ro.desc });
}

const DECISIONS = {
  resign: {
    build({ eid }) {
      const e = empById(eid); if (!e || e.status === 'gone') return null;
      return { cat: 'Employees', title: `${empName(e)} has handed in a resignation letter`, body: `${empName(e)} (${e.role === 'tech' ? TECH_TIERS[e.tier] : ROLES[e.role].title}, skill ${Math.round(e.skill)}) says morale has been low (${Math.round(e.morale)}/100) and pay isn't competitive. Replacing them means recruiting costs and lost productivity.`,
        options: [{ label: 'Counter-offer: 10% raise', desc: 'Raises pay and morale. Works if pay is the main issue.' }, { label: 'Counter-offer: 15% raise and paid training', desc: 'Bigger commitment, much better odds of keeping them.' }, { label: 'Accept the resignation', desc: 'They leave today.' }] };
    },
    resolve({ eid }, i) {
      const e = empById(eid); if (!e || e.status === 'gone') return;
      if (i === 2) { quit(e, 'resigned'); return; }
      const raise = i === 0 ? 0.1 : 0.15;
      if (e.role === 'tech') e.flat = round2(e.flat * (1 + raise)); else e.salary = roundTo(e.salary * (1 + raise), 500);
      if (chance(i === 0 ? 0.7 : 0.92)) {
        e.morale = clamp(e.morale + (i === 0 ? 22 : 30), 0, 100); e.warned = false;
        if (i === 1) expense('training', 1500);
        return `${empName(e)} accepted the counter-offer and is staying.`;
      }
      quit(e, 'resigned despite the counter-offer');
    },
  },
  poach: {
    build({ eid, comp }) {
      const e = empById(eid); if (!e || e.status === 'gone') return null;
      return { cat: 'Employees', title: `${comp} is trying to recruit ${empName(e)}`, body: `Your ${e.role === 'tech' ? TECH_TIERS[e.tier] : ROLES[e.role].title} has an offer from ${comp} worth roughly 12% more. Losing them would hurt ${e.role === 'tech' ? 'shop capacity' : 'sales production'}.`,
        options: [{ label: 'Match the offer (+12%)', desc: 'They stay, morale improves.' }, { label: 'Offer a retention bonus of $5,000', desc: 'One-off cost, decent odds.' }, { label: 'Let them decide', desc: 'Free, but they may leave.' }] };
    },
    resolve({ eid }, i) {
      const e = empById(eid); if (!e || e.status === 'gone') return;
      if (i === 0) { if (e.role === 'tech') e.flat = round2(e.flat * 1.12); else e.salary = roundTo(e.salary * 1.12, 500); e.morale = clamp(e.morale + 15, 0, 100); return `Matched the outside offer for ${empName(e)}.`; }
      if (i === 1) { expense('payroll', 5000); if (chance(0.72)) { e.morale = clamp(e.morale + 10, 0, 100); return `${empName(e)} took the retention bonus and stayed.`; } quit(e, 'left for a competitor'); return; }
      if (chance(e.morale > 60 ? 0.6 : 0.3)) return `${empName(e)} turned down the outside offer.`;
      quit(e, 'left for a competitor');
    },
  },
  reconSurprise: {
    build({ uid }) {
      const u = S.used.find(x => x.id === uid); if (!u || !u.surprise) return null;
      const est = Math.round(usedRetail({ ...u, cond: Math.max(u.cond, 4) }));
      return { cat: 'Used vehicles', title: `Recon found ${u.surprise.desc} on ${u.stock}`, body: `The ${u.year} ${u.make} ${u.model} (${kmf(u.km)}) needs an extra ${money(u.surprise.cost)} beyond the planned ${money(u.reconPlanned)} reconditioning. Total investment would be about ${money(u.cost + u.reconPlanned + u.surprise.cost)} against an expected retail value near ${money(est)}.`,
        options: [{ label: `Approve the repair (+${money(u.surprise.cost)})`, desc: 'Finish recon and retail it at full value.' }, { label: 'Stop recon and wholesale it now', desc: `Immediate cash, roughly ${money(acvOf(u) * 0.93)}.` }, { label: 'Send it to auction', desc: 'Sold in about a week. Price is uncertain.' }] };
    },
    resolve({ uid }, i) {
      const u = S.used.find(x => x.id === uid); if (!u) return;
      if (i === 0) { u.surprise.approved = true; const ro = S.svc.ros.find(r => r.uid === uid); if (ro) { ro.hrs = round2(ro.hrs + u.surprise.cost * 0.4 / INTERNAL_RATE); ro.left = round2(ro.left + u.surprise.cost * 0.4 / INTERNAL_RATE); u.surprise.cost *= 0.6; } return `Approved additional recon on ${u.stock}.`; }
      S.svc.ros = S.svc.ros.filter(r => r.uid !== uid);
      if (i === 1) wholesaleUnit(u); else auctionUnit(u);
    },
  },
  fleet: {
    build({ mid, n, biz, disc }) {
      const m = MODEL[mid];
      const units = availableNew().filter(v => v.modelId === mid).slice(0, n);
      if (units.length < n) return null;
      const per = roundTo(avg(units, v => newMarketValue(v)) * (1 - disc), 50);
      const gross = sum(units, v => per - v.invoice + v.msrp * HOLDBACK + DOC_FEE - PREP_COST);
      return { cat: 'Sales', title: `Fleet inquiry: ${biz} wants ${n} ${m.name}s`, body: `They want ${n} units from stock at ${money(per)} each (about ${pct(disc, 1)} below market), delivered this week. Estimated total front gross ${money(gross)}, no F&I. Fleet volume counts toward your OEM target.`,
        options: [{ label: `Accept at ${money(per)} per unit`, desc: `${n} units sold today.` }, { label: `Counter at ${money(roundTo(per * 1.025, 50))}`, desc: 'About a 50% chance they agree.' }, { label: 'Decline', desc: 'Keep the inventory for retail customers.' }] };
    },
    resolve(data, i) {
      if (i === 2) return `Declined the fleet request from ${data.biz}.`;
      const units = availableNew().filter(v => v.modelId === data.mid).slice(0, data.n);
      if (units.length < data.n) return 'The fleet units are no longer available.';
      let per = roundTo(avg(units, v => newMarketValue(v)) * (1 - data.disc), 50);
      if (i === 1) { if (!chance(0.5)) return `${data.biz} declined the counter-offer and bought elsewhere.`; per = roundTo(per * 1.025, 50); }
      const c = addCustomer(genCustomer('prospect')); c.fn = data.biz; c.ln = ''; c.business = true; c.veh = null; c.status = 'owner';
      let g = 0;
      for (const v of units) {
        const hb = v.msrp * HOLDBACK;
        S.cash += per + DOC_FEE - v.invoice + hb - PREP_COST;
        book('new', per + DOC_FEE, v.invoice - hb + PREP_COST);
        expense('floorplan', -Math.round(v.invoice * 0.0125));
        S.fin.mtd.units.new++; S.oem.mtdNew++; S.fin.mtd.sold++;
        g += per + DOC_FEE - v.invoice + hb - PREP_COST;
        S.inv = S.inv.filter(x => x !== v);
        S.deals.unshift({ day: S.day, cid: c.id, name: data.biz, veh: vehName(v), stock: v.stock, kind: 'new', mid: v.modelId, price: per, front: Math.round(per + DOC_FEE - v.invoice + hb - PREP_COST), back: 0, acc: 0, total: Math.round(per + DOC_FEE - v.invoice + hb - PREP_COST), type: 'fleet', pmt: 0, term: 0, by: 'You', csi: null, trade: '', products: 0, days: daysIn(v) });
      }
      const fv = units[0];
      c.veh = { year: fv.year, make: 'Aurex', model: MODEL[fv.modelId].name, cls: MODEL[fv.modelId].cls, pt: MODEL[fv.modelId].pt, msrpNew: fv.msrp, km: 20, cond: 5, acc: 'none', fromUs: true, purchased: S.day, boughtNew: true, modelId: fv.modelId, warrantyEnd: S.day + 1095, ptWarrantyEnd: S.day + 1825, ext: false, ppm: 0, freeOil: false, fin: { type: 'cash' } };
      c.annualKm = 32000; c.svc.dueDay = S.day + 120; c.svc.dueKm = 8000; c.dealerLoy = 0.55;
      addHist(c, 'purchase', `Fleet purchase: ${units.length} × ${MODEL[fv.modelId].name}`, g);
      return `Delivered ${units.length} fleet units to ${data.biz} for ${money(g)} front gross.`;
    },
  },
  oemOffer: {
    build({ mid, n, cash }) {
      const m = MODEL[mid];
      return { cat: 'OEM', title: `Aurex offers ${n} extra ${m.name} units with dealer cash`, body: `The zone manager can ship ${n} additional ${m.name}s outside your allocation, each carrying ${money(cash)} of dealer cash (added to the unit's incentive). Accepting helps your standing; the units add floorplan cost until sold.`,
        options: [{ label: `Accept ${n} units`, desc: `Standing +2. Ships in 7–14 days.` }, { label: 'Decline politely', desc: 'Standing −1.' }] };
    },
    resolve({ mid, n, cash }, i) {
      if (i === 1) { S.oem.standing = clamp(S.oem.standing - 1, 0, 100); return 'Declined the extra OEM allocation.'; }
      if (S.inv.length + n > lotCapacity().new) { toast('Not enough lot space — the offer lapsed.', 'bad'); return; }
      for (let k = 0; k < n; k++) { const eta = S.day + randi(7, 14); const v = makeNewVehicle(mid, { transit: true, eta, arrived: eta }); v.invoice -= cash; S.inv.push(v); }
      S.oem.standing = clamp(S.oem.standing + 2, 0, 100);
      return `Accepted ${n} extra ${MODEL[mid].name} units with ${money(cash)} dealer cash each.`;
    },
  },
  compCampaign: {
    build({ comp }) {
      const c = S.comps.find(x => x.id === comp); if (!c) return null;
      return { cat: 'Market', title: `How do you respond to ${c.name}'s campaign?`, body: `${c.name} is pulling shoppers with heavy advertising and discounts for the next few weeks. Unanswered, it will cut your showroom traffic${c.brand === 'Aurex' ? ' and push shoppers to compare the same Aurex models' : ''}.`,
        options: [{ label: 'Match with a $30,000 conquest ad blitz', desc: 'Neutralises most of the traffic loss.' }, { label: 'Cut prices: switch desk to Aggressive', desc: 'Close more deals at lower gross.' }, { label: 'Hold pricing and ride it out', desc: 'Protect gross, accept fewer ups.' }] };
    },
    resolve({ comp }, i) {
      const c = S.comps.find(x => x.id === comp); if (!c || !c.campaign) return;
      if (i === 0) { expense('advertising', 30000); c.campaign.matched = true; return `Ran a $30,000 counter-campaign against ${c.name}.`; }
      if (i === 1) { S.settings.desk.stance = 'aggressive'; return 'Desk pricing switched to Aggressive to fight the competitor campaign.'; }
      return `Held pricing during ${c.name}'s campaign.`;
    },
  },
  evRebate: {
    build() { return { cat: 'OEM', title: 'Aurex offers bonus EV allocation for the rebate program', body: 'With the new $4,000 government rebate, Aurex can ship 6 additional Volta units above your allocation. EV sales also count toward your electrified-mix objective.', options: [{ label: 'Take 6 extra Voltas', desc: 'Arrive in 7–14 days.' }, { label: 'Decline', desc: 'Stay with current allocation.' }] }; },
    resolve(d, i) { if (i === 1) return; for (let k = 0; k < 6; k++) { const eta = S.day + randi(7, 14); S.inv.push(makeNewVehicle('volta', { transit: true, eta, arrived: eta })); } return 'Ordered 6 bonus-allocation Volta EVs.'; },
  },
  winterTires: {
    build() { const p = partByPn('AX-TIRWN'); return { cat: 'Parts', title: 'Winter tire season is starting', body: `You have ${p.qoh} winter tire sets in stock. Pre-season orders arrive before the rush; in-season orders take ${partLead(p) + 3}+ days and customers who wait often buy elsewhere. Each set costs ${money(p.cost)} and retails at ${money(p.retail)}.`, options: [{ label: 'Pre-order 16 sets', desc: `${money(16 * p.cost)} paid on arrival.` }, { label: 'Pre-order 30 sets', desc: `${money(30 * p.cost)} — capture the full season.` }, { label: 'Order as needed', desc: 'No upfront cash.' }] }; },
    resolve(d, i) {
      const p = partByPn('AX-TIRWN');
      if (i === 2) { return; }
      const q = i === 0 ? 16 : 30;
      S.porders.push({ id: nextId('PO'), pn: p.pn, qty: q, eta: S.day + 4, cost: q * p.cost, kind: 'stock' }); p.onOrder += q;
      p.min = Math.max(p.min, 4); p.max = Math.max(p.max, Math.round(q * 0.6));
      return `Pre-ordered ${q} winter tire sets.`;
    },
  },
  recall: {
    build({ model, n }) { return { cat: 'Service', title: `Recall campaign: ${n} ${model} owners to contact`, body: `Each recall repair pays about ${money(0.9 * WARRANTY_RATE)} in warranty labour. Recall kits take ${partLead(partByPn('AX-RCL27'))} days to arrive. Customers who wait weeks for a recall appointment get frustrated.`, options: [{ label: `Stock ${Math.min(150, n)} recall kits now`, desc: `${money(Math.min(150, n) * 14)} — fix cars on the first visit.` }, { label: 'Stock 40 kits and add a recall call blitz', desc: `${money(40 * 14 + 2500)} — contact owners proactively.` }, { label: 'Order kits per repair order', desc: 'No upfront cost; cars wait for parts.' }] }; },
    resolve({ n }, i) {
      const p = partByPn('AX-RCL27');
      if (i === 2) { p.auto = false; return; }
      const q = i === 0 ? Math.min(150, n) : 40;
      S.porders.push({ id: nextId('PO'), pn: p.pn, qty: q, eta: S.day + partLead(p), cost: q * p.cost, kind: 'stock' }); p.onOrder += q;
      p.min = 6; p.max = 30; p.auto = true;
      if (i === 1) { expense('advertising', 2500); let k = 0; for (const c of S.customers) if (c.recall && chance(0.35) && !c.svc.appt) { bookAppointment(c, 'recall'); k++; } return `Stocked ${q} recall kits; call blitz booked ${k} recall appointments.`; }
      return `Stocked ${q} recall kits.`;
    },
  },
  complaint: {
    build({ cid, desc }) { const c = cust(cid); if (!c) return null; return { cat: 'Service', title: `${fullName(c)} is upset about a comeback`, body: `After "${desc}", the same problem returned. ${c.fn} is threatening to post a review and take the vehicle to an independent shop. Lifetime value with you so far: ${money(c.ltv)}.`, options: [{ label: 'Call personally and offer $350 goodwill', desc: 'Best chance to keep the customer.' }, { label: 'Offer a free loaner and a free next oil change', desc: 'Cheaper, usually enough.' }, { label: 'Let the service manager handle it', desc: 'No cost; risk of losing them.' }] }; },
    resolve({ cid }, i) {
      const c = cust(cid); if (!c) return;
      if (i === 0) { expense('other', 350); c.sat = clamp(c.sat + 18, 0, 100); c.dealerLoy = clamp(c.dealerLoy + 0.06, 0, 1); return `Goodwill gesture made to ${fullName(c)}.`; }
      if (i === 1) { expense('other', 140); c.sat = clamp(c.sat + 10, 0, 100); if (c.veh) c.veh.freeOil = true; return `Offered ${fullName(c)} a loaner and free oil change.`; }
      c.sat = clamp(c.sat - 8, 0, 100); if (chance(0.45)) { c.svc.defected = true; c.dealerLoy = clamp(c.dealerLoy - 0.15, 0, 1); S.fin.mtd.csiService.push(35); return `${fullName(c)} posted a one-star review and moved to an independent shop.`; }
    },
  },
  vip: {
    build({ vid }) { const v = S.showroom.find(x => x.id === vid); if (!v) return null; const c = cust(v.cid); return { cat: 'Sales', title: `${fullName(c)} is asking for the General Manager`, body: `A loyal customer (${c.svc.visits} service visits, lifetime value ${money(c.ltv)}) is in the showroom looking to replace their ${c.veh ? c.veh.year + ' ' + c.veh.model : 'vehicle'}. They want to deal with you directly.`, options: [{ label: 'Meet them now', desc: 'Opens the deal desk. They start in a good mood.' }, { label: 'Hand to the sales team', desc: 'A consultant works the deal at day end.' }] }; },
    resolve({ vid }, i) { const v = S.showroom.find(x => x.id === vid); if (!v) return; if (i === 0) { v.mood = clamp(v.mood + 12, 0, 100); v.boost = (v.boost || 0) + 0.2; setTimeout(() => openNegotiation(v.id), 30); } },
  },
};

/* ---------- Expansion & dealer group ---------- */
function hasExp(id) { return S.exp && S.exp.owned.includes(id); }
function monthsPlayed() { return S.fin.hist.filter(h => !h.prior).length; }
function expansionStatus(x) {
  if (hasExp(x.id)) return { state: 'owned' };
  const b = S.exp.building.find(e => e.id === x.id); if (b) return { state: 'building', done: b.done };
  const r = x.req, miss = [];
  if (r.months && monthsPlayed() < r.months) miss.push(`${r.months} months as GM (${monthsPlayed()} so far)`);
  if (r.standing && S.oem.standing < r.standing) miss.push(`OEM standing ${r.standing}+ (now ${S.oem.standing})`);
  if (r.usedSold && (!lastMonth() || lastMonth().units.used < r.usedSold)) miss.push(`${r.usedSold}+ used retail sales last month`);
  if (r.csi && kpiSalesCsi() < r.csi) miss.push(`Sales CSI ${r.csi}+`);
  if (r.netMonths) { const recent = S.fin.hist.filter(h => !h.prior).slice(-r.netMonths); if (recent.length < r.netMonths || recent.some(h => statementNet(h) <= 0)) miss.push(`${r.netMonths} consecutive profitable months`); }
  if (S.cash < x.cost) miss.push(`${money(x.cost)} cash`);
  return { state: miss.length ? 'locked' : 'available', miss };
}
function startExpansion(id) {
  const x = EXPANSION[id], st = expansionStatus(x);
  if (st.state !== 'available') return toast('Requirements not met yet.', 'bad');
  S.cash -= x.cost; S.fin.mtd.cf.capex += x.cost;
  S.exp.building.push({ id, done: S.day + x.days });
  logEvent('good', 'group', `Started project: ${x.name} (${money(x.cost)}, ${x.days} days).`);
}
function dailyExpansion() {
  for (const b of S.exp.building.filter(b => b.done <= S.day)) {
    S.exp.owned.push(b.id);
    const x = EXPANSION[b.id];
    news('good', `${x.name} is open`, x.effect);
    if (b.id === 'luxury') S.stores.push(newStore('Oriel of Lakeshore', 'Oriel', 'luxury'));
    if (b.id === 'acquire') S.stores.push(newStore('Kestrel of Millbrook', 'Kestrel', 'mainstream'));
  }
  S.exp.building = S.exp.building.filter(b => b.done > S.day);
  // collision centre daily work
  if (hasExp('collision') && dparts(S.day).dow !== 0) {
    const jobs = poisson(2.4 * (0.8 + kpiServiceCsi() / 400) * (S.customers.length / 3000));
    let rev = 0; for (let i = 0; i < jobs; i++) rev += randf(1800, 5200);
    book('collision', rev, rev * 0.56); S.cash += rev * 0.44;
  }
  if (hasExp('warehouse') && dparts(S.day).dow !== 0 && dparts(S.day).dow !== 6) { const r = randf(1500, 2300); book('parts', r, r * 0.8); S.cash += r * 0.2; }
}
function newStore(name, brand, kind) {
  const g = genPersonName();
  return { id: nextId('ST'), name, brand, kind, opened: S.day, gm: { name: g.fn + ' ' + g.ln, skill: randi(40, 72) }, invest: 0, hist: [], csi: randi(76, 86) };
}
function storesMonthly() {
  for (const st of S.stores) {
    const base = st.kind === 'luxury' ? 110000 : 22000;
    const mature = clamp((S.day - st.opened) / 180, 0.35, 1);
    const net = Math.round((base * (0.45 + st.gm.skill / 90) * (0.75 + S.mkt.conf / 250) + st.invest * 9000) * mature + gauss(0, 16000));
    const units = Math.round((st.kind === 'luxury' ? 38 : 70) * (0.7 + st.gm.skill / 200) * mature);
    st.hist.push({ key: S.fin.mtd.key, net, units, rev: Math.round(units * (st.kind === 'luxury' ? 78000 : 36000) * 1.25) });
    if (st.hist.length > 36) st.hist.shift();
    st.gm.skill = Math.min(95, st.gm.skill + randf(0, 0.8));
    S.cash += net; S.fin.mtd.cf.stores += net;
  }
}
function storeInvest(id) { const st = S.stores.find(s => s.id === id); if (!st) return; S.cash -= 250000; S.fin.mtd.cf.capex += 250000; st.invest++; logEvent('info', 'group', `Invested $250,000 in ${st.name} (facility & marketing).`); }
function storeReplaceGm(id) { const st = S.stores.find(s => s.id === id); if (!st) return; expense('other', 45000); const g = genPersonName(); st.gm = { name: g.fn + ' ' + g.ln, skill: randi(45, 85) }; logEvent('info', 'group', `Installed ${st.gm.name} as GM of ${st.name} (search fee $45,000).`); }
function storeSell(id) {
  const st = S.stores.find(s => s.id === id); if (!st) return;
  const annual = avg(st.hist.slice(-6), h => h.net) * 12;
  const price = Math.round(Math.max(800000, annual * 4.5 + 1200000 + st.invest * 150000));
  S.cash += price; S.stores = S.stores.filter(s => s !== st);
  logEvent('good', 'group', `Sold ${st.name} for ${money(price)}.`);
}

/* ---------- Logging & KPIs ---------- */
function logEvent(tone, cat, text) {
  const e = { day: S.day, tone, cat, text };
  S.log.unshift(e); if (S.log.length > 400) S.log.length = 400;
  if (S.today) S.today.push(e);
}
function kpiSalesCsi() { const a = [...S.fin.mtd.csiSales, ...((lastMonth() && lastMonth().csiSales) || [])].slice(-80); return a.length ? avg(a) : 82; }
function kpiServiceCsi() { const a = [...S.fin.mtd.csiService, ...((lastMonth() && lastMonth().csiService) || [])].slice(-200); return a.length ? avg(a) : 80; }
function computeKpis() {
  const k = S.kpiCache;
  k.ret = retentionStats();
  k.lead = apptLeadTime();
  k.dsupply = daysSupply();
  k.morale = avg(S.emps.filter(e => e.status !== 'gone'), e => e.morale);
}

/* ---------- Time ---------- */
function morning() {
  S.today = [];
  S.flags.deliveriesToday = 0; S.flags.callsToday = 0;
  S.flags.grossAtMorning = stGross(S.fin.mtd);
  refreshMods();
  if (S.day > 0) marketDaily();
  vehicleArrivals(); usedArrivals();
  morningEmployees();
  checkInAppointments();
  scheduledVisits();
  genTraffic();
  if (dparts(S.day).dow === 1) genCandidates();
  if (dparts(S.day).dow === 3 && S.day - S.auctionDay >= 7) genAuction();
  randomEvents();
  dailyExpansion();
  computeKpis();
}
function scheduledVisits() {
  const sunday = dparts(S.day).dow === 0;
  for (const c of S.customers) {
    if (!c.inMarket || c.inMarket.visit == null || c.inMarket.visit > S.day) continue;
    if (sunday) { c.inMarket.visit = S.day + 1; continue; }
    c.inMarket.visit = null;
    const v = createVisit(c, c.inMarket.src || 'repeat', { serious: 0.12 });
    if (c.veh && c.veh.fromUs && c.ltv > 6000 && c.dealerLoy > 0.45 && chance(0.12) && !S.decisions.some(d => d.type === 'vip')) { v.vip = true; v.time = '9:05'; v.shown = true; queueDecision('vip', { vid: v.id }); }
  }
}
function endOfDay() {
  resolveShowroom();
  dailyShop();
  dailyParts();
  settleAuctions();
  dailyCustomers();
  eveningEmployees();
  dailyFloorplan();
  dailyExpenses();
  const g = stGross(S.fin.mtd) - (S.flags.grossAtMorning || 0);
  S.fin.daily.push({ d: S.day, cash: Math.round(S.cash), gross: Math.round(g), units: S.deals.filter(x => x.day === S.day).length });
  if (S.fin.daily.length > 420) S.fin.daily.shift();
  if (isLastDayOfMonth(S.day)) closeMonth();
  if (S.cash < -CREDIT_LINE && !S.over) S.over = { day: S.day, reason: `Cash fell below the bank's ${money(CREDIT_LINE)} operating line. The lender has called the loan and Aurex has appointed a receiver.` };
}
function closeMonth() {
  const L = S.fin.mtd;
  const oem = evaluateOem(L);
  L.oem = oem; L.cashEnd = S.cash;
  const ret = retentionStats();
  L.retention = ret.owner; L.retAll = ret.overall; L.cohorts = ret.cohorts.map(c => (c.n ? c.r / c.n : 0));
  L.standing = S.oem.standing; L.target = S.oem.targets.units;
  L.csiS = avg(L.csiSales) || null; L.csiV = avg(L.csiService) || null;
  L.dsupply = daysSupply(); L.invValue = sum(S.inv.filter(v => v.status !== 'transit'), v => v.invoice); L.partsValue = partsValue();
  L.usedValue = sum(S.used, u => u.cost + u.reconCost); L.headcount = S.emps.filter(e => e.status !== 'gone').length;
  L.share = 0;
  for (const e of S.emps) { e.lastPay = e.mtd.pay; e.lastMtd = { ...e.mtd }; e.mtd = { units: 0, gross: 0, ups: 0, hours: 0, ros: 0, pay: 0 }; }
  competitorsMonthly(L.units.new);
  storesMonthly();
  L.share = (() => { const ours = L.units.new + L.units.used; const theirs = sum(S.comps.filter(c => c.type === 'dealer' || c.type === 'used'), c => c.units || c.vol); return ours / Math.max(1, ours + theirs); })();
  S.fin.hist.push(L); if (S.fin.hist.length > 72) S.fin.hist.shift();
  S.fin.mtd = newLedger(monthKey(S.day + 1)); S.fin.mtd.cashStart = S.cash;
  S.oem.mtdNew = 0; S.oem.mtdEv = 0; S.oem.ordered = 0;
  setOemTargets(); setOemIncentives();
  if (S.flags.fillTotal > 200) { S.flags.fillTotal /= 2; S.flags.fillOk /= 2; }
  pruneCustomers();
  for (const pid of Object.keys(S.progStats)) { /* keep running totals */ }
  S.report = L.key;
  const net = statementNet(L);
  logEvent(net >= 0 ? 'good' : 'bad', 'finance', `${monthLabel(L.key, true)} closed: net profit ${money(net)}.`);
}
function advanceDay() {
  if (S.over) return false;
  endOfDay();
  if (S.over) return false;
  S.day++;
  morning();
  return true;
}
function blocked() { return S.over || S.decisions.length > 0 || S.report != null; }
