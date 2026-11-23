'use strict';
/* =====================================================================
   Dealer Empire — vehicles, valuation, deal structuring, showroom
   ===================================================================== */

/* ---------- Rates ---------- */
function floorplanRate() { return (S.mkt.prime + 1.25) / 100; }
function autoRateBase() { return S.mkt.prime + 1.35 + (mods().rateAdj || 0); }
function amort(p, apr, n) { const r = apr / 1200; if (p <= 0) return 0; if (r <= 0) return p / n; return p * r / (1 - Math.pow(1 + r, -n)); }
function loanBalance(fin, day = S.day) {
  if (!fin) return 0;
  if (fin.type === 'cash') return 0;
  const k = Math.floor((day - fin.start) / 30.44);
  if (fin.type === 'lease') {
    const left = Math.max(0, fin.term - k);
    return Math.round(fin.residual + left * fin.pmt * 0.88);
  }
  if (k >= fin.term) return 0;
  const r = fin.apr / 1200;
  if (r <= 0) return Math.max(0, fin.amt * (1 - k / fin.term));
  const g = Math.pow(1 + r, k);
  return Math.max(0, Math.round(fin.amt * g - fin.pmt * (g - 1) / r));
}
function creditTier(score) {
  if (score >= 760) return { n: 'Tier 1+', spread: 0 }; if (score >= 720) return { n: 'Tier 1', spread: 0.5 };
  if (score >= 680) return { n: 'Tier 2', spread: 1.4 }; if (score >= 640) return { n: 'Tier 3', spread: 3.4 };
  if (score >= 600) return { n: 'Tier 4', spread: 6.2 }; return { n: 'Subprime', spread: 10.5 };
}
function buyRate(score, term, used) {
  return round2(Math.max(0.9, autoRateBase() + creditTier(score).spread + (term > 72 ? 0.6 : term > 60 ? 0.3 : 0) + (used ? 0.9 : 0)));
}
function lenderApproves(c, pmt, af, value, type) {
  if (type === 'cash') return true;
  if (c.credit < 540) return false;
  const pti = pmt / (c.inc / 12);
  const maxPti = c.credit >= 700 ? 0.2 : c.credit >= 640 ? 0.165 : 0.13;
  const maxLtv = c.credit >= 700 ? 1.38 : c.credit >= 640 ? 1.22 : 1.1;
  return pti <= maxPti && af / Math.max(1, value) <= maxLtv;
}

/* ---------- New vehicles ---------- */
function makeNewVehicle(modelId, opt = {}) {
  const m = MODEL[modelId];
  const ti = opt.trim != null ? opt.trim : m.trims.indexOf(pickW(m.trims, (t, i) => [30, 34, 22, 14][i] || 10));
  const trim = m.trims[ti];
  const col = (opt.color && EXT_COLORS.find(c => c.n === opt.color)) || pickW(EXT_COLORS, c => c.w);
  const year = opt.year || S.oem.my;
  const msrp = roundTo((m.msrp + trim.add) * (1 + (year - 2027) * 0.022), 5) + col.add;
  S.ids.stock = (S.ids.stock || 100) + 1;
  return {
    id: nextId('V'), stock: 'A' + String(year).slice(2) + String(S.ids.stock).padStart(4, '0'), kind: 'new', modelId, ti, trim: trim.n, eng: trim.eng, dr: trim.dr,
    year, ext: col.n, int: pick(ti >= 2 ? INT_COLORS.slice(2) : INT_COLORS.slice(0, 3)), msrp, invoice: Math.round(msrp * m.inv),
    arrived: opt.arrived != null ? opt.arrived : S.day, status: opt.transit ? 'transit' : 'available', eta: opt.eta || null, discount: 0, fpAccrued: 0,
  };
}
function vehById(id) { return S.inv.find(v => v.id === id) || S.used.find(u => u.id === id); }
function availableNew() { return S.inv.filter(v => v.status === 'available'); }
function availableUsed() { return S.used.filter(u => u.status === 'available'); }
function daysIn(v) { return Math.max(0, S.day - (v.kind === 'new' ? v.arrived : v.acquired)); }
function vehName(v, short) {
  if (v.kind === 'new') { const m = MODEL[v.modelId]; return short ? `${v.year} ${m.name} ${v.trim}` : `${v.year} Aurex ${m.name} ${v.trim}`; }
  return `${v.year} ${v.make} ${v.model}`;
}
function vehSeg(v) {
  if (v.kind === 'new') return MODEL[v.modelId].seg;
  if (v.pt === 'ev') return 'ev'; if (v.pt === 'hybrid') return 'hybrid';
  return { car: 'small', suv: 'compactSUV', '3row': 'midsizeSUV', truck: 'pickup' }[v.cls];
}
function vehCls(v) { return v.kind === 'new' ? MODEL[v.modelId].cls : v.cls; }
function vehPt(v) { return v.kind === 'new' ? MODEL[v.modelId].pt : v.pt; }
function lotCapacity() { return { new: 140 + (hasExp('bigstore') ? 60 : 0), used: 70 + (hasExp('superstore') ? 80 : 0) }; }

function segDemand(seg) {
  const m = S.mkt, fuelDev = (m.fuel - 1.58) / 1.58, p = dparts(S.day);
  const winter = [1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1][p.m];
  let d;
  switch (seg) {
    case 'pickup': d = 1.02 - fuelDev * 1.1 + winter * 0.04; break;
    case 'midsizeSUV': d = 1.0 - fuelDev * 0.7 + winter * 0.03; break;
    case 'compactSUV': d = 1.04 - fuelDev * 0.2 + winter * 0.02; break;
    case 'small': d = 0.95 + fuelDev * 0.6 + (60 - m.conf) / 220; break;
    case 'hybrid': d = 1.02 + fuelDev * 1.3; break;
    case 'ev': d = m.ev + fuelDev * 0.9 + (mods().evRebate ? 0.12 : 0); break;
    default: d = 1;
  }
  d *= (mods().seg && mods().seg[seg]) || 1;
  return clamp(d, 0.5, 1.7);
}
function newMarketValue(v) {
  const m = MODEL[v.modelId], dem = segDemand(m.seg);
  let disc = 0.034 - (dem - 1) * 0.07;
  if (v.year < S.oem.my) disc += 0.035;
  const age = daysIn(v); if (age > 90) disc += Math.min(0.03, (age - 90) / 30 * 0.006);
  disc += intraBrandPressure();
  disc += (S.mkt.supply - 1) * 0.06;
  if (m.exclusive) disc -= 0.02;
  return roundTo(v.msrp * (1 - clamp(disc, -0.03, 0.13)), 50);
}
function incentiveFor(v) {
  if (v.kind !== 'new') return 0;
  let x = S.oem.incentives[v.modelId] || 0;
  if (v.year < S.oem.my) x += 1500;
  if (MODEL[v.modelId].pt === 'ev') x += mods().evRebate || 0;
  return x;
}
function residualPct(v, term) {
  const m = MODEL[v.modelId];
  return clamp(m.resid + (36 - term) / 12 * 0.06 + (m.pt === 'ev' ? (S.mkt.ev - 1) * 0.1 : 0), 0.3, 0.75);
}

