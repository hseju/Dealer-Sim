'use strict';
/* =====================================================================
   Dealer Empire — customer lifecycle, retention, employees
   ===================================================================== */

/* ---------- Service retention decision ---------- */
function quickLubePrice() { const q = S.comps.find(c => c.id === 'speedlane'); return (q ? q.oil : 74) * (mods().indyRate || 1); }
function effectiveRate(c) { return S.settings.laborRate * (S.programs.preferred && c.veh && c.veh.fromUs ? 0.9 : 1); }
function programTerms(c, job) {
  const t = {}, v = c.veh;
  if (S.programs.reminders) t.reminders = 0.32;
  if (S.programs.loyalty) t.loyalty = v.fromUs ? 0.32 : 0.18;
  if (S.programs.pickup) t.pickup = 0.34;
  if (S.programs.exthours) t.exthours = 0.16;
  if (S.programs.mobile && (job === 'oil' || job === 'tires')) t.mobile = 0.5;
  if (S.programs.preferred && v.fromUs) t.preferred = (S.settings.laborRate * 0.1) / indyRate() * 2.2 * (0.5 + c.priceSens) + 0.08;
  if (S.programs.freeoil && v.freeOil && job === 'oil') t.freeoil = 1.4;
  if (S.programs.ppm && v.ppm > 0 && (job === 'oil' || job === 'maint')) t.ppm = 2.2;
  return t;
}
function serviceLogit(c, job) {
  const v = c.veh;
  let x = 0.0 + c.dealerLoy * 1.6 + (c.sat - 75) / 25 * 0.6;
  if (job === 'warranty' || job === 'recall') x += 3.4;
  if (v.warrantyEnd && S.day < v.warrantyEnd) x += 0.55;
  if (v.ext) x += 0.35;
  if (v.fromUs) x += 0.3;
  if (c.svc.defected) x -= 1.3;
  const gap = (S.settings.laborRate - indyRate()) / indyRate();
  if (job !== 'warranty' && job !== 'recall') x -= gap * 2.2 * (0.5 + c.priceSens);
  if (job === 'oil') x -= (S.settings.oilPrice - quickLubePrice()) / quickLubePrice() * 1.4;
  const age = yearFrac(S.day) - v.year; x -= Math.max(0, age - 3) * 0.12;
  x -= Math.max(0, (S.kpiCache.lead || 1) - 2) * 0.09;
  const adv = present('advisor');
  x += adv.length ? (avg(adv, e => e.csi) - 78) / 20 * 0.3 : -1;
  x -= mods().indyPull || 0;
  return x;
}
/* returns probability with programs and the share attributable to each program */
function serviceChoice(c, job) {
  const base = serviceLogit(c, job), terms = programTerms(c, job);
  const all = base + sum(Object.values(terms));
  const p = sigmoid(all), shares = {};
  for (const [k, t] of Object.entries(terms)) shares[k] = Math.max(0, (p - sigmoid(all - t)) / p);
  return { p, shares };
}
function decideService(c, job, bonus = 0, opt = {}) {
  const { p, shares } = serviceChoice(c, job);
  const pp = sigmoid(Math.log(p / (1 - p)) + bonus);
  if (chance(pp)) {
    S.flags.progAttrib = S.flags.progAttrib || {};
    if (Object.keys(shares).length) { S.flags.progAttrib[c.id] = shares; for (const [k, s] of Object.entries(shares)) S.progStats[k].visits += s; }
    let parts = null, hrs = null, note = '';
    if (job === 'warranty' || job === 'diag') { const pn = pick(REPAIR_PARTS); parts = [[pn, 1]]; note = job === 'warranty' ? `Warranty: ${partByPn(pn).desc.toLowerCase()}` : `Diagnose & replace ${partByPn(pn).desc.toLowerCase()}`; }
    if (job === 'major') {
      const pn = c.veh.pt === 'ev' ? 'AX-EVP11' : c.veh.pt === 'hybrid' && chance(0.5) ? 'AX-HBM04' : pick(MAJOR_PARTS);
      parts = [[pn, 1]]; note = `Major repair: ${partByPn(pn).desc.toLowerCase()}`; hrs = round2(randf(4.5, 8.5));
      if (c.veh.ptWarrantyEnd && S.day < c.veh.ptWarrantyEnd) opt.pay = 'warranty';
    }
    if (job === 'maint' && c.veh.km > 90000) { hrs = 2.8; parts = [...JOBS.maint.parts, ['AX-12290', 4]]; note = 'Scheduled maintenance, 96,000 km service'; }
    if (job === 'tires' && c.winter && !c.hasWinterSet && chance(0.12)) { parts = [['AX-TIRWN', 1]]; hrs = 1.0; note = 'Winter tire & wheel package installed'; c.hasWinterSet = true; }
    bookAppointment(c, job, { parts, hrs, note, pay: opt.pay, asap: opt.asap });
    c.svc.pending = null;
    return true;
  }
  c.svc.pending = null;
  if (job === 'oil' || job === 'maint' || job === 'tires') {
    c.svc.missed++; c.dealerLoy = round2(clamp(c.dealerLoy - 0.04, 0, 1));
    if (c.svc.missed >= 2 && !c.svc.defected) c.svc.defected = true;
  }
  return false;
}

