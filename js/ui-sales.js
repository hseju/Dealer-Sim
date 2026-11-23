'use strict';
/* =====================================================================
   Dealer Empire — Dashboard, Showroom and the Deal Desk
   ===================================================================== */

const VIEWS = {};

function mtdStats() {
  const L = S.fin.mtd, P = lastMonth();
  const g = id => L.rev[id] - L.cogs[id], gp = id => P ? P.rev[id] - P.cogs[id] : 0;
  const retail = L.units.new + L.units.used, pRetail = P ? P.units.new + P.units.used : 0;
  return {
    L, P, rev: stRevenue(L), gross: stGross(L), exp: stExpenses(L), net: statementNet(L),
    pRev: P ? stRevenue(P) : null, pGross: P ? stGross(P) : null, pNet: P ? statementNet(P) : null,
    newGpu: L.units.new ? g('new') / L.units.new : 0, usedGpu: L.units.used ? g('used') / L.units.used : 0,
    pNewGpu: P && P.units.new ? gp('new') / P.units.new : null, pUsedGpu: P && P.units.used ? gp('used') / P.units.used : null,
    pvr: retail ? g('fi') / retail : 0, pPvr: pRetail ? gp('fi') / pRetail : null, retail, pRetail,
    svcRev: L.rev.labor, partsRev: L.rev.parts, pSvcRev: P ? P.rev.labor : null, pPartsRev: P ? P.rev.parts : null,
  };
}
function paceFactor() { const dom = dparts(S.day).dom, dim = daysInMonthOf(S.day); return dim / Math.max(1, dom); }

function computeAlerts() {
  const a = [];
  const waiting = visibleVisits();
  const cap = sum(present('sales'), e => e.skill > 72 ? 5 : 4) + (present('gsm').length ? 2 : 0);
  if (waiting.length) a.push({ tone: waiting.length > cap ? 'bad' : 'info', icon: 'showroom', text: `${plural(waiting.length, 'customer')} waiting in showroom`, sub: waiting.length > cap ? `The sales team can only take ${cap} today. Work some deals yourself or hire.` : 'Work a deal yourself or let the team handle them at close.', link: 'showroom' });
  if (S.decisions.length) a.push({ tone: 'warn', icon: 'flag', text: `${plural(S.decisions.length, 'decision')} waiting for you`, sub: S.decisions[0].title, act: 'openDecision' });
  for (const e of S.emps.filter(e => e.absent && e.status === 'active')) a.push({ tone: 'warn', icon: 'user', text: `${e.role === 'tech' ? 'Technician' : ROLES[e.role].title} ${empName(e)} called in sick`, sub: e.role === 'tech' ? 'Shop capacity is reduced today.' : '', link: 'employees' });
  const aged = S.inv.filter(v => v.status === 'available' && daysIn(v) > 90);
  if (aged.length) a.push({ tone: 'warn', icon: 'clock', text: `${plural(aged.length, 'vehicle')} have been in inventory over 90 days`, sub: `Floorplan accrued on these: ${money(sum(aged, v => v.fpAccrued))}. Discount or dealer-trade them.`, link: 'inventory' });
  const t = S.oem.targets.units, done = S.oem.mtdNew, proj = Math.round(done * paceFactor());
  a.push({ tone: proj >= t ? 'good' : proj >= t * 0.85 ? 'warn' : 'bad', icon: 'oem', text: `OEM sales target: ${done} / ${t}`, sub: `On pace for about ${proj} new units this month.`, link: 'oem' });
  const ret = S.kpiCache.ret;
  if (ret && ret.overdue) a.push({ tone: ret.overdue > 80 ? 'warn' : 'info', icon: 'retention', text: `${plural(ret.overdue, 'customer')} have overdue maintenance`, sub: 'Due for a week or more and not booked. Call them before they go elsewhere.', link: 'retention' });
  const appr = S.used.filter(u => u.status === 'appraisal');
  if (appr.length) a.push({ tone: 'warn', icon: 'used', text: `${plural(appr.length, 'used vehicle')} awaiting a disposition decision`, sub: 'Recondition, retail as-is, wholesale or auction.', link: 'used' });
  const wp = S.svc.ros.filter(r => r.status === 'parts');
  if (wp.length) a.push({ tone: 'warn', icon: 'parts', text: `${plural(wp.length, 'repair order')} waiting on parts`, sub: 'Customers are waiting. Check stock levels.', link: 'parts' });
  const ds = S.kpiCache.dsupply;
  if (ds < 30) a.push({ tone: 'bad', icon: 'car', text: `Low new inventory: ${Math.round(ds)} days supply`, sub: `${allocationLeft()} units of Aurex allocation left this month.`, act: 'openOrder' });
  else if (allocationLeft() > 10 && dparts(S.day).dom > 15) a.push({ tone: 'info', icon: 'car', text: `${allocationLeft()} units of allocation unused this month`, sub: 'Unused allocation can be lost and lowers next month\'s.', act: 'openOrder' });
  const risk = S.emps.filter(e => e.status !== 'gone' && e.morale < 38);
  if (risk.length) a.push({ tone: 'bad', icon: 'employees', text: `${plural(risk.length, 'employee')} at risk of resigning`, sub: risk.slice(0, 3).map(empName).join(', '), link: 'employees' });
  if (S.cash < 250000) a.push({ tone: 'bad', icon: 'dollar', text: `Cash is ${S.cash < 0 ? 'drawing on the credit line' : 'low'}: ${money(S.cash)}`, sub: `Bank line limit ${money(CREDIT_LINE)}. Interest accrues on any negative balance.`, link: 'finance' });
  const oldUsed = S.used.filter(u => u.status === 'available' && daysIn(u) > 60);
  if (oldUsed.length) a.push({ tone: 'warn', icon: 'used', text: `${plural(oldUsed.length, 'used unit')} over 60 days`, sub: 'Used values fall weekly. Reprice or wholesale.', link: 'used' });
  const leases = S.customers.filter(c => c.veh && c.veh.fin && c.veh.fin.type === 'lease' && c.status !== 'lost' && c.veh.fin.start + c.veh.fin.term * 30.44 - S.day < 60 && c.veh.fin.start + c.veh.fin.term * 30.44 > S.day).length;
  if (leases) a.push({ tone: 'info', icon: 'key', text: `${plural(leases, 'lease')} maturing in the next 60 days`, sub: 'Lease-end customers are your easiest repeat sales.', link: 'customers', filter: 'lease' });
  return a;
}