/* ---------- Used vehicles ---------- */
function randomUsedSpec(opt = {}) {
  const aurex = chance(opt.aurexShare != null ? opt.aurexShare : 0.4);
  let base;
  if (aurex) { const m = pick(MODELS.filter(x => !x.exclusive && (x.pt !== 'ev' || chance(0.4)))); base = { make: 'Aurex', model: m.name, cls: m.cls, pt: m.pt, msrp: m.msrp + randi(0, 3) * 2400 }; }
  else base = pickW(ROAD_VEHICLES, v => v.w);
  const age = randi(opt.minAge || 1, opt.maxAge || 9);
  const year = dparts(S.day).y - age + (dparts(S.day).m >= 8 ? 1 : 0);
  const km = Math.round(clamp(gauss(17500 * age, 6000 * Math.sqrt(age)), 4000, 320000));
  return {
    year, make: base.make, model: base.model, cls: base.cls, pt: base.pt, msrpNew: base.msrp, km,
    cond: clamp(Math.round(5.2 - age / 2.8 - km / 150000 + gauss(0, 0.7)), 1, 5),
    acc: chance(0.1 + age * 0.02) ? (chance(0.72) ? 'minor' : 'major') : 'none',
  };
}
function usedRetail(u) {
  const age = Math.max(0.3, yearFrac(S.day) - (u.year - 0.3));
  let dep = age <= 1 ? 1 - 0.19 * age : 0.81 * Math.pow(0.876, age - 1);
  dep *= { truck: 1.07, suv: 1.02, '3row': 1.0, car: 0.95 }[u.cls] || 1;
  if (u.pt === 'ev') dep *= 0.9 * (0.85 + S.mkt.ev * 0.15); else if (u.pt === 'hybrid') dep *= 1.04;
  if (u.make === 'Valdis') dep *= 0.92;
  const expKm = 17500 * age;
  const kmAdj = clamp(1 - (u.km - expKm) / 100000 * 0.17, 0.62, 1.12);
  const cond = [0, 0.74, 0.86, 0.94, 1.0, 1.03][u.cond];
  const accd = { none: 1, minor: 0.93, major: 0.81 }[u.acc];
  const seg = vehSeg({ kind: 'used', cls: u.cls, pt: u.pt });
  const dem = Math.pow(segDemand(seg), 0.6);
  return Math.max(1800, roundTo(u.msrpNew * dep * kmAdj * cond * accd * dem * S.mkt.usedIdx / 100, 50));
}
function reconEstimate(u) {
  return [0, 4300, 2700, 1550, 820, 380][u.cond] + (u.acc === 'major' ? 900 : 0) + (u.km > 150000 ? 650 : 0);
}
function reconCond(u) { const c = u.cond <= 2 ? u.cond + 2 : Math.min(5, u.cond + 1); return u.acc === 'major' ? Math.min(c, 4) : c; }
function acvOf(u) { return Math.max(400, roundTo(usedRetail({ ...u, cond: reconCond(u) }) * 0.915 - reconEstimate(u) - 250, 50)); }

function makeUsedFromSpec(spec, source) {
  S.ids.ustock = (S.ids.ustock || 400) + 1;
  const u = {
    id: nextId('U'), stock: 'U' + String(dparts(S.day).y).slice(2) + String(S.ids.ustock).padStart(4, '0'), kind: 'used', ...spec,
    ext: pickW(EXT_COLORS, c => c.w).n, source, acquired: S.day, cost: 0, reconCost: 0, recon: 'none', status: 'appraisal', ask: 0,
    surprise: null, decideBy: S.day + 3,
  };
  u.cost = acvOf(u);
  return u;
}

/* ---------- Trade-in appraisal ---------- */
function buildTrade(c) {
  const v = c.veh;
  const spec = { year: v.year, make: v.make, model: v.model, cls: v.cls, pt: v.pt, msrpNew: v.msrpNew, km: Math.round(v.km), cond: v.cond, acc: v.acc };
  const acv = acvOf(spec);
  const payoff = loanBalance(v.fin);
  const optimism = randf(0.03, 0.17) + (c.style === 'hardball' ? 0.05 : 0) + (c.style === 'easygoing' ? -0.03 : 0);
  return { spec, acv, retail: usedRetail(spec), recon: reconEstimate(spec), payoff, expect: roundTo(acv * (1 + optimism) + 300, 100) };
}

