'use strict';
/* =====================================================================
   Dealer Empire — service department and parts department
   ===================================================================== */

function serviceEligible(c) { return !!(c.veh && (c.veh.make === 'Aurex' || c.veh.fromUs)); }
function techs() { return S.emps.filter(e => e.role === 'tech' && e.status !== 'gone'); }
function bayCount() { return S.svc.bays + (hasExp('bigstore') ? 6 : 0); }
function bayHoursPerDay() { return S.programs.exthours ? 12.5 : 9; }

/* Estimated flat-rate hours the shop can produce on a given day (for booking) */
function shopCapacity(day) {
  const dow = dparts(day).dow;
  if (dow === 0) return 0;
  const satF = dow === 6 ? (S.programs.exthours ? 0.85 : 0.5) : 1;
  const ts = techs().filter(t => t.status === 'active' || (t.status === 'training' && t.trainUntil < day));
  const techHrs = sum(ts, t => 8 * t.eff) * 0.93 * (S.programs.exthours ? 1.35 : 1);
  const bayHrs = bayCount() * bayHoursPerDay() * 1.05;
  return Math.min(techHrs, bayHrs) * satF;
}
function bookedHours(day) { return S.svc.booked[day] || 0; }
/* Open work in the shop spills into the coming days before new appointments fit */
function shopBacklog() { return Math.max(0, sum(S.svc.ros, r => r.status === 'done' ? 0 : r.left) - shopCapacity(S.day) * 0.35); }
function earliestSlot(hrs, from = S.day + 1, carry = shopBacklog()) {
  for (let d = from; d < from + 30; d++) {
    const cap = shopCapacity(d) * BOOK_FACTOR;
    if (cap <= 0) continue;
    const free = cap - bookedHours(d) - carry;
    if (free >= hrs) return d;
    carry = Math.max(0, carry - Math.max(0, cap / BOOK_FACTOR - bookedHours(d)));
  }
  return from + 30;
}
const BOOK_FACTOR = 0.8; // leave room for recon, upsells and comebacks
function apptLeadTime() { const d = earliestSlot(1.2); return d - S.day; }
function shopLoadToday() { return sum(S.svc.ros, r => r.left); }

function jobHours(job) { return JOBS[job].hrs; }
function bookAppointment(c, job, opt = {}) {
  const hrs = opt.hrs || jobHours(job);
  const day = opt.day != null ? opt.day : earliestSlot(hrs, S.day + 1);
  S.svc.booked[day] = bookedHours(day) + hrs;
  const a = { id: nextId('AP'), cid: c.id, day, job, hrs, pay: opt.pay || JOBS[job].pay, parts: opt.parts || null, note: opt.note || '' };
  S.svc.appts.push(a);
  c.svc.appt = a.id;
  return a;
}

/* Repair orders */
function createRO(o) {
  const job = JOBS[o.job];
  const ro = {
    id: nextId('RO'), num: 50000 + (S.ids.RO || 0), cid: o.cid, uid: o.uid || null, job: o.job, desc: o.desc || job.name,
    hrs: o.hrs != null ? o.hrs : job.hrs, left: o.hrs != null ? o.hrs : job.hrs, skill: o.skill || job.skill, pay: o.pay || job.pay,
    parts: (o.parts || job.parts).map(([pn, q]) => ({ pn, q, ok: false })), status: 'queued', tech: null, opened: S.day, waitDays: 0,
    upsell: [], km: o.km || 0, ev: !!o.ev, loaner: false, rushed: false, advisor: o.advisor || null, partsFilled: null, vehDesc: o.vehDesc || '',
  };
  S.svc.ros.push(ro);
  return ro;
}
function roCustomerName(ro) { if (!ro.cid) return 'Internal — used vehicle'; const c = cust(ro.cid); return c ? fullName(c) : '—'; }