/* ---------- Customer daily lifecycle ---------- */
function dailyCustomers() {
  const p = dparts(S.day);
  const springTires = (p.m === 3) || (p.m === 4 && p.dom <= 15);
  const fallTires = (p.m === 9 && p.dom >= 12) || p.m === 10;
  const season = springTires ? p.y + 'S' : fallTires ? p.y + 'F' : '';
  const econ = 0.6 + S.mkt.conf / 160;
  const fuCap = { left: present('bdc').length * 30 * (hasExp('bdc') ? 2 : 1) + present('sales').length * 3 };
  const overdueCalls = { left: present('bdc').length * 12 * (hasExp('bdc') ? 2 : 1) };
  const weekly = S.day % 7;
  for (const c of S.customers) {
    const v = c.veh;
    if (!v) { followUps(c, fuCap); continue; }
    v.km = Math.round(v.km + c.annualKm / 365);
    if (weekly === (c.id.charCodeAt(c.id.length - 1) % 7)) { c.eq = Math.round(acvOf(v) - loanBalance(v.fin)); if (p.dom < 8 && chance(0.02)) v.cond = Math.max(1, v.cond - 1); }

    if (serviceEligible(c) && c.status !== 'lost') {
      const s = c.svc;
      // maintenance coming due
      if (!s.pending && !s.appt && (v.km >= s.dueKm || S.day >= s.dueDay)) {
        const job = s.visits % 2 === 1 || v.km > 40000 && chance(0.4) ? 'maint' : 'oil';
        s.pending = { job, since: S.day, decide: S.day + (S.programs.reminders ? randi(0, 7) : randi(2, 24)) };
        s.dueDay = S.day + 182; s.dueKm = v.km + 8000;
      }
      if (s.pending && S.day >= s.pending.decide && !s.appt) decideService(c, s.pending.job);
      else if (s.pending && !s.appt && S.day - s.pending.since > 7 && overdueCalls.left > 0 && chance(0.25)) { overdueCalls.left--; decideService(c, s.pending.job, 0.5); }
      // breakdowns and repairs
      if (!s.appt && p.dow !== 0) {
        const age = Math.max(0, yearFrac(S.day) - v.year);
        const rel = v.modelId ? MODEL[v.modelId].attrs.rel : 0.78;
        if (chance(0.0008 * (1 + age / 3) * (1.75 - rel) * (v.km > 150000 ? 1.4 : 1))) {
          const warranty = v.warrantyEnd && S.day < v.warrantyEnd;
          const job = warranty ? 'warranty' : pickW(['brakes', 'diag', 'tirenew', 'major'], [4, 4, 2, 0.6 + age * 0.15]);
          decideService(c, job, 0, { asap: true });
        }
        if (c.recall && chance(S.programs.reminders ? 0.05 : 0.025)) decideService(c, 'recall', 0.5);
        if (season && c.winter && s.tireSeason !== season && chance(1 / 28)) {
          s.tireSeason = season;
          decideService(c, 'tires', (S.programs.reminders ? 0.2 : 0) + (mods().tireDemand ? 0.2 : 0));
        }
      }
    }
    // trade cycle: going back into the market
    if (!c.inMarket) {
      const age = yearFrac(S.day) - v.year;
      let pr = 0.00016;
      if (age > 4) pr *= 1.5; if (age > 6) pr *= 1.5; if (age > 9) pr *= 1.6;
      if (v.km > 130000) pr *= 1.5;
      if (c.eq > 3000) pr *= 1.5; else if (c.eq < -3000) pr *= 0.55;
      if (v.fin && v.fin.type === 'lease') { const end = v.fin.start + Math.round(v.fin.term * 30.44); if (end - S.day < 75) pr *= 18; if (S.day >= end) pr = 1; }
      if (S.day - v.purchased < 365) pr *= 0.12;
      if (c.offerUntil > S.day) pr *= 4;
      if (c.hh === 'Family with kids' && v.cls === 'car') pr *= 1.4;
      pr *= econ * (mods().inMarket || 1);
      if (chance(pr)) goInMarket(c);
    } else {
      followUps(c, fuCap);
      if (c.inMarket && c.inMarket.comp && S.day >= c.inMarket.comp) buyFromCompetitor(c);
      else if (c.inMarket && S.day > c.inMarket.until && c.inMarket.visit == null) { if (chance(0.55)) buyFromCompetitor(c); else c.inMarket = null; }
    }
  }
}
function goInMarket(c) {
  const v = c.veh;
  const serviced = c.svc.last != null && S.day - c.svc.last < 365;
  let x = -0.5 + 1.8 * c.dealerLoy + (v && v.make === 'Aurex' ? 0.6 * c.brandLoy : -0.2) + (c.sat - 75) / 25 * 0.5 + (serviced ? 0.65 : -0.2)
    + (c.offerUntil > S.day ? 0.5 : 0) + (S.programs.loyalty ? 0.25 : 0) - compPressure() * 2;
  const us = chance(sigmoid(x));
  c.inMarket = { since: S.day, until: S.day + randi(20, 50), us, visit: null, comp: null, src: serviced ? 'service' : (v && v.fromUs ? 'repeat' : 'returning') };
  if (us) c.inMarket.visit = S.day + randi(1, 7);
  else c.inMarket.comp = S.day + randi(6, 28);
}
function followUps(c, cap) {
  if (c.followUp == null || c.followUp > S.day) return;
  if (cap.left <= 0) { c.followUp = S.day + 1; if (chance(0.06) && c.inMarket) buyFromCompetitor(c); return; }
  cap.left--;
  const bdc = present('bdc').length;
  const pr = clamp(0.16 + (bdc ? 0.1 : 0) + (hasExp('bdc') ? 0.06 : 0) + c.dealerLoy * 0.3 + (c.sat - 70) / 200, 0.04, 0.7);
  if (chance(pr)) {
    c.followUp = null;
    c.inMarket = c.inMarket || { since: S.day, until: S.day + 30, us: true };
    c.inMarket.us = true; c.inMarket.comp = null; c.inMarket.visit = S.day + randi(1, 3); c.inMarket.src = 'follow-up';
  } else if (c.inMarket && c.inMarket.until > S.day) {
    if (chance(0.22)) buyFromCompetitor(c); else c.followUp = S.day + randi(5, 9);
  } else c.followUp = null;
}
function buyFromCompetitor(c) {
  const dealers = S.comps.filter(x => x.type === 'dealer' || x.type === 'used');
  const comp = pickW(dealers, d => (d.brand === 'Aurex' ? 1.4 : 1) * (1 + d.aggr) * (d.campaign ? 1.6 : 1) * (d.type === 'used' && c.wantNew === 'used' ? 2 : 1));
  let base;
  if (comp.brand === 'Aurex') { const m = pick(MODELS.filter(x => !x.exclusive)); base = { make: 'Aurex', model: m.name, cls: m.cls, pt: m.pt, msrp: m.msrp, modelId: m.id }; }
  else if (comp.type === 'used') base = pick(ROAD_VEHICLES);
  else base = pick(ROAD_VEHICLES.filter(r => r.make === comp.brand)) || pick(ROAD_VEHICLES);
  const wasOwner = c.veh && c.veh.fromUs;
  const isNew = comp.type !== 'used';
  const yr = dparts(S.day).y + (isNew && dparts(S.day).m >= 8 ? 1 : 0) - (isNew ? 0 : randi(1, 5));
  c.veh = { year: yr, make: base.make, model: base.model, cls: base.cls, pt: base.pt, msrpNew: base.msrp, km: isNew ? 20 : randi(20000, 90000), cond: isNew ? 5 : 4, acc: 'none',
    fromUs: false, purchased: S.day, boughtNew: isNew, modelId: base.modelId || null, warrantyEnd: isNew ? S.day + 1095 : null, ptWarrantyEnd: isNew ? S.day + 1825 : null, ext: false, ppm: 0, freeOil: false,
    fin: { type: 'finance', amt: Math.round(base.msrp * 0.92), apr: 6.9, term: 72, start: S.day, pmt: Math.round(amort(base.msrp * 0.92, 6.9, 72)) } };
  c.status = base.make === 'Aurex' ? 'service' : 'lost';
  c.inMarket = null; c.followUp = null;
  c.svc.pending = null; c.svc.dueDay = S.day + 182; c.svc.dueKm = c.veh.km + 8000;
  comp.units = (comp.units || 0) + 1; comp.mtdWins = (comp.mtdWins || 0) + 1;
  addHist(c, 'lost', `Bought a ${c.veh.year} ${c.veh.make} ${c.veh.model} at ${comp.name}`, null);
  S.fin.mtd.lostToComp = (S.fin.mtd.lostToComp || 0) + 1;
  if (wasOwner) { S.fin.mtd.lostRepeat = (S.fin.mtd.lostRepeat || 0) + 1; if (chance(0.35)) logEvent('warn', 'customers', `Former customer ${fullName(c)} bought a ${c.veh.make} ${c.veh.model} at ${comp.name}.`); }
}
function pruneCustomers() {
  const before = S.customers.length;
  S.customers = S.customers.filter(c => {
    if (c.status === 'owner' || c.status === 'service') return true;
    if (c.inMarket || c.followUp != null) return true;
    if (serviceEligible(c) && c.svc.last != null && S.day - c.svc.last < 540) return true;
    return (c.lastVisit != null ? c.lastVisit : c.since) > S.day - 270;
  });
  if (S.customers.length !== before) rebuildIndex();
}