/* ---------- Customer–vehicle fit (0..1) ---------- */
function vehicleFit(c, v) {
  const cls = vehCls(v), pt = vehPt(v);
  const clsM = { car: { car: 1, suv: 0.45, '3row': 0.12, truck: 0.1 }, suv: { car: 0.45, suv: 1, '3row': 0.62, truck: 0.25 },
    '3row': { car: 0.1, suv: 0.55, '3row': 1, truck: 0.2 }, truck: { car: 0.08, suv: 0.3, '3row': 0.2, truck: 1 } }[c.wantCls][cls];
  let a;
  if (v.kind === 'new') {
    const m = MODEL[v.modelId], at = m.attrs, tb = v.ti * 0.03;
    a = (c.rel * at.rel + c.perf * Math.min(1, at.perf + tb) + c.eff * at.eff + c.tech * Math.min(1, at.tech + tb)) / Math.max(0.4, c.rel + c.perf + c.eff + c.tech);
  } else {
    const ageY = yearFrac(S.day) - v.year;
    a = clamp(0.62 - ageY * 0.02 + (v.cond - 3) * 0.06 - (v.acc === 'major' ? 0.12 : 0), 0.1, 0.9);
    if (v.make === c.veh?.make) a += c.brandLoy * 0.1;
  }
  let ptM = 0.6;
  if (pt === 'ev') ptM = clamp(0.25 + c.eff * 0.45 + c.tech * 0.4 - (c.age > 62 ? 0.2 : 0) - (c.annualKm > 35000 ? 0.15 : 0), 0, 1);
  else if (pt === 'hybrid') ptM = clamp(0.4 + c.eff * 0.6, 0, 1);
  else ptM = clamp(0.75 - c.eff * 0.25, 0, 1);
  const price = v.kind === 'new' ? newMarketValue(v) - incentiveFor(v) : (v.ask || usedRetail(v));
  const estPmt = amort(price * 1.13 - Math.min(c.cashAvail, price * 0.1), 7.5 + creditTier(c.credit).spread, 72);
  const ratio = estPmt / Math.max(200, c.budget * 1.12);
  const priceFit = ratio <= 1 ? 1 : clamp(1 - (ratio - 1) * 1.6, 0, 1);
  let fit = 0.42 * clsM + 0.22 * a + 0.14 * ptM + 0.22 * priceFit;
  if (c.wantNew === 'used' && v.kind === 'new') fit -= 0.08;
  if (c.wantNew === 'new' && v.kind === 'used') fit -= 0.12;
  if (v.kind === 'new' && v.discount > 0) fit += Math.min(0.05, v.discount / v.msrp);
  return clamp(fit, 0, 1);
}

function rankVehicles(visit, limit = 40) {
  const c = cust(visit.cid);
  const list = [...availableNew(), ...availableUsed()].map(v => ({ v, fit: vehicleFit(c, v) }));
  list.sort((a, b) => b.fit - a.fit);
  return list.slice(0, limit);
}

/* ---------- Deal structure & evaluation ---------- */
function startPrice(v) { return v.kind === 'new' ? v.msrp - (v.discount || 0) : v.ask; }
function defaultDeal(visit, v) {
  const c = cust(visit.cid), isNew = v.kind === 'new';
  const tradeAllow = visit.trade ? roundTo(visit.trade.acv * ({ conservative: 0.95, market: 1, aggressive: 1.05 }[S.settings.desk.trade]), 100) : 0;
  let type = 'finance';
  if (c.cashBuyer) type = 'cash'; else if (isNew && c.leasePref && v.kind === 'new') type = 'lease';
  const term = type === 'lease' ? 36 : (isNew ? 72 : 60);
  const br = buyRate(c.credit, term, !isNew);
  return {
    vid: v.id, price: startPrice(v), trade: tradeAllow, down: roundTo(Math.min(c.cashAvail, startPrice(v) * 0.1), 250),
    type, term, rate: round2(br + (type === 'cash' ? 0 : S.settings.desk.markup)), acc: [], prod: [],
  };
}

function evalDeal(visit, d) {
  const c = cust(visit.cid), v = vehById(d.vid);
  if (!v) return null;
  const isNew = v.kind === 'new';
  const market = isNew ? newMarketValue(v) : usedRetail(v);
  const inc = incentiveFor(v);
  const accT = sum(d.acc, id => ACCESSORY[id].price), accC = sum(d.acc, id => ACCESSORY[id].cost);
  const prodT = sum(d.prod, id => PRODUCT[id].price), prodC = sum(d.prod, id => PRODUCT[id].cost);
  const tr = visit.trade, payoff = tr ? tr.payoff : 0, acv = tr ? tr.acv : 0, allow = tr ? d.trade : 0;
  const taxable = Math.max(0, d.price - inc + DOC_FEE + accT - allow);
  const tax = taxable * TAX;
  const totalDue = d.price - inc + DOC_FEE + accT + tax + prodT - allow + payoff;
  const br = d.type === 'cash' ? 0 : (d.type === 'lease' ? round2(buyRate(c.credit, d.term, false) - 0.6) : buyRate(c.credit, d.term, !isNew));
  const markup = d.type === 'cash' ? 0 : clamp(d.rate - br, 0, 2.5);
  let pmt = 0, af = 0, reserve = 0, residual = 0;
  if (d.type === 'finance') {
    af = Math.max(0, totalDue - d.down); pmt = amort(af, d.rate, d.term);
    reserve = af * markup / 100 * (d.term / 12) * 0.3;
  } else if (d.type === 'lease') {
    residual = Math.round(v.msrp * residualPct(v, d.term));
    const cap = d.price - inc + DOC_FEE + accT + prodT - allow + payoff - d.down;
    const mf = d.rate / 2400;
    pmt = Math.max(0, (cap - residual) / d.term + (cap + residual) * mf) * (1 + TAX);
    af = cap; reserve = (cap + residual) * (markup / 2400) * d.term * 0.7;
  }
  const cashNeeded = d.type === 'cash' ? totalDue : d.down;
  const prep = isNew ? PREP_COST : 150;
  const front = isNew
    ? d.price - v.invoice + v.msrp * HOLDBACK + DOC_FEE - prep - (allow - acv)
    : d.price - (v.cost + v.reconCost) + DOC_FEE - prep - (allow - acv);
  const accG = accT - accC, back = reserve + prodT - prodC;
  const approved = lenderApproves(c, pmt, af, market, d.type) && !(d.type === 'lease' && !isNew);

  // ----- customer psychology -----
  const st = NEG_STYLES[c.style];
  const fit = vehicleFit(c, v);
  const fair = market * (1 + st.fairAdj + visit.fairNoise);
  let U = -1.15 + st.base + 2.0 * (visit.serious - 0.55) + 2.6 * (fit - 0.6) + 0.9 * c.dealerLoy + (isNew ? 0.3 * c.brandLoy : 0);
  const gap = (d.price - fair) / fair;
  U -= clamp(gap * 24 * (0.4 + c.priceSens), -0.7, 5);
  const target = visit.targetPmt;
  if (d.type !== 'cash') {
    const pw = c.style === 'payment' ? 1.7 : 0.85;
    if (pmt > target) U -= Math.min(4.5, (pmt - target) / target * 6 * pw);
    else U += Math.min(0.3, (target - pmt) / target * 1.2 * pw);
  }
  const cashCap = c.cashAvail * (c.cashBuyer ? 14 : 1.15);
  if (cashNeeded > cashCap) U -= Math.min(3.5, (cashNeeded - cashCap) / Math.max(2500, cashCap) * 1.4 + 0.5);
  if (tr) U += clamp((d.trade - tr.expect) / Math.max(4000, tr.expect) * 2.6, -1.5, 0.35);
  if (d.type !== 'cash' && c.credit >= 700 && (c.style === 'researcher' || c.style === 'hardball')) U -= Math.max(0, markup - 0.75) * 0.35;
  for (const id of d.prod) { const p = PRODUCT[id]; U += p.pref === 'rel' ? (c.rel - 0.55) * 0.35 : -0.05; }
  U += d.acc.length * 0.03;
  if (d.type === 'lease' && !c.leasePref) U -= 0.25;
  if (d.type === 'lease' && c.annualKm > 24000) U -= 0.35;
  U -= 0.22 * visit.rounds;
  U += (visit.mood - 60) / 50 * 0.45 + (visit.boost || 0);
  if (!approved) U -= 6;
  const prob = sigmoid(U);

  // ----- satisfaction impact -----
  let csi = clamp((fair - d.price) / fair * 260, -9, 6);
  if (d.type !== 'cash') csi += pmt <= target ? 2 : -clamp((pmt - target) / target * 40, 0, 9);
  if (tr) csi += clamp((d.trade - tr.expect) / Math.max(4000, tr.expect) * 30, -5, 3);
  if (d.prod.length >= 3 && c.rel < 0.6) csi -= 2.5;
  if (markup > 1.75) csi -= 2;
  csi += (fit - 0.6) * 8;

  return {
    v, isNew, market, inc, accT, accC, prodT, prodC, tax, payoff, acv, allow, totalDue, br, markup, pmt, af, reserve, residual, cashNeeded,
    front, accG, back, total: front + accG + back, approved, fit, fair, gap, prob, U, csi, target,
  };
}
function sentiment(prob) {
  if (prob >= 0.74) return { k: 'vi', label: 'Very interested', tone: 'good', lvl: 5 };
  if (prob >= 0.54) return { k: 'in', label: 'Interested', tone: 'good', lvl: 4 };
  if (prob >= 0.34) return { k: 'un', label: 'Uncertain', tone: 'warn', lvl: 3 };
  if (prob >= 0.16) return { k: 'fr', label: 'Frustrated', tone: 'bad', lvl: 2 };
  return { k: 'rw', label: 'Ready to walk', tone: 'bad', lvl: 1 };
}
function csiLabel(x) {
  if (x >= 5) return { label: 'Delighted', tone: 'good' }; if (x >= 1.5) return { label: 'Positive', tone: 'good' };
  if (x >= -2) return { label: 'Neutral', tone: 'neutral' }; if (x >= -6) return { label: 'Negative', tone: 'warn' };
  return { label: 'Damaging', tone: 'bad' };
}