/* Morning: appointments arrive and become ROs; advisors write them up */
function checkInAppointments() {
  const today = S.svc.appts.filter(a => a.day <= S.day);
  S.svc.appts = S.svc.appts.filter(a => a.day > S.day);
  const advisors = present('advisor');
  const mgr = present('svcmgr')[0];
  const capacity = advisors.length * 16 + (mgr ? 4 : 0);
  let n = 0;
  for (const a of today) {
    const c = cust(a.cid); if (!c) continue;
    c.svc.appt = null;
    if (chance(0.04)) { addHist(c, 'service', 'No-show for appointment', null); c.svc.pending = c.svc.pending || { job: a.job, since: S.day }; continue; }
    n++;
    const adv = advisors.length ? advisors[n % advisors.length] : null;
    const ro = createRO({ cid: c.id, job: a.job, hrs: a.hrs, pay: a.pay, parts: a.parts || JOBS[a.job].parts, km: Math.round(c.veh.km), ev: c.veh.pt === 'ev' && ['warranty', 'major', 'diag'].includes(a.job),
      advisor: adv ? adv.id : null, desc: a.note || JOBS[a.job].name, vehDesc: `${c.veh.year} ${c.veh.make} ${c.veh.model}` });
    ro.rushed = n > capacity;
    // advisor recommends additional work
    const upP = adv ? 0.18 + adv.skill / 300 : 0.08;
    if (!ro.rushed && a.pay === 'cp' && chance(upP * (c.priceSens > 0.7 ? 0.7 : 1))) {
      const up = pick(UPSELLS); ro.upsell.push(up.n); ro.hrs = round2(ro.hrs + up.hrs); ro.left = ro.hrs; up.parts.forEach(([pn, q]) => ro.parts.push({ pn, q, ok: false }));
    }
    if (adv) { adv.mtd.ros++; }
  }
  if (n > capacity) logEvent('warn', 'service', `Service drive overloaded: ${n} check-ins for advisor capacity of ${capacity}. Customers waited and upsells were missed.`);
  S.svc.checkins = n;
}

function roPriority(ro) {
  const f = S.settings.roFocus;
  const base = { cp: 2, warranty: 2, internal: 0 }[ro.pay] + (ro.job === 'comeback' ? 3 : 0) + ro.waitDays * 1.5;
  if (f === 'waiting') return base + (ro.pay === 'internal' ? 0 : 2) + ro.waitDays * 2;
  if (f === 'cp') return base + (ro.pay === 'cp' ? 3 : ro.pay === 'warranty' ? 1 : 0);
  if (f === 'recon') return base + (ro.pay === 'internal' ? 5 : 0);
  return base;
}

function allocateParts(ro) {
  let ok = true;
  if (!ro.fillCounted && ro.parts.length) {
    ro.fillCounted = true;
    S.flags.fillTotal = (S.flags.fillTotal || 0) + 1;
    if (ro.parts.every(l => { const p = partByPn(l.pn); return !p || p.qoh >= l.q; })) S.flags.fillOk = (S.flags.fillOk || 0) + 1;
  }
  for (const line of ro.parts) {
    if (line.ok) continue;
    const p = partByPn(line.pn);
    if (!p) { line.ok = true; continue; }
    if (p.qoh >= line.q) {
      p.qoh -= line.q; line.ok = true; p.lastSale = S.day; p.used90 += line.q; p.sold.push([S.day, line.q]);
      if (ro.partsFilled == null) ro.partsFilled = true;
    } else {
      ok = false; ro.partsFilled = false;
      if (!line.ordered) { specialOrder(p, line.q - p.qoh + (p.auto ? 0 : 0)); line.ordered = true; }
    }
  }
  return ok;
}