/* ---------- Retention analytics ---------- */
function retentionStats() {
  const cohorts = [0, 1, 2, 3, 4].map(() => ({ n: 0, r: 0 }));
  let el = 0, ret = 0, active = 0, base = 0, overdue = 0, defected = 0, due = 0, ppm = 0;
  for (const c of S.customers) {
    if (!serviceEligible(c) || c.status === 'lost') continue;
    const s = c.svc, active12 = s.last != null && S.day - s.last <= 365;
    base++; if (active12) active++;
    if (s.defected) defected++;
    if (s.pending && !s.appt) { due++; if (S.day - s.pending.since > 7) overdue++; }
    if (c.veh.ppm > 0) ppm++;
    if (c.veh.fromUs) {
      const held = S.day - c.veh.purchased;
      const r = active12 && s.last >= c.veh.purchased;
      if (held >= 210 || r) {
        el++; if (r) ret++;
        const k = Math.floor(held / 365);
        if (k < 5) { cohorts[k].n++; if (r) cohorts[k].r++; }
      }
    }
  }
  return { owner: el ? ret / el : 0, cohorts, active, base, overall: base ? active / base : 0, overdue, defected, due, ppm, eligible: el };
}
function overdueList() {
  return S.customers.filter(c => c.svc.pending && !c.svc.appt && S.day - c.svc.pending.since > 7 && serviceEligible(c) && c.status !== 'lost');
}
function callOverdue() {
  const list = overdueList().sort((a, b) => b.dealerLoy - a.dealerLoy);
  const cap = present('bdc').length * 25 * (hasExp('bdc') ? 2 : 1) + present('advisor').length * 6 + (present('svcmgr').length ? 4 : 0) - (S.flags.callsToday || 0);
  if (cap <= 0) { toast('No one is free to make calls today. Hire BDC staff to expand outreach.', 'bad'); return; }
  let booked = 0, n = 0;
  for (const c of list.slice(0, cap)) { n++; if (decideService(c, c.svc.pending.job, 0.75)) booked++; }
  S.flags.callsToday = (S.flags.callsToday || 0) + n;
  toast(`Called ${n} overdue customers — ${booked} booked appointments.`, booked ? 'good' : 'info');
  logEvent('info', 'retention', `Outbound calls to ${n} overdue customers booked ${booked} appointments.`);
}
function upgradeTargets() {
  return S.customers.filter(c => c.veh && (c.status === 'owner' || c.status === 'service') && !c.inMarket && !(c.offerUntil > S.day) && S.day - c.veh.purchased > 540
    && ((c.eq || 0) > 2000 || (c.veh.fin && c.veh.fin.type === 'lease') || yearFrac(S.day) - c.veh.year > 5));
}
function sendUpgradeOffers() {
  if (S.flags.offerDay && S.day - S.flags.offerDay < 7) { toast('An upgrade campaign already went out this week.', 'bad'); return; }
  const list = upgradeTargets().sort((a, b) => (b.eq || 0) - (a.eq || 0));
  const n = Math.min(list.length, 60 + present('bdc').length * 80 * (hasExp('bdc') ? 2 : 1));
  if (!n) { toast('No customers match the upgrade criteria right now.', 'info'); return; }
  list.slice(0, n).forEach(c => { c.offerUntil = S.day + 30; addHist(c, 'note', 'Received equity upgrade offer', null); });
  expense('advertising', n * 6);
  S.flags.offerDay = S.day;
  toast(`Upgrade offers sent to ${n} customers in an equity or lease-end position (${money(n * 6)}).`, 'good');
  logEvent('info', 'retention', `Equity mining campaign sent to ${n} customers.`);
}
function winBackCampaign() {
  if (S.flags.winbackDay && S.day - S.flags.winbackDay < 30) { toast('A win-back mailer already went out this month.', 'bad'); return; }
  const list = S.customers.filter(c => c.svc.defected && serviceEligible(c) && c.status !== 'lost');
  if (!list.length) { toast('No defected service customers to target.', 'info'); return; }
  let won = 0;
  for (const c of list) {
    const pr = clamp(0.1 + c.sat / 600 + (S.programs.preferred ? 0.06 : 0) + (S.programs.loyalty ? 0.04 : 0) - Math.max(0, S.settings.laborRate - indyRate()) / 400, 0.03, 0.4);
    if (chance(pr)) { won++; c.svc.defected = false; c.svc.missed = 0; c.dealerLoy = round2(clamp(c.dealerLoy + 0.1, 0, 1)); if (!c.svc.pending && !c.svc.appt) c.svc.pending = { job: 'oil', since: S.day, decide: S.day + randi(1, 10) }; }
  }
  expense('advertising', list.length * 11);
  S.flags.winbackDay = S.day;
  toast(`Win-back mailer reached ${list.length} lapsed customers; ${won} re-engaged.`, won ? 'good' : 'info');
  logEvent('info', 'retention', `Win-back campaign: ${won} of ${list.length} lapsed service customers re-engaged (${money(list.length * 11)}).`);
}
function inviteCustomer(cid) {
  const c = cust(cid); if (!c) return;
  if (c.invited && S.day - c.invited < 14) { toast(`${fullName(c)} was contacted recently.`, 'bad'); return; }
  c.invited = S.day;
  const pr = clamp(0.12 + c.dealerLoy * 0.5 + ((c.eq || 0) > 0 ? 0.12 : -0.05) + (c.inMarket ? 0.25 : 0) + (c.sat - 70) / 150, 0.03, 0.85);
  if (chance(pr)) {
    c.inMarket = c.inMarket || { since: S.day, until: S.day + 30 };
    Object.assign(c.inMarket, { us: true, comp: null, visit: S.day + 1, src: 'bdc' });
    toast(`${fullName(c)} booked a showroom appointment for tomorrow.`, 'good');
    addHist(c, 'note', 'Accepted showroom invitation', null);
  } else { toast(`${fullName(c)} isn't ready to look at a new vehicle.`, 'info'); addHist(c, 'note', 'Declined showroom invitation', null); }
}
function callToBook(cid) {
  const c = cust(cid); if (!c) return;
  if (!serviceEligible(c)) return toast('This customer\'s vehicle isn\'t serviced here.', 'bad');
  if (c.svc.appt) return toast('Already booked.', 'info');
  const job = c.svc.pending ? c.svc.pending.job : 'oil';
  if (decideService(c, job, 0.9)) toast(`${fullName(c)} booked ${JOBS[job].name.toLowerCase()}.`, 'good');
  else toast(`${fullName(c)} said they'll service elsewhere this time.`, 'bad');
}