/* ---------- Customer response to an offer ---------- */
function presentOffer(visit, d) {
  const c = cust(visit.cid);
  const r = evalDeal(visit, d);
  visit.rounds++;
  if (!r.approved) {
    visit.mood -= 5; visit.patience--;
    return say(visit, 'declined', d.type === 'lease' && r.v.kind === 'used' ? 'Used vehicles cannot be leased. Structure it as a finance deal.'
      : `The lender won't approve this structure at ${c.credit} credit. Try more down, a cheaper vehicle or a longer term.`, 'system');
  }
  if (rand() < r.prob) return { res: 'accept', r };
  visit.patience--;
  visit.mood = clamp(visit.mood - (r.prob < 0.3 ? 12 : 6), 0, 100);
  if (visit.patience <= 0 || r.prob < 0.05 || visit.mood < 18) {
    const toComp = chance(r.prob < 0.12 ? 0.55 : 0.3);
    return { res: toComp ? 'competitor' : 'leave', r, text: toComp ? pick(LINES.competitor) : pick(LINES.leave) };
  }
  if (r.fit < 0.42) {
    const alt = rankVehicles(visit, 6).find(x => x.v.id !== d.vid && x.fit > r.fit + 0.08);
    if (alt) return { res: 'another', r, alt: alt.v, text: `Honestly, this isn't really what I'm after. Do you have something like the ${vehName(alt.v, true)}?` };
  }
  const counter = buildCounter(visit, d, r);
  if (counter) { visit.counter = counter; return { res: 'counter', r, counter, text: counter.text }; }
  return { res: 'stall', r, text: r.pmt > r.target ? `I really can't go over about ${money(r.target)} a month.` : pick(LINES.stall) };
}
const LINES = {
  leave: ['I need to think about it. I might come back later this week.', "Let me talk it over at home. I'll be in touch.", "This isn't working for me today. Thanks for your time."],
  competitor: ['Northgate quoted me better. I think I\'ll go there.', "I'm going to see what Bayview can do instead.", "We're done here. I'll buy elsewhere."],
  stall: ["We're still too far apart.", 'That doesn\'t move me much.', 'I was hoping for something better than that.'],
  accept: ["Okay, let's do it.", 'You have a deal.', 'That works. Where do I sign?', 'Alright — we\'ll take it.'],
};
function buildCounter(visit, d, r) {
  const c = cust(visit.cid);
  const tryDeal = (patch) => { const nd = { ...d, ...patch }; return { nd, e: evalDeal({ ...visit, rounds: visit.rounds - 1 }, nd) }; };
  let nd = { ...d };
  // trade gap first
  if (visit.trade && d.trade < visit.trade.expect * 0.94) nd.trade = roundTo((d.trade + visit.trade.expect) / 2, 100);
  // find a price they would sign at
  const floor = r.market * 0.9;
  let lo = floor, hi = d.price, found = null;
  if (tryDeal({ ...nd, price: hi }).e.prob >= 0.7) found = hi;
  else if (tryDeal({ ...nd, price: lo }).e.prob >= 0.7) {
    for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (tryDeal({ ...nd, price: mid }).e.prob >= 0.7) lo = mid; else hi = mid; }
    found = roundTo(lo, 50);
  }
  if (found == null) {
    // price alone can't fix it: likely payment
    const longer = d.type === 'finance' && d.term < 84 ? { ...nd, term: d.term + 12, price: roundTo(d.price * 0.985, 50) } : null;
    if (longer && tryDeal(longer).e.prob >= 0.6) {
      const e = tryDeal(longer).e;
      return { deal: longer, text: `Stretch it to ${longer.term} months and get me to about ${money(e.pmt)} a month, and I'm in.`, kind: 'term' };
    }
    return null;
  }
  nd.price = found;
  const e = tryDeal(nd).e;
  let text;
  if (c.style === 'payment' && d.type !== 'cash') text = `If you can get me to ${money(e.pmt)} a month, we have a deal.`;
  else if (nd.trade !== d.trade && found >= d.price - 50) text = `Give me ${money(nd.trade)} for my trade and I'll sign today.`;
  else if (nd.trade !== d.trade) text = `${money(nd.trade)} for my trade and ${money(found)} on the vehicle. That's my number.`;
  else text = c.style === 'hardball' ? `${money(found)}. Not a dollar more.` : `Take it to ${money(found)} and I'll sign.`;
  return { deal: nd, text, kind: 'price' };
}
function say(visit, res, text, who = 'customer') { visit.log.push({ who, text }); return { res, text }; }

