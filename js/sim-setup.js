'use strict';
/* =====================================================================
   Dealer Empire — new game generation
   ===================================================================== */

function newLedger(key) {
  const z = () => Object.fromEntries(DEPTS.map(d => [d.id, 0]));
  return {
    key, rev: z(), cogs: z(), exp: Object.fromEntries(Object.keys(EXPENSE_LABELS).map(k => [k, 0])),
    units: { new: 0, used: 0, wholesale: 0, ev: 0, lease: 0 }, ros: { cp: 0, warranty: 0, internal: 0 },
    hours: { cp: 0, warranty: 0, internal: 0 }, techPay: 0, ups: 0, sold: 0, lost: 0, unattended: 0,
    fiDeals: 0, products: 0, csiSales: [], csiService: [], cashStart: S ? S.cash : 0, cashEnd: 0,
    cf: { parts: 0, usedBuy: 0, capex: 0, stores: 0 }, repeat: 0, conquest: 0, comebacks: 0,
  };
}

function fullName(c) { return c.fn + ' ' + c.ln; }

function genPersonName() { return { fn: pick(FIRST_NAMES), ln: pick(LAST_NAMES) }; }

/* A brand-new customer profile. kind: owner | service | prospect | conquest */
function genCustomer(kind, opt = {}) {
  const nm = genPersonName();
  const age = Math.round(clamp(gauss(46, 14), 19, 84));
  const hh = pickW(HOUSEHOLDS, h => ({
    'Single': age < 35 ? 30 : 10, 'Couple': age < 60 ? 18 : 8, 'Family with kids': age >= 28 && age <= 52 ? 34 : 4,
    'Single parent': age >= 26 && age <= 50 ? 8 : 1, 'Empty nesters': age >= 50 && age < 68 ? 26 : 2, 'Retired': age >= 64 ? 40 : 0, 'Roommates': age < 30 ? 10 : 1,
  })[h]);
  const inc = roundTo(clamp(Math.exp(gauss(Math.log(age < 26 ? 52000 : age > 66 ? 62000 : 84000), 0.42)), 26000, 420000), 1000);
  const credit = Math.round(clamp(gauss(704 + (inc - 80000) / 5000 + (age - 45) * 0.8, 52), 520, 850));
  const budget = roundTo(clamp(inc * randf(0.072, 0.118) / 12, 260, 2400), 10);
  const wantCls = pickW(['car', 'suv', '3row', 'truck'], ({
    'Single': [42, 38, 3, 17], 'Couple': [32, 46, 6, 16], 'Family with kids': [10, 42, 34, 14], 'Single parent': [26, 52, 14, 8],
    'Empty nesters': [30, 44, 8, 18], 'Retired': [40, 46, 4, 10], 'Roommates': [48, 30, 2, 20],
  })[hh]);
  const young = clamp((60 - age) / 40, 0, 1);
  const c = {
    id: nextId('C'), fn: nm.fn, ln: nm.ln, age, inc, hh, credit, budget,
    cashAvail: roundTo(inc * randf(0.015, 0.16), 250),
    style: pickW(Object.keys(NEG_STYLES), [15, 32, 25, 15, 13]),
    priceSens: round2(clamp(gauss(0.56 - (inc - 80000) / 320000, 0.17), 0.08, 0.96)),
    rel: round2(clamp(gauss(0.62 + (age - 45) / 140, 0.18), 0.05, 1)),
    perf: round2(clamp(gauss(0.40 + young * 0.15 + (wantCls === 'truck' ? 0.12 : 0), 0.2), 0.02, 1)),
    eff: round2(clamp(gauss(0.48, 0.22), 0.02, 1)),
    tech: round2(clamp(gauss(0.38 + young * 0.3, 0.2), 0.02, 1)),
    wantCls, wantNew: 'new', leasePref: chance(0.2), brandLoy: round2(clamp(gauss(0.35, 0.18), 0, 1)),
    dealerLoy: round2(clamp(gauss(0.3, 0.15), 0, 1)), sat: Math.round(clamp(gauss(78, 9), 40, 100)),
    annualKm: roundTo(clamp(gauss(17500, 6200), 5000, 48000), 500), winter: chance(0.58),
    veh: null, status: kind === 'owner' ? 'owner' : kind === 'service' ? 'service' : 'prospect',
    svc: { last: null, visits: 0, missed: 0, dueKm: 0, dueDay: 0, pending: null, appt: null, spend: 0, defected: false, tireSeason: '' },
    inMarket: null, followUp: null, lastVisit: null, recall: false, invited: 0, hist: [], ltv: 0, since: S.day,
  };
  if (c.credit < 640 || c.budget < 430) c.wantNew = pickW(['used', 'either', 'new'], [70, 20, 10]);
  else c.wantNew = pickW(['new', 'either', 'used'], [64, 22, 14]);
  if (c.inc > 140000 && c.age > 45 && chance(0.35)) c.cashBuyer = true;
  c.veh = genCustomerVehicle(c, kind, opt);
  return c;
}
function round2(x) { return Math.round(x * 100) / 100; }