/* The day's shop work: dispatch technicians to repair orders */
function dailyShop() {
  const dow = dparts(S.day).dow;
  const L = S.fin.mtd;
  if (dow !== 0) {
    const ts = techs().filter(t => t.status === 'active' && !t.absent);
    const satF = dow === 6 ? (S.programs.exthours ? 0.85 : 0.5) : 1;
    const mgr = present('svcmgr')[0];
    const mgrF = mgr ? 1 + (mgr.skill - 50) / 600 : 0.95;
    const shiftF = S.programs.exthours ? 1.35 : 1;
    let techHours = ts.map(t => ({ t, h: 8 * satF * shiftF * clamp(0.85 + t.morale / 400, 0.85, 1.08) * mgrF }));
    const bayHrs = bayCount() * bayHoursPerDay() * satF * 1.05;
    const totalTech = sum(techHours, x => x.h);
    if (totalTech > bayHrs) techHours.forEach(x => { x.h *= bayHrs / totalTech; });
    S.svc.idleHours = 0;

    // mobile van takes light jobs first
    if (S.programs.mobile) {
      let slots = 6;
      for (const ro of S.svc.ros.filter(r => (r.job === 'oil' || r.job === 'tires') && r.status === 'queued')) {
        if (slots-- <= 0) break;
        if (allocateParts(ro)) { ro.mobile = true; ro.left = 0; completeRO(ro, null); }
      }
    }
    S.svc.ros.sort((a, b) => roPriority(b) - roPriority(a));
    for (const slot of techHours.sort((a, b) => b.t.tier - a.t.tier)) {
      let guard = 0;
      while (slot.h > 0.05 && guard++ < 40) {
        let ro = S.svc.ros.find(r => r.tech === slot.t.id && r.status === 'working');
        if (!ro) {
          ro = S.svc.ros.find(r => r.status === 'queued' && r.skill <= slot.t.tier && (!r.ev || slot.t.ev) && (!r.tech || r.tech === slot.t.id));
          if (!ro) {
            // overflow: a skilled tech takes easier work, a less skilled tech cannot help
            ro = S.svc.ros.find(r => r.status === 'queued' && r.skill <= slot.t.tier + (slot.t.skill > 60 ? 0 : -1) && (!r.ev || slot.t.ev));
          }
          if (!ro) break;
          if (!allocateParts(ro)) { ro.status = 'parts'; continue; }
          ro.status = 'working'; ro.tech = slot.t.id;
        }
        const clockNeeded = ro.left / slot.t.eff;
        const spent = Math.min(slot.h, clockNeeded);
        slot.h -= spent; ro.left = round2(ro.left - spent * slot.t.eff);
        // recon surprise surfaces mid-job
        if (ro.uid && ro.left < ro.hrs * 0.6) { const u = S.used.find(x => x.id === ro.uid); if (u && u.surprise && !u.surprise.asked) { u.surprise.asked = true; queueDecision("reconSurprise", { uid: u.id }); } }
        if (ro.left <= 0.02) completeRO(ro, slot.t);
      }
      S.svc.idleHours += Math.max(0, slot.h);
    }
  }
  // carry-over: waiting customers, loaners
  let loanersUsed = 0;
  for (const ro of S.svc.ros) {
    if (ro.status === 'done') continue;
    if (ro.opened < S.day) ro.waitDays++;
    if (ro.pay !== 'internal' && ro.cid && ro.opened < S.day) {
      if (!ro.loaner && !S.programs.pickup) { if (loanersUsed < S.settings.loaners) { ro.loaner = true; loanersUsed++; } }
      else if (ro.loaner) loanersUsed++;
      if (!ro.loaner && !S.programs.pickup) { const c = cust(ro.cid); if (c) c.sat = clamp(c.sat - 3, 0, 100); }
    }
  }
  S.svc.loanersOut = loanersUsed;
  expense('loaners', loanersUsed * 22);
  S.svc.ros = S.svc.ros.filter(r => r.status !== 'done');
}