/* ---------- Showroom traffic ---------- */
const ARRIVAL_TIMES = ['9:05', '9:40', '10:15', '10:50', '11:30', '12:10', '12:45', '13:20', '13:55', '14:30', '15:05', '15:40', '16:15', '16:50', '17:25', '18:00', '18:35', '19:10'];
function createVisit(c, source, opt = {}) {
  const v = {
    id: nextId('W'), cid: c.id, day: S.day, source, time: pick(ARRIVAL_TIMES),
    serious: clamp(gauss(source === 'internet' ? 0.56 : 0.64, 0.2) + (opt.serious || 0), 0.08, 1),
    targetPmt: roundTo(c.budget * randf(0.92, 1.06), 10), trade: null, fairNoise: gauss(0, 0.008), rounds: 0,
    mood: Math.round(clamp(gauss(66, 8), 35, 92)), patience: randi(3, 5) + (c.style === 'easygoing' ? 1 : 0), boost: 0,
    td: false, to: false, appraised: false, state: 'waiting', log: [], counter: null, vip: !!opt.vip, note: opt.note || '',
  };
  if (c.veh && chance(0.82)) v.trade = buildTrade(c);
  if (c.veh && c.veh.fromUs) v.serious = clamp(v.serious + 0.08 + c.dealerLoy * 0.1, 0, 1);
  S.showroom.push(v);
  c.lastVisit = S.day;
  S.fin.mtd.ups++;
  return v;
}
function genTraffic() {
  const p = dparts(S.day);
  if (p.dow === 0) return;
  const dowF = [0, 0.85, 0.9, 0.95, 1.0, 1.1, 1.6][p.dow];
  const seasonF = [0.72, 0.82, 1.08, 1.12, 1.12, 1.06, 1.0, 1.02, 1.0, 1.0, 0.9, 0.82][p.m];
  const econ = 0.6 + S.mkt.conf / 160;
  const rateF = clamp(1 - (S.mkt.prime - 4.75) * 0.05, 0.75, 1.15);
  const adF = clamp(0.55 + 0.45 * Math.sqrt(S.settings.ad / 42000), 0.55, 1.5);
  const repF = 0.86 + (kpiSalesCsi() - 80) / 100;
  const invF = clamp(0.5 + (availableNew().length + availableUsed().length) / 110, 0.55, 1.08);
  const n = poisson(6.6 * dowF * seasonF * econ * rateF * adF * repF * invF * (1 - compPressure()) * (hasExp('bigstore') ? 1.12 : 1) * (mods().traffic || 1));
  for (let i = 0; i < n; i++) {
    const c = addCustomer(genCustomer('conquest'));
    if (hasExp('superstore') && chance(0.25)) c.wantNew = 'used';
    createVisit(c, pickW(['walk-in', 'internet', 'phone'], [50, 38, 12]));
  }
  S.showroom.sort((a, b) => a.time.localeCompare(b.time, undefined, { numeric: true }));
}