/* ---------- Employees ---------- */
function morningEmployees() {
  const dow = dparts(S.day).dow;
  S.today = S.today || [];
  for (const e of S.emps) {
    if (e.status === 'gone') continue;
    if (e.status === 'training' && S.day >= e.trainUntil) completeTraining(e);
    e.absent = false;
    if (e.status === 'active' && dow !== 0 && chance(e.absence * (1 + Math.max(0, 60 - e.morale) / 50))) {
      e.absent = true;
      S.today.push({ tone: 'warn', cat: 'hr', text: `${ROLES[e.role].title} ${empName(e)} called in sick.`, link: 'employees' });
    }
  }
}
function payRatio(e) {
  if (e.role === 'tech') {
    const exp = 150 * marketFlat(e.tier, e.skill), earned = (e.lastPay != null ? e.lastPay : exp) ;
    return (e.flat / marketFlat(e.tier, e.skill)) * 0.5 + (earned / exp) * 0.5;
  }
  const mkt = marketSalary(e.role, e.skill);
  const mult = { sales: 2.2, fi: 2.5, advisor: 1.55 }[e.role];
  if (!mult) return e.salary / mkt;
  const expTotal = mkt * mult / 12, earned = e.salary / 12 + (e.lastPay != null ? e.lastPay : expTotal - e.salary / 12);
  return earned / expTotal;
}
function eveningEmployees() {
  const dow = dparts(S.day).dow;
  const lastNet = S.fin.hist.length ? statementNet(S.fin.hist[S.fin.hist.length - 1]) : 0;
  const idle = S.svc.idleHours || 0;
  const salesUps = present('sales').length ? S.fin.mtd.ups / Math.max(1, dparts(S.day).dom) / present('sales').length : 0;
  for (const e of S.emps) {
    if (e.status === 'gone') continue;
    if (dow !== 0 && e.status === 'active' && !e.absent) {
      e.exp = round2(e.exp + 1 / 300);
      e.skill = Math.min(99, e.skill + (100 - e.skill) * 0.00011 * (e.exp < 4 ? 1.7 : 1));
    }
    let target = 62 + clamp((payRatio(e) - 1) * 70, -30, 18) + (lastNet > 0 ? 4 : -5);
    if (e.role === 'tech') target -= clamp(idle / Math.max(1, techs().length) - 1.5, 0, 6) * 2.5;
    if (e.role === 'sales') target -= salesUps > 5.5 ? (salesUps - 5.5) * 4 : 0;
    if (['tech', 'advisor', 'parts', 'detail'].includes(e.role)) { const m = present('svcmgr')[0]; target += m ? (m.skill - 55) / 8 : -4; }
    if (['sales', 'fi', 'bdc'].includes(e.role)) { const g = present('gsm')[0]; target += g ? (g.skill - 55) / 8 : -4; }
    if (e.trainedDay && S.day - e.trainedDay < 60) target += 5;
    if (S.flags.firedDay && S.day - S.flags.firedDay < 30) target -= 3;
    e.morale = clamp(e.morale + (clamp(target, 8, 96) - e.morale) * 0.035 + gauss(0, 0.5), 0, 100);
    if (e.status === 'active' && e.morale < 32 && chance((32 - e.morale) * 0.0011)) resignationRisk(e);
  }
}
function resignationRisk(e) {
  const valued = e.skill >= 55 || e.tier >= 3 || ['gsm', 'svcmgr', 'fi'].includes(e.role);
  if (valued && !e.warned) { e.warned = true; queueDecision('resign', { eid: e.id }); }
  else quit(e, 'resigned');
}
function quit(e, how) {
  e.status = 'gone'; e.left = S.day;
  S.svc.ros.forEach(r => { if (r.tech === e.id) { r.tech = null; if (r.status === 'working') r.status = 'queued'; } });
  logEvent('bad', 'hr', `${empName(e)} (${ROLES[e.role].title}) ${how}.`);
}
function genCandidates(force) {
  if (!force && S.day - S.candDay < 7) return;
  S.candDay = S.day;
  const rep = clamp((kpiSalesCsi() + kpiServiceCsi()) / 2 - 80, -15, 15);
  const tight = avg(S.comps.filter(c => c.type === 'dealer'), c => c.aggr) - 0.5;
  for (const role of Object.keys(ROLES)) {
    const n = role === 'tech' ? 4 : role === 'sales' ? 4 : 3;
    S.cands[role] = [];
    for (let i = 0; i < n; i++) {
      const skill = Math.round(clamp(gauss(48 + rep * 0.5 - tight * 12, 16), 15, 92));
      const e = genEmployee(role, { skill, hired: S.day, morale: randi(66, 80) });
      e.ask = role === 'tech' ? round2(e.flat * randf(0.98, 1.12)) : roundTo(e.salary * randf(0.97, 1.14), 500);
      if (role === 'tech') e.flat = e.ask; else e.salary = e.ask;
      e.ev = role === 'tech' && e.tier >= 3 && chance(0.3);
      S.cands[role].push(e);
    }
  }
}
function hireCandidate(role, id) {
  const list = S.cands[role] || [];
  const e = list.find(x => x.id === id); if (!e) return;
  if (ROLES[role].max && emps(role).length >= ROLES[role].max) return toast(`You already have a ${ROLES[role].title}. Promote, replace or fire first.`, 'bad');
  const fee = role === 'tech' ? 3200 : Math.round(e.salary * 0.06 + 800);
  expense('payroll', fee);
  e.hired = S.day; e.status = 'active'; e.absent = true; e.mtd = { units: 0, gross: 0, ups: 0, hours: 0, ros: 0, pay: 0 };
  S.emps.push(e);
  S.cands[role] = list.filter(x => x !== e);
  logEvent('good', 'hr', `Hired ${empName(e)} as ${ROLES[role].title} (${role === 'tech' ? '$' + e.flat.toFixed(2) + '/flagged hr' : money(e.salary) + '/yr'}). Recruiting cost ${money(fee)}.`);
  toast(`${empName(e)} starts tomorrow.`, 'good');
}
function fireEmployee(id) {
  const e = empById(id); if (!e || e.status === 'gone') return;
  const sev = e.role === 'tech' ? 80 * e.flat : e.salary / 26;
  expense('payroll', sev);
  const weak = e.skill < 40 || e.morale < 35;
  S.emps.filter(x => x.status !== 'gone' && ROLES[x.role].dept === ROLES[e.role].dept && x !== e).forEach(x => { x.morale = clamp(x.morale - (weak ? 1 : 4), 0, 100); });
  S.flags.firedDay = S.day;
  quit(e, `was let go (severance ${money(sev)})`);
}
function trainEmployee(id, courseId) {
  const e = empById(id), c = COURSES.find(x => x.id === courseId);
  if (!e || !c || e.status !== 'active') return;
  if (!c.roles.includes(e.role)) return toast('That course is not available for this role.', 'bad');
  expense('training', c.cost);
  e.status = 'training'; e.course = c.id; e.trainUntil = S.day + c.days + (dparts(S.day).dow + c.days >= 7 ? 1 : 0);
  logEvent('info', 'hr', `${empName(e)} enrolled in ${c.name} (${money(c.cost)}, ${c.days} days).`);
}
function completeTraining(e) {
  const c = COURSES.find(x => x.id === e.course);
  e.status = 'active'; e.trainUntil = null; e.course = null; e.trainedDay = S.day;
  if (!c) return;
  e.skill = Math.min(99, e.skill + c.skill * (1 - e.skill / 140));
  if (c.cert && !e.certs.includes(c.id)) e.certs.push(c.id);
  if (c.ev) e.ev = true;
  if (c.csi) e.csi = Math.min(99, e.csi + c.csi); else e.csi = Math.min(99, e.csi + 1);
  if (e.role === 'tech') e.eff = round2(Math.min(1.5, e.eff + 0.025));
  e.morale = clamp(e.morale + 6, 0, 100);
  logEvent('good', 'hr', `${empName(e)} completed ${c.name}.`);
}
const TIER_REQ = [0, 0, 38, 56, 72];
function promotionOptions(e) {
  const o = [];
  if (e.role === 'sales') { if (!emps('gsm').length) o.push({ to: 'gsm', label: 'Promote to General Sales Manager' }); if (emps('fi').length < 3) o.push({ to: 'fi', label: 'Move to Finance Manager' }); }
  if (e.role === 'advisor' && !emps('svcmgr').length) o.push({ to: 'svcmgr', label: 'Promote to Service Manager' });
  if (e.role === 'tech' && e.tier < 4) {
    const t = e.tier + 1, ok = e.skill >= TIER_REQ[t] && (t < 3 || e.certs.includes('techcert'));
    o.push({ to: 'tier', label: `Promote to ${TECH_TIERS[t]}`, ok, why: ok ? '' : `Needs skill ${TIER_REQ[t]}${t >= 3 ? ' and Aurex Technical Certification' : ''}` });
  }
  if (e.role === 'bdc' || e.role === 'detail') o.push({ to: 'sales', label: 'Move to Sales Consultant' });
  if (e.role === 'parts') o.push({ to: 'advisor', label: 'Move to Service Advisor' });
  if (e.role === 'detail' && e.skill >= 40) o.push({ to: 'tech1', label: 'Apprentice technician (Express)' });
  return o.map(x => ({ ok: true, ...x }));
}
function promoteEmployee(id, to) {
  const e = empById(id); if (!e) return;
  const opt = promotionOptions(e).find(o => o.to === to);
  if (!opt || !opt.ok) return toast(opt ? opt.why : 'Not eligible.', 'bad');
  const old = ROLES[e.role].title;
  if (to === 'tier') { e.tier++; e.flat = round2(Math.max(e.flat + 4, marketFlat(e.tier, e.skill))); }
  else if (to === 'tech1') { e.role = 'tech'; e.tier = 1; e.eff = 0.8; e.flat = TECH_FLAT[1]; e.salary = 0; e.comm = 0; }
  else { e.role = to; e.salary = roundTo(Math.max(e.salary * 1.12, marketSalary(to, e.skill) * 0.95), 500); e.comm = ROLES[to].comm; }
  e.morale = clamp(e.morale + 15, 0, 100); e.warned = false;
  logEvent('good', 'hr', `${empName(e)} promoted from ${old} to ${e.role === 'tech' ? TECH_TIERS[e.tier] : ROLES[e.role].title}.`);
}
function setCompensation(id, salary, comm, flat) {
  const e = empById(id); if (!e) return;
  let change;
  if (e.role === 'tech') { change = (flat - e.flat) / e.flat; e.flat = round2(flat); }
  else { change = (salary - e.salary) / Math.max(1, e.salary); e.salary = roundTo(salary, 500); if (comm != null) { change += (comm - e.comm) * 2; e.comm = comm; } }
  e.morale = clamp(e.morale + (change >= 0 ? Math.min(22, change * 130) : change * 220), 0, 100);
  if (change > 0.03) e.warned = false;
  e.lastRaise = S.day;
  logEvent(change >= 0 ? 'info' : 'warn', 'hr', `Compensation for ${empName(e)} ${change >= 0 ? 'increased' : 'reduced'} by ${pct(Math.abs(change), 1)}.`);
}