function genCustomerVehicle(c, kind, opt) {
  const now = yearFrac(S.day);
  if (kind === 'conquest' && chance(0.07)) return null; // first-time buyer
  let base, fromUs = false, purchased, isNew = true, modelId = null;
  if (kind === 'owner' || kind === 'service' || (kind === 'conquest' && chance(0.14))) {
    purchased = opt.purchased != null ? opt.purchased : -Math.floor(Math.pow(rand(), 1.15) * 2900) - 15;
    const yrsAgo = (S.day - purchased) / 365;
    if (yrsAgo > 4 && chance(0.22)) base = pick(AUREX_LEGACY);
    else {
      const m = pickW(MODELS.filter(x => !x.exclusive), m => ({ car: { small: 3, hybrid: 1, ev: 0.4 }, suv: { compactSUV: 3, hybrid: 1, ev: 0.6 }, '3row': { midsizeSUV: 3 }, truck: { pickup: 3 } }[c.wantCls] || {})[m.seg] || 0.25);
      base = { make: 'Aurex', model: m.name, cls: m.cls, pt: m.pt, msrp: m.msrp + randi(0, 3) * 2500 }; modelId = m.id;
      if (m.pt === 'ev' && yrsAgo > 4) { base = { make: 'Aurex', model: 'Terra', cls: 'suv', pt: 'ice', msrp: 33000 }; modelId = 'terra'; }
    }
    fromUs = kind === 'owner';
    isNew = kind === 'owner' ? chance(0.78) : chance(0.45);
  } else {
    base = pickW(ROAD_VEHICLES, v => v.w * (v.cls === c.wantCls ? 2.2 : 1));
    purchased = -Math.floor(Math.pow(rand(), 0.9) * 2600) - 30;
    isNew = chance(0.6);
  }
  const purYear = yearFrac(purchased);
  let year = Math.floor(purYear + (isNew ? (dparts(Math.max(-3000, purchased)).m >= 8 ? 1 : 0) : -randi(1, 5)));
  const age = Math.max(0.1, now - year + 0.4);
  const ownedYrs = Math.max(0.05, (S.day - purchased) / 365);
  const kmAtBuy = isNew ? randi(10, 80) : Math.round(c.annualKm * Math.max(0.3, age - ownedYrs) * randf(0.8, 1.2));
  const km = Math.round(kmAtBuy + c.annualKm * ownedYrs * randf(0.85, 1.15));
  const cond = clamp(Math.round(5.2 - age / 2.8 - km / 140000 + gauss(0, 0.6)), 1, 5);
  const v = {
    year, make: base.make, model: base.model, cls: base.cls, pt: base.pt, msrpNew: base.msrp, km, cond,
    acc: chance(0.12 + age * 0.02) ? (chance(0.75) ? 'minor' : 'major') : 'none',
    fromUs, purchased, boughtNew: isNew, modelId, warrantyEnd: null, ptWarrantyEnd: null, ext: false, ppm: 0, freeOil: false, fin: null,
  };
  if (isNew) { v.warrantyEnd = purchased + 365 * 3; v.ptWarrantyEnd = purchased + 365 * 5; }
  if (v.fromUs && chance(0.22)) v.ext = true;
  const price = base.msrp * (isNew ? 0.97 : Math.max(0.35, Math.pow(0.86, age - ownedYrs)) * 0.9);
  const roll = rand();
  if (c.cashBuyer || roll < 0.1) v.fin = { type: 'cash' };
  else if (isNew && roll < 0.27 && ownedYrs < 3.9) {
    const term = pick([36, 36, 48, 48, 24]);
    if (ownedYrs * 12 < term) v.fin = { type: 'lease', term, start: purchased, pmt: roundTo(price * 0.0145, 1), residual: Math.round(base.msrp * (term <= 36 ? 0.57 : 0.5)), apr: 4.9 };
  }
  if (!v.fin) {
    const term = pick([60, 72, 72, 84, 84, 96]);
    const amt = Math.round(price * randf(0.75, 1.08));
    const apr = round2(clamp(5.5 + (720 - c.credit) / 30, 0.9, 19));
    v.fin = { type: 'finance', amt, apr, term, start: purchased, pmt: Math.round(amort(amt, apr, term)) };
  }
  return v;
}