const AUTO_CLOSE = [0.26, 0.17, 0.12]; // chance a pencil converts, scaled by the customer's willingness
/* Unhandled visitors at the end of the day are worked by the sales team */
function resolveShowroom() {
  const waiting = S.showroom.filter(v => v.state === 'waiting' || v.state === 'negotiating');
  const team = present('sales').map(e => ({ e, cap: (e.skill > 72 ? 5 : 4) - (e.today || 0) }));
  const gsm = present('gsm')[0]; if (gsm) team.push({ e: gsm, cap: 2 - (gsm.today || 0) });
  for (const visit of waiting) {
    team.sort((a, b) => b.cap - a.cap || b.e.skill - a.e.skill);
    const slot = team.find(t => t.cap > 0);
    if (!slot) { unattended(visit); continue; }
    slot.cap--; slot.e.today = (slot.e.today || 0) + 1; slot.e.mtd.ups++;
    autoWork(visit, slot.e);
  }
  S.showroom = [];
  S.emps.forEach(e => { e.today = 0; });
}
function unattended(visit) {
  const c = cust(visit.cid);
  c.sat = clamp(c.sat - 6, 0, 100); c.dealerLoy = clamp(c.dealerLoy - 0.03, 0, 1);
  S.fin.mtd.unattended++; S.fin.mtd.lost++;
  addHist(c, 'visit', 'Left the showroom without being helped', null);
  leadAfterLoss(c, visit, 0.5);
}
function autoWork(visit, e) {
  const c = cust(visit.cid);
  if (visit.serious < 0.22 && chance(0.7)) { lostVisit(visit, 'Just looking today', e); return; }
  const cands = rankVehicles(visit, 4).filter((x, i) => x.fit > (i ? 0.55 : 0.3)).slice(0, 2);
  if (!cands.length) { lostVisit(visit, 'No suitable vehicle in stock', e); return; }
  const desk = S.settings.desk;
  visit.boost = (visit.boost || 0) + (e.skill - 50) / 50 * 0.55 + gsmBonus(e) + (e.morale - 60) / 100 * 0.3 + (e.csi - 78) / 100 * 0.25 + (visit.td ? 0 : 0.2);
  for (const { v } of cands) {
    const d = defaultDeal(visit, v);
    const mv = v.kind === 'new' ? newMarketValue(v) : v.ask;
    const plan = v.kind === 'new'
      ? { hold: [startPrice(v), mv + v.msrp * 0.01, mv], market: [mv + v.msrp * 0.005, mv - v.msrp * 0.007, mv - v.msrp * 0.015], aggressive: [mv - v.msrp * 0.01, mv - v.msrp * 0.022, mv - v.msrp * 0.035] }[desk.stance]
      : { hold: [v.ask, v.ask * 0.99, v.ask * 0.98], market: [v.ask, v.ask * 0.975, v.ask * 0.96], aggressive: [v.ask * 0.98, v.ask * 0.96, v.ask * 0.94] }[desk.stance];
    for (let round = 0; round < 3; round++) {
      d.price = roundTo(Math.min(plan[round], startPrice(v)), 50);
      if (round === 2 && visit.trade) d.trade = roundTo(d.trade * 1.02, 100);
      if (d.type === 'finance') {
        for (const t of [60, 72, 84]) { const tt = { ...d, term: t, rate: round2(buyRate(c.credit, t, v.kind === 'used') + desk.markup) }; if (evalDeal(visit, tt).pmt <= visit.targetPmt || t === 84) { d.term = tt.term; d.rate = tt.rate; break; } }
      }
      const r = evalDeal(visit, d);
      if (!r.approved && d.type === 'finance') { d.down = roundTo(Math.min(c.cashAvail, d.down + 2000), 250); continue; }
      if (r.approved && rand() < r.prob * AUTO_CLOSE[round]) {
        fiMenu(visit, d, e);
        finalizeSale(visit, d, e.id, 'auto');
        return;
      }
      visit.rounds++;
    }
  }
  lostVisit(visit, 'Could not agree on numbers', e);
}
function gsmBonus(e) { const g = present('gsm')[0]; return g && g !== e ? (g.skill - 50) / 50 * 0.25 + 0.08 : (e.role === 'gsm' ? 0.1 : -0.05); }
function lostVisit(visit, reason, e) {
  const c = cust(visit.cid);
  S.fin.mtd.lost++;
  addHist(c, 'visit', `Showroom visit — ${reason.toLowerCase()}${e ? ' (' + empName(e) + ')' : ''}`, null);
  leadAfterLoss(c, visit, visit.serious);
}
function leadAfterLoss(c, visit, serious) {
  if (serious > 0.3) { c.followUp = S.day + randi(2, 6); c.inMarket = { since: S.day, until: S.day + randi(21, 55), shopping: true }; }
  else if (chance(0.3)) c.followUp = S.day + randi(5, 12);
}

/* F&I office: products added after the customer agrees to the vehicle deal */
function fiMenu(visit, d, seller) {
  const c = cust(visit.cid);
  const fi = present('fi')[0];
  const skill = fi ? fi.skill : (seller ? seller.skill * 0.6 : 30);
  const push = { low: 0.7, medium: 1, high: 1.35 }[S.settings.desk.fiPush];
  const mult = clamp(skill / 60, 0.3, 1.5) * push * (fi ? 1 : 0.5);
  if (d.type === 'cash') return;
  for (const p of PRODUCTS) {
    if (p.program && !S.programs[p.program]) continue;
    let pr = p.base * mult;
    if (p.pref === 'rel') pr *= 0.6 + c.rel;
    if (p.id === 'gap') { const r = evalDeal(visit, d); pr *= r.af / Math.max(1, r.market) > 0.9 ? 1.3 : 0.4; }
    if (chance(clamp(pr, 0, 0.8))) d.prod.push(p.id);
  }
  if (chance(0.22 * push)) d.acc.push(pickW(ACCESSORIES, a => (a.id === 'winter' && [9, 10, 11].includes(dparts(S.day).m)) ? 4 : 1).id);
  visit.fiPush = push;
}