function completeRO(ro, tech) {
  ro.status = 'done';
  const L = S.fin.mtd;
  const flagged = ro.hrs;
  const flat = tech ? tech.flat : 32;
  const techPay = flagged * flat;
  if (tech) { tech.mtd.hours += flagged; tech.mtd.pay += techPay; tech.mtd.ros++; }
  L.techPay += techPay;
  // parts
  let partsRetail = 0, partsCost = 0;
  for (const line of ro.parts) { const p = partByPn(line.pn); if (!p) continue; partsRetail += p.retail * line.q; partsCost += p.cost * line.q; }
  const c = ro.cid ? cust(ro.cid) : null;
  if (ro.pay === 'internal') {
    const labour = flagged * INTERNAL_RATE;
    book('labor', labour, techPay); L.hours.internal += flagged; L.ros.internal++;
    S.cash -= techPay;
    if (ro.uid) finishRecon(ro, labour);
    else if (ro.job === 'comeback') { /* internal re-repair: cost only */ book('labor', -labour, 0); }
    return;
  }
  let rate = ro.pay === 'warranty' ? WARRANTY_RATE : S.settings.laborRate;
  if (ro.pay === 'cp' && c && S.programs.preferred && c.veh && c.veh.fromUs) rate *= 0.9;
  let labour = flagged * rate;
  let partsRev = ro.pay === 'warranty' ? partsCost * 1.4 : partsRetail;
  // prepaid maintenance / free first oil change
  let note = '';
  if (c && ro.pay === 'cp' && (ro.job === 'oil' || ro.job === 'maint')) {
    if (c.veh.freeOil && ro.job === 'oil') { c.veh.freeOil = false; note = ' (free first oil change)'; S.progStats.freeoil.cost += techPay + partsCost; labour = 0; partsRev = 0; }
    else if (c.veh.ppm > 0) { c.veh.ppm--; note = ' (prepaid plan)'; labour *= 0.55; partsRev *= 0.6; }
    else if (ro.job === 'oil') { const menu = S.settings.oilPrice; labour = Math.max(0, menu - partsRetail * 0.85); partsRev = partsRetail * 0.85; }
  }
  if (ro.pay === 'cp') { L.hours.cp += flagged; L.ros.cp++; } else { L.hours.warranty += flagged; L.ros.warranty++; }
  book('labor', labour, techPay); book('parts', partsRev, partsCost);
  S.cash += labour + partsRev - techPay;
  const adv = ro.advisor ? empById(ro.advisor) : null;
  if (adv && ro.pay === 'cp') { const x = (labour + partsRev) * adv.comm; expense('payroll', x); adv.mtd.pay += x; adv.mtd.gross += labour + partsRev; }
  const mgr = present('svcmgr')[0]; if (mgr) { const x = (labour - techPay) * mgr.comm; expense('payroll', x); mgr.mtd.pay += x; }
  if (S.programs.loyalty && ro.pay === 'cp') { const pts = (labour + partsRev) * 0.02; S.progStats.loyalty.cost += pts; expense('programs', pts); }
  if (!c) return;
  // customer experience
  const quality = tech ? (tech.tier >= ro.skill ? 0.97 : 0.86) * (1 - (100 - tech.skill) / 900) : 0.97;
  const mgrSkill = mgr ? mgr.skill : 35;
  const comeback = !ro.mobile && chance((1 - quality) * 0.35 * (1.25 - mgrSkill / 200) + 0.008);
  const priceGap = (S.settings.laborRate - indyRate()) / indyRate();
  let csi = 86 + (adv ? (adv.csi - 78) * 0.4 : -4) - ro.waitDays * 5 - (ro.rushed ? 6 : 0) - Math.max(0, priceGap) * 18 * c.priceSens
    + (S.programs.pickup ? 4 : 0) + (ro.mobile ? 5 : 0) + (ro.pay === 'warranty' ? 2 : 0) + (ro.loaner ? 2 : 0) + gauss(0, 5);
  if (comeback) csi -= 14;
  csi = Math.round(clamp(csi, 20, 100));
  L.csiService.push(csi);
  c.sat = Math.round(c.sat * 0.6 + csi * 0.4);
  c.dealerLoy = round2(clamp(c.dealerLoy + (csi - 78) / 600 + 0.01, 0, 1));
  c.svc.last = S.day; c.svc.visits++; c.svc.spend += Math.round(labour + partsRev); c.svc.missed = 0; c.svc.defected = false;
  c.ltv += Math.round(labour + partsRev - techPay - partsCost);
  if (ro.job === 'oil' || ro.job === 'maint') { c.svc.dueKm = c.veh.km + 8000; c.svc.dueDay = S.day + 182; }
  if (ro.job === 'recall') c.recall = false;
  if (S.flags.progAttrib && S.flags.progAttrib[c.id]) { for (const [pid, share] of Object.entries(S.flags.progAttrib[c.id])) S.progStats[pid].attrib += share * (labour + partsRev - techPay - partsCost); delete S.flags.progAttrib[c.id]; }
  addHist(c, 'service', `${ro.desc}${ro.upsell.length ? ' + ' + ro.upsell.join(', ') : ''}${note}${ro.mobile ? ' — mobile service' : ''}`, labour + partsRev);
  if (comeback) {
    L.comebacks++;
    const cb = createRO({ cid: c.id, job: 'comeback', pay: 'internal', desc: `Comeback: ${ro.desc}`, km: ro.km, vehDesc: ro.vehDesc });
    cb.opened = S.day + 1;
    if (chance(0.3)) queueComplaint(c, ro);
  }
}

function finishRecon(ro, labour) {
  const u = S.used.find(x => x.id === ro.uid); if (!u) return;
  const partsSublet = Math.max(0, u.reconPlanned - labour) + (u.surprise && u.surprise.approved ? u.surprise.cost : 0);
  S.cash -= partsSublet;
  u.reconCost += labour + partsSublet;
  u.cond = reconCond(u);
  u.recon = 'done'; u.status = 'available'; u.frontline = S.day;
  u.ask = roundTo(usedRetail(u) * 1.02, 100) - 5;
}