function initServiceHistory(c) {
  const v = c.veh; if (!v || v.make !== 'Aurex') return;
  const yrs = (S.day - v.purchased) / 365;
  if (yrs < 0.45) { // bought recently, first service not due yet
    c.svc.dueDay = v.purchased + randi(165, 195); c.svc.dueKm = v.km + randi(2000, 7000);
    if (v.fromUs) c.ltv = Math.round(randf(2200, 5200));
    return;
  }
  const ret = [0.84, 0.72, 0.62, 0.5, 0.42, 0.34, 0.29, 0.26, 0.24][Math.min(8, Math.floor(yrs))] * (c.status === 'service' ? 1.1 : 1);
  if (chance(ret)) {
    c.svc.last = -randi(3, 178); c.svc.visits = Math.max(1, Math.round(yrs * 2.1 + rand()));
    c.svc.spend = Math.round(c.svc.visits * randf(240, 520));
    c.dealerLoy = round2(clamp(c.dealerLoy + 0.18, 0, 1)); c.sat = Math.round(clamp(c.sat + 4, 40, 100));
    c.svc.dueDay = c.svc.last + randi(160, 200);
  } else {
    if (yrs > 0.6) { c.svc.last = v.purchased + randi(90, Math.max(91, Math.floor((S.day - v.purchased) * 0.5))); c.svc.visits = randi(1, 3); }
    c.svc.missed = randi(2, 4); c.svc.defected = true; c.dealerLoy = round2(clamp(c.dealerLoy - 0.1, 0, 1));
    c.svc.dueDay = randi(5, 180);
  }
  if (c.svc.last != null && c.svc.last > 0) c.svc.last = -1;
  c.svc.dueKm = v.km + randi(300, 8000);
  if (v.fromUs) c.ltv = Math.round(randf(2200, 5200) + c.svc.spend * 0.6);
}

function addHist(c, type, text, amt) {
  c.hist.unshift([S.day, type, text, amt == null ? null : Math.round(amt)]);
  const cap = c.status === 'prospect' || c.status === 'lost' ? 4 : 9;
  if (c.hist.length > cap) c.hist.length = cap;
}

function addCustomer(c) { S.customers.push(c); CIDX.set(c.id, c); return c; }
function cust(id) { return CIDX.get(id); }
function rebuildIndex() { CIDX = new Map(S.customers.map(c => [c.id, c])); }

/* ---------- Employees ---------- */
function marketSalary(role, skill) { return roundTo(ROLES[role].base * (0.8 + skill / 250), 500); }
function marketFlat(tier, skill) { return round2(TECH_FLAT[tier] * (0.93 + skill / 700)); }

function genEmployee(role, opt = {}) {
  const nm = genPersonName();
  const skill = Math.round(opt.skill != null ? opt.skill : clamp(gauss(52, 15), 18, 92));
  const e = {
    id: nextId('E'), fn: nm.fn, ln: nm.ln, role, skill, exp: round2(opt.exp != null ? opt.exp : clamp(skill / 9 + gauss(0, 2.5), 0.2, 30)),
    morale: Math.round(opt.morale != null ? opt.morale : clamp(gauss(66, 8), 40, 90)), salary: 0, comm: ROLES[role].comm,
    csi: Math.round(clamp(gauss(78 + (skill - 50) / 5, 6), 55, 98)), absence: round2(clamp(gauss(0.025, 0.008), 0.008, 0.06)),
    hired: opt.hired != null ? opt.hired : S.day - Math.round(clamp(gauss(900, 700), 30, 5000)), status: 'active', trainUntil: null, course: null,
    absent: false, certs: [], ev: false, tier: 0, eff: 1, flat: 0, mtd: { units: 0, gross: 0, ups: 0, hours: 0, ros: 0, pay: 0 }, lastRaise: -400, warned: false,
  };
  e.salary = opt.salary != null ? opt.salary : marketSalary(role, skill) * (role === 'sales' ? 1 : randf(0.96, 1.04));
  e.salary = roundTo(e.salary, 500);
  if (role === 'tech') {
    e.tier = opt.tier || clamp(Math.round(skill / 25 + 0.3), 1, 4);
    e.eff = round2(opt.eff || clamp(0.72 + skill / 180 + gauss(0, 0.06), 0.65, 1.45));
    e.flat = marketFlat(e.tier, skill); e.ev = !!opt.ev;
  }
  return e;
}
function empName(e) { return e.fn + ' ' + e.ln; }
function emps(role) { return S.emps.filter(e => e.role === role && e.status !== 'gone'); }
function present(role) { return S.emps.filter(e => e.role === role && e.status === 'active' && !e.absent); }
function empById(id) { return S.emps.find(e => e.id === id); }