/* ---------- Closing a sale ---------- */
function finalizeSale(visit, d, empId, how) {
  const c = cust(visit.cid), r = evalDeal(visit, d), v = r.v, L = S.fin.mtd;
  const isNew = v.kind === 'new', e = empId ? empById(empId) : null;
  if (isNew) S.inv = S.inv.filter(x => x !== v); else S.used = S.used.filter(x => x !== v);
  if (isNew) {
    const hb = v.msrp * HOLDBACK;
    S.cash += d.price + DOC_FEE - r.allow - v.invoice + hb - PREP_COST;
    book('new', d.price + DOC_FEE, v.invoice - hb + PREP_COST + (r.allow - r.acv));
    expense('floorplan', -Math.round(v.invoice * 0.0125)); // OEM floorplan assistance credit
    L.units.new++; S.oem.mtdNew++;
    if (MODEL[v.modelId].pt !== 'ice') { L.units.ev++; S.oem.mtdEv++; }
    if (d.type === 'lease') L.units.lease++;
  } else {
    S.cash += d.price + DOC_FEE - r.allow - 150;
    book('used', d.price + DOC_FEE, v.cost + v.reconCost + 150 + (r.allow - r.acv));
    L.units.used++;
  }
  S.cash += r.accT - r.accC; book('acc', r.accT, r.accC);
  S.cash += r.prodT - r.prodC + r.reserve; book('fi', r.prodT + r.reserve, r.prodC);
  if (d.type !== 'cash') { L.fiDeals++; L.products += d.prod.length; }
  L.sold++;
  // commissions
  const fi = present('fi')[0];
  let comm = 0;
  if (e && e.role === 'sales') { const x = Math.max(250, r.front * e.comm); comm += x; e.mtd.pay += x; }
  if (e) { e.mtd.units++; e.mtd.gross += r.total; }
  if (fi) { const x = Math.max(0, r.back * fi.comm); comm += x; fi.mtd.pay += x; fi.mtd.gross += r.back; fi.mtd.units++; }
  const gsm = present('gsm')[0]; if (gsm) { const x = Math.max(0, (r.front + r.back) * gsm.comm); comm += x; gsm.mtd.pay += x; }
  expense('payroll', comm);

  // trade-in comes into used inventory at ACV
  let tradeDesc = '';
  if (visit.trade) {
    const u = makeUsedFromSpec(visit.trade.spec, 'trade');
    u.cost = r.acv; u.fromCust = c.id; tradeDesc = `${u.year} ${u.make} ${u.model}`;
    S.used.push(u); planTrade(u);
  }
  // customer record
  const prevVeh = c.veh;
  const modelId = isNew ? v.modelId : (MODELS.find(m => m.name === v.model && v.make === 'Aurex') || {}).id || null;
  c.veh = {
    year: v.year, make: isNew ? 'Aurex' : v.make, model: isNew ? MODEL[v.modelId].name : v.model, cls: vehCls(v), pt: vehPt(v),
    msrpNew: isNew ? v.msrp : v.msrpNew, km: isNew ? randi(8, 40) : v.km, cond: isNew ? 5 : v.cond, acc: isNew ? 'none' : v.acc,
    fromUs: true, purchased: S.day, boughtNew: isNew, modelId, warrantyEnd: null, ptWarrantyEnd: null, ext: d.prod.includes('warranty'),
    ppm: d.prod.includes('ppm') ? 3 : 0, freeOil: isNew && S.programs.freeoil, fin: null, asIs: !isNew && v.recon === 'as-is',
  };
  if (isNew) { c.veh.warrantyEnd = S.day + 1095; c.veh.ptWarrantyEnd = S.day + 1825; }
  else if (v.make === 'Aurex' && yearFrac(S.day) - v.year < 4.5) { c.veh.ptWarrantyEnd = S.day + Math.round((5 - (yearFrac(S.day) - v.year)) * 365); }
  if (d.type === 'finance') c.veh.fin = { type: 'finance', amt: Math.round(r.af), apr: d.rate, term: d.term, start: S.day, pmt: Math.round(r.pmt) };
  else if (d.type === 'lease') c.veh.fin = { type: 'lease', term: d.term, start: S.day, pmt: Math.round(r.pmt), residual: r.residual, apr: d.rate };
  else c.veh.fin = { type: 'cash' };
  const wasOwner = prevVeh && prevVeh.fromUs;
  if (wasOwner || c.status === 'owner') L.repeat++; else L.conquest++;
  c.status = 'owner';
  c.svc.defected = false; c.svc.missed = 0; c.svc.pending = null; c.svc.dueDay = S.day + randi(170, 190); c.svc.dueKm = c.veh.km + 8000;
  c.inMarket = null; c.followUp = null; c.recall = false;

  // satisfaction survey
  const detailers = present('detail').length;
  S.flags.deliveriesToday = (S.flags.deliveriesToday || 0) + 1;
  const delivery = S.flags.deliveriesToday > Math.max(1, detailers) * 5 ? -6 : detailers ? 1 : -4;
  const push = visit.fiPush === 1.35 ? -3 : visit.fiPush === 0.7 ? 1 : 0;
  const asIsHit = c.veh.asIs && v.cond <= 2 ? -8 : 0;
  const csi = Math.round(clamp(84 + r.csi + (e ? (e.csi - 78) * 0.35 : 3) + delivery + push + asIsHit + gauss(0, 4.5), 25, 100));
  L.csiSales.push(csi);
  c.sat = Math.round(c.sat * 0.4 + csi * 0.6);
  c.dealerLoy = round2(clamp(c.dealerLoy + 0.08 + (csi - 80) / 220, 0, 1));
  if (isNew) c.brandLoy = round2(clamp(c.brandLoy + 0.05, 0, 1));
  c.ltv += Math.round(r.total);
  addHist(c, 'purchase', `Bought ${isNew ? 'new' : 'used'} ${vehName(v)}${tradeDesc ? ', traded ' + tradeDesc : ''}`, r.total);
  if (S.programs.loyalty) c.dealerLoy = round2(clamp(c.dealerLoy + 0.03, 0, 1));

  const deal = {
    day: S.day, cid: c.id, name: fullName(c), veh: vehName(v), stock: v.stock, kind: v.kind, mid: isNew ? v.modelId : null, price: d.price, front: Math.round(r.front), back: Math.round(r.back),
    acc: Math.round(r.accG), total: Math.round(r.total), type: d.type, pmt: Math.round(r.pmt), term: d.term, by: how === 'manual' ? 'You' : (e ? empName(e) : 'Team'),
    csi, trade: tradeDesc, products: d.prod.length, days: daysIn(v), repeat: !!wasOwner,
  };
  S.deals.unshift(deal); if (S.deals.length > 300) S.deals.length = 300;
  if (how === 'manual' || r.total > 6000) logEvent(r.total > 0 ? 'good' : 'bad', 'sales', `${deal.by === 'You' ? 'You' : deal.by} sold a ${vehName(v, true)} to ${fullName(c)} — ${money(r.total)} total gross.`);
  visit.state = 'sold';
  return { deal, r, csi };
}

/* ---------- Trade-in & used vehicle disposition ---------- */
function planTrade(u) {
  const plan = S.settings.usedPlan;
  if (plan === 'ask') { u.status = 'appraisal'; u.decideBy = S.day + 3; return; }
  if (plan === 'recon') { if (u.cond <= 1 || yearFrac(S.day) - u.year > 11) wholesaleUnit(u); else sendToRecon(u); }
  else if (plan === 'wholesale') wholesaleUnit(u);
}
const SURPRISES = ['worn timing chain', 'leaking rear main seal', 'cracked windshield', 'transmission shudder', 'seized brake calipers', 'failed A/C compressor',
  'hidden frame repair', 'worn suspension bushings', 'water damage under carpet', 'check-engine fault: catalytic converter'];
