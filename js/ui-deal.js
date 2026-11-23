'use strict';
/* =====================================================================
   Dealer Empire — the deal, played face to face.
   You pick moves; the customer answers. The full worksheet is still
   there under "Fine-tune the numbers".
   ===================================================================== */

function dealFace(v, r) { return clamp(Math.round(v.mood * 0.5 + (r ? r.prob * 100 : 50) * 0.5), 0, 100); }
function renderDealScene() {
  const v = negVisit(); if (!v) return '';
  const c = cust(v.cid), N = UI.neg;
  if (N.done) return dealDone(v, c);
  const d = N.deal, veh = d ? vehById(d.vid) : null;
  const r = veh ? evalDeal(v, d) : null;
  const s = r ? sentiment(r.prob) : { label: 'Browsing', tone: 'neutral', lvl: 3 };
  const said = v.log.filter(m => m.who !== 'system');
  const last = said[said.length - 1];
  const sys = v.log.filter(m => m.who === 'system').slice(-1)[0];
  const tr = v.trade;
  const traits = [
    `Wants: ${c.wantNew === 'used' ? 'used ' : c.wantNew === 'new' ? 'new ' : ''}${CLS_LABEL[c.wantCls].toLowerCase()}`,
    `Budget ~${money(v.targetPmt)}/mo`, `Credit ${creditTier(c.credit).n}`, `Cares about ${concernLabel(c).toLowerCase()}`,
    NEG_STYLES[c.style].label + ' negotiator', tr ? `Trade: ${tr.spec.year} ${tr.spec.make} ${tr.spec.model}` : 'No trade-in',
  ];
  const history = v.log.slice(0, -1).slice(-5).map(m => `<li class="h-${m.who}">${m.who === 'customer' ? `<b>${esc(c.fn)}:</b> ` : m.who === 'you' ? '<b>You:</b> ' : ''}${esc(m.text)}</li>`).join('');
  return `<div class="scene">
    <div class="scene-bg" aria-hidden="true"></div>
    <header class="scene-h"><span class="eyebrow">${esc(srcLabel(v.source))} · walked in at ${v.time}</span><button class="icon-btn" data-act="closeNeg" aria-label="Leave the conversation">${icon('x')}</button></header>
    <div class="scene-main">
      <section class="scene-cust">
        <div class="pframe pframe-${s.tone}">${portrait(v.cid, dealFace(v, r))}</div>
        <div class="nameplate"><b>${esc(fullName(c))}</b><small>${c.age} · ${esc(c.hh)}</small></div>
        <div class="speech">${last ? esc(last.text) : '…'}</div>
        ${sys ? `<div class="speech-sys">${icon('info')}<span>${esc(sys.text)}</span></div>` : ''}
        <div class="mood mood-${s.tone}">${meter(s.lvl, s.tone)}<b>${s.label}</b><span class="pat">${[...Array(Math.max(0, v.patience))].map(() => '<i></i>').join('')}</span></div>
        <ul class="traits">${traits.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      </section>
      <section class="scene-desk">
        ${veh ? dealCard(v, d, veh, r) : `<div class="deal-card"><p>Nothing in stock suits this customer. Order inventory or hand them to the team.</p></div>`}
        ${veh ? `<div class="moves">${dealMoves(v, d, veh, r)}</div>` : ''}
        ${history ? `<ul class="history">${history}</ul>` : ''}
        <details class="numbers" ${N.showNumbers ? 'open' : ''} data-act="toggleNumbers"><summary>${icon('cog')}<span>Fine-tune the numbers</span></summary>
          <div class="numbers-b">${negVehiclePicker(v)}${veh ? negWorksheet(v, d, veh) : ''}<div id="neg-live" class="numbers-live">${veh ? negLive(v, d) : ''}</div></div>
        </details>
      </section>
    </div>
  </div>`;
}
function dealCard(v, d, veh, r) {
  const isNew = veh.kind === 'new';
  return `<div class="deal-card" id="deal-card">
    <div class="dc-veh"><span class="dc-swatch" style="background:${carColor(veh)}"></span><div><b>${esc(vehName(veh, true))}</b><small>${isNew ? `${esc(veh.eng)} · ${veh.dr}` : `${kmf(veh.km)} · ${condLabel(veh.cond)}`} · ${pill(fitLabel(r.fit)[0], fitLabel(r.fit)[1])}</small></div></div>
    <div class="dc-nums">
      <div><small>${isNew ? 'Sticker' : 'Asking'}</small><b>${money(startPrice(veh))}</b></div>
      <div><small>Your price</small><b id="dc-price">${money(d.price)}</b></div>
      <div><small>${d.type === 'cash' ? 'Cash due' : d.type === 'lease' ? `Lease ${d.term} mo` : `Finance ${d.term} mo`}</small><b id="dc-pmt" class="dc-big">${d.type === 'cash' ? moneyK(r.totalDue) : money(r.pmt) + '<small>/mo</small>'}</b></div>
      <div><small>Your gross</small><b id="dc-gross" class="${r.total < 0 ? 't-bad' : 't-good'}">${money(r.total)}</b></div>
    </div>
    ${v.trade ? `<div class="dc-trade">Trade allowance <b id="dc-trade">${money(d.trade)}</b>${v.appraised ? ` <small>(ACV ${money(v.trade.acv)})</small>` : ''}</div>` : ''}
  </div>`;
}
function updateDealCard() {
  const v = negVisit(); if (!v || !UI.neg.deal) return;
  const d = UI.neg.deal, r = evalDeal(v, d); if (!r) return;
  const set = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
  set('dc-price', money(d.price));
  set('dc-pmt', d.type === 'cash' ? moneyK(r.totalDue) : money(r.pmt) + '<small>/mo</small>');
  const g = document.getElementById('dc-gross'); if (g) { g.textContent = money(r.total); g.className = r.total < 0 ? 't-bad' : 't-good'; }
  set('dc-trade', money(d.trade));
}
function dealMoves(v, d, veh, r) {
  const moves = [];
  const mv = (act, label, sub, opt = {}) => moves.push(`<button type="button" class="move ${opt.cls || ''}" data-act="${act}" ${opt.val != null ? `data-val="${opt.val}"` : ''} ${opt.disabled ? 'disabled' : ''}>${opt.icon ? icon(opt.icon) : ''}<span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span></button>`);
  if (v.counter) mv('negAcceptCounter', 'Take their offer', v.counter.text, { cls: 'move-key', icon: 'check' });
  mv('dealPitch', `Offer ${money(d.price)}`, d.type === 'cash' ? 'Cash deal' : `${money(r.pmt)}/mo for ${d.term} months`, { cls: v.counter ? '' : 'move-key', icon: 'deal' });
  mv('dealDrop', 'Knock off $500', `Offer ${money(d.price - 500)}`, { val: 500, icon: 'trenddown' });
  mv('dealDrop', 'Knock off $1,500', `Offer ${money(d.price - 1500)}`, { val: 1500, icon: 'trenddown' });
  if (v.trade) mv('dealTrade', 'More for their trade', `Allow ${money(d.trade + 750)}`, { icon: 'used' });
  if (d.type === 'finance' && d.term < 84) mv('dealTerm', `Stretch to ${d.term + 12} months`, 'Lowers the payment', { icon: 'clock' });
  if (!v.threw) mv('dealThrow', 'Throw in winter tires', `Costs you ${money(ACCESSORY.winter.cost)}`, { icon: 'star' });
  mv('dealOther', 'Show them something else', 'Next best match on the lot', { icon: 'car' });
  if (!v.td) mv('negTD', 'Take a test drive', 'Builds desire if it fits', { icon: 'car' });
  if (v.trade && !v.appraised) mv('negAppraise', 'Appraise their trade', 'See what it is really worth', { icon: 'search' });
  if (!v.to && present('gsm').length) mv('negTO', 'Bring in your sales manager', 'Buys one more round', { icon: 'user' });
  mv('closeNeg', 'Hand them to the team', 'A consultant takes over', { cls: 'move-quiet', icon: 'customers' });
  return moves.join('');
}
function dealDone(v, c) {
  const D = UI.neg.done;
  if (D.lost) {
    return `<div class="scene scene-end"><div class="scene-bg" aria-hidden="true"></div>
      <div class="end-card"><div class="pframe pframe-bad">${portrait(v.cid, 12)}</div>
        <h2>${esc(c.fn)} walked out</h2><p class="speech">${esc(D.text)}</p>
        <p class="muted">${D.comp ? 'They are heading to a competitor.' : 'They might come back — your team will follow up.'}</p>
        ${btn('Back to the floor', 'closeNeg', {}, { cls: 'primary' })}</div></div>`;
  }
  const { deal, csi } = D;
  return `<div class="scene scene-end"><div class="scene-bg" aria-hidden="true"></div>
    <div class="end-card won"><div class="stamp">SOLD</div><div class="pframe pframe-good">${portrait(v.cid, 96)}</div>
      <h2>${esc(c.fn)} is driving home in a ${esc(deal.veh)}</h2>
      <p class="speech">“${esc((v.log.filter(m => m.who === 'customer').slice(-1)[0] || {}).text || 'You have a deal.')}”</p>
      <div class="end-nums"><div><small>Front</small><b>${money(deal.front)}</b></div><div><small>F&I</small><b>${money(deal.back)}</b></div><div><small>Total gross</small><b class="${deal.total >= 0 ? 't-good' : 't-bad'}">${money(deal.total)}</b></div><div><small>Their rating</small><b>${csi}/100</b></div></div>
      <p class="muted small">${deal.type === 'cash' ? 'Paid cash.' : `${deal.type === 'lease' ? 'Leased' : 'Financed'} at ${money(deal.pmt)}/mo for ${deal.term} months.`}${deal.trade ? ` Their ${esc(deal.trade)} is now in your used department.` : ''}</p>
      ${btn('Back to the floor', 'closeNeg', {}, { cls: 'primary' })}</div></div>`;
}
const DEAL_ACT = {
  dealPitch() { dealSay('you', pick(['Here is where we can be.', 'Let me show you the numbers.', 'This is a strong deal.'])); negPresent(); return 'skip'; },
  dealDrop(d) { const deal = UI.neg.deal; deal.price = Math.max(0, deal.price - +d.val); dealSay('you', `I can take ${money(+d.val)} off — ${money(deal.price)}.`); negPresent(); return 'skip'; },
  dealTrade() { const v = negVisit(), deal = UI.neg.deal; if (!v.trade) return; deal.trade += 750; dealSay('you', `I'll give you ${money(deal.trade)} for your ${v.trade.spec.model}.`); negPresent(); return 'skip'; },
  dealTerm() {
    const v = negVisit(), deal = UI.neg.deal, c = cust(v.cid), veh = vehById(deal.vid);
    const mk = deal.rate - buyRate(c.credit, deal.term, veh.kind === 'used');
    deal.term = Math.min(96, deal.term + 12); deal.rate = round2(buyRate(c.credit, deal.term, veh.kind === 'used') + mk);
    dealSay('you', `Spread over ${deal.term} months, the payment comes down.`); negPresent(); return 'skip';
  },
  dealThrow() {
    const v = negVisit(), deal = UI.neg.deal; if (v.threw) return;
    v.threw = true; if (!deal.acc.includes('winter')) deal.acc.push('winter');
    deal.price = Math.max(0, deal.price - ACCESSORY.winter.price); v.boost = (v.boost || 0) + 0.15; v.mood = clamp(v.mood + 5, 0, 100);
    dealSay('you', 'I will throw in a set of winter tires and wheels at no charge.'); negPresent(); return 'skip';
  },
  dealOther() {
    const v = negVisit(); if (!v) return;
    const cur = UI.neg.deal && UI.neg.deal.vid;
    const list = rankVehicles(v, 12).filter(x => x.v.id !== cur);
    const next = (UI.neg.suggest && list.find(x => x.v.id === UI.neg.suggest)) || list[0];
    if (!next) { dealSay('system', 'Nothing else on the lot suits them.'); return; }
    ACT.negVeh({ id: next.v.id });
    v.log.push({ who: 'customer', text: next.fit > 0.75 ? `Oh, the ${vehName(next.v, true)}? I like that.` : `The ${vehName(next.v, true)}… maybe. What would that cost me?` });
  },
  toggleNumbers(d, el, e) { if (e.target.closest('summary')) { e.preventDefault(); UI.neg.showNumbers = !UI.neg.showNumbers; } else return 'skip'; },
};
function dealSay(who, text) { const v = negVisit(); if (v) v.log.push({ who, text }); }