/* ---------- New game ---------- */
function newGame(opt = {}) {
  const seed = opt.seed != null ? opt.seed : (Date.now() ^ (Math.random() * 1e9)) | 0;
  S = {
    v: 3, rng: seed, seed, ids: {}, day: 0, dealerName: opt.name || 'Lakeshore Aurex', difficulty: opt.difficulty || 'standard',
    cash: opt.difficulty === 'hard' ? 1400000 : 2000000,
    settings: { desk: { stance: 'market', fiPush: 'medium', markup: 1.0, trade: 'market' }, usedPlan: 'ask', ad: 42000, laborRate: 165, oilPrice: 99,
      loaners: 6, roFocus: 'waiting', autoReorder: true, pace: 1200 },
    inv: [], used: [], sold: [], auction: [], auctionDay: -99, customers: [], showroom: [], deals: [],
    emps: [], cands: {}, candDay: -99,
    svc: { bays: 6, ros: [], appts: [], booked: {}, loanersOut: 0, done: 0, mobileToday: 0 },
    parts: [], porders: [],
    fin: { mtd: null, hist: [], daily: [] },
    oem: null, mkt: null, comps: [], programs: {}, progStats: {}, exp: { owned: [], building: [] }, stores: [],
    log: [], today: [], decisions: [], report: null, flags: { intro: true }, over: null, kpiCache: {},
  };
  S.fin.mtd = newLedger(monthKey(0));
  S.fin.mtd.cashStart = S.cash;
  for (const p of PROGRAMS) { S.programs[p.id] = false; S.progStats[p.id] = { since: null, cost: 0, visits: 0, attrib: 0 }; }

  S.mkt = { prime: 4.75, fuel: 1.58, conf: 64, ev: 1.0, usedIdx: 100, partsLead: 1, supply: 1, events: [], news: [], hist: { prime: [], fuel: [], conf: [], ev: [], usedIdx: [] } };
  // seed 120 days of market history for sparklines
  for (let i = -120; i < 0; i++) {
    S.mkt.fuel = clamp(S.mkt.fuel + gauss(0, 0.012) + (1.56 - S.mkt.fuel) * 0.03, 1.2, 2.4);
    S.mkt.conf = clamp(S.mkt.conf + gauss(0, 0.7) + (63 - S.mkt.conf) * 0.03, 30, 90);
    S.mkt.usedIdx = clamp(S.mkt.usedIdx + gauss(0, 0.3) + (100 - S.mkt.usedIdx) * 0.03, 80, 120);
    S.mkt.ev = clamp(S.mkt.ev + gauss(0.0006, 0.004), 0.7, 1.6);
    pushMarketHist(i);
  }
  S.comps = COMPETITORS_INIT.map(c => ({ ...c, campaign: null, share: 0, units: c.vol, hist: [] }));

  S.oem = {
    standing: 58, my: 2027, facility: 72, targets: null, alloc: 50, ordered: 0, incentives: {}, hist: [], stair: [[1.0, 300], [1.1, 450], [1.25, 650]],
    mtdNew: 0, mtdEv: 0, exclusiveAlloc: 0, standingHist: [],
  };
  setOemTargets(); setOemIncentives(true);

  // Employees — the starting team
  const team = [
    ['gsm', { skill: 63, exp: 14 }], ['sales', { skill: 61, exp: 6 }], ['sales', { skill: 48, exp: 2.5 }], ['sales', { skill: 38, exp: 0.8 }],
    ['fi', { skill: 58, exp: 7 }], ['svcmgr', { skill: 60, exp: 12 }], ['advisor', { skill: 57, exp: 5 }], ['advisor', { skill: 43, exp: 1.5 }],
    ['tech', { skill: 84, tier: 4, eff: 1.27, ev: true, exp: 18 }], ['tech', { skill: 67, tier: 3, eff: 1.12, exp: 9 }], ['tech', { skill: 61, tier: 3, eff: 1.05, exp: 7 }],
    ['tech', { skill: 49, tier: 2, eff: 0.96, exp: 4 }], ['tech', { skill: 44, tier: 2, eff: 0.92, exp: 3 }], ['tech', { skill: 28, tier: 1, eff: 0.84, exp: 0.7 }],
    ['parts', { skill: 57, exp: 8 }], ['detail', { skill: 50, exp: 3 }],
  ];
  for (const [role, o] of team) S.emps.push(genEmployee(role, o));
  S.emps.filter(e => ['sales', 'tech', 'advisor'].includes(e.role)).forEach(e => { if (chance(0.45)) e.certs.push(e.role === 'tech' ? 'techcert' : e.role === 'advisor' ? 'advisor' : 'product'); });

  // Parts
  S.parts = PARTS_CATALOG.map(p => ({
    ...p, qoh: p.legacy ? randi(6, 14) : p.recall ? 0 : Math.round(randf(p.min * 0.9, p.max * 0.85)),
    onOrder: 0, auto: !p.legacy && !p.recall, lastSale: p.legacy ? -randi(300, 520) : -randi(0, 30), used90: 0, sold: [], obsolete: false,
  }));
  S.parts.forEach(p => { if (p.seasonal) p.qoh = randi(1, 3); });

  // New vehicle inventory: 25 units, a few aged prior-model-year units
  const mix = { pico: 2, strada: 3, stradah: 2, terra: 5, terrah: 2, atlas: 3, ridge: 3, forge: 3, volta: 2 };
  for (const [mid, n] of Object.entries(mix)) for (let i = 0; i < n; i++) S.inv.push(makeNewVehicle(mid, { arrived: -randi(2, 70), year: 2027 }));
  for (let i = 0; i < 4; i++) {
    const v = pick(S.inv.filter(x => x.year === 2027 && ['atlas', 'forge', 'strada', 'pico'].includes(x.modelId)));
    v.year = 2026; v.arrived = -randi(96, 160);
  }
  S.inv.forEach(v => { v.fpAccrued = Math.round(v.invoice * floorplanRate() / 365 * (S.day - v.arrived)); });

  // Customers
  for (let i = 0; i < 2000; i++) { const c = addCustomer(genCustomer('owner')); initServiceHistory(c); seedHistory(c); }
  for (let i = 0; i < 1400; i++) { const c = addCustomer(genCustomer('service')); initServiceHistory(c); seedHistory(c); }
  for (let i = 0; i < 250; i++) {
    const c = addCustomer(genCustomer('prospect'));
    c.lastVisit = -randi(1, 120); addHist(c, 'visit', 'Showroom visit, did not purchase', null);
    if (chance(0.4)) c.followUp = randi(0, 14);
  }
  // Used vehicle inventory: 10 units on the lot
  for (let i = 0; i < 10; i++) {
    const u = makeUsedFromSpec(randomUsedSpec(), chance(0.6) ? 'trade' : 'auction');
    u.acquired = -randi(3, 75); u.status = 'available'; u.recon = 'done'; u.cond = Math.max(u.cond, 4);
    u.reconCost = roundTo(randf(500, 1800), 10); u.ask = roundTo(usedRetail(u) * randf(1.0, 1.04), 100) - 5;
    S.used.push(u);
  }
  S.customers.forEach(c => { if (c.veh) c.eq = Math.round(acvOf(c.veh) - loanBalance(c.veh.fin)); });
  genCandidates(true);
  genAuction();
  seedAppointments();
  seedFinanceHistory();
  S.svc.loanersOut = 0;
  logEvent('info', 'gm', `You take over as General Manager of ${S.dealerName}.`);
  morning();
  return S;
}