function sendToRecon(u) {
  const est = reconEstimate(u);
  u.status = 'recon'; u.recon = 'queued';
  u.reconPlanned = roundTo(est * randf(0.85, 1.18), 10);
  u.surprise = chance(0.27) ? { cost: roundTo(randf(600, 3400), 10), desc: pick(SURPRISES), asked: false } : null;
  const hrs = round2(clamp(u.reconPlanned * 0.5 / INTERNAL_RATE, 1.5, 14));
  createRO({ cid: null, uid: u.id, job: 'recon', hrs, pay: 'internal', desc: `Recon — ${u.year} ${u.make} ${u.model}`, km: u.km });
}
function retailAsIs(u) {
  u.status = 'available'; u.recon = 'as-is'; u.reconCost += 180; S.cash -= 180;
  u.ask = roundTo(usedRetail(u) * 1.02, 100) - 5;
}
function wholesaleUnit(u, reason = 'wholesale') {
  const proceeds = roundTo(acvOf(u) * randf(0.95, 1.02), 50);
  S.cash += proceeds; book('wholesale', proceeds, u.cost + u.reconCost); S.fin.mtd.units.wholesale++;
  S.used = S.used.filter(x => x !== u);
  S.svc.ros = S.svc.ros.filter(ro => ro.uid !== u.id);
  logEvent(proceeds - u.cost - u.reconCost >= 0 ? 'info' : 'warn', 'used', `Wholesaled ${u.stock} ${u.year} ${u.make} ${u.model} for ${money(proceeds)} (${signed(Math.round(proceeds - u.cost - u.reconCost))}).`);
  return proceeds;
}
function auctionUnit(u) { u.status = 'auction'; u.auctionDay = S.day + randi(5, 9); S.svc.ros = S.svc.ros.filter(ro => ro.uid !== u.id); }
function settleAuctions() {
  for (const u of S.used.filter(x => x.status === 'auction' && x.auctionDay <= S.day)) {
    const gross = (u.recon === 'done' ? usedRetail(u) * 0.9 : acvOf(u) + 250) * randf(0.9, 1.08);
    const proceeds = Math.max(300, roundTo(gross - 450, 50));
    S.cash += proceeds; book('wholesale', proceeds, u.cost + u.reconCost); S.fin.mtd.units.wholesale++;
    S.used = S.used.filter(x => x !== u);
    logEvent('info', 'used', `Auction sold ${u.stock} ${u.year} ${u.make} ${u.model} for ${money(proceeds)} after fees (${signed(Math.round(proceeds - u.cost - u.reconCost))}).`);
  }
  // overdue appraisal decisions get the default plan
  for (const u of S.used.filter(x => x.status === 'appraisal' && x.decideBy <= S.day)) {
    if (u.cond >= 3 && yearFrac(S.day) - u.year < 10) sendToRecon(u); else wholesaleUnit(u);
    logEvent('warn', 'used', `No decision on trade ${u.stock} after 3 days — the used manager ${u.status === 'recon' ? 'sent it to recon' : 'wholesaled it'}.`);
  }
}
function usedProjected(u) { return (u.ask || usedRetail(u)) + DOC_FEE - u.cost - u.reconCost - (u.recon === 'done' || u.recon === 'as-is' ? 0 : (u.reconPlanned || reconEstimate(u))) - 150; }

/* Weekly auction run */
function genAuction() {
  S.auction = [];
  for (let i = 0; i < 12; i++) {
    const spec = randomUsedSpec({ aurexShare: 0.35, maxAge: 8 });
    const retail = usedRetail(spec);
    const hammer = roundTo(acvOf(spec) * randf(0.95, 1.1), 50);
    S.auction.push({ id: nextId('L'), ...spec, retail, price: hammer, fee: 395 + (hasExp('superstore') ? -150 : 0) });
  }
  S.auctionDay = S.day;
}
function buyAuction(lotId) {
  const lot = S.auction.find(a => a.id === lotId); if (!lot) return;
  const cap = lotCapacity().used;
  if (S.used.length >= cap) return toast('Used lot is full. Sell or wholesale units first.', 'bad');
  const u = makeUsedFromSpec({ year: lot.year, make: lot.make, model: lot.model, cls: lot.cls, pt: lot.pt, msrpNew: lot.msrpNew, km: lot.km, cond: lot.cond, acc: lot.acc }, 'auction');
  u.cost = lot.price + lot.fee + 250; // + transport
  S.cash -= u.cost; S.fin.mtd.cf.usedBuy += u.cost;
  u.status = 'inbound'; u.arriveDay = S.day + 2;
  S.used.push(u);
  S.auction = S.auction.filter(a => a !== lot);
  logEvent('info', 'used', `Bought ${lot.year} ${lot.make} ${lot.model} at auction for ${money(u.cost)} incl. fees and transport.`);
}
function usedArrivals() {
  for (const u of S.used.filter(x => x.status === 'inbound' && x.arriveDay <= S.day)) { u.acquired = S.day; u.status = 'appraisal'; u.decideBy = S.day + 3; }
}

/* ---------- New vehicle ordering & arrivals ---------- */
function allocationLeft() { return Math.max(0, S.oem.alloc - S.oem.ordered); }
function orderVehicles(modelId, ti, color, qty) {
  const m = MODEL[modelId];
  if (m.exclusive) { if (S.oem.exclusiveAlloc < qty) return toast('No exclusive allocation available for the Volta GT this month.', 'bad'); }
  else if (allocationLeft() < qty) return toast(`Only ${allocationLeft()} units of allocation left this month.`, 'bad');
  const onLot = S.inv.length;
  if (onLot + qty > lotCapacity().new) return toast('Not enough lot space for that order.', 'bad');
  for (let i = 0; i < qty; i++) {
    const eta = S.day + Math.round(randi(7, 17) * (mods().transit || 1));
    S.inv.push(makeNewVehicle(modelId, { trim: ti, color: color === 'any' ? null : color, transit: true, eta, arrived: eta }));
  }
  if (m.exclusive) S.oem.exclusiveAlloc -= qty; else S.oem.ordered += qty;
  logEvent('info', 'oem', `Ordered ${qty} × ${m.name} ${m.trims[ti].n} from Aurex.`);
  return true;
}
function vehicleArrivals() {
  const arr = S.inv.filter(v => v.status === 'transit' && v.eta <= S.day);
  arr.forEach(v => { v.status = 'available'; v.arrived = S.day; });
  if (arr.length) logEvent('info', 'inventory', `${plural(arr.length, 'new vehicle')} delivered from Aurex and checked in.`);
}
function dailyFloorplan() {
  const rate = floorplanRate() / 365; let tot = 0;
  for (const v of S.inv) if (v.status !== 'transit') { const x = v.invoice * rate * (daysIn(v) > 180 ? 1.25 : 1); v.fpAccrued += x; tot += x; }
  expense('floorplan', tot);
}
function wholesaleNew(v) {
  const proceeds = roundTo(v.invoice * randf(0.955, 0.985), 50);
  S.cash += proceeds - v.invoice;
  book('wholesale', proceeds, v.invoice); S.fin.mtd.units.wholesale++;
  S.inv = S.inv.filter(x => x !== v);
  logEvent('warn', 'inventory', `Dealer-traded aged unit ${v.stock} ${vehName(v, true)} to Northgate Aurex for ${money(proceeds)} (${signed(proceeds - v.invoice)}).`);
}
