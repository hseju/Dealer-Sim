'use strict';
/* =====================================================================
   Dealer Empire — Finance, OEM, Market, Retention, Group, report modals
   ===================================================================== */

/* ---------------- Finance ---------------- */
function plTable(A, B, C, labels) {
  const row = (label, f, opt = {}) => {
    const a = f(A), b = B ? f(B) : null, c = C ? f(C) : null;
    const chg = b != null ? a - b : null;
    const good = opt.inverse ? chg < 0 : chg > 0;
    return `<tr class="${opt.cls || ''}"><td>${label}</td><td class="num">${money(a)}</td><td class="num">${b == null ? '—' : money(b)}</td><td class="num ${chg == null || Math.abs(chg) < 1 ? '' : good ? 't-good' : 't-bad'}">${chg == null ? '—' : signed(Math.round(chg))}</td><td class="num">${c == null ? '—' : money(c)}</td></tr>`;
  };
  const sec = t => `<tr class="sec"><td colspan="5">${t}</td></tr>`;
  const avgL = C;
  let h = `<table class="t pl"><thead><tr><th></th><th class="num">${labels[0]}</th><th class="num">${labels[1]}</th><th class="num">Change</th><th class="num">${labels[2]}</th></tr></thead><tbody>`;
  h += sec('Revenue');
  for (const d of DEPTS) if (A.rev[d.id] || (B && B.rev[d.id])) h += row(d.label, L => L.rev[d.id]);
  h += row('Total revenue', stRevenue, { cls: 'tot' });
  h += sec('Gross profit');
  for (const d of DEPTS) if (A.rev[d.id] || A.cogs[d.id] || (B && (B.rev[d.id] || B.cogs[d.id]))) h += row(`${d.label} <small class="muted">${A.rev[d.id] ? pct((A.rev[d.id] - A.cogs[d.id]) / A.rev[d.id]) : ''}</small>`, L => L.rev[d.id] - L.cogs[d.id]);
  h += row('Total gross profit', stGross, { cls: 'tot' });
  h += sec('Operating expenses');
  for (const [k, l] of Object.entries(EXPENSE_LABELS)) if (A.exp[k] || (B && B.exp[k])) h += row(l, L => L.exp[k], { inverse: true });
  h += row('Total operating expenses', stExpenses, { cls: 'tot', inverse: true });
  h += row('<b>Net profit</b>', statementNet, { cls: 'net' });
  h += sec('Cash');
  h += row('Cash at start', L => L.cashStart);
  h += row('Cash at end', L => (L.cashEnd || S.cash));
  h += row('Net cash flow', L => (L.cashEnd || S.cash) - L.cashStart);
  h += `</tbody></table>`;
  return h;
}
function avgLedger(list) {
  if (!list.length) return null;
  const z = newLedger('avg');
  for (const L of list) { for (const d of DEPTS) { z.rev[d.id] += L.rev[d.id] / list.length; z.cogs[d.id] += L.cogs[d.id] / list.length; } for (const k of Object.keys(z.exp)) z.exp[k] += (L.exp[k] || 0) / list.length; z.cashStart += L.cashStart / list.length; z.cashEnd += (L.cashEnd || 0) / list.length; }
  return z;
}
VIEWS.finance = function () {
  const sel = UI.finMonth || 'mtd';
  const hist = S.fin.hist;
  const A = sel === 'mtd' ? S.fin.mtd : hist.find(h => h.key === sel) || S.fin.mtd;
  const idx = hist.indexOf(A);
  const B = sel === 'mtd' ? lastMonth() : hist[idx - 1];
  const prior3 = sel === 'mtd' ? hist.slice(-3) : hist.slice(Math.max(0, idx - 3), idx);
  const C = avgLedger(prior3);
  const months = hist.slice(-12);
  const net = months.map(h => statementNet(h)), gross = months.map(h => stGross(h));
  const trend = lineChart([{ name: 'Gross profit', values: gross, color: '--series-1' }, { name: 'Net profit', values: net, color: '--series-2' }], months.map(h => monthLabel(h.key)), { fmt: moneyK, label: 'Monthly gross and net profit' });
  const cash = S.fin.daily.slice(-120);
  const cashChart = lineChart([{ name: 'Cash', values: cash.map(d => d.cash), color: '--accent', area: true }], cash.map(d => fmtShort(d.d)), { fmt: moneyK, zero: false, label: 'Daily cash balance', maxLabels: 6 });
  const deptItems = DEPTS.map(d => ({ label: d.label, value: stDeptGross(A, d.id), sub: A.rev[d.id] ? `${pct((A.rev[d.id] - A.cogs[d.id]) / A.rev[d.id])} of revenue` : '' })).filter(x => x.value);
  const fixedCoverage = (stDeptGross(A, 'labor') + stDeptGross(A, 'parts')) / Math.max(1, stExpenses(A));
  const kp = [
    kpi(sel === 'mtd' ? 'Revenue MTD' : 'Revenue', moneyK(stRevenue(A)), B ? `Previous ${moneyK(stRevenue(B))} ${delta(stRevenue(A) * (sel === 'mtd' ? paceFactor() : 1), stRevenue(B))}` : ''),
    kpi('Gross profit', moneyK(stGross(A)), `${pct(stGross(A) / Math.max(1, stRevenue(A)), 1)} of revenue`),
    kpi('Operating expenses', moneyK(stExpenses(A)), B ? `Previous ${moneyK(stExpenses(B))}` : ''),
    kpi('Net profit', moneyK(statementNet(A)), `${pct(statementNet(A) / Math.max(1, stRevenue(A)), 1)} return on sales`, { tone: statementNet(A) < 0 ? 'bad' : 'good' }),
    kpi('Fixed absorption', pct(fixedCoverage), 'Service + parts gross ÷ expenses', { tip: 'How much of the dealership\'s overhead is covered by service and parts gross. Strong stores aim for 70% or more so they survive slow sales months.' }),
    kpi('Cash', moneyK(S.cash), `Credit line ${moneyK(CREDIT_LINE)}`, { tone: S.cash < 0 ? 'bad' : '' }),
  ].join('');
  const opts = [['mtd', `${monthLabel(S.fin.mtd.key)} (MTD)`], ...hist.slice().reverse().map(h => [h.key, monthLabel(h.key) + (h.prior ? ' · prior GM' : '')])];
  return `<div class="kpis kpis-6">${kp}</div>
  <div class="grid g-2-1">
    ${panel('Income statement', `<div class="filters"><select class="sel" id="fin-month" data-chg="finMonth">${opts.map(([k, l]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${l}</option>`).join('')}</select><span class="muted">${A.prior ? 'Results under the previous general manager.' : sel === 'mtd' ? `${dparts(S.day).dom} of ${daysInMonthOf(S.day)} days` : ''}</span></div><div class="tablewrap">${plTable(A, B, C, [sel === 'mtd' ? 'This month' : monthLabel(A.key), B ? monthLabel(B.key) : 'Previous', '3-month avg'])}</div>`, { flush: true })}
    <div class="stack">
      ${panel('Gross & net profit', trend, { sub: 'Last 12 closed months' })}
      ${panel('Cash balance', cashChart, { sub: 'Daily, last 120 days' })}
      ${panel('Gross by department', barsH(deptItems, { fmt: moneyK }))}
      ${panel('Spending levers', `<div class="form"><label class="fl"><span>Advertising budget <b>${money(S.settings.ad)}/mo</b></span><input type="range" id="fin-ad" min="10000" max="120000" step="2000" value="${S.settings.ad}" data-chg="ad"><small class="muted">Drives showroom traffic with diminishing returns.</small></label><p class="hint">Payroll is managed on Employees, loaners and labour rates on Service, programs on Retention.</p></div>`)}
    </div>
  </div>`;
};

/* ---------------- OEM ---------------- */
VIEWS.oem = function () {
  const o = S.oem, t = o.targets, L = S.fin.mtd;
  const tier = standingTier();
  const pf = paceFactor();
  const evMix = o.mtdNew ? o.mtdEv / o.mtdNew : 0;
  const csi = (kpiSalesCsi() + kpiServiceCsi()) / 2;
  const obj = [
    { label: 'New vehicle sales', val: o.mtdNew, target: t.units, frac: o.mtdNew / t.units, text: `${o.mtdNew} / ${t.units}`, sub: `Pace ≈ ${Math.round(o.mtdNew * pf)} by month end`, ok: o.mtdNew * pf >= t.units },
    { label: 'Electrified sales mix', frac: evMix / t.ev, text: `${pct(evMix)} / ${pct(t.ev)}`, sub: `${o.mtdEv} EV and hybrid units`, ok: evMix >= t.ev },
    { label: 'Customer satisfaction', frac: csi / t.csi, text: `${Math.round(csi)} / ${t.csi}`, sub: 'Average of sales and service CSI', ok: csi >= t.csi },
    { label: 'Training completion', frac: trainingCompletion() / t.training, text: `${pct(trainingCompletion())} / ${pct(t.training)}`, sub: 'Staff holding an Aurex certification', ok: trainingCompletion() >= t.training, act: 'go', to: 'employees' },
    { label: 'Facility compliance', frac: o.facility / t.facility, text: `${o.facility}% / ${t.facility}%`, sub: 'Image program standard', ok: o.facility >= t.facility },
    { label: 'Inventory days supply', frac: Math.min(1, t.dsupply / Math.max(1, S.kpiCache.dsupply)), text: `${Math.round(S.kpiCache.dsupply)} / ≤${t.dsupply}`, sub: 'Lower is better', ok: S.kpiCache.dsupply <= t.dsupply },
  ];
  const objHtml = obj.map(x => `<div class="obj ${x.ok ? 'ok' : 'miss'}"><div class="obj-h"><b>${x.label}</b>${x.ok ? pill('On track', 'good', 'check') : pill('At risk', 'warn', 'alert')}</div><div class="obj-v">${x.text}</div>${bar(x.frac, x.ok ? 'good' : 'warn')}<small class="muted">${x.sub}</small></div>`).join('');
  const stair = o.stair.map(([r, amt]) => { const need = Math.ceil(t.units * r); const hit = o.mtdNew >= need; return `<div class="stair ${hit ? 'hit' : ''}"><b>${Math.round(r * 100)}%</b><span>${need} units</span><small>${money(amt)}/unit on every new sale</small><small class="muted">≈ ${money(amt * Math.max(need, o.mtdNew))}</small></div>`; }).join('');
  const incRows = MODELS.map(m => `<tr><td><b>${esc(m.name)}</b>${m.exclusive ? ' ' + chip('Exclusive', 'chip-warn') : ''}</td><td>${SEGMENTS[m.seg]}</td><td class="num">${o.incentives[m.id] ? money(o.incentives[m.id]) : '—'}</td><td>${demandPill(segDemand(m.seg))}</td><td class="num">${S.inv.filter(v => v.modelId === m.id && v.status === 'available').length}</td><td class="num">${pct(m.inv, 1)}</td></tr>`).join('');
  const histRows = o.hist.slice().reverse().map(h => `<tr><td>${monthLabel(h.key)}</td><td class="num">${h.units} / ${h.target}</td><td class="num">${pct(h.evMix)}</td><td class="num">${Math.round(h.csi)}</td><td class="num">${h.met} of 6</td><td class="num">${h.bonus ? money(h.bonus) : '—'}</td><td class="num">${h.standing}</td></tr>`).join('');
  const facCost = Math.round((100 - o.facility) * 11000 + 60000);
  return `<div class="grid g-1-2">
    ${panel('Standing with Aurex', `<div class="standing">${gauge(o.standing, 100, { text: o.standing, sub: tier.n, tone: tier.tone === 'bad' ? 'bad' : tier.tone === 'good' ? 'good' : 'accent', marks: [35, 60, 80], label: 'OEM standing' })}
      <ul class="tiers"><li class="${o.standing < 35 ? 'on' : ''}"><b>At risk</b> &lt;35 · reduced allocation, franchise review</li><li class="${o.standing >= 35 && o.standing < 60 ? 'on' : ''}"><b>Standard</b> 35–59 · base allocation</li><li class="${o.standing >= 60 && o.standing < 80 ? 'on' : ''}"><b>Preferred</b> 60–79 · bigger allocation, Volta GT from 68</li><li class="${o.standing >= 80 ? 'on' : ''}"><b>Elite</b> 80+ · priority allocation, more exclusives, higher targets</li></ul></div>`, { sub: 'Changes each month-end with objective results' })}
    ${panel(`${MONTHS_LONG[dparts(S.day).m]} objectives`, `<div class="objs">${objHtml}</div>`, { sub: 'Evaluated at month-end. Each objective met raises standing; misses lower it.' })}
  </div>
  <div class="grid g-2-1">
    ${panel('Stair-step volume bonus', `<div class="stairs">${stair}</div><p class="hint">Bonus is paid on every new unit delivered in the month once a step is reached. Fleet deals count.</p>`, { sub: `${o.mtdNew} new units delivered so far` })}
    ${panel('Allocation', `<dl class="facts f2"><div><dt>Monthly allocation</dt><dd>${o.alloc} units</dd></div><div><dt>Ordered this month</dt><dd>${o.ordered}</dd></div><div><dt>Remaining</dt><dd><b>${allocationLeft()}</b></dd></div><div><dt>Volta GT (exclusive)</dt><dd>${o.exclusiveAlloc}</dd></div></dl>${btn('Order vehicles', 'openOrder', {}, { cls: 'primary sm', icon: 'plus' })}`, { sub: 'Allocation grows with standing and shrinks during shortages' })}
  </div>
  <div class="grid g-2">
    ${panel('Model incentives this month', `<div class="tablewrap"><table class="t"><thead><tr><th>Model</th><th>Segment</th><th class="num">Customer cash</th><th>Demand</th><th class="num">In stock</th><th class="num">Invoice % MSRP</th></tr></thead><tbody>${incRows}</tbody></table></div>`, { flush: true })}
    <div class="stack">${panel('Facility compliance', `<div class="fac">${bar(o.facility / 100, o.facility >= 90 ? 'good' : 'warn')}<b>${o.facility}%</b></div><p class="hint">Aurex's image standard requires ${t.facility}%. Compliance slips about 1 point a month as standards change.</p>${btn(o.facility >= 99 ? 'Fully compliant' : `Upgrade facility — ${money(facCost)}`, 'upgradeFacility', {}, { cls: 'sm', disabled: o.facility >= 99 })}`)}
    ${panel('History', histRows ? `<div class="tablewrap"><table class="t compact"><thead><tr><th>Month</th><th class="num">Units</th><th class="num">Elec. mix</th><th class="num">CSI</th><th class="num">Objectives</th><th class="num">Bonus</th><th class="num">Standing</th></tr></thead><tbody>${histRows}</tbody></table></div>` : empty('First evaluation at month-end.'), { flush: true })}</div>
  </div>`;
};

/* ---------------- Market ---------------- */
VIEWS.market = function () {
  const m = S.mkt, h = m.hist;
  const sp = (k, c) => sparkline(h[k].slice(-120).map(x => x[1]), { color: c });
  const kp = [
    kpi('Prime rate', `${m.prime.toFixed(2)}%`, `Floorplan ${(floorplanRate() * 100).toFixed(2)}%`, { spark: sp('prime', '--series-1') }),
    kpi('Auto loan rate (Tier 1)', `${buyRate(740, 72, false).toFixed(2)}%`, '72-month new, lender buy rate'),
    kpi('Fuel price', `$${m.fuel.toFixed(2)}/L`, m.fuel > 1.75 ? 'High — truck demand soft' : m.fuel < 1.45 ? 'Low — trucks in favour' : 'Normal range', { spark: sp('fuel', '--series-2') }),
    kpi('Consumer confidence', Math.round(m.conf), m.conf < 50 ? 'Weak' : m.conf > 72 ? 'Strong' : 'Steady', { spark: sp('conf', '--series-1') }),
    kpi('EV demand index', m.ev.toFixed(2), 'Base 1.00', { spark: sp('ev', '--series-3') }),
    kpi('Used price index', m.usedIdx.toFixed(1), 'Base 100', { spark: sp('usedIdx', '--series-3') }),
  ].join('');
  const segItems = Object.keys(SEGMENTS).map(k => ({ label: SEGMENTS[k], value: round2(segDemand(k)), sub: segDemand(k) >= 1 ? 'Above normal' : 'Below normal' }));
  const events = m.events.length ? `<ul class="events">${m.events.map(e => `<li class="ev-${tone(e.tone)}"><b>${esc(e.title)}</b><span>${esc(e.text)}</span><small class="muted">${fmtShort(e.start)} – ${fmtShort(e.end)} · ${Math.max(0, e.end - S.day)} days left</small></li>`).join('')}${S.flags.recallActive ? `<li class="ev-warn"><b>Open recall: ${esc(S.flags.recallActive.model)}</b><span>${S.customers.filter(c => c.recall).length} affected vehicles still unrepaired.</span></li>` : ''}</ul>` : empty('No major market events right now.');
  const comps = S.comps.map(c => `<tr><td><b>${esc(c.name)}</b>${c.isNew ? ' ' + chip('New', 'chip-warn') : ''}</td><td>${{ dealer: 'Franchise dealer', used: 'Used superstore', indy: 'Independent repair', lube: 'Quick lube' }[c.type]}</td><td>${esc(c.brand)}</td><td class="num">${c.dist} km</td>
    <td class="num">${c.type === 'dealer' || c.type === 'used' ? (c.hist.length ? c.hist[c.hist.length - 1] : c.vol) : '—'}</td><td>${c.type === 'dealer' || c.type === 'used' ? bar(c.aggr, c.aggr > 0.7 ? 'bad' : c.aggr > 0.5 ? 'warn' : 'accent', { tip: 'Pricing aggression ' + pct(c.aggr) }) : '—'}</td>
    <td class="num">${c.svcRate ? money(c.type === 'indy' ? indyRate() : c.svcRate) + '/h' : '—'}${c.oil ? `<small class="muted block">Oil ${money(quickLubePrice())}</small>` : ''}</td><td>${c.campaign && c.campaign.until >= S.day ? pill(c.campaign.matched ? 'Campaign (countered)' : 'Discount campaign', c.campaign.matched ? 'neutral' : 'bad') : '—'}</td></tr>`).join('');
  const shareHist = S.fin.hist.filter(x => x.share).slice(-12);
  const newsHtml = m.news.length ? `<ul class="news">${m.news.slice(0, 12).map(n => `<li class="ev-${tone(n.tone)}"><small class="muted">${fmtDate(n.day)}</small><b>${esc(n.title)}</b><span>${esc(n.text)}</span></li>`).join('')}</ul>` : empty('No headlines yet.');
  return `<div class="kpis kpis-6">${kp}</div>
  <div class="grid g-2-1">
    ${panel('Active conditions', events)}
    ${panel('Segment demand', barsH(segItems, { fmt: v => v.toFixed(2) + '×' }), { sub: 'Relative to normal. Drives traffic mix and transaction prices.' })}
  </div>
  <div class="grid g-2-1">
    ${panel('Competitors', `<div class="tablewrap"><table class="t"><thead><tr><th>Name</th><th>Type</th><th>Brand</th><th class="num">Distance</th><th class="num">Units / mo</th><th>Aggression</th><th class="num">Service rate</th><th>Activity</th></tr></thead><tbody>${comps}</tbody></table></div>`, { flush: true })}
    ${panel('Market share', shareHist.length ? lineChart([{ name: 'Retail share', values: shareHist.map(x => round2(x.share * 100)), color: '--series-1', area: true }], shareHist.map(x => monthLabel(x.key)), { fmt: v => v.toFixed(1) + '%', zero: false, label: 'Market share' }) : empty('Share is measured at each month-end.'), { sub: 'Your retail units vs nearby dealers and AutoMax' })}
  </div>
  ${panel('Industry news', newsHtml)}`;
};

/* ---------------- Retention ---------------- */
VIEWS.retention = function () {
  const ret = S.kpiCache.ret;
  const kp = [
    kpi('Owner retention', pct(ret.owner), 'Bought here, serviced here in 12 months', { tone: ret.owner < 0.5 ? 'warn' : 'good' }),
    kpi('Active service customers', num(ret.active), `of ${num(ret.base)} serviceable vehicles (${pct(ret.overall)})`),
    kpi('Overdue maintenance', ret.overdue, `${ret.due} due in total`, { tone: ret.overdue > 60 ? 'warn' : '' }),
    kpi('Servicing elsewhere', num(ret.defected), 'Defected to independents'),
    kpi('Next open appointment', `${S.kpiCache.lead} day${S.kpiCache.lead === 1 ? '' : 's'}`, 'Availability drives retention', { tone: S.kpiCache.lead > 3 ? 'warn' : 'good' }),
    kpi('Prepaid plan holders', ret.ppm, S.programs.ppm ? 'Program active' : 'Program off'),
  ].join('');
  const coh = ret.cohorts.map((c, i) => ({ label: `Year ${i + 1}`, value: c.n ? round2(c.r / c.n * 100) : 0, tip: `<b>Year ${i + 1} after purchase</b><br>${pct(c.n ? c.r / c.n : 0)} retained<br>${c.r} of ${c.n} customers` }));
  const cohChart = colChart(coh, { h: 190, fmt: v => Math.round(v) + '%', label: 'Retention by years since purchase' });
  const gap = (S.settings.laborRate - indyRate()) / indyRate(), oilGap = (S.settings.oilPrice - quickLubePrice()) / quickLubePrice();
  const adv = present('advisor');
  const drivers = [
    ['Labour rate vs independents', `${money(S.settings.laborRate)} vs ${money(indyRate())} (${signed(Math.round(gap * 100), x => x + '%')})`, gap > 0.35 ? 'bad' : gap > 0.2 ? 'warn' : 'good', 'service'],
    ['Oil change vs quick lube', `${money(S.settings.oilPrice)} vs ${money(quickLubePrice())}`, oilGap > 0.35 ? 'bad' : oilGap > 0.15 ? 'warn' : 'good', 'service'],
    ['Appointment availability', `${S.kpiCache.lead} day${S.kpiCache.lead === 1 ? '' : 's'} to next opening`, S.kpiCache.lead > 4 ? 'bad' : S.kpiCache.lead > 2 ? 'warn' : 'good', 'service'],
    ['Service CSI', Math.round(kpiServiceCsi()), kpiServiceCsi() < 75 ? 'bad' : kpiServiceCsi() < 82 ? 'warn' : 'good', 'service'],
    ['Advisor experience', adv.length ? `${adv.length} present · avg rating ${Math.round(avg(adv, e => e.csi))}` : 'No advisors today', !adv.length ? 'bad' : avg(adv, e => e.csi) < 75 ? 'warn' : 'good', 'employees'],
    ['Loaners & transport', S.programs.pickup ? 'Pickup & delivery' : `${S.settings.loaners} loaners · ${S.svc.loanersOut} out`, S.programs.pickup || S.settings.loaners >= 6 ? 'good' : 'warn', 'service'],
    ['Outbound follow-up', `${present('bdc').length} BDC agent${present('bdc').length === 1 ? '' : 's'}${S.programs.reminders ? ' · reminders on' : ''}`, present('bdc').length || S.programs.reminders ? 'good' : 'warn', 'employees'],
    ['Independent competition', S.flags.indyPull ? 'Precision expanded nearby' : 'Normal', S.flags.indyPull ? 'warn' : 'good', 'market'],
  ];
  const drvHtml = `<ul class="drivers">${drivers.map(([l, v, t, link]) => `<li data-act="go" data-to="${link}" role="button" tabindex="0"><span class="dot-s dot-${t}"></span><b>${l}</b><span>${v}</span></li>`).join('')}</ul>`;
  const progs = PROGRAMS.map(p => {
    const st = S.progStats[p.id], on = S.programs[p.id];
    const roi = st.cost > 0 ? st.attrib / st.cost : null;
    return `<article class="prog ${on ? 'on' : ''}"><div class="prog-h"><b>${esc(p.name)}</b><label class="switch"><input type="checkbox" data-chg="program" data-id="${p.id}" ${on ? 'checked' : ''} aria-label="${esc(p.name)}"><span></span></label></div>
      <p>${esc(p.desc)}</p><p class="muted small">${esc(p.effect)}</p>
      <dl class="facts f2"><div><dt>Cost</dt><dd>${p.monthly ? money(p.monthly) + '/mo' : 'Per use'}${p.perUse ? `<small class="muted block">${esc(p.perUse)}</small>` : ''}</dd></div><div><dt>${on ? 'Active since' : 'Status'}</dt><dd>${on && st.since != null ? fmtShort(st.since) : on ? 'Active' : 'Off'}</dd></div>
      <div><dt>Spent to date</dt><dd>${money(st.cost)}</dd></div><div><dt>Retained visits</dt><dd>${num(st.visits, 0)}</dd></div>
      <div><dt>Attributed gross</dt><dd>${money(st.attrib)}</dd></div><div><dt>Return</dt><dd class="${roi == null ? '' : roi >= 1 ? 't-good' : 't-bad'}">${roi == null ? '—' : roi.toFixed(1) + '×'}</dd></div></dl></article>`;
  }).join('');
  const od = overdueList().sort((a, b) => b.dealerLoy - a.dealerLoy).slice(0, 25);
  const odRows = od.map(c => `<tr><td><a href="#" data-act="openCustomer" data-id="${c.id}">${esc(fullName(c))}</a></td><td>${c.veh.year} ${esc(c.veh.make)} ${esc(c.veh.model)}</td><td>${JOBS[c.svc.pending.job].name}</td><td class="num">${S.day - c.svc.pending.since}</td><td>${bar(c.dealerLoy)}</td><td>${btn('Call', 'callBook', { id: c.id }, { cls: 'ghost xs', icon: 'phone' })}</td></tr>`).join('');
  const callCap = present('bdc').length * 25 * (hasExp('bdc') ? 2 : 1) + present('advisor').length * 6 + (present('svcmgr').length ? 4 : 0) - (S.flags.callsToday || 0);
  return `<div class="kpis kpis-6">${kp}</div>
  <div class="grid g-2-1">
    ${panel('Retention by ownership year', cohChart + `<p class="hint">Customers who bought here and returned for service within the last 12 months, grouped by years since purchase. Warranty keeps years 1–3 strong; years 4–5 are where independents win.</p>`, { sub: 'Cohorts' })}
    ${panel('What drives it', drvHtml, { flush: true })}
  </div>
  ${panel('Retention programs', `<div class="progs">${progs}</div>`, { sub: 'Each program has a real monthly cost. Retained visits and gross are estimated from customers who chose you because of the program.' })}
  <div class="grid g-2-1">
    ${panel('Overdue maintenance', odRows ? `<div class="tablewrap"><table class="t compact"><thead><tr><th>Customer</th><th>Vehicle</th><th>Service</th><th class="num">Days overdue</th><th>Loyalty</th><th></th></tr></thead><tbody>${odRows}</tbody></table></div>` : empty('No overdue customers.', 'check'), { flush: true, actions: btn(`Call list (${Math.max(0, callCap)} calls left today)`, 'callOverdue', {}, { cls: 'sm', icon: 'phone', disabled: callCap <= 0 }) })}
    ${panel('Campaigns', `<div class="opts col">
      <button type="button" class="opt" data-act="upgradeOffers"><b>Equity upgrade offers</b><small>Mail and text owners with positive equity, lease-ends or older vehicles. $6 each. Puts them in market and points them to you.</small></button>
      <button type="button" class="opt" data-act="winBack"><b>Win-back mailer</b><small>${num(ret.defected)} lapsed service customers · $11 each. Better results with preferred pricing or loyalty points on.</small></button>
      <button type="button" class="opt" data-act="go" data-to="employees"><b>Hire BDC agents</b><small>Each agent makes about 25 service calls and 30 sales follow-ups a day.</small></button></div>`)}
  </div>`;
};

/* ---------------- Group ---------------- */
VIEWS.group = function () {
  const P = lastMonth();
  const ourNet = P ? statementNet(P) : 0;
  const storeNet = sum(S.stores, s => s.hist.length ? s.hist[s.hist.length - 1].net : 0);
  const kp = [
    kpi('Rooftops', 1 + S.stores.length, S.stores.length ? 'Dealer group' : 'Single-point dealer'),
    kpi('Last month net (group)', moneyK(ourNet + storeNet), `${esc(S.dealerName)} ${moneyK(ourNet)}${S.stores.length ? ' · other stores ' + moneyK(storeNet) : ''}`),
    kpi('Projects open', S.exp.owned.length, `${S.exp.building.length} under construction`),
    kpi('Cash', moneyK(S.cash), 'Available for investment'),
  ].join('');
  const cards = EXPANSIONS.map(x => {
    const st = expansionStatus(x);
    const reqs = Object.entries(x.req).map(([k, v]) => ({ months: `${v}+ months as GM`, standing: `OEM standing ${v}+`, usedSold: `${v}+ used retail sales in a month`, csi: `Sales CSI ${v}+`, netMonths: `${v} consecutive profitable months` }[k]));
    return `<article class="exp exp-${st.state}"><div class="exp-h"><b>${esc(x.name)}</b>${st.state === 'owned' ? pill('Open', 'good', 'check') : st.state === 'building' ? pill(`Opens ${fmtShort(st.done)}`, 'info', 'clock') : st.state === 'available' ? pill('Available', 'good') : pill('Locked', 'neutral')}</div>
      <p>${esc(x.desc)}</p><p class="small"><b>Effect:</b> ${esc(x.effect)}</p>
      <dl class="facts f3"><div><dt>Investment</dt><dd>${moneyK(x.cost)}</dd></div><div><dt>Build time</dt><dd>${x.days} days</dd></div><div><dt>Running cost</dt><dd>${x.monthly ? moneyK(x.monthly) + '/mo' : 'Own P&L'}</dd></div></dl>
      <ul class="reqs">${reqs.map(r => `<li>${esc(r)}</li>`).join('')}<li>${moneyK(x.cost)} cash</li></ul>
      ${st.state === 'locked' ? `<p class="small t-warn">Needs: ${esc(st.miss.join(', '))}</p>` : ''}
      ${st.state === 'available' ? btn(`Start — ${moneyK(x.cost)}`, 'startExp', { id: x.id }, { cls: 'primary sm' }) : ''}</article>`;
  }).join('');
  const stores = S.stores.map(s => {
    const last = s.hist[s.hist.length - 1];
    return `<tr><td><b>${esc(s.name)}</b><small class="muted block">${esc(s.brand)} · opened ${fmtDate(s.opened)}</small></td><td>${esc(s.gm.name)}<small class="muted block">GM skill ${Math.round(s.gm.skill)}</small></td><td class="num">${last ? last.units : '—'}</td><td class="num">${last ? moneyK(last.rev) : '—'}</td><td class="num ${last && last.net < 0 ? 't-bad' : ''}">${last ? money(last.net) : 'First month pending'}</td><td>${sparkline(s.hist.map(h => h.net))}</td><td class="num">${s.invest}</td>
      <td class="acts">${btn('Invest $250K', 'storeInvest', { id: s.id }, { cls: 'ghost xs' })}${btn('Replace GM', 'storeGm', { id: s.id }, { cls: 'ghost xs' })}${btn('Sell', 'storeSell', { id: s.id }, { cls: 'ghost xs danger-t' })}</td></tr>`;
  }).join('');
  return `<div class="kpis kpis-4">${kp}</div>
  ${panel('Growth projects', `<div class="exps">${cards}</div>`, { sub: 'Build out the store, add departments, then add rooftops to become a dealer group.' })}
  ${panel('Dealer group stores', stores ? `<div class="tablewrap"><table class="t"><thead><tr><th>Store</th><th>General manager</th><th class="num">Units</th><th class="num">Revenue</th><th class="num">Net profit</th><th>Trend</th><th class="num">Investments</th><th></th></tr></thead><tbody>${stores}</tbody></table></div>` : empty('Your group is one rooftop for now. The Oriel luxury franchise and the Millbrook acquisition add stores with their own P&L.', 'group'), { flush: true })}`;
};

/* ---------------- Interrupt modals ---------------- */
function decisionModal() {
  const d = S.decisions[0]; if (!d) return '';
  return `<div class="modal-h"><div><span class="eyebrow">${esc(d.cat || 'Decision')} · ${S.decisions.length > 1 ? `1 of ${S.decisions.length}` : 'Decision required'}</span><h2>${esc(d.title)}</h2></div></div>
  <div class="modal-b"><p class="lead">${esc(d.body)}</p><div class="opts col">${d.options.map((o, i) => `<button type="button" class="opt" data-act="decide" data-id="${d.id}" data-val="${i}"><b>${esc(o.label)}</b><small>${esc(o.desc)}</small></button>`).join('')}</div></div>`;
}
function reportModal() {
  const L = S.fin.hist.find(h => h.key === S.report); if (!L) return '';
  const i = S.fin.hist.indexOf(L), P = S.fin.hist[i - 1];
  const net = statementNet(L), retail = L.units.new + L.units.used;
  const g = id => L.rev[id] - L.cogs[id];
  const o = L.oem;
  const rows = DEPTS.filter(d => L.rev[d.id] || L.cogs[d.id]).map(d => `<tr><td>${d.label}</td><td class="num">${money(L.rev[d.id])}</td><td class="num">${money(g(d.id))}</td><td class="num">${P ? money(P.rev[d.id] - P.cogs[d.id]) : '—'}</td></tr>`).join('');
  return `<div class="modal-h"><div><span class="eyebrow">Month-end close</span><h2>${monthLabel(L.key, true)} results</h2></div></div>
  <div class="modal-b">
    <div class="kpis kpis-4">${kpi('Revenue', moneyK(stRevenue(L)), P ? delta(stRevenue(L), stRevenue(P)) + ' vs prior month' : '')}${kpi('Gross profit', moneyK(stGross(L)), P ? delta(stGross(L), stGross(P)) + ' vs prior month' : '')}${kpi('Operating expenses', moneyK(stExpenses(L)), P ? delta(stExpenses(L), stExpenses(P), { inverse: true }) + ' vs prior month' : '')}${kpi('Net profit', moneyK(net), P ? `Prior month ${moneyK(statementNet(P))}` : '', { tone: net >= 0 ? 'good' : 'bad' })}</div>
    <div class="grid g-2">
      <div><h5>Gross by department</h5><div class="tablewrap"><table class="t compact"><thead><tr><th></th><th class="num">Revenue</th><th class="num">Gross</th><th class="num">Prior gross</th></tr></thead><tbody>${rows}</tbody></table></div>
        <dl class="facts f2 mt"><div><dt>Cash flow</dt><dd>${money(L.cashStart)} → ${money(L.cashEnd)} (${signed(Math.round(L.cashEnd - L.cashStart))})</dd></div><div><dt>Retail units</dt><dd>${L.units.new} new · ${L.units.used} used</dd></div>
        <div><dt>New / used gross per unit</dt><dd>${money(L.units.new ? g('new') / L.units.new : 0)} / ${money(L.units.used ? g('used') / L.units.used : 0)}</dd></div><div><dt>F&I per retail unit</dt><dd>${money(retail ? g('fi') / retail : 0)}</dd></div>
        <div><dt>Service hours sold</dt><dd>${num(L.hours.cp + L.hours.warranty + L.hours.internal, 0)}</dd></div><div><dt>CSI sales / service</dt><dd>${Math.round(L.csiS || 0)} / ${Math.round(L.csiV || 0)}</dd></div>
        <div><dt>Owner retention</dt><dd>${pct(L.retention)}</dd></div><div><dt>Close rate</dt><dd>${pct(L.ups ? L.sold / L.ups : 0)} of ${L.ups} ups</dd></div></dl></div>
      <div><h5>Aurex evaluation</h5><ul class="oemres">${o.res.map(r => `<li class="${r.met ? 'ok' : 'miss'}">${icon(r.met ? 'check' : 'x')}<b>${r.label}</b><span>${r.fmt === 'pct' ? pct(r.val) + ' / ' + pct(r.target) : r.fmt === 'days' ? Math.round(r.val) + ' / ≤' + r.target : r.fmt === 'n1' ? Math.round(r.val) + ' / ' + r.target : r.val + ' / ' + r.target}</span></li>`).join('')}</ul>
        <dl class="facts f2"><div><dt>Standing change</dt><dd class="${o.delta >= 0 ? 't-good' : 't-bad'}">${signed(o.delta, x => String(x))} → ${L.standing} (${standingTier(L.standing).n})</dd></div><div><dt>Stair-step bonus</dt><dd>${o.bonus ? money(o.bonus) + ` (${money(o.perUnit)}/unit)` : 'Not reached'}</dd></div>
        <div><dt>Next month target</dt><dd>${S.oem.targets.units} new units</dd></div><div><dt>Next month allocation</dt><dd>${S.oem.alloc} units</dd></div></dl></div>
    </div></div>
  <div class="modal-f"><span class="muted">${net >= 0 ? 'Profitable month.' : 'Loss month — check inventory levels, pricing and expenses.'}</span>${btn(`Start ${MONTHS_LONG[dparts(S.day + 1).m]}`, 'closeReport', {}, { cls: 'primary', icon: 'right' })}</div>`;
}
function gameOverModal() {
  const months = monthsPlayed();
  return `<div class="modal-h"><div><span class="eyebrow">Game over</span><h2>The bank has called the loan</h2></div></div>
  <div class="modal-b"><p class="lead">${esc(S.over.reason)}</p><p>You ran ${esc(S.dealerName)} for ${plural(months, 'month')}.</p></div>
  <div class="modal-f">${btn('Start a new game', 'openNewGame', {}, { cls: 'primary' })}</div>`;
}
function newGameModal() {
  return `<div class="modal-h"><div><span class="eyebrow">New game</span><h2>Take over a dealership</h2></div>${S && !S.over ? `<button class="icon-btn" data-act="closeModal" aria-label="Close">${icon('x')}</button>` : ''}</div>
  <form class="modal-b form" data-form="newgame">
    <label class="fl"><span>Dealership name</span><input class="txt" id="ng-name" name="name" maxlength="40" value="${esc(S ? S.dealerName : 'Lakeshore Aurex')}"></label>
    <label class="fl"><span>Difficulty</span><select class="sel" id="ng-diff" name="difficulty"><option value="standard">Standard — $2,000,000 cash</option><option value="hard">Challenging — $1,400,000 cash</option></select></label>
    <p class="hint">Starting a new game replaces your current save in this browser.</p>
    <div class="modal-f">${S && !S.over ? btn('Cancel', 'closeModal', {}, { cls: 'ghost' }) : ''}<button class="btn primary" type="submit">${icon('check')}<span>Start new game</span></button></div>
  </form>`;
}