/* ---------------- Dashboard ---------------- */
VIEWS.dashboard = function () {
  const m = mtdStats(), pf = paceFactor(), ret = S.kpiCache.ret;
  const csiS = kpiSalesCsi(), csiV = kpiServiceCsi();
  const ds = S.kpiCache.dsupply, morale = S.kpiCache.morale;
  const t = S.oem.targets.units, done = S.oem.mtdNew;
  const dailyCash = S.fin.daily.slice(-30).map(d => d.cash);
  const intro = S.flags.intro ? `<section class="intro">
    <div class="intro-text"><h2>Welcome, General Manager</h2>
      <p>You now run ${esc(S.dealerName)}: ${S.inv.filter(v => v.status === 'available').length} new units on the ground, ${S.used.length} used, ${S.emps.filter(e => e.status !== 'gone').length} staff and ${num(S.customers.length)} customers on file. The previous GM lost money three months running; Aurex expects ${t} new sales this month.</p>
      <ol class="steps"><li><b>Stock the lot.</b> ${S.inv.filter(v => v.status === 'available').length} new units won't last a month. ${btnLink('Order from Aurex', 'openOrder')}</li><li><b>Work deals.</b> Customers walk into the ${btnLink('showroom', 'go', 'showroom')} through the day. Take the ones you want; your team handles the rest at closing.</li><li><b>Keep them for life.</b> Service retention drives long-term profit. See ${btnLink('Retention', 'go', 'retention')}.</li><li><b>The clock is running.</b> Customers walk in through the day. Change speed or pause at the top; decisions and the deal desk pause it for you.</li></ol></div>
    <button class="btn ghost sm" data-act="dismissIntro" type="button">${icon('x')}<span>Dismiss</span></button></section>` : '';
  const kp = [
    kpi('Cash', money(S.cash), `Credit line ${moneyK(CREDIT_LINE)} available`, { tone: S.cash < 250000 ? 'bad' : '', spark: sparkline(dailyCash), link: 'finance' }),
    kpi('Revenue MTD', moneyK(m.rev), `On pace for ${moneyK(m.rev * pf)} ${m.pRev != null ? delta(m.rev * pf, m.pRev, { pace: 1 }) : ''}`, { link: 'finance' }),
    kpi('Gross profit MTD', moneyK(m.gross), `On pace for ${moneyK(m.gross * pf)} ${m.pGross != null ? delta(m.gross * pf, m.pGross, { pace: 1 }) : ''}`, { link: 'finance' }),
    kpi('Vehicles sold', `${m.retail}`, `${m.L.units.new} new · ${m.L.units.used} used${m.L.units.wholesale ? ` · ${m.L.units.wholesale} wholesale` : ''}`, { link: 'showroom' }),
    kpi('New gross / unit', money(m.newGpu), m.pNewGpu != null ? `Last month ${money(m.pNewGpu)} ${m.L.units.new ? delta(m.newGpu, m.pNewGpu) : ''}` : 'Front-end incl. holdback', { tone: m.L.units.new && m.newGpu < 1200 ? 'warn' : '' }),
    kpi('Used gross / unit', money(m.usedGpu), m.pUsedGpu != null ? `Last month ${money(m.pUsedGpu)} ${m.L.units.used ? delta(m.usedGpu, m.pUsedGpu) : ''}` : 'Retail only', { link: 'used' }),
    kpi('F&I gross / unit', money(m.pvr), m.pPvr != null ? `Last month ${money(m.pPvr)} ${m.retail ? delta(m.pvr, m.pPvr) : ''}` : 'Per retail unit (PVR)', {}),
    kpi('Service revenue', moneyK(m.svcRev), `${num(m.L.hours.cp + m.L.hours.warranty + m.L.hours.internal, 0)} hrs sold ${m.pSvcRev != null ? delta(m.svcRev * pf, m.pSvcRev, { pace: 1 }) : ''}`, { link: 'service' }),
    kpi('Parts revenue', moneyK(m.partsRev), `Fill rate ${pct(fillRate())} ${m.pPartsRev != null ? delta(m.partsRev * pf, m.pPartsRev, { pace: 1 }) : ''}`, { link: 'parts' }),
    kpi('CSI', `${Math.round(csiS)} <small>/ ${Math.round(csiV)}</small>`, 'Sales / service, rolling', { tone: Math.min(csiS, csiV) < 78 ? 'warn' : '', tip: 'Customer satisfaction index from post-sale and post-service surveys (0–100). Aurex target: 84.' }),
    kpi('Customer retention', pct(ret.owner), `${num(ret.active)} active service customers`, { tone: ret.owner < 0.5 ? 'warn' : '', link: 'retention', tip: 'Share of customers who bought here and serviced here in the last 12 months.' }),
    kpi('Days supply', `${Math.round(ds)}`, `${S.inv.filter(v => v.status === 'available').length} on ground · ${S.inv.filter(v => v.status === 'transit').length} in transit`, { tone: ds < 30 || ds > 90 ? 'warn' : '', link: 'inventory' }),
    kpi('Employee morale', `${Math.round(morale)}`, `${S.emps.filter(e => e.status !== 'gone' && e.morale < 40).length} at risk`, { tone: morale < 50 ? 'warn' : '', link: 'employees' }),
    kpi('OEM target', `${done} <small>/ ${t}</small>`, bar(done / t, done >= t ? 'good' : 'accent', { mark: Math.min(1, (dparts(S.day).dom / daysInMonthOf(S.day))) }), { link: 'oem', tip: 'New units delivered this month against the Aurex objective. The tick marks where you should be today.' }),
  ].join('');
  const alerts = computeAlerts();
  const alertHtml = alerts.length ? `<ul class="alerts">${alerts.map(x => `<li class="alert alert-${x.tone}" ${x.link ? `data-act="go" data-to="${x.link}" ${x.filter ? `data-filter="${x.filter}"` : ''}` : x.act ? `data-act="${x.act}"` : ''} role="button" tabindex="0">
      <span class="alert-i">${icon(x.icon)}</span><span class="alert-t"><b>${esc(x.text)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span>${icon('right', 'alert-go')}</li>`).join('')}</ul>` : empty('Nothing urgent. Enjoy it while it lasts.', 'check');
  const todays = (S.today || []).slice().reverse();
  const todayHtml = todays.length ? `<ul class="feed">${todays.slice(0, 14).map(e => `<li class="feed-${tone(e.tone)}"><i></i><span>${esc(e.text)}</span></li>`).join('')}</ul>` : empty('Quiet morning so far.');
  // charts
  const d30 = S.fin.daily.slice(-30);
  const grossChart = colChart(d30.map(d => ({ label: fmtShort(d.d).replace(' ', ' '), value: d.gross, tip: `<b>${fmtDate(d.d, { dow: true })}</b><br>Gross ${money(d.gross)}<br>${plural(d.units, 'vehicle')} sold`, tone: d.gross < 0 ? 'bad' : null })), { fmt: moneyK, label: 'Daily gross profit', maxLabels: 6 });
  const ms = monthStartDay(S.day), dim = daysInMonthOf(S.day);
  const cum = [], tgt = [], labels = [];
  let run = 0;
  for (let i = 0; i < dim; i++) {
    const day = ms + i;
    labels.push(String(i + 1));
    run += S.deals.filter(x => x.day === day && x.kind === 'new').length;
    cum.push(day <= S.day ? run : null);
    tgt.push(round2(t * (i + 1) / dim));
  }
  const paceChart = lineChart([{ name: 'New units delivered', values: cum, color: '--series-1', area: true }, { name: 'Target pace', values: tgt, color: '--fg-3', dash: true }], labels, { fmt: v => num(v), label: 'Sales pace vs target', maxLabels: 8 });
  const deptItems = DEPTS.map(d => ({ label: d.label, value: stDeptGross(m.L, d.id) })).filter(x => x.value !== 0);
  // showroom & service glance
  const sr = visibleVisits().slice(0, 5);
  const srHtml = sr.length ? `<ul class="mini-list">${sr.map(v => { const c = cust(v.cid); return `<li><span><b>${esc(fullName(c))}</b><small>${esc(srcLabel(v.source))} · ${esc(CLS_LABEL[c.wantCls])} · ${v.time}</small></span>${btn('Work deal', 'negotiate', { id: v.id }, { cls: 'sm' })}</li>`; }).join('')}</ul>` : empty(dparts(S.day).dow === 0 ? 'Closed Sunday.' : 'No one waiting right now. Customers arrive through the day.');
  const ros = S.svc.ros, working = ros.filter(r => r.status === 'working').length;
  const svcHtml = `<div class="glance">
     <div><span class="muted">Open ROs</span><b>${ros.filter(r => r.pay !== 'internal').length}</b></div>
     <div><span class="muted">Recon in shop</span><b>${ros.filter(r => r.pay === 'internal').length}</b></div>
     <div><span class="muted">Waiting parts</span><b class="${ros.filter(r => r.status === 'parts').length ? 't-warn' : ''}">${ros.filter(r => r.status === 'parts').length}</b></div>
     <div><span class="muted">Next open appointment</span><b>${S.kpiCache.lead} day${S.kpiCache.lead === 1 ? '' : 's'}</b></div>
     <div><span class="muted">Techs present</span><b>${techs().filter(t => t.status === 'active' && !t.absent).length} / ${techs().length}</b></div>
     <div><span class="muted">Booked next 7 days</span><b>${num(sum([1, 2, 3, 4, 5, 6, 7], i => bookedHours(S.day + i)), 0)} h</b></div></div>`;
  return `${intro}
  <div class="kpis kpis-7">${kp}</div>
  <div class="grid g-2-1">
    ${panel('Urgent issues', alertHtml, { sub: `${alerts.length} item${alerts.length === 1 ? '' : 's'} need attention`, flush: true })}
    ${panel(`Today · ${DOW_LONG[dparts(S.day).dow]}`, todayHtml, { flush: true })}
  </div>
  <div class="grid g-3">
    ${panel('Daily gross profit', grossChart, { sub: 'Last 30 trading days' })}
    ${panel('New sales pace', paceChart, { sub: `${MONTHS_LONG[dparts(S.day).m]}: delivered vs Aurex objective` })}
    ${panel('Gross by department', barsH(deptItems, { fmt: moneyK }), { sub: 'Month to date' })}
  </div>
  <div class="grid g-2">
    ${panel('Showroom now', srHtml, { actions: btn('Open showroom', 'go', { to: 'showroom' }, { cls: 'sm ghost' }), flush: true })}
    ${panel('Service drive', svcHtml, { actions: btn('Open service', 'go', { to: 'service' }, { cls: 'sm ghost' }) })}
  </div>`;
};
function btnLink(label, act, to) { return `<a href="#" class="ilink" data-act="${act}" ${to ? `data-to="${to}"` : ''}>${esc(label)}</a>`; }

/* ---------------- Showroom ---------------- */
VIEWS.showroom = function () {
  const L = S.fin.mtd;
  const waiting = visibleVisits();
  const expected = S.showroom.filter(v => !v.shown).length;
  const team = present('sales');
  const cap = sum(team, e => e.skill > 72 ? 5 : 4) + (present('gsm').length ? 2 : 0);
  const close = L.ups ? L.sold / L.ups : 0;
  const leads = S.customers.filter(c => c.followUp != null).length;
  const booked = S.customers.filter(c => c.inMarket && c.inMarket.visit != null).length;
  const kp = [
    kpi('Waiting now', waiting.length, `Team capacity today: ${cap}`, { tone: waiting.length > cap ? 'bad' : '' }),
    kpi('Sold today', S.deals.filter(d => d.day === S.day).length, `${L.sold} this month`),
    kpi('Close rate', pct(close), `${num(L.ups)} ups this month`),
    kpi('Walked unattended', L.unattended, 'This month', { tone: L.unattended > 5 ? 'warn' : '' }),
    kpi('Follow-up leads', leads, `${booked} appointments booked`),
  ].join('');
  const cards = waiting.length ? waiting.map(v => visitorCard(v)).join('') : empty(dparts(S.day).dow === 0 ? 'The showroom is closed on Sundays.' : expected ? 'No one waiting right now. More customers will walk in as the day goes on.' : 'No more customers today. Advertising, reputation and inventory drive tomorrow\'s traffic.', 'showroom');
  const desk = S.settings.desk;
  const policy = `<div class="form">
    <label class="fl"><span>Pricing stance</span>${seg('desk.stance', [['hold', 'Hold gross', 'Start at sticker and concede slowly. Higher gross, fewer deals.'], ['market', 'Market', 'Price to market. Balanced.'], ['aggressive', 'Aggressive', 'Undercut market. More deals, thin gross.']], desk.stance)}</label>
    <label class="fl"><span>F&I menu push</span>${seg('desk.fiPush', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High', 'More product gross, lower CSI']], desk.fiPush)}</label>
    <label class="fl"><span>Rate markup over buy rate</span>${seg('desk.markup', [[0, '0%'], [0.5, '0.5%'], [1, '1.0%'], [1.5, '1.5%'], [2, '2.0%']], desk.markup)}</label>
    <label class="fl"><span>Trade appraisals</span>${seg('desk.trade', [['conservative', 'Conservative'], ['market', 'Market'], ['aggressive', 'Aggressive', 'Over-allow to win deals']], desk.trade)}</label>
    <label class="fl"><span>Advertising budget <b>${money(S.settings.ad)}/mo</b></span><input type="range" id="ad-budget" min="10000" max="120000" step="2000" value="${S.settings.ad}" data-chg="ad"></label>
    <p class="hint">Consultants follow these rules for every customer you don't work yourself.</p></div>`;
  const teamRows = [...present('sales'), ...present('gsm')].map(e => `<tr><td><b>${esc(empName(e))}</b><small class="muted block">${ROLES[e.role].short} · skill ${Math.round(e.skill)} · morale <span class="t-${moraleTone(e.morale)}">${Math.round(e.morale)}</span></small></td><td class="num">${e.mtd.ups}</td><td class="num">${e.mtd.units}</td><td class="num">${moneyK(e.mtd.gross)}</td></tr>`).join('');
  const absentSales = emps('sales').filter(e => e.absent || e.status === 'training');
  const deals = S.deals.slice(0, 25);
  const dealRows = deals.map(d => `<tr><td>${fmtShort(d.day)}</td><td><a href="#" data-act="openCustomer" data-id="${d.cid}">${esc(d.name)}</a>${d.repeat ? ' ' + chip('Repeat', 'chip-good') : ''}</td><td><span class="mono">${esc(d.stock)}</span> ${esc(d.veh)}${d.trade ? `<small class="muted block">Trade: ${esc(d.trade)}</small>` : ''}</td><td>${esc(d.type === 'fleet' ? 'Fleet' : d.type[0].toUpperCase() + d.type.slice(1))}${d.pmt ? `<small class="muted block">${money(d.pmt)}/mo · ${d.term} mo</small>` : ''}</td><td class="num">${money(d.front)}</td><td class="num">${money(d.back + d.acc)}</td><td class="num"><b>${money(d.total)}</b></td><td class="num">${d.csi == null ? '—' : d.csi}</td><td>${esc(d.by)}</td></tr>`).join('');
  return `<div class="kpis kpis-5">${kp}</div>
  <div class="grid g-2-1">
    <div class="stack">${panel('Customers in the showroom', `<div class="visitors">${cards}</div>`, { sub: 'Work a deal yourself, or assign it to a consultant now. Anyone left at closing is worked by the team automatically.' })}</div>
    <div class="stack">${panel('Desk policy', policy)}
      ${panel('Sales team today', `<div class="tablewrap"><table class="t"><thead><tr><th>Consultant</th><th class="num">Ups</th><th class="num">Units</th><th class="num">Gross</th></tr></thead><tbody>${teamRows || '<tr><td colspan="4">No consultants present.</td></tr>'}</tbody></table></div>${absentSales.length ? `<p class="hint">${absentSales.map(e => esc(empName(e)) + (e.absent ? ' is out sick' : ' is in training')).join(' · ')}</p>` : ''}`, { flush: true })}</div>
  </div>
  ${panel('Recent deals', deals.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Date</th><th>Customer</th><th>Vehicle</th><th>Structure</th><th class="num">Front</th><th class="num">Back + acc.</th><th class="num">Total gross</th><th class="num">CSI</th><th>Sold by</th></tr></thead><tbody>${dealRows}</tbody></table></div>` : empty('No deals yet this game.'), { flush: true })}`;
};
function visitorCard(v) {
  const c = cust(v.cid);
  const tr = v.trade;
  const sm = sentimentForVisit(v);
  const consultants = present('sales').filter(e => (e.today || 0) < (e.skill > 72 ? 5 : 4));
  const want = `${v.vip ? chip('Asked for GM', 'chip-warn') + ' ' : ''}${chip(srcLabel(v.source))} ${chip(c.wantNew === 'used' ? 'Used' : c.wantNew === 'new' ? 'New' : 'New or used')} ${chip(CLS_LABEL[c.wantCls])}`;
  return `<article class="visitor ${v.state === 'negotiating' ? 'is-active' : ''}">
    <div class="visitor-h"><div class="avatar">${esc(c.fn[0] + (c.ln[0] || ''))}</div><div><h4>${esc(fullName(c))}</h4><small class="muted">Arrived ${v.time} · ${c.age} · ${esc(c.hh)}</small></div><div class="visitor-mood">${meter(sm.lvl, sm.tone)}<small>${sm.label}</small></div></div>
    <div class="chips">${want}</div>
    <dl class="facts">
      <div><dt>Target payment</dt><dd>${money(v.targetPmt)}/mo</dd></div>
      <div><dt>Credit</dt><dd>${creditTier(c.credit).n}</dd></div>
      <div><dt>Trade-in</dt><dd>${tr ? `${tr.spec.year} ${esc(tr.spec.make)} ${esc(tr.spec.model)}` : 'None'}</dd></div>
      <div><dt>Style</dt><dd>${NEG_STYLES[c.style].label}</dd></div>
    </dl>
    <div class="visitor-a">${btn('Work this deal', 'negotiate', { id: v.id }, { cls: 'primary sm', icon: 'deal' })}
      ${consultants.length ? `<select class="sel sm" data-chg="assign" data-id="${v.id}" aria-label="Assign to consultant"><option value="">Assign to…</option>${consultants.map(e => `<option value="${e.id}">${esc(empName(e))} (skill ${Math.round(e.skill)})</option>`).join('')}</select>` : '<small class="muted">No consultant free</small>'}</div>
  </article>`;
}
function sentimentForVisit(v) {
  const m = v.mood;
  if (m >= 75) return { lvl: 5, tone: 'good', label: 'Upbeat' }; if (m >= 62) return { lvl: 4, tone: 'good', label: 'Relaxed' };
  if (m >= 48) return { lvl: 3, tone: 'warn', label: 'Guarded' }; if (m >= 32) return { lvl: 2, tone: 'bad', label: 'Impatient' };
  return { lvl: 1, tone: 'bad', label: 'Annoyed' };
}
function assignVisit(wid, eid) {
  const v = S.showroom.find(x => x.id === wid), e = empById(eid);
  if (!v || !e) return;
  e.today = (e.today || 0) + 1; e.mtd.ups++;
  const before = S.deals.length;
  autoWork(v, e);
  S.showroom = S.showroom.filter(x => x !== v);
  const c = cust(v.cid);
  if (S.deals.length > before) { const d = S.deals[0]; toast(`${empName(e)} sold ${fullName(c)} a ${d.veh} — ${money(d.total)} gross.`, 'good'); }
  else toast(`${empName(e)} couldn't close ${fullName(c)}. Added to follow-up leads.`, 'info');
}