function seedHistory(c) {
  const v = c.veh; if (!v) return;
  if (v.fromUs) addHist(c, 'purchase', `Purchased ${v.boughtNew ? 'new' : 'used'} ${v.year} ${v.make} ${v.model}`, null);
  else if (v.make === 'Aurex') addHist(c, 'note', `Owns ${v.year} ${v.make} ${v.model}, bought elsewhere`, null);
  if (c.svc.last != null) addHist(c, 'service', 'Maintenance visit', randf(160, 520));
  c.hist.sort((a, b) => b[0] - a[0]);
}

/* Three months of results under the previous GM, so comparisons exist from day one */
function seedFinanceHistory() {
  const keys = ['2026-12', '2027-01', '2027-02'];
  keys.forEach((key, i) => {
    const L = newLedger(key); L.prior = true;
    const f = [0.86, 0.8, 0.88][i];
    const nu = Math.round(36 * f + randi(-2, 2)), uu = Math.round(24 * f + randi(-2, 2));
    L.units.new = nu; L.units.used = uu; L.units.ev = Math.round(nu * 0.1); L.sold = nu + uu; L.ups = Math.round((nu + uu) / 0.27);
    L.rev.new = nu * 41500; L.cogs.new = L.rev.new - nu * randf(2100, 2600);
    L.rev.used = uu * 24800; L.cogs.used = L.rev.used - uu * randf(1700, 2300);
    L.rev.wholesale = 6 * 9000; L.cogs.wholesale = L.rev.wholesale + 6 * randf(300, 700);
    L.rev.fi = (nu + uu) * randf(1350, 1550); L.cogs.fi = L.rev.fi * 0.18; L.fiDeals = Math.round((nu + uu) * 0.85); L.products = Math.round(L.fiDeals * 1.3);
    L.hours.cp = Math.round(720 * f); L.hours.warranty = Math.round(160 * f); L.hours.internal = 120;
    L.rev.labor = L.hours.cp * 151 + L.hours.warranty * WARRANTY_RATE + L.hours.internal * INTERNAL_RATE; L.cogs.labor = (L.hours.cp + L.hours.warranty + L.hours.internal) * 40;
    L.ros.cp = Math.round(L.hours.cp / 1.55); L.ros.warranty = Math.round(L.hours.warranty / 2.3); L.ros.internal = 30;
    L.rev.parts = L.rev.labor * 0.78; L.cogs.parts = L.rev.parts * 0.62; L.rev.acc = (nu + uu) * 210; L.cogs.acc = L.rev.acc * 0.55;
    L.rev.oemInc = nu >= 34 ? nu * 300 : 0;
    L.exp.payroll = 112000 * (0.9 + f * 0.1); L.exp.advertising = 42000; L.exp.rent = FIXED_EXPENSES.rent; L.exp.utilities = FIXED_EXPENSES.utilities * (i < 2 ? 1.25 : 1.1);
    L.exp.insurance = FIXED_EXPENSES.insurance; L.exp.floorplan = 13500; L.exp.technology = FIXED_EXPENSES.technology; L.exp.loaners = 6 * 650 + 900;
    L.exp.training = 1800; L.exp.maintenance = FIXED_EXPENSES.maintenance; L.exp.oem = FIXED_EXPENSES.oem; L.exp.other = FIXED_EXPENSES.other + FIXED_EXPENSES.admin;
    L.csiSales = [Math.round(82 + randf(-2, 2))]; L.csiService = [Math.round(80 + randf(-2, 2))];
    const net = statementNet(L);
    L.cashStart = 2000000 - net * (3 - i) * 0.4; L.cashEnd = L.cashStart + net * 0.4;
    L.retention = 0.5 + i * 0.005; L.standing = 56 + i; L.target = 40; L.csiS = L.csiSales[0]; L.csiV = L.csiService[0];
    S.fin.hist.push(L);
  });
}

