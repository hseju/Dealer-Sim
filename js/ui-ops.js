'use strict';
/* =====================================================================
   Dealer Empire — Inventory, Used, Customers, Service, Parts, Employees
   ===================================================================== */

/* ---------------- New vehicle inventory ---------------- */
VIEWS.inventory = function () {
  const f = UI.filters.inv = UI.filters.inv || { model: 'all', status: 'all', age: 'all', q: '' };
  const onGround = S.inv.filter(v => v.status === 'available'), transit = S.inv.filter(v => v.status === 'transit');
  const aged = onGround.filter(v => daysIn(v) > 90);
  const fpMtd = S.fin.mtd.exp.floorplan;
  const buckets = [[0, 30], [31, 60], [61, 90], [91, 120], [121, 9999]].map(([a, b]) => ({ label: b > 999 ? '120+' : `${a}–${b}`, value: onGround.filter(v => daysIn(v) >= a && daysIn(v) <= b).length }));
  const kp = [
    kpi('On the ground', onGround.length, `${money(sum(onGround, v => v.invoice))} at invoice`),
    kpi('In transit', transit.length, transit.length ? `Next arrival ${fmtShort(Math.min(...transit.map(v => v.eta)))}` : 'Nothing ordered'),
    kpi('Days supply', Math.round(S.kpiCache.dsupply), 'Aurex target ≤ 75', { tone: S.kpiCache.dsupply < 30 || S.kpiCache.dsupply > 90 ? 'warn' : '' }),
    kpi('Average age', `${Math.round(avg(onGround, daysIn))} days`, `${aged.length} over 90 days`, { tone: aged.length > 5 ? 'warn' : '' }),
    kpi('Floorplan MTD', money(fpMtd), `${(floorplanRate() * 100).toFixed(2)}% rate, net of OEM assistance`),
    kpi('Allocation left', allocationLeft(), `of ${S.oem.alloc} this month${S.oem.exclusiveAlloc ? ` · ${S.oem.exclusiveAlloc} Volta GT` : ''}`),
  ].join('');
  const sold30 = id => S.deals.filter(d => d.mid === id && d.day > S.day - 30).length;
  const mix = MODELS.map(m => {
    const st = onGround.filter(v => v.modelId === m.id).length, tr = transit.filter(v => v.modelId === m.id).length, s = sold30(m.id);
    const dem = segDemand(m.seg);
    return `<tr><td><b>${esc(m.name)}</b><small class="muted block">${esc(m.body)}</small></td><td>${SEGMENTS[m.seg]}</td><td class="num">${st}</td><td class="num">${tr}</td><td class="num">${s}</td><td class="num">${s ? Math.round(st / (s / 30)) : st ? '∞' : '—'}</td><td>${demandPill(dem)}</td><td class="num">${S.oem.incentives[m.id] ? money(S.oem.incentives[m.id]) : '—'}</td></tr>`;
  }).join('');
  let list = S.inv.slice();
  if (f.model !== 'all') list = list.filter(v => v.modelId === f.model);
  if (f.status !== 'all') list = list.filter(v => v.status === f.status);
  if (f.age === '60') list = list.filter(v => v.status === 'available' && daysIn(v) > 60);
  if (f.age === '90') list = list.filter(v => v.status === 'available' && daysIn(v) > 90);
  if (f.q) list = list.filter(v => (v.stock + ' ' + vehName(v) + ' ' + v.ext).toLowerCase().includes(f.q.toLowerCase()));
  const sk = UI.sort.inv || 'days';
  list.sort((a, b) => sk === 'days' ? daysIn(b) - daysIn(a) : sk === 'msrp' ? b.msrp - a.msrp : sk === 'model' ? vehName(a).localeCompare(vehName(b)) : 0);
  const rows = list.map(v => {
    const dd = daysIn(v), mv = v.status === 'transit' ? null : newMarketValue(v);
    return `<tr class="${dd > 90 && v.status === 'available' ? 'row-warn' : ''}" data-act="openVeh" data-id="${v.id}" role="button" tabindex="0">
      <td class="mono">${v.stock}</td><td class="vcell"><b>${esc(vehName(v, true))}</b><small class="muted block">${esc(v.eng)} · ${v.dr}</small></td>
      <td><span class="swatch" style="background:${EXT_COLORS.find(c => c.n === v.ext).hex}"></span>${esc(v.ext)}</td>
      <td class="num">${money(v.msrp)}</td><td class="num">${money(v.invoice)}</td><td class="num">${mv ? money(mv) : '—'}</td><td class="num">${incentiveFor(v) ? money(incentiveFor(v)) : '—'}</td>
      <td class="num">${v.discount ? money(v.discount) : '—'}</td><td class="num">${v.status === 'transit' ? 'ETA ' + fmtShort(v.eta) : dd}</td><td class="num">${money(v.fpAccrued)}</td>
      <td>${v.status === 'transit' ? pill('In transit', 'info') : dd > 120 ? pill('Aged', 'bad') : dd > 90 ? pill('Aging', 'warn') : pill('Available', 'good')}</td></tr>`;
  }).join('');
  const filters = `<div class="filters">
    <label class="fl-in">${icon('search')}<input type="search" id="inv-q" placeholder="Stock #, model, colour" value="${esc(f.q)}" data-chg="filter" data-key="inv.q"></label>
    <select class="sel" id="inv-model" data-chg="filter" data-key="inv.model"><option value="all">All models</option>${MODELS.map(m => `<option value="${m.id}" ${f.model === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}</select>
    ${seg('inv.status', [['all', 'All'], ['available', 'On ground'], ['transit', 'In transit']], f.status, { act: 'filterSeg' })}
    ${seg('inv.age', [['all', 'Any age'], ['60', '60+ days'], ['90', '90+ days']], f.age, { act: 'filterSeg' })}
    ${seg('inv', [['days', 'Oldest first'], ['msrp', 'Price'], ['model', 'Model']], sk, { act: 'sortSeg' })}</div>`;
  return `<div class="kpis kpis-6">${kp}</div>
  <div class="grid g-2-1">
    ${panel('Model mix & supply', `<div class="tablewrap"><table class="t"><thead><tr><th>Model</th><th>Segment</th><th class="num">Stock</th><th class="num">Transit</th><th class="num">Sold 30d</th><th class="num">Days supply</th><th>Demand</th><th class="num">Incentive</th></tr></thead><tbody>${mix}</tbody></table></div>`, { flush: true, actions: btn('Order from Aurex', 'openOrder', {}, { cls: 'primary sm', icon: 'plus' }) })}
    ${panel('Aging', colChart(buckets.map((b, i) => ({ label: b.label, value: b.value, tone: i >= 3 ? 'bad' : i === 2 ? 'warn' : null })), { h: 170, label: 'Units by days in stock' }) + `<p class="hint">Floorplan interest accrues daily from arrival and steps up after 180 days. Shoppers also value aged units lower. Advertise a discount or dealer-trade a unit from its detail page.</p>`, { sub: 'Units by days in stock' })}
  </div>
  ${panel(`Vehicles (${list.length})`, filters + `<div class="tablewrap"><table class="t t-click"><thead><tr><th>Stock</th><th>Vehicle</th><th>Exterior</th><th class="num">MSRP</th><th class="num">Invoice</th><th class="num">Market value</th><th class="num">Incentive</th><th class="num">Discount</th><th class="num">Days</th><th class="num">Floorplan</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="11" class="muted">No vehicles match.</td></tr>'}</tbody></table></div>`, { flush: true })}`;
};
function demandPill(d) { return d >= 1.12 ? pill('Hot', 'good') : d >= 0.98 ? pill('Steady', 'neutral') : d >= 0.85 ? pill('Soft', 'warn') : pill('Weak', 'bad'); }

function vehDrawer(id) {
  const v = vehById(id); if (!v) return '';
  if (v.kind === 'used') return usedDrawer(v);
  const m = MODEL[v.modelId], mv = newMarketValue(v), inc = incentiveFor(v);
  const dd = daysIn(v);
  return `<div class="drawer-h"><div><span class="eyebrow mono">${v.stock}</span><h2>${esc(vehName(v))}</h2></div><button class="icon-btn" data-act="closeDrawer" aria-label="Close">${icon('x')}</button></div>
  <div class="drawer-b">
    <div class="monroney">
      <div class="mn-h"><b>Aurex ${esc(m.name)} ${esc(v.trim)}</b><span>Model year ${v.year}</span></div>
      <div class="mn-g"><div><small>Engine</small>${esc(v.eng)}</div><div><small>Drivetrain</small>${v.dr}</div><div><small>Exterior</small>${esc(v.ext)}</div><div><small>Interior</small>${esc(v.int)}</div><div><small>Body</small>${esc(m.body)}</div><div><small>Segment</small>${SEGMENTS[m.seg]}</div></div>
      <div class="mn-l"><span>Base price, ${esc(v.trim)}</span><b>${money(roundTo((m.msrp + m.trims[v.ti].add) * (1 + (v.year - 2027) * 0.022), 5))}</b></div>
      <div class="mn-l"><span>${esc(v.ext)} paint</span><b>${money(EXT_COLORS.find(c => c.n === v.ext).add)}</b></div>
      <div class="mn-l tot"><span>Total MSRP</span><b>${money(v.msrp)}</b></div>
    </div>
    <dl class="facts f2">
      <div><dt>Dealer invoice</dt><dd>${money(v.invoice)}</dd></div><div><dt>Holdback (2%)</dt><dd>${money(v.msrp * HOLDBACK)}</dd></div>
      <div><dt>Market value today</dt><dd>${money(mv)}</dd></div><div><dt>OEM incentive</dt><dd>${inc ? money(inc) : 'None'}</dd></div>
      <div><dt>Days in stock</dt><dd>${v.status === 'transit' ? 'Arrives ' + fmtDate(v.eta) : dd}</dd></div><div><dt>Floorplan accrued</dt><dd>${money(v.fpAccrued)}</dd></div>
      <div><dt>Gross at market</dt><dd>${money(mv - v.invoice + v.msrp * HOLDBACK + DOC_FEE - PREP_COST)}</dd></div><div><dt>Daily carrying cost</dt><dd>${money(v.invoice * floorplanRate() / 365)}</dd></div>
    </dl>
    ${v.status === 'available' ? `<h5>Advertised dealer discount</h5>
    <div class="row2"><input type="range" id="veh-disc" min="0" max="${roundTo(v.msrp * 0.12, 100)}" step="100" value="${v.discount}" data-chg="vehDisc" data-id="${v.id}" aria-label="Dealer discount"><b>${money(v.discount)}</b></div>
    <p class="hint">An advertised discount lowers the starting price your team quotes and makes the unit stand out to internet shoppers.</p>
    <h5>Exit options</h5>
    <p class="hint">Dealer-trade the unit to Northgate Aurex at about ${money(v.invoice * 0.97)} (${money(v.invoice * 0.97 - v.invoice)} vs invoice). It stops floorplan cost but doesn't count toward your sales target.</p>
    ${btn('Dealer-trade this unit', 'wholesaleNew', { id: v.id }, { cls: 'danger sm' })}` : ''}
  </div>`;
}

/* order modal */
function orderModal() {
  const o = UI.order = UI.order || { mid: 'terra', ti: 0, color: 'any', qty: 2 };
  const m = MODEL[o.mid];
  if (o.ti >= m.trims.length) o.ti = 0;
  const left = m.exclusive ? S.oem.exclusiveAlloc : allocationLeft();
  const trim = m.trims[o.ti], msrp = m.msrp + trim.add, inv = Math.round(msrp * m.inv);
  const cards = MODELS.map(x => {
    const st = S.inv.filter(v => v.modelId === x.id).length;
    return `<button type="button" class="mcard ${o.mid === x.id ? 'on' : ''}" data-act="orderModel" data-id="${x.id}">
      <span class="mc-ic">${icon(x.pt === 'ev' ? 'zap' : x.pt === 'hybrid' ? 'leaf' : x.cls === 'truck' ? 'truck' : 'car')}</span>
      <b>${esc(x.name)}</b><small>${esc(x.body)}</small><small>From ${moneyK(x.msrp)} · ${st} in stock</small>${demandPill(segDemand(x.seg))}${x.exclusive ? chip('Exclusive', 'chip-warn') : ''}</button>`;
  }).join('');
  const transit = S.inv.filter(v => v.status === 'transit').sort((a, b) => a.eta - b.eta);
  return `<div class="modal-h"><div><span class="eyebrow">Aurex dealer ordering</span><h2>Order new vehicles</h2></div><button class="icon-btn" data-act="closeModal" aria-label="Close">${icon('x')}</button></div>
  <div class="modal-b">
    <div class="alloc"><div><small class="muted">Allocation left this month</small><b>${allocationLeft()} <small>of ${S.oem.alloc}</small></b></div><div><small class="muted">Volta GT exclusive</small><b>${S.oem.exclusiveAlloc}</b></div><div><small class="muted">Lot space</small><b>${lotCapacity().new - S.inv.length} free</b></div><div><small class="muted">Standing</small><b>${S.oem.standing} · ${standingTier().n}</b></div></div>
    <div class="mcards">${cards}</div>
    <div class="order-form">
      <label class="fl"><span>Trim</span><select class="sel" id="ord-trim" data-chg="orderTrim">${m.trims.map((t, i) => `<option value="${i}" ${i === o.ti ? 'selected' : ''}>${esc(t.n)} — ${esc(t.eng)}, ${t.dr} (${money(m.msrp + t.add)})</option>`).join('')}</select></label>
      <label class="fl"><span>Colour</span><select class="sel" id="ord-color" data-chg="orderColor"><option value="any">Factory mix</option>${EXT_COLORS.map(c => `<option value="${c.n}" ${o.color === c.n ? 'selected' : ''}>${c.n}${c.add ? ' (+' + money(c.add) + ')' : ''}</option>`).join('')}</select></label>
      <label class="fl"><span>Quantity</span><div class="stepper"><button type="button" class="btn sm ghost" data-act="orderQty" data-val="-1" aria-label="Fewer">${icon('minus')}</button><b>${o.qty}</b><button type="button" class="btn sm ghost" data-act="orderQty" data-val="1" aria-label="More">${icon('plus')}</button></div></label>
      <div class="order-sum"><div><small>Invoice each</small><b>${money(inv)}</b></div><div><small>Order total (floorplanned)</small><b>${money(inv * o.qty)}</b></div><div><small>Floorplan per month</small><b>${money(inv * o.qty * floorplanRate() / 12)}</b></div><div><small>Current incentive</small><b>${S.oem.incentives[m.id] ? money(S.oem.incentives[m.id]) : 'None'}</b></div></div>
    </div>
    ${m.exclusive && S.oem.standing < 68 ? `<p class="hint t-warn">The Volta GT is only allocated to Preferred dealers (standing 68+).</p>` : ''}
    ${transit.length ? `<h5>In transit (${transit.length})</h5><div class="tablewrap"><table class="t compact"><thead><tr><th>Stock</th><th>Vehicle</th><th>Colour</th><th class="num">Invoice</th><th>ETA</th></tr></thead><tbody>${transit.slice(0, 30).map(v => `<tr><td class="mono">${v.stock}</td><td>${esc(vehName(v, true))}</td><td>${esc(v.ext)}</td><td class="num">${money(v.invoice)}</td><td>${fmtShort(v.eta)}</td></tr>`).join('')}</tbody></table></div>` : ''}
  </div>
  <div class="modal-f"><span class="muted">Vehicles are floorplanned on arrival; no cash is due now. Delivery in 1–3 weeks.</span>${btn(`Order ${o.qty} × ${esc(m.name)} ${esc(trim.n)}`, 'placeOrder', {}, { cls: 'primary', disabled: left < o.qty, icon: 'check' })}</div>`;
}

/* ---------------- Used vehicles ---------------- */
VIEWS.used = function () {
  const L = S.fin.mtd;
  const avail = S.used.filter(u => u.status === 'available');
  const appr = S.used.filter(u => u.status === 'appraisal'), recon = S.used.filter(u => u.status === 'recon'), auc = S.used.filter(u => u.status === 'auction' || u.status === 'inbound');
  const g = L.units.used ? (L.rev.used - L.cogs.used) / L.units.used : 0;
  const kp = [
    kpi('Frontline ready', avail.length, `Lot capacity ${lotCapacity().used}`),
    kpi('Awaiting decision', appr.length, 'Trade-ins & auction buys', { tone: appr.length ? 'warn' : '' }),
    kpi('In reconditioning', recon.length, `${num(sum(S.svc.ros.filter(r => r.uid), r => r.left), 1)} shop hours left`),
    kpi('Investment', moneyK(sum(S.used, u => u.cost + u.reconCost)), `Avg ${Math.round(avg(avail, daysIn))} days on lot`),
    kpi('Sold this month', L.units.used, `${money(g)} gross per unit`),
    kpi('Used price index', S.mkt.usedIdx.toFixed(1), 'Base 100', { spark: sparkline(S.mkt.hist.usedIdx.slice(-90).map(x => x[1]), { color: '--series-3' }) }),
  ].join('');
  const apprCards = appr.map(u => {
    const ret = usedRetail({ ...u, cond: reconCond(u) }), est = reconEstimate(u), asIs = usedRetail(u), ws = acvOf(u) * 0.985;
    const ageY = yearFrac(S.day) - u.year;
    return `<article class="appr">
      <div class="appr-h"><div><b>${u.year} ${esc(u.make)} ${esc(u.model)}</b><small class="muted block"><span class="mono">${u.stock}</span> · ${u.source === 'trade' ? 'Trade-in' : 'Auction purchase'} · ${kmf(u.km)}</small></div>${stars(u.cond)}</div>
      <dl class="facts f3"><div><dt>Cost basis (ACV)</dt><dd>${money(u.cost)}</dd></div><div><dt>Accidents</dt><dd>${u.acc === 'none' ? 'None' : u.acc}</dd></div><div><dt>Decide by</dt><dd>${fmtShort(u.decideBy)}</dd></div></dl>
      <div class="opts">
        <button type="button" class="opt" data-act="usedPlan" data-id="${u.id}" data-val="recon"><b>Recondition & retail</b><small>Recon ≈ ${money(est)} · ${Math.round(est * 0.5 / INTERNAL_RATE + 1)}+ shop hrs<br>Retail ≈ ${money(ret)} · gross ≈ ${money(ret * 0.98 - u.cost - est + DOC_FEE - 150)}</small></button>
        <button type="button" class="opt" data-act="usedPlan" data-id="${u.id}" data-val="asis"><b>Retail as-is</b><small>Safety only $180 · on the lot today<br>Retail ≈ ${money(asIs)} · gross ≈ ${money(asIs * 0.98 - u.cost - 180 + DOC_FEE - 150)}${u.cond <= 2 ? '<br><span class="t-warn">Rough unit — buyers may complain</span>' : ''}</small></button>
        <button type="button" class="opt" data-act="usedPlan" data-id="${u.id}" data-val="wholesale"><b>Wholesale now</b><small>≈ ${money(ws)} today<br>Result ≈ ${money(ws - u.cost)}</small></button>
        <button type="button" class="opt" data-act="usedPlan" data-id="${u.id}" data-val="auction"><b>Send to auction</b><small>Sells in 5–9 days<br>Range ${money((ws + 250) * 0.9 - 450)} – ${money((ws + 250) * 1.08 - 450)}${ageY > 9 ? '<br>Best exit for older units' : ''}</small></button>
      </div></article>`;
  }).join('');
  const rows = S.used.filter(u => u.status !== 'appraisal').sort((a, b) => daysIn(b) - daysIn(a)).map(u => {
    const dd = daysIn(u), mv = usedRetail(u), proj = usedProjected(u), ro = S.svc.ros.find(r => r.uid === u.id);
    const st = u.status === 'available' ? (dd > 60 ? pill('Aged', 'bad') : pill(u.recon === 'as-is' ? 'As-is' : 'Frontline', 'good')) : u.status === 'recon' ? pill(ro ? `Recon ${Math.round((1 - ro.left / ro.hrs) * 100)}%` : 'Recon', 'info') : u.status === 'auction' ? pill('At auction', 'neutral') : pill('Inbound', 'neutral');
    return `<tr class="${dd > 60 && u.status === 'available' ? 'row-warn' : ''}"><td class="mono">${u.stock}</td><td class="vcell"><b>${u.year} ${esc(u.make)} ${esc(u.model)}</b><small class="muted block">${u.source === 'trade' ? 'Trade' : 'Auction'} · ${esc(u.ext)}</small></td>
      <td class="num">${num(u.km)}</td><td>${stars(u.cond)}</td><td>${u.acc === 'none' ? '—' : u.acc}</td><td class="num">${money(u.cost)}</td><td class="num">${money(u.reconCost || (u.status === 'recon' ? u.reconPlanned : 0))}</td>
      <td class="num">${money(mv)}</td><td class="num">${u.status === 'available' ? `<input class="num-in sm" type="number" step="100" value="${u.ask}" data-chg="usedAsk" data-id="${u.id}" aria-label="Asking price for ${u.stock}">` : '—'}</td>
      <td class="num">${dd}</td><td class="num ${proj < 0 ? 't-bad' : ''}">${money(proj)}</td><td>${st}</td>
      <td class="acts">${u.status === 'available' ? `${btn('Reprice', 'usedMarket', { id: u.id }, { cls: 'ghost xs', tip: 'Set the asking price to today\'s market value' })}${btn('Wholesale', 'usedWs', { id: u.id }, { cls: 'ghost xs', tip: 'Sell to a wholesaler today' })}${btn('Auction', 'usedAuc', { id: u.id }, { cls: 'ghost xs', tip: 'Consign to next week\'s auction' })}` : ''}</td></tr>`;
  }).join('');
  const lots = S.auction.map(a => `<tr><td><b>${a.year} ${esc(a.make)} ${esc(a.model)}</b></td><td class="num">${num(a.km)}</td><td>${stars(a.cond)}</td><td>${a.acc === 'none' ? '—' : a.acc}</td><td class="num">${money(a.retail)}</td><td class="num"><b>${money(a.price)}</b><small class="muted block">+${money(a.fee + 250)} fees</small></td><td>${btn('Buy', 'buyLot', { id: a.id }, { cls: 'sm' })}</td></tr>`).join('');
  return `<div class="kpis kpis-6">${kp}</div>
  ${appr.length ? panel('Disposition decisions', `<div class="apprs">${apprCards}</div>`, { sub: 'Every trade-in needs a plan. Units not decided in 3 days get the used manager\'s default.' }) : ''}
  ${panel('Used inventory', rows ? `<div class="tablewrap"><table class="t"><thead><tr><th>Stock</th><th>Vehicle</th><th class="num">Km</th><th>Cond.</th><th>Accident</th><th class="num">Acquired</th><th class="num">Recon</th><th class="num">Market</th><th class="num">Asking</th><th class="num">Days</th><th class="num">Proj. gross</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : empty('No used inventory.'), { flush: true, actions: `<label class="inline-l">Default for trades ${seg('usedPlan', [['ask', 'Ask me'], ['recon', 'Recon'], ['wholesale', 'Wholesale']], S.settings.usedPlan, { cls: 'sm' })}</label>` })}
  ${panel('Weekly dealer auction', `<div class="tablewrap"><table class="t"><thead><tr><th>Vehicle</th><th class="num">Km</th><th>Cond.</th><th>Accident</th><th class="num">Est. retail</th><th class="num">Buy now</th><th></th></tr></thead><tbody>${lots || '<tr><td colspan="7" class="muted">Sold out. A new run lists every Wednesday.</td></tr>'}</tbody></table></div>`, { flush: true, sub: `Run listed ${fmtShort(S.auctionDay)}. Purchases arrive in 2 days and need a recon decision.` })}`;
};
function usedDrawer(u) { return `<div class="drawer-h"><h2>${u.year} ${esc(u.make)} ${esc(u.model)}</h2><button class="icon-btn" data-act="closeDrawer">${icon('x')}</button></div><div class="drawer-b"><p>${kmf(u.km)}</p></div>`; }

/* ---------------- Customers ---------------- */
VIEWS.customers = function () {
  const f = UI.filters.cust = UI.filters.cust || { seg: 'all', q: '', quick: '' };
  const all = S.customers;
  const owners = all.filter(c => c.status === 'owner'), svcOnly = all.filter(c => c.status === 'service');
  const inMarket = all.filter(c => c.inMarket).length;
  const leaseEnd = c => c.veh && c.veh.fin && c.veh.fin.type === 'lease' && (c.veh.fin.start + c.veh.fin.term * 30.44 - S.day) < 120;
  const kp = [
    kpi('Customers on file', num(all.length), `${num(owners.length)} bought here`),
    kpi('Active service', num(S.kpiCache.ret.active), 'Visited in last 12 months'),
    kpi('In market now', inMarket, 'Shopping for a vehicle'),
    kpi('Positive equity', num(all.filter(c => (c.status === 'owner' || c.status === 'service') && (c.eq || 0) > 2000).length), 'Trade worth more than payoff'),
    kpi('Leases ending ≤ 120 days', all.filter(c => c.status !== 'lost' && leaseEnd(c)).length, 'Prime repeat opportunities'),
    kpi('Overdue maintenance', S.kpiCache.ret.overdue, 'Due and not booked', { link: 'retention' }),
  ].join('');
  let list = all;
  if (f.seg !== 'all') list = list.filter(c => c.status === f.seg);
  if (f.quick === 'equity') list = list.filter(c => (c.eq || 0) > 2000 && c.status !== 'lost');
  if (f.quick === 'lease') list = list.filter(c => c.status !== 'lost' && leaseEnd(c));
  if (f.quick === 'overdue') list = list.filter(c => c.svc.pending && !c.svc.appt && S.day - c.svc.pending.since > 7);
  if (f.quick === 'defected') list = list.filter(c => c.svc.defected && serviceEligible(c) && c.status !== 'lost');
  if (f.quick === 'market') list = list.filter(c => c.inMarket);
  if (f.q) { const q = f.q.toLowerCase(); list = list.filter(c => (fullName(c) + ' ' + (c.veh ? c.veh.make + ' ' + c.veh.model : '')).toLowerCase().includes(q)); }
  const sk = UI.sort.cust || 'recent';
  list = list.slice().sort((a, b) => sk === 'ltv' ? b.ltv - a.ltv : sk === 'equity' ? (b.eq || 0) - (a.eq || 0) : sk === 'name' ? a.ln.localeCompare(b.ln) : (b.hist[0] ? b.hist[0][0] : -9999) - (a.hist[0] ? a.hist[0][0] : -9999));
  const rows = pageSlice('cust', list, 40).map(c => {
    const v = c.veh;
    return `<tr data-act="openCustomer" data-id="${c.id}" role="button" tabindex="0"><td><b>${esc(fullName(c))}</b><small class="muted block">${c.business ? 'Fleet account' : `${c.age} · ${esc(c.hh)}`}</small></td>
      <td>${v ? `${v.year} ${esc(v.make)} ${esc(v.model)}` : '<span class="muted">No vehicle</span>'}${v && v.fromUs ? ' ' + chip('Ours', 'chip-good') : ''}</td>
      <td class="num">${v ? num(v.km) : '—'}</td><td class="num ${(c.eq || 0) < 0 ? 't-bad' : ''}">${v ? money(c.eq || 0) : '—'}</td><td class="num">${c.credit}</td>
      <td>${bar(c.dealerLoy, 'accent', { tip: 'Dealer loyalty ' + pct(c.dealerLoy) })}</td><td class="num">${Math.round(c.sat)}</td>
      <td>${c.svc.last != null && serviceEligible(c) ? ago(c.svc.last) : '—'}</td><td>${custStage(c)}</td></tr>`;
  }).join('');
  const filters = `<div class="filters">
    <label class="fl-in">${icon('search')}<input type="search" id="cust-q" placeholder="Search name or vehicle" value="${esc(f.q)}" data-chg="filter" data-key="cust.q"></label>
    ${seg('cust.seg', [['all', 'All'], ['owner', 'Owners'], ['service', 'Service only'], ['prospect', 'Prospects'], ['lost', 'Lost']], f.seg, { act: 'filterSeg' })}
    ${seg('cust.quick', [['', 'Any'], ['equity', 'In equity'], ['lease', 'Lease ending'], ['overdue', 'Overdue service'], ['defected', 'Defected'], ['market', 'In market']], f.quick, { act: 'filterSeg' })}
    ${seg('cust', [['recent', 'Recent'], ['ltv', 'Lifetime value'], ['equity', 'Equity'], ['name', 'Name']], sk, { act: 'sortSeg' })}</div>`;
  return `<div class="kpis kpis-6">${kp}</div>
  ${panel('Customer database', filters + `<div class="tablewrap"><table class="t t-click"><thead><tr><th>Customer</th><th>Current vehicle</th><th class="num">Km</th><th class="num">Equity</th><th class="num">Credit</th><th>Loyalty</th><th class="num">Sat.</th><th>Last service</th><th>Stage</th></tr></thead><tbody>${rows || '<tr><td colspan="9" class="muted">No customers match.</td></tr>'}</tbody></table></div>${pager('cust', list.length, 40)}`,
    { flush: true, actions: `${btn('Send upgrade offers', 'upgradeOffers', {}, { cls: 'sm', icon: 'mail', tip: 'Equity-mining campaign to owners whose trade is worth more than they owe, or whose lease is ending. $6 per customer.' })}${btn('Call overdue customers', 'callOverdue', {}, { cls: 'sm ghost', icon: 'phone' })}` })}`;
};
function custStage(c) {
  if (c.status === 'lost') return pill('Lost sale', 'bad');
  if (c.inMarket) return pill(c.inMarket.us ? 'In market — with us' : 'In market — shopping', c.inMarket.us ? 'good' : 'warn');
  if (c.status === 'prospect') return pill(c.followUp != null ? 'Lead — follow-up' : 'Prospect', 'info');
  if (c.svc.defected) return pill('Servicing elsewhere', 'warn');
  if (c.svc.pending && !c.svc.appt) return pill('Service due', S.day - c.svc.pending.since > 7 ? 'warn' : 'info');
  if (c.svc.appt) return pill('Appointment booked', 'good');
  return pill(c.status === 'owner' ? 'Owner — loyal' : 'Service customer', 'neutral');
}
function custDrawer(id) {
  const c = cust(id); if (!c) return '';
  const v = c.veh;
  const trade = v ? acvOf(v) : 0, bal = v ? loanBalance(v.fin) : 0;
  const prefs = [['Price sensitivity', c.priceSens], ['Reliability', c.rel], ['Performance', c.perf], ['Fuel efficiency', c.eff], ['Technology', c.tech], ['Brand loyalty', c.brandLoy], ['Dealer loyalty', c.dealerLoy]];
  const stages = ['Lead', 'Purchase', 'Service', 'Loyalty', 'Trade cycle', 'Repeat'];
  const stIdx = c.status === 'prospect' || c.status === 'lost' ? 0 : c.inMarket ? 4 : (c.svc.visits >= 3 && !c.svc.defected ? 3 : c.svc.visits ? 2 : 1);
  const repeat = c.hist.filter(h => h[1] === 'purchase').length > 1;
  const warranty = v && v.warrantyEnd ? (S.day < v.warrantyEnd ? `Basic until ${fmtDate(v.warrantyEnd)}` : v.ptWarrantyEnd && S.day < v.ptWarrantyEnd ? `Powertrain until ${fmtDate(v.ptWarrantyEnd)}` : 'Expired') : 'None';
  const finTxt = !v ? '—' : v.fin.type === 'cash' ? 'Owned outright' : v.fin.type === 'lease' ? `Lease ${money(v.fin.pmt)}/mo, ends ${fmtDate(Math.round(v.fin.start + v.fin.term * 30.44))}` : `${money(v.fin.pmt)}/mo at ${v.fin.apr}% · ${v.fin.term} mo`;
  const hist = c.hist.map(h => `<li class="tl-${h[1]}"><span class="tl-d">${fmtDate(h[0])}</span><span>${esc(h[2])}</span>${h[3] != null ? `<b>${money(h[3])}</b>` : ''}</li>`).join('');
  return `<div class="drawer-h"><div><span class="eyebrow">${statusLabel(c)}${c.business ? ' · Fleet' : ''}</span><h2>${esc(fullName(c))}</h2></div><button class="icon-btn" data-act="closeDrawer" aria-label="Close">${icon('x')}</button></div>
  <div class="drawer-b">
    <ol class="lifecycle">${stages.map((s, i) => `<li class="${i < stIdx ? 'done' : i === stIdx ? 'now' : ''} ${i === 5 && repeat ? 'done' : ''}">${s}</li>`).join('')}</ol>
    <dl class="facts f2">
      ${c.business ? '' : `<div><dt>Age</dt><dd>${c.age}</dd></div><div><dt>Income</dt><dd>${money(c.inc)}</dd></div><div><dt>Household</dt><dd>${esc(c.hh)}</dd></div>`}
      <div><dt>Credit score</dt><dd>${c.credit} · ${creditTier(c.credit).n}</dd></div>
      <div><dt>Current vehicle</dt><dd>${v ? `${v.year} ${esc(v.make)} ${esc(v.model)}` : 'None'}</dd></div>
      <div><dt>Odometer</dt><dd>${v ? kmf(v.km) : '—'}</dd></div>
      <div><dt>Trade value (ACV)</dt><dd>${v ? money(trade) : '—'}</dd></div>
      <div><dt>Loan / lease payoff</dt><dd>${v ? money(bal) : '—'}</dd></div>
      <div><dt>Equity</dt><dd class="${trade - bal < 0 ? 't-bad' : 't-good'}">${v ? money(trade - bal) : '—'}</dd></div>
      <div><dt>Financing</dt><dd>${finTxt}</dd></div>
      <div><dt>Target payment</dt><dd>${money(c.budget)}/mo</dd></div>
      <div><dt>Primary concern</dt><dd>${concernLabel(c)}</dd></div>
      <div><dt>Negotiation</dt><dd>${NEG_STYLES[c.style].label} (${NEG_STYLES[c.style].difficulty.toLowerCase()})</dd></div>
      <div><dt>Warranty</dt><dd>${warranty}${v && v.ext ? ' + extended' : ''}${v && v.ppm ? ` · ${v.ppm} prepaid visits` : ''}</dd></div>
      <div><dt>Satisfaction</dt><dd>${Math.round(c.sat)}/100</dd></div>
      <div><dt>Lifetime gross</dt><dd>${money(c.ltv)}</dd></div>
    </dl>
    <h5>Preferences</h5><div class="prefs">${prefs.map(([l, x]) => `<div><span>${l}</span>${bar(x, 'accent')}<b>${pct(x)}</b></div>`).join('')}</div>
    <h5>Service relationship</h5>
    <dl class="facts f3"><div><dt>Last visit</dt><dd>${c.svc.last != null ? ago(c.svc.last) : 'Never'}</dd></div><div><dt>Visits</dt><dd>${c.svc.visits}</dd></div><div><dt>Spend</dt><dd>${money(c.svc.spend)}</dd></div>
      <div><dt>Next due</dt><dd>${serviceEligible(c) ? (c.svc.appt ? 'Booked' : c.svc.pending ? 'Due now' : fmtShort(c.svc.dueDay)) : '—'}</dd></div><div><dt>Missed visits</dt><dd>${c.svc.missed}</dd></div><div><dt>Status</dt><dd>${c.svc.defected ? 'Using another shop' : serviceEligible(c) ? 'With us' : 'Not serviced here'}</dd></div></dl>
    <div class="row-btns">${btn('Invite to showroom', 'invite', { id: c.id }, { cls: 'primary sm', icon: 'showroom' })}${serviceEligible(c) ? btn('Call to book service', 'callBook', { id: c.id }, { cls: 'sm', icon: 'phone' }) : ''}</div>
    <h5>History</h5><ul class="timeline">${hist || '<li class="muted">No history.</li>'}</ul>
  </div>`;
}

/* ---------------- Service ---------------- */
VIEWS.service = function () {
  const L = S.fin.mtd;
  const ros = S.svc.ros, ts = techs();
  const hrs = L.hours.cp + L.hours.warranty + L.hours.internal;
  const elr = L.hours.cp ? (sum(S.deals, () => 0) + (L.rev.labor - L.hours.warranty * WARRANTY_RATE - L.hours.internal * INTERNAL_RATE)) / L.hours.cp : 0;
  const avail = sum(ts.filter(t => t.status !== 'gone'), t => t.mtd.hours);
  const kp = [
    kpi('Open repair orders', ros.filter(r => r.pay !== 'internal').length, `${ros.filter(r => r.waitDays > 0 && r.pay !== 'internal').length} carried over`, { tone: ros.filter(r => r.waitDays >= 2).length > 3 ? 'warn' : '' }),
    kpi('ROs closed MTD', L.ros.cp + L.ros.warranty, `${L.ros.cp} customer-pay · ${L.ros.warranty} warranty`),
    kpi('Hours sold MTD', num(hrs, 0), `${num(L.hours.internal, 0)} internal recon`),
    kpi('Effective labour rate', money(elr), `Door rate ${money(S.settings.laborRate)} · indy ${money(indyRate())}`, { tip: 'Customer-pay labour revenue divided by customer-pay hours. Menu-priced oil changes, prepaid plans and discounts pull it below the door rate.' }),
    kpi('Next open appointment', `${S.kpiCache.lead} day${S.kpiCache.lead === 1 ? '' : 's'}`, 'Long waits push customers elsewhere', { tone: S.kpiCache.lead > 4 ? 'bad' : S.kpiCache.lead > 2 ? 'warn' : 'good' }),
    kpi('Service CSI', Math.round(kpiServiceCsi()), `${L.comebacks} comebacks MTD`, { tone: kpiServiceCsi() < 78 ? 'warn' : '' }),
  ].join('');
  // bay board
  const nb = bayCount();
  const working = ros.filter(r => r.status === 'working');
  const queuedForBays = ros.filter(r => r.status === 'queued').slice(0, Math.max(0, nb - working.length));
  const bays = [];
  for (let i = 0; i < nb; i++) {
    const ro = working[i] || null;
    const t = ro && ro.tech ? empById(ro.tech) : null;
    bays.push(`<div class="bay ${ro ? 'busy' : ''}"><div class="bay-n">Bay ${i + 1}</div>${ro ? `<b>${esc(ro.desc)}</b><small>${esc(roCustomerName(ro))}${ro.vehDesc ? ' · ' + esc(ro.vehDesc) : ''}</small>${bar(1 - ro.left / ro.hrs, ro.pay === 'internal' ? 'info' : 'accent')}<small class="muted">${t ? esc(empName(t)) : '—'} · ${num(ro.left, 1)} of ${num(ro.hrs, 1)} h left</small>` : `<span class="muted">${queuedForBays[i - working.length] ? 'Next: ' + esc(queuedForBays[i - working.length].desc) : 'Open'}</span>`}</div>`);
  }
  const sorted = ros.slice().sort((a, b) => roPriority(b) - roPriority(a));
  const roRows = sorted.map(r => {
    const t = r.tech ? empById(r.tech) : null;
    return `<tr class="${r.status === 'parts' ? 'row-warn' : ''}"><td class="mono">${r.num}</td><td>${esc(roCustomerName(r))}<small class="muted block">${esc(r.vehDesc || '')}${r.km ? ' · ' + num(r.km) + ' km' : ''}</small></td>
      <td>${esc(r.desc)}${r.upsell.length ? `<small class="muted block">+ ${esc(r.upsell.join(', '))}</small>` : ''}</td><td>${TECH_TIERS[r.skill].split(' ')[0]}${r.ev ? ' · EV' : ''}</td>
      <td class="num">${num(r.hrs, 1)}${r.left < r.hrs ? `<small class="muted block">${num(r.left, 1)} left</small>` : ''}</td>
      <td>${r.parts.length ? (r.parts.every(l => l.ok) ? pill('Pulled', 'good') : r.status === 'parts' ? pill('Back-ordered', 'bad') : pill(r.parts.length + ' lines', 'neutral')) : '—'}</td>
      <td>${{ cp: 'Customer pay', warranty: 'Warranty', internal: 'Internal' }[r.pay]}</td><td class="num">${r.waitDays}${r.loaner ? ' ' + chip('Loaner') : ''}</td>
      <td>${{ queued: pill('Queued', 'neutral'), working: pill('In bay', 'info'), parts: pill('Waiting parts', 'warn') }[r.status]}</td><td>${t ? esc(empName(t)) : '—'}</td></tr>`;
  }).join('');
  const load = [];
  for (let i = 0; i < 14; i++) { const d = S.day + i; const cap = shopCapacity(d); load.push({ label: DOW[dparts(d).dow][0] + dparts(d).dom, value: round2(bookedHours(d)), tip: `<b>${fmtDate(d, { dow: true })}</b><br>Booked ${num(bookedHours(d), 1)} h<br>Capacity ${num(cap, 1)} h`, tone: cap > 0 && bookedHours(d) > cap * 0.88 ? 'warn' : null, cap }); }
  const loadChart = colChart(load, { h: 170, fmt: v => num(v), line: load.map(l => l.cap * 0.88), label: 'Booked hours vs bookable capacity' });
  const techRows = ts.map(t => `<tr><td><b>${esc(empName(t))}</b>${t.ev ? ' ' + chip('EV', 'chip-good') : ''}</td><td>${TECH_TIERS[t.tier]}</td><td class="num">${t.eff.toFixed(2)}</td><td>${bar(t.skill / 100, 'accent', { tip: 'Skill ' + Math.round(t.skill) })}</td><td>${bar(t.morale / 100, moraleTone(t.morale), { tip: 'Morale ' + Math.round(t.morale) })}</td><td class="num">${num(t.mtd.hours, 1)}</td><td class="num">$${t.flat.toFixed(2)}</td><td>${t.status === 'training' ? pill('Training', 'info') : t.absent ? pill('Sick', 'warn') : pill('Present', 'good')}</td></tr>`).join('');
  const st = S.settings;
  const settings = `<div class="form">
    <label class="fl"><span>Customer-pay labour rate <b>${money(st.laborRate)}/hr</b></span><input type="range" id="svc-rate" min="110" max="230" step="5" value="${st.laborRate}" data-chg="laborRate"><small class="muted">Independent shops: ${money(indyRate())}/hr. A wide gap drives out-of-warranty customers away.</small></label>
    <label class="fl"><span>Oil change menu price <b>${money(st.oilPrice)}</b></span><input type="range" id="svc-oil" min="49" max="159" step="5" value="${st.oilPrice}" data-chg="oilPrice"><small class="muted">SpeedLane Lube charges ${money(quickLubePrice())}.</small></label>
    <label class="fl"><span>Dispatch priority</span>${seg('roFocus', [['waiting', 'Waiting customers'], ['cp', 'Customer pay'], ['recon', 'Used recon']], st.roFocus)}</label>
    <label class="fl"><span>Loaner fleet <b>${st.loaners} cars</b> · ${S.svc.loanersOut} out today</span><div class="stepper"><button type="button" class="btn sm ghost" data-act="loaners" data-val="-1" aria-label="Fewer loaners">${icon('minus')}</button><b>${st.loaners}</b><button type="button" class="btn sm ghost" data-act="loaners" data-val="1" aria-label="More loaners">${icon('plus')}</button></div><small class="muted">$650/month each. Customers waiting overnight without one lose satisfaction.</small></label>
    <div class="fl"><span>Service bays <b>${nb}</b></span>${btn('Add a bay — $95,000', 'addBay', {}, { cls: 'sm', icon: 'plus', disabled: S.svc.bays >= 10 })}<small class="muted">Techs beyond the bay count can't work at the same time unless you run extended hours.</small></div></div>`;
  return `<div class="kpis kpis-6">${kp}</div>
  ${panel('Shop floor', `<div class="bays">${bays.join('')}</div>`, { sub: `${working.length} of ${nb} bays working · ${ros.filter(r => r.status === 'queued').length} queued · ${ros.filter(r => r.status === 'parts').length} waiting on parts` })}
  <div class="grid g-2-1">
    ${panel('Repair orders', `<div class="tablewrap"><table class="t"><thead><tr><th>RO</th><th>Customer</th><th>Concern</th><th>Skill</th><th class="num">Hours</th><th>Parts</th><th>Pay type</th><th class="num">Days</th><th>Status</th><th>Tech</th></tr></thead><tbody>${roRows || '<tr><td colspan="10" class="muted">No open repair orders.</td></tr>'}</tbody></table></div>`, { flush: true })}
    <div class="stack">${panel('Appointment load', loadChart + `<p class="hint">Columns: booked flat-rate hours. Dashed line: bookable capacity (88% of what present techs can produce).</p>`, { sub: 'Next 14 days' })}${panel('Shop settings', settings)}</div>
  </div>
  ${panel('Technicians', `<div class="tablewrap"><table class="t"><thead><tr><th>Technician</th><th>Level</th><th class="num">Efficiency</th><th>Skill</th><th>Morale</th><th class="num">Flagged MTD</th><th class="num">Flat rate</th><th>Today</th></tr></thead><tbody>${techRows}</tbody></table></div>`, { flush: true, sub: 'Efficiency = flagged hours produced per clock hour. Flat-rate techs earn only on hours flagged, so idle bays hurt their morale.' })}`;
};

/* ---------------- Parts ---------------- */
VIEWS.parts = function () {
  const L = S.fin.mtd;
  const onOrder = sum(S.porders, o => o.cost);
  const waiting = S.svc.ros.filter(r => r.status === 'parts').length;
  const kp = [
    kpi('Inventory value', moneyK(partsValue()), `${S.parts.filter(p => p.qoh > 0).length} active part numbers`),
    kpi('First-time fill rate', pct(fillRate()), 'Repair orders filled from stock', { tone: fillRate() < 0.85 ? 'warn' : '' }),
    kpi('Obsolete stock', money(obsoleteValue()), 'No sale in 270+ days', { tone: obsoleteValue() > 1500 ? 'warn' : '' }),
    kpi('On order', money(onOrder), `${S.porders.length} open orders · paid on receipt`),
    kpi('Parts gross MTD', moneyK(L.rev.parts - L.cogs.parts), `${pct(L.rev.parts ? (L.rev.parts - L.cogs.parts) / L.rev.parts : 0)} margin`),
    kpi('ROs waiting on parts', waiting, 'Customers are waiting', { tone: waiting ? 'bad' : '' }),
  ].join('');
  const rows = S.parts.map(p => {
    const status = p.obsolete ? pill('Obsolete', 'bad') : p.qoh === 0 ? (p.recall || p.legacy ? pill('None', 'neutral') : pill('Out', 'bad')) : p.qoh <= p.min ? pill('Low', 'warn') : pill('OK', 'good');
    return `<tr class="${p.obsolete ? 'row-warn' : ''}"><td class="mono">${p.pn}</td><td><b>${esc(p.desc)}</b><small class="muted block">${esc(p.cat)}</small></td>
      <td class="num">${p.qoh}</td><td class="num"><input class="num-in xs" type="number" min="0" value="${p.min}" data-chg="partMin" data-pn="${p.pn}" aria-label="Minimum for ${p.pn}"></td><td class="num"><input class="num-in xs" type="number" min="0" value="${p.max}" data-chg="partMax" data-pn="${p.pn}" aria-label="Maximum for ${p.pn}"></td>
      <td class="num">${p.onOrder || '—'}</td><td class="num">${p.used90}</td><td class="num">${money(p.cost)}</td><td class="num">${p.retail ? money(p.retail) : 'Warranty'}</td><td class="num">${partLead(p)}d</td><td class="num">${money(p.qoh * p.cost)}</td><td>${status}</td>
      <td class="acts"><label class="tog" data-tip="Automatic replenishment to max when stock hits min"><input type="checkbox" data-chg="partAuto" data-pn="${p.pn}" ${p.auto ? 'checked' : ''}><span>Auto</span></label>${btn('Order', 'partOrder', { pn: p.pn }, { cls: 'ghost xs' })}${p.obsolete || p.legacy ? btn('Return', 'partReturn', { pn: p.pn }, { cls: 'ghost xs', disabled: !p.qoh }) : ''}</td></tr>`;
  }).join('');
  const orders = S.porders.slice().sort((a, b) => a.eta - b.eta).map(o => { const p = partByPn(o.pn); return `<tr><td class="mono">${o.pn}</td><td>${esc(p.desc)}</td><td class="num">${o.qty}</td><td class="num">${money(o.cost)}</td><td>${o.kind === 'special' ? pill('Special order', 'warn') : pill('Stock order', 'neutral')}</td><td>${fmtShort(o.eta)}</td></tr>`; }).join('');
  return `<div class="kpis kpis-6">${kp}</div>
  ${panel('Parts inventory', `<div class="tablewrap"><table class="t"><thead><tr><th>Part #</th><th>Description</th><th class="num">On hand</th><th class="num">Min</th><th class="num">Max</th><th class="num">On order</th><th class="num">Used 90d</th><th class="num">Cost</th><th class="num">Retail</th><th class="num">Lead</th><th class="num">Value</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`,
    { flush: true, sub: 'Stock too thin and repair orders wait for parts; too deep and cash sits on the shelf. Discontinued-model parts go obsolete.', actions: `<label class="tog"><input type="checkbox" data-chg="autoReorder" ${S.settings.autoReorder ? 'checked' : ''}><span>Auto-replenish enabled</span></label>` })}
  ${panel('Orders in transit', orders ? `<div class="tablewrap"><table class="t compact"><thead><tr><th>Part #</th><th>Description</th><th class="num">Qty</th><th class="num">Cost</th><th>Type</th><th>ETA</th></tr></thead><tbody>${orders}</tbody></table></div>` : empty('Nothing on order.'), { flush: true })}`;
};

/* ---------------- Employees ---------------- */
VIEWS.employees = function () {
  const tab = UI.tab.emp || 'all';
  const staff = S.emps.filter(e => e.status !== 'gone');
  const list = staff.filter(e => tab === 'all' || ROLES[e.role].dept === tab);
  const payrollMtd = S.fin.mtd.exp.payroll + S.fin.mtd.techPay;
  const kp = [
    kpi('Headcount', staff.length, `${staff.filter(e => e.role === 'tech').length} technicians · ${staff.filter(e => e.role === 'sales').length} sales`),
    kpi('Payroll MTD', moneyK(payrollMtd), 'Salaries, commissions & flat-rate'),
    kpi('Average morale', Math.round(avg(staff, e => e.morale)), `${staff.filter(e => e.morale < 40).length} at risk of leaving`, { tone: avg(staff, e => e.morale) < 50 ? 'warn' : '' }),
    kpi('Training completion', pct(trainingCompletion()), `Aurex target ${pct(S.oem.targets.training)}`, { tone: trainingCompletion() < S.oem.targets.training ? 'warn' : 'good' }),
    kpi('Out today', staff.filter(e => e.absent || e.status === 'training').length, `${staff.filter(e => e.absent).length} sick · ${staff.filter(e => e.status === 'training').length} training`),
  ].join('');
  const rows = list.map(e => {
    const r = ROLES[e.role];
    const prod = e.role === 'sales' || e.role === 'gsm' ? `${e.mtd.units} units · ${moneyK(e.mtd.gross)}` : e.role === 'tech' ? `${num(e.mtd.hours, 1)} h flagged` : e.role === 'advisor' ? `${e.mtd.ros} ROs · ${moneyK(e.mtd.gross)}` : e.role === 'fi' ? `${e.mtd.units} deals · ${moneyK(e.mtd.gross)}` : '—';
    const pay = e.role === 'tech' ? `$${e.flat.toFixed(2)}/h` : money(e.salary);
    return `<tr><td><b>${esc(empName(e))}</b><small class="muted block">Since ${fmtDate(e.hired)}</small></td><td>${e.role === 'tech' ? TECH_TIERS[e.tier] : r.title}${e.ev ? ' ' + chip('EV', 'chip-good') : ''}${e.certs.length ? ' ' + chip(e.certs.length + ' cert', '') : ''}</td>
      <td>${bar(e.skill / 100, 'accent', { tip: 'Skill ' + Math.round(e.skill) })}</td><td class="num">${e.exp.toFixed(1)} yr</td><td>${bar(e.morale / 100, moraleTone(e.morale), { tip: 'Morale ' + Math.round(e.morale) })}</td>
      <td>${prod}</td><td class="num">${Math.round(e.csi)}</td><td class="num">${pay}${e.comm ? `<small class="muted block">+${pct(e.comm, e.comm < 0.1 ? 1 : 0)} ${esc(r.commOn)}</small>` : ''}</td><td class="num">${pct(e.absence, 1)}</td>
      <td>${e.status === 'training' ? pill('Training', 'info') : e.absent ? pill('Sick', 'warn') : e.morale < 35 ? pill('Flight risk', 'bad') : pill('Active', 'good')}</td>
      <td class="acts">${btn('Train', 'empTrain', { id: e.id }, { cls: 'ghost xs', disabled: e.status !== 'active' })}${btn('Pay', 'empComp', { id: e.id }, { cls: 'ghost xs' })}${btn('Promote', 'empPromote', { id: e.id }, { cls: 'ghost xs', disabled: !promotionOptions(e).length })}${btn('Fire', 'empFire', { id: e.id }, { cls: 'ghost xs danger-t' })}</td></tr>`;
  }).join('');
  const gone = S.emps.filter(e => e.status === 'gone').slice(-6).reverse();
  return `<div class="kpis kpis-5">${kp}</div>
  ${panel('Team', `<div class="filters">${seg('emp', [['all', 'All'], ['Sales', 'Sales'], ['Fixed Ops', 'Fixed operations'], ['Retention', 'Retention / BDC']], tab, { act: 'tabSeg' })}</div><div class="tablewrap"><table class="t"><thead><tr><th>Name</th><th>Role</th><th>Skill</th><th class="num">Exp.</th><th>Morale</th><th>Productivity MTD</th><th class="num">CSI</th><th class="num">Pay</th><th class="num">Absence</th><th>Status</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="11" class="muted">No one in this department yet.</td></tr>'}</tbody></table></div>`,
    { flush: true, actions: btn('Hire', 'openHire', {}, { cls: 'primary sm', icon: 'plus' }) })}
  ${gone.length ? panel('Recent departures', `<ul class="mini-list">${gone.map(e => `<li><span><b>${esc(empName(e))}</b><small>${e.role === 'tech' ? TECH_TIERS[e.tier] : ROLES[e.role].title} · left ${fmtDate(e.left)}</small></span></li>`).join('')}</ul>`, { flush: true }) : ''}`;
};
function hireModal() {
  const role = UI.hireRole || 'sales';
  const cands = S.cands[role] || [];
  const r = ROLES[role];
  const cards = cands.map(e => `<article class="cand"><div class="cand-h"><b>${esc(empName(e))}</b>${role === 'tech' ? chip(TECH_TIERS[e.tier]) : ''}${e.ev ? chip('EV certified', 'chip-good') : ''}</div>
    <div class="prefs"><div><span>Skill</span>${bar(e.skill / 100)}<b>${Math.round(e.skill)}</b></div><div><span>Customer rating</span>${bar(e.csi / 100)}<b>${Math.round(e.csi)}</b></div></div>
    <dl class="facts f2"><div><dt>Experience</dt><dd>${e.exp.toFixed(1)} years</dd></div><div><dt>Asking</dt><dd>${role === 'tech' ? '$' + e.flat.toFixed(2) + '/flagged hr' : money(e.salary) + '/yr'}</dd></div>${role === 'tech' ? `<div><dt>Efficiency</dt><dd>${e.eff.toFixed(2)}</dd></div>` : ''}<div><dt>Absence history</dt><dd>${pct(e.absence, 1)}</dd></div></dl>
    ${btn('Hire', 'hire', { role, id: e.id }, { cls: 'primary sm' })}</article>`).join('');
  return `<div class="modal-h"><div><span class="eyebrow">Recruiting</span><h2>Hire staff</h2></div><button class="icon-btn" data-act="closeModal" aria-label="Close">${icon('x')}</button></div>
  <div class="modal-b">${seg('hireRole', Object.entries(ROLES).map(([k, v]) => [k, v.short]), role, { act: 'hireRole' })}
    <p class="hint">${esc(r.title)} · market base ${role === 'tech' ? 'flat rate $' + TECH_FLAT[2] + '–$' + TECH_FLAT[4] + '/hr' : money(r.base)}${r.comm ? ` + ${pct(r.comm, 1)} of ${esc(r.commOn)}` : ''}. ${role === 'tech' ? 'Recruiting fee $3,200.' : 'Recruiting fee about 6% of salary.'} New candidates every Monday; competitor hiring and your reputation affect the pool.</p>
    <div class="cands">${cards || empty('No candidates left this week.')}</div></div>`;
}
function empModal(kind, id) {
  const e = empById(id); if (!e) return '';
  const head = `<div class="modal-h"><div><span class="eyebrow">${e.role === 'tech' ? TECH_TIERS[e.tier] : ROLES[e.role].title}</span><h2>${esc(empName(e))}</h2></div><button class="icon-btn" data-act="closeModal" aria-label="Close">${icon('x')}</button></div>`;
  if (kind === 'train') {
    const list = COURSES.filter(c => c.roles.includes(e.role));
    return head + `<div class="modal-b"><p class="hint">Training takes the employee off the floor for the course length, then raises skill, customer rating and morale. Certifications count toward the Aurex training objective.</p>
      <div class="opts col">${list.map(c => `<button type="button" class="opt" data-act="train" data-id="${e.id}" data-course="${c.id}" ${e.certs.includes(c.id) && c.cert ? 'disabled' : ''}><b>${esc(c.name)}</b><small>${money(c.cost)} · ${c.days} day${c.days > 1 ? 's' : ''} · +${c.skill} skill${c.cert ? ' · OEM certification' : ''}${c.ev ? ' · unlocks EV repairs' : ''}${e.certs.includes(c.id) && c.cert ? ' · already certified' : ''}</small></button>`).join('') || empty('No courses for this role.')}</div></div>`;
  }
  if (kind === 'comp') {
    const tech = e.role === 'tech';
    const mkt = tech ? marketFlat(e.tier, e.skill) : marketSalary(e.role, e.skill);
    return head + `<div class="modal-b"><dl class="facts f3"><div><dt>Current</dt><dd>${tech ? '$' + e.flat.toFixed(2) + '/hr' : money(e.salary)}</dd></div><div><dt>Market for skill ${Math.round(e.skill)}</dt><dd>${tech ? '$' + mkt.toFixed(2) + '/hr' : money(mkt)}</dd></div><div><dt>Morale</dt><dd>${Math.round(e.morale)}</dd></div></dl>
      <form class="form" data-form="comp" data-id="${e.id}">
      ${tech ? `<label class="fl"><span>Flat rate ($ per flagged hour)</span><input class="num-in" type="number" id="comp-flat" name="flat" step="0.25" min="20" max="80" value="${e.flat.toFixed(2)}"></label>`
        : `<label class="fl"><span>Annual salary</span><input class="num-in" type="number" id="comp-salary" name="salary" step="500" min="20000" max="300000" value="${e.salary}"></label>${ROLES[e.role].comm ? `<label class="fl"><span>Commission (% of ${esc(ROLES[e.role].commOn)})</span><input class="num-in" type="number" id="comp-comm" name="comm" step="0.5" min="0" max="40" value="${(e.comm * 100).toFixed(1)}"></label>` : ''}`}
      <p class="hint">Raises lift morale quickly. Cuts hit morale about twice as hard.</p>
      <div class="modal-f">${btn('Cancel', 'closeModal', {}, { cls: 'ghost' })}<button class="btn primary" type="submit">${icon('check')}<span>Apply</span></button></div></form></div>`;
  }
  if (kind === 'promote') {
    const opts = promotionOptions(e);
    return head + `<div class="modal-b"><div class="opts col">${opts.map(o => `<button type="button" class="opt" data-act="promote" data-id="${e.id}" data-to="${o.to}" ${o.ok ? '' : 'disabled'}><b>${esc(o.label)}</b><small>${o.ok ? 'Raises pay about 12% and morale +15.' : esc(o.why)}</small></button>`).join('')}</div></div>`;
  }
  if (kind === 'fire') {
    const sev = e.role === 'tech' ? 80 * e.flat : e.salary / 26;
    return head + `<div class="modal-b"><p>Let ${esc(empName(e))} go? Severance is ${money(sev)} (two weeks' pay). Co-workers in ${ROLES[e.role].dept} will take a morale hit unless the person was a poor performer.</p></div>
      <div class="modal-f">${btn('Keep them', 'closeModal', {}, { cls: 'ghost' })}${btn('Confirm termination', 'fire', { id: e.id }, { cls: 'danger' })}</div>`;
  }
  return '';
}