/* ---------------- Deal desk (negotiation) ---------------- */
function openNegotiation(wid) {
  const v = S.showroom.find(x => x.id === wid);
  if (!v) return;
  stopPlay();
  const c = cust(v.cid);
  v.state = 'negotiating';
  if (!v.log.length) {
    const concern = primaryConcern(c);
    v.log.push({ who: 'customer', text: `Hi. I'm looking at a ${c.wantNew === 'used' ? 'good used' : c.wantNew === 'new' ? 'new' : ''} ${CLS_LABEL[c.wantCls].toLowerCase()}${concern ? `, and ${concern}` : ''}. I'd like to stay around ${money(v.targetPmt)} a month.` });
    if (v.trade) v.log.push({ who: 'customer', text: `I'd be trading in my ${v.trade.spec.year} ${v.trade.spec.make} ${v.trade.spec.model}${v.trade.payoff > 0 ? ` — I still owe about ${moneyK(v.trade.payoff)} on it` : ''}.` });
  }
  const best = rankVehicles(v, 1)[0];
  UI.neg = { wid, deal: best ? defaultDeal(v, best.v) : null, filter: 'all', done: null, suggest: null };
  UI.modal = 'neg';
  render();
}
function primaryConcern(c) {
  const p = [['reliability is the big thing for me', c.rel], ['I want something fun to drive', c.perf * 0.9], ['fuel economy really matters', c.eff], ['I want the latest tech', c.tech * 0.95], ['price matters most', c.priceSens * 0.9]];
  p.sort((a, b) => b[1] - a[1]);
  return p[0][1] > 0.55 ? p[0][0] : '';
}
function concernLabel(c) {
  const p = [['Reliability', c.rel], ['Performance', c.perf * 0.9], ['Fuel efficiency', c.eff], ['Technology', c.tech * 0.95], ['Price', c.priceSens * 0.9]];
  p.sort((a, b) => b[1] - a[1]); return p[0][0];
}
function negVisit() { return UI.neg && S.showroom.find(x => x.id === UI.neg.wid); }