/* Book the first two weeks of the service schedule from customers already due */
function seedAppointments() {
  const due = S.customers.filter(c => serviceEligible(c) && !c.svc.defected && c.svc.dueDay <= 14).sort((a, b) => a.svc.dueDay - b.svc.dueDay);
  for (const c of due) {
    const job = c.svc.visits % 2 === 1 ? 'maint' : 'oil';
    const from = Math.max(0, c.svc.dueDay - 3);
    const day = earliestSlot(JOBS[job].hrs, from);
    if (day > 16) continue;
    bookAppointment(c, job, { day });
    c.svc.dueDay = day + 182; c.svc.dueKm = c.veh.km + 8000 + c.annualKm * (day / 365);
  }
  // a few repairs already in the schedule
  for (const c of shuffle(S.customers.filter(c => serviceEligible(c) && !c.svc.appt)).slice(0, 22)) {
    const job = pickW(['brakes', 'diag', 'warranty', 'tirenew', 'major'], [4, 3, (c.veh.warrantyEnd || -1) > S.day ? 4 : 0, 2, 1]);
    const parts = job === 'warranty' || job === 'diag' ? [[pick(REPAIR_PARTS), 1]] : job === 'major' ? [[pick(MAJOR_PARTS), 1]] : null;
    bookAppointment(c, job, { day: earliestSlot(JOBS[job].hrs, randi(0, 8)), parts });
  }
}