/* Independent shop pricing benchmark */
function indyRate() { const p = S.comps.find(c => c.id === 'precision'); return (p ? p.svcRate : 126) * (mods().indyRate || 1); }

/* ---------- Parts department ---------- */
function partByPn(pn) { return S.parts.find(p => p.pn === pn); }
function partLead(p) { return Math.max(1, Math.round(p.lead * S.mkt.partsLead * (mods().partsLead || 1) * (hasExp('warehouse') ? 0.5 : 1))); }
function specialOrder(p, qty) {
  qty = Math.max(1, Math.round(qty));
  S.porders.push({ id: nextId('PO'), pn: p.pn, qty, eta: S.day + partLead(p), cost: qty * p.cost, kind: 'special' });
  p.onOrder += qty;
}
function stockOrder(p, qty) {
  qty = Math.max(1, Math.round(qty));
  S.porders.push({ id: nextId('PO'), pn: p.pn, qty, eta: S.day + partLead(p), cost: qty * p.cost, kind: 'stock' });
  p.onOrder += qty;
}
function dailyParts() {
  // receive
  const arrived = S.porders.filter(o => o.eta <= S.day);
  S.porders = S.porders.filter(o => o.eta > S.day);
  for (const o of arrived) {
    const p = partByPn(o.pn); if (!p) continue;
    p.qoh += o.qty; p.onOrder = Math.max(0, p.onOrder - o.qty);
    S.cash -= o.cost; S.fin.mtd.cf.parts += o.cost;
  }
  if (arrived.length) for (const ro of S.svc.ros.filter(r => r.status === 'parts')) { if (allocateParts(ro)) ro.status = 'queued'; }
  const dow = dparts(S.day).dow;
  if (dow !== 0) {
    // counter and wholesale sales
    const staff = present('parts');
    const f = staff.length ? 0.6 + sum(staff, e => e.skill) / 120 : 0.25;
    const n = poisson(5.5 * f * (dow === 6 ? 0.5 : 1) * (hasExp('warehouse') ? 3.2 : 1));
    let rev = 0, cost = 0;
    const sellable = S.parts.filter(p => p.qoh > 0 && !p.recall && !p.seasonal && p.cat !== 'EV / Hybrid');
    for (let i = 0; i < n && sellable.length; i++) {
      const p = pickW(sellable, x => x.cat === 'Maintenance' ? 4 : x.cat === 'Brakes' ? 3 : x.legacy ? 0.05 : 1);
      const q = Math.min(p.qoh, randi(1, p.cat === 'Maintenance' ? 6 : 2));
      if (q <= 0) continue;
      const wholesale = chance(0.45);
      p.qoh -= q; p.lastSale = S.day; p.used90 += q; p.sold.push([S.day, q]);
      rev += q * p.retail * (wholesale ? 0.8 : 1); cost += q * p.cost;
    }
    book('parts', rev, cost); S.cash += rev;
  }
  // replenishment
  if (S.settings.autoReorder) for (const p of S.parts) {
    if (!p.auto || p.max <= 0) continue;
    if (p.qoh + p.onOrder <= p.min) stockOrder(p, p.max - p.qoh - p.onOrder);
  }
  // rolling usage window & obsolescence
  for (const p of S.parts) {
    if (p.sold.length && p.sold[0][0] < S.day - 90) { p.sold = p.sold.filter(s => s[0] >= S.day - 90); p.used90 = sum(p.sold, s => s[1]); }
    p.obsolete = p.qoh > 0 && S.day - p.lastSale > 270;
  }
}
function partsValue() { return sum(S.parts, p => p.qoh * p.cost); }
function obsoleteValue() { return sum(S.parts.filter(p => p.obsolete), p => p.qoh * p.cost); }
function returnParts(p) {
  if (p.qoh <= 0) return;
  const rate = S.day - p.lastSale > 540 ? 0.35 : 0.75;
  const credit = p.qoh * p.cost * rate;
  S.cash += credit; book('parts', credit, p.qoh * p.cost);
  logEvent('info', 'parts', `Returned ${p.qoh} × ${p.desc} for ${money(credit)} credit (${rate === 0.75 ? 'restocking fee 25%' : 'liquidated at 35%'}).`);
  p.qoh = 0; p.obsolete = false; p.auto = false; p.min = 0; p.max = 0;
}
function fillRate() { return S.flags.fillTotal ? (S.flags.fillOk || 0) / S.flags.fillTotal : 0.92; }