function renderNegotiation() {
  const v = negVisit(); if (!v) return '';
  const c = cust(v.cid), N = UI.neg;
  if (N.done) return negDone(v, c);
  const d = N.deal;
  const veh = d ? vehById(d.vid) : null;
  const left = negCustomerPane(v, c);
  const center = `<div class="neg-col neg-center">${negVehiclePicker(v)}${veh ? negWorksheet(v, d, veh) : empty('No vehicles in stock match. Order inventory.')}</div>`;
  const right = `<div class="neg-col neg-right" id="neg-live">${veh ? negLive(v, d) : ''}</div>`;
  return `<div class="modal-h neg-h"><div><span class="eyebrow">Deal desk · ${esc(srcLabel(v.source))}</span><h2>${esc(fullName(c))}</h2></div>
    <button class="icon-btn" data-act="closeNeg" aria-label="Close deal desk">${icon('x')}</button></div>
    <div class="neg">${left}${center}${right}</div>`;
}
function negCustomerPane(v, c) {
  const tr = v.trade;
  const prefs = [['Price sensitivity', c.priceSens], ['Reliability', c.rel], ['Performance', c.perf], ['Fuel efficiency', c.eff], ['Technology', c.tech], ['Dealer loyalty', c.dealerLoy]];
  const tradeBox = tr ? `<div class="trade">
      <div class="trade-h"><b>${tr.spec.year} ${esc(tr.spec.make)} ${esc(tr.spec.model)}</b><small class="muted">${kmf(tr.spec.km)}</small></div>
      ${v.appraised ? `<dl class="facts f2">
        <div><dt>Condition</dt><dd>${stars(tr.spec.cond)} ${condLabel(tr.spec.cond)}</dd></div>
        <div><dt>Accident history</dt><dd>${tr.spec.acc === 'none' ? 'None reported' : tr.spec.acc === 'minor' ? 'Minor' : 'Major'}</dd></div>
        <div><dt>Actual cash value</dt><dd><b>${money(tr.acv)}</b></dd></div>
        <div><dt>Est. reconditioning</dt><dd>${money(tr.recon)}</dd></div>
        <div><dt>Retail after recon</dt><dd>${money(usedRetail({ ...tr.spec, cond: reconCond(tr.spec) }))}</dd></div>
        <div><dt>Loan payoff</dt><dd>${money(tr.payoff)}</dd></div>
        <div><dt>Equity at ACV</dt><dd class="${tr.acv - tr.payoff < 0 ? 't-bad' : 't-good'}">${money(tr.acv - tr.payoff)}</dd></div></dl>`
      : `<p class="muted small">Not appraised yet. The used manager can walk it now.</p>${btn('Appraise trade', 'negAppraise', {}, { cls: 'sm', icon: 'search' })}`}
    </div>` : '<p class="muted small">No trade-in.</p>';
  const log = v.log.slice(-6).map(m => `<div class="say say-${m.who}">${m.who === 'system' ? icon('info') : ''}<span>${esc(m.text)}</span></div>`).join('');
  return `<div class="neg-col neg-left">
    <div class="cust-card"><div class="avatar lg">${esc(c.fn[0] + (c.ln[0] || ''))}</div><div><b>${esc(fullName(c))}</b><small class="muted block">${c.age} · ${esc(c.hh)} · ${moneyK(c.inc)} income</small></div></div>
    <dl class="facts f2">
      <div><dt>Credit score</dt><dd>${c.credit} <small class="muted">${creditTier(c.credit).n}</small></dd></div>
      <div><dt>Target payment</dt><dd>${money(v.targetPmt)}/mo</dd></div>
      <div><dt>Cash to put down</dt><dd>${c.cashBuyer ? 'Can pay cash' : '~' + moneyK(c.cashAvail)}</dd></div>
      <div><dt>Primary concern</dt><dd>${concernLabel(c)}</dd></div>
      <div><dt>Negotiation</dt><dd>${NEG_STYLES[c.style].label} <small class="muted">(${NEG_STYLES[c.style].difficulty.toLowerCase()})</small></dd></div>
      <div><dt>History here</dt><dd>${c.veh && c.veh.fromUs ? 'Bought here' : c.svc.visits ? c.svc.visits + ' service visits' : 'New to us'}</dd></div>
    </dl>
    <h5>What they're saying</h5><div class="dialog">${log}</div>
    <h5>Trade-in</h5>${tradeBox}
    <h5>Preferences</h5><div class="prefs">${prefs.map(([l, x]) => `<div><span>${l}</span>${bar(x, 'accent')}</div>`).join('')}</div>
  </div>`;
}
function negVehiclePicker(v) {
  const N = UI.neg, c = cust(v.cid);
  let list = rankVehicles(v, 60);
  if (N.filter === 'new') list = list.filter(x => x.v.kind === 'new'); else if (N.filter === 'used') list = list.filter(x => x.v.kind === 'used');
  list = list.slice(0, 12);
  const items = list.map(({ v: x, fit }) => {
    const [fl, ft] = fitLabel(fit);
    const sel = N.deal && N.deal.vid === x.id;
    return `<button type="button" class="vpick ${sel ? 'on' : ''} ${N.suggest === x.id ? 'suggest' : ''}" data-act="negVeh" data-id="${x.id}">
      <span class="vp-name">${esc(vehName(x, true))}</span>
      <span class="vp-meta"><span class="mono">${x.stock}</span> · ${x.kind === 'new' ? 'New' : kmf(x.km)} · ${daysIn(x)}d</span>
      <span class="vp-price">${money(startPrice(x))}</span>${pill(fl, ft)}</button>`;
  }).join('');
  return `<div class="vpicker"><div class="vp-head"><h5>Vehicle</h5>${seg('negFilter', [['all', 'All'], ['new', 'New'], ['used', 'Used']], N.filter, { act: 'negFilter', cls: 'sm' })}</div>
    <div class="vp-list">${items || '<p class="muted small">Nothing in stock for this filter.</p>'}</div></div>`;
}
function negWorksheet(v, d, veh) {
  const c = cust(v.cid), r = evalDeal(v, d), isNew = veh.kind === 'new';
  const pMin = roundTo(isNew ? veh.invoice * 0.96 : (veh.cost + veh.reconCost) * 0.95, 50), pMax = roundTo(isNew ? veh.msrp + 1500 : veh.ask * 1.1, 50);
  const tr = v.trade, tMax = tr ? roundTo(Math.max(tr.acv * 1.4, tr.expect * 1.2), 100) : 0;
  const dMax = roundTo(Math.max(5000, c.cashBuyer ? r.totalDue : c.cashAvail * 2), 250);
  const terms = d.type === 'lease' ? [24, 36, 48] : [36, 48, 60, 72, 84, 96];
  const sticker = isNew ? `<div class="sticker">
      <div class="st-h"><b>${esc(vehName(veh))}</b><span class="mono">${veh.stock}</span></div>
      <div class="st-g"><span>${esc(veh.eng)} · ${veh.dr}</span><span>${esc(veh.ext)} / ${esc(veh.int)}</span><span>${daysIn(veh)} days in stock</span></div>
      <div class="st-n"><div><small>MSRP</small><b>${money(veh.msrp)}</b></div><div><small>Market</small><b>${money(newMarketValue(veh))}</b></div><div><small>Invoice</small><b>${money(veh.invoice)}</b></div><div><small>Incentive</small><b>${r.inc ? money(r.inc) : '—'}</b></div></div></div>`
    : `<div class="sticker used">
      <div class="st-h"><b>${esc(vehName(veh))}</b><span class="mono">${veh.stock}</span></div>
      <div class="st-g"><span>${kmf(veh.km)}</span><span>${stars(veh.cond)} ${condLabel(veh.cond)}</span><span>${veh.acc === 'none' ? 'No accidents' : veh.acc + ' accident'}</span><span>${veh.recon === 'as-is' ? 'Sold as-is' : 'Reconditioned'}</span></div>
      <div class="st-n"><div><small>Asking</small><b>${money(veh.ask)}</b></div><div><small>Market</small><b>${money(usedRetail(veh))}</b></div><div><small>Total cost</small><b>${money(veh.cost + veh.reconCost)}</b></div><div><small>Days</small><b>${daysIn(veh)}</b></div></div></div>`;
  return `${sticker}
  <div class="foursq">
    <div class="sq"><label for="neg-price">Selling price</label><input class="num-in" type="number" id="neg-price" data-neg="price" value="${d.price}" step="50" min="${pMin}" max="${pMax}"><input type="range" id="neg-price-r" data-neg="price" min="${pMin}" max="${pMax}" step="50" value="${clamp(d.price, pMin, pMax)}" aria-label="Selling price slider"><small class="muted">${isNew ? `${money(veh.msrp - d.price)} off MSRP` : `${money(veh.ask - d.price)} off asking`}</small></div>
    <div class="sq ${tr ? '' : 'disabled'}"><label for="neg-trade">Trade allowance</label><input class="num-in" type="number" id="neg-trade" data-neg="trade" value="${d.trade}" step="100" min="0" max="${tMax}" ${tr ? '' : 'disabled'}><input type="range" id="neg-trade-r" data-neg="trade" min="0" max="${tMax || 1}" step="100" value="${d.trade}" ${tr ? '' : 'disabled'} aria-label="Trade allowance slider"><small class="muted">${tr ? (v.appraised ? `${signed(d.trade - tr.acv)} vs ACV` : 'Appraise to see ACV') : 'No trade'}</small></div>
    <div class="sq"><label for="neg-down">${d.type === 'cash' ? 'Cash deal' : 'Down payment'}</label>${d.type === 'cash' ? `<div class="big">${money(r.totalDue)}</div><small class="muted">Total due on delivery</small>` : `<input class="num-in" type="number" id="neg-down" data-neg="down" value="${d.down}" step="250" min="0" max="${dMax}"><input type="range" id="neg-down-r" data-neg="down" min="0" max="${dMax}" step="250" value="${clamp(d.down, 0, dMax)}" aria-label="Down payment slider"><small class="muted">They have about ${moneyK(c.cashAvail)}</small>`}</div>
    <div class="sq sq-pay"><label>Monthly payment</label><div class="big" id="neg-pmt">${d.type === 'cash' ? '—' : money(r.pmt)}</div>
      ${seg('negType', [['finance', 'Finance'], ['lease', 'Lease'], ['cash', 'Cash']], d.type, { act: 'negType', cls: 'sm' })}
      ${d.type !== 'cash' ? `<div class="row2"><label class="mini">Term<select class="sel sm" id="neg-term" data-neg="term">${terms.map(t => `<option value="${t}" ${t === d.term ? 'selected' : ''}>${t} mo</option>`).join('')}</select></label>
      <label class="mini">${d.type === 'lease' ? 'Rate (APR equiv.)' : 'APR'}<input class="num-in sm" type="number" id="neg-rate" data-neg="rate" step="0.1" min="0" max="29.9" value="${d.rate}"></label></div><small class="muted" id="neg-buy">Buy rate ${r.br.toFixed(2)}% · markup ${r.markup.toFixed(2)}%</small>` : ''}
    </div>
  </div>
  <div class="addons">
    <div><h5>Accessories</h5>${ACCESSORIES.map(a => `<label class="chk"><input type="checkbox" data-negchk="acc" value="${a.id}" ${d.acc.includes(a.id) ? 'checked' : ''}><span>${esc(a.name)}</span><b>${money(a.price)}</b></label>`).join('')}</div>
    <div><h5>Protection products</h5>${PRODUCTS.map(p => { const off = p.program && !S.programs[p.program]; return `<label class="chk ${off ? 'off' : ''}" ${off ? 'data-tip="Enable the Prepaid maintenance program on the Retention page first."' : ''}><input type="checkbox" data-negchk="prod" value="${p.id}" ${d.prod.includes(p.id) ? 'checked' : ''} ${off || d.type === 'cash' ? 'disabled' : ''}><span>${esc(p.name)}</span><b>${money(p.price)}</b></label>`; }).join('')}</div>
  </div>`;
}
function negLive(v, d) {
  const r = evalDeal(v, d), s = sentiment(r.prob), cs = csiLabel(r.csi), c = cust(v.cid);
  const reasons = [];
  if (!r.approved) reasons.push(['bad', d.type === 'lease' && r.v.kind === 'used' ? 'Used vehicles cannot be leased' : 'Lender will not approve this structure']);
  if (d.type !== 'cash' && r.pmt > r.target * 1.03) reasons.push(['bad', `Payment is about ${money(r.pmt - r.target)} over their target`]);
  else if (d.type !== 'cash' && r.pmt < r.target * 0.92) reasons.push(['good', 'Payment is comfortably inside their budget']);
  if (r.gap > 0.012) reasons.push(['warn', 'They think the price is high for this vehicle']);
  else if (r.gap < -0.015) reasons.push(['good', 'They see the price as a good deal']);
  if (v.trade && d.trade < v.trade.expect * 0.95) reasons.push(['warn', 'Disappointed by the trade value']);
  if (r.fit < 0.5) reasons.push(['warn', 'Not really the vehicle they want']);
  else if (r.fit >= 0.8) reasons.push(['good', 'Likes this vehicle']);
  if (r.cashNeeded > c.cashAvail * (c.cashBuyer ? 14 : 1.15)) reasons.push(['bad', 'More cash up front than they have']);
  if (d.type !== 'cash' && r.markup > 1 && c.credit >= 700 && (c.style === 'researcher' || c.style === 'hardball')) reasons.push(['warn', 'Knows rates — noticing the markup']);
  if (v.rounds >= 3) reasons.push(['warn', 'Getting tired of the back-and-forth']);
  const gsm = present('gsm')[0];
  return `<div class="read read-${s.tone}"><span class="eyebrow">Customer read</span><div class="read-main">${meter(s.lvl, s.tone)}<b>${s.label}</b></div>
      <ul class="reasons">${reasons.slice(0, 5).map(([t, x]) => `<li class="t-${t}">${esc(x)}</li>`).join('') || '<li class="muted">Weighing it up</li>'}</ul>
      <div class="patience"><span class="muted">Patience</span>${[...Array(Math.max(0, v.patience))].map(() => '<i></i>').join('')}</div></div>
    <dl class="recap">
      <div><dt>Selling price</dt><dd>${money(d.price)}</dd></div>
      ${r.inc ? `<div><dt>Incentive / rebate</dt><dd>−${money(r.inc)}</dd></div>` : ''}
      <div><dt>Doc fee</dt><dd>${money(DOC_FEE)}</dd></div>
      ${r.accT ? `<div><dt>Accessories</dt><dd>${money(r.accT)}</dd></div>` : ''}
      ${v.trade ? `<div><dt>Trade allowance</dt><dd>−${money(d.trade)}</dd></div><div><dt>Loan payoff</dt><dd>${money(r.payoff)}</dd></div>` : ''}
      <div><dt>Sales tax</dt><dd>${money(r.tax)}</dd></div>
      ${r.prodT ? `<div><dt>Protection</dt><dd>${money(r.prodT)}</dd></div>` : ''}
      ${d.type !== 'cash' ? `<div><dt>Down payment</dt><dd>−${money(d.down)}</dd></div><div class="tot"><dt>${d.type === 'lease' ? 'Cap cost' : 'Amount financed'}</dt><dd>${money(r.af)}</dd></div>
      <div class="tot big"><dt>Payment</dt><dd>${money(r.pmt)}<small>/mo × ${d.term}</small></dd></div>` : `<div class="tot big"><dt>Total due</dt><dd>${money(r.totalDue)}</dd></div>`}
    </dl>
    <dl class="recap gross">
      <div><dt>Front gross</dt><dd class="${r.front < 0 ? 't-bad' : ''}">${money(r.front)}</dd></div>
      <div><dt>F&I gross</dt><dd>${money(r.back)}</dd></div>
      ${r.accG ? `<div><dt>Accessory gross</dt><dd>${money(r.accG)}</dd></div>` : ''}
      <div class="tot"><dt>Total dealer gross</dt><dd class="${r.total < 0 ? 't-bad' : 't-good'}">${money(r.total)}</dd></div>
      <div><dt>Satisfaction impact</dt><dd>${pill(cs.label, cs.tone)}</dd></div>
    </dl>
    <div class="neg-actions">
      ${btn('Present offer', 'negPresent', {}, { cls: 'primary', icon: 'deal' })}
      ${v.counter ? btn('Accept their counter', 'negAcceptCounter', {}, { cls: 'good', icon: 'check', tip: v.counter.text }) : ''}
      <div class="row2">${btn('Test drive', 'negTD', {}, { cls: 'ghost sm', disabled: v.td, icon: 'car' })}${btn('Bring in GSM', 'negTO', {}, { cls: 'ghost sm', disabled: v.to || !gsm, icon: 'user', tip: gsm ? `Turn the deal over to ${empName(gsm)}` : 'No GSM on staff today' })}</div>
      ${btn('Hand to the sales team', 'closeNeg', {}, { cls: 'ghost sm' })}
    </div>`;
}
function negDone(v, c) {
  const D = UI.neg.done;
  if (D.lost) {
    return `<div class="modal-h"><div><span class="eyebrow">Deal desk</span><h2>${esc(fullName(c))} left</h2></div><button class="icon-btn" data-act="closeNeg" aria-label="Close">${icon('x')}</button></div>
    <div class="modal-b"><div class="done done-bad">${icon('x')}<div><h3>${esc(D.text)}</h3><p class="muted">${D.comp ? 'They are likely to buy from a competitor within days.' : 'They may come back. A follow-up is scheduled with your team.'}</p></div></div>
    <div class="modal-f">${btn('Back to showroom', 'closeNeg', {}, { cls: 'primary' })}</div></div>`;
  }
  const { deal, r, csi } = D;
  return `<div class="modal-h"><div><span class="eyebrow">Deal desk</span><h2>Sold — ${esc(deal.veh)}</h2></div><button class="icon-btn" data-act="closeNeg" aria-label="Close">${icon('x')}</button></div>
  <div class="modal-b"><div class="done done-good">${icon('check')}<div><h3>${esc(fullName(c))}: “${esc(pick(LINES.accept))}”</h3><p class="muted">${deal.type === 'cash' ? 'Cash purchase' : `${deal.type === 'lease' ? 'Lease' : 'Finance'} at ${money(deal.pmt)}/month for ${deal.term} months`}${deal.trade ? ` · trade-in ${esc(deal.trade)} sent to the used department` : ''}.</p></div></div>
    <div class="kpis kpis-4">${kpi('Front gross', money(deal.front))}${kpi('F&I gross', money(deal.back))}${kpi('Total gross', money(deal.total), '', { tone: deal.total > 0 ? 'good' : 'bad' })}${kpi('Delivery survey', String(csi), csi >= 85 ? 'Delighted customer' : csi >= 75 ? 'Satisfied' : 'Unhappy — expect weaker loyalty', { tone: csi >= 80 ? 'good' : csi >= 70 ? 'warn' : 'bad' })}</div>
    <div class="modal-f">${btn('Back to showroom', 'closeNeg', {}, { cls: 'primary' })}</div></div>`;
}
function negUpdateLive() {
  const v = negVisit(); if (!v || !UI.neg.deal) return;
  const el = document.getElementById('neg-live'); if (el) el.innerHTML = negLive(v, UI.neg.deal);
  const r = evalDeal(v, UI.neg.deal);
  const p = document.getElementById('neg-pmt'); if (p) p.textContent = UI.neg.deal.type === 'cash' ? '—' : money(r.pmt);
  const b = document.getElementById('neg-buy'); if (b) b.textContent = `Buy rate ${r.br.toFixed(2)}% · markup ${r.markup.toFixed(2)}%`;
}
function negPresent() {
  const v = negVisit(), N = UI.neg; if (!v || !N.deal) return;
  const c = cust(v.cid);
  const res = presentOffer(v, N.deal);
  if (res.res === 'declined') { v.log.push({ who: 'system', text: res.text }); }
  else if (res.res === 'accept') { v.log.push({ who: 'customer', text: pick(LINES.accept) }); N.done = finalizeSale(v, N.deal, null, 'manual'); }
  else if (res.res === 'counter') { v.log.push({ who: 'customer', text: res.text }); }
  else if (res.res === 'another') { v.log.push({ who: 'customer', text: res.text }); N.suggest = res.alt.id; }
  else if (res.res === 'stall') { v.log.push({ who: 'customer', text: res.text }); }
  else if (res.res === 'leave' || res.res === 'competitor') {
    v.log.push({ who: 'customer', text: res.text });
    v.state = 'left';
    if (res.res === 'competitor') { c.inMarket = { since: S.day, until: S.day + 10, us: false, comp: S.day + randi(1, 4) }; S.fin.mtd.lost++; addHist(c, 'visit', 'Walked out of negotiation, shopping competitors', null); }
    else lostVisit(v, 'Left to think it over', null);
    c.sat = clamp(c.sat - 4, 0, 100);
    N.done = { lost: true, text: res.text, comp: res.res === 'competitor' };
  }
  render();
}
