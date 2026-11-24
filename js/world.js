'use strict';
/* =====================================================================
   Dealer Empire — the dealership, drawn as an isometric world.
   Everything you see is derived from the simulation: lot cars are the
   real inventory, people in the showroom are the real customers, cars on
   the lifts are the real repair orders.
   ===================================================================== */

const TW = 64, TH = 32;
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
}
const WORLD_W = 46, WORLD_H = 34;
const MAP = {
  walkY0: 29.2, walkY1: 30.2, roadY0: 30.2, roadY1: 33.9, laneE: 31.1, laneW: 32.9,
  drvX: 22.4, aisleA: 18.7, aisleB: 22.75, rowA: 20.65, rowB: 24.8, rowC: 27.75, pedX: 10.6,
  show: { x0: 2, y0: 6.6, x1: 18.4, y1: 16.8, door: 10.6 },
  svc: { x0: 24, y0: 4.6, x1: 44.6, y1: 14.4 },
  canopy: { x0: 24.2, x1: 32, y0: 14.4, y1: 17.3 },
  bayY: 10.4,
};
const Wd = {
  cv: null, ctx: null, dpr: 1, vw: 0, vh: 0, cam: { x: 0, y: 0, z: 1 }, fitZ: 1,
  ents: new Map(), floats: [], hits: [], hover: null, last: 0, time: 0, inited: false,
  slotOf: {}, slotUsed: { new: [], used: [], park: [] }, display: [], night: 0, trafficT: 0, syncT: 0,
  ptr: new Map(), drag: null, pinch: null, attract: false, statics: null, staticSig: '',
};

/* ---------- geometry ---------- */
function P(gx, gy, z = 0) { return [(gx - gy) * TW / 2, (gx + gy) * TH / 2 - z]; }
function poly(c, pts, fill, stroke, lw) {
  c.beginPath(); for (let i = 0; i < pts.length; i++) { const p = pts[i]; i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); } c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1; c.stroke(); }
}
function quad(x0, y0, x1, y1, z = 0) { return [P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)]; }
function box(c, x0, y0, x1, y1, z0, z1, col) {
  const base = col.base || '#999';
  poly(c, [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], col.right || shade(base, -0.24));
  poly(c, [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], col.left || shade(base, -0.08));
  poly(c, quad(x0, y0, x1, y1, z1), col.top || shade(base, 0.12), col.line, 1);
}
function ell(c, x, y, rx, ry, fill) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); }
function wallText(c, x0, y, z, text, size, color, alongX = true) {
  const [sx, sy] = P(x0, y, z);
  c.save(); c.translate(sx, sy);
  if (alongX) c.transform(0.894, 0.447, 0, 1, 0, 0); else c.transform(0.894, -0.447, 0, 1, 0, 0);
  c.font = `700 ${size}px "Barlow Semi Condensed", "Arial Narrow", sans-serif`; c.fillStyle = color; c.textBaseline = 'alphabetic';
  c.fillText(text, 0, 0); c.restore();
}
function brandColor() { return (S && S.color) || '#0a7480'; }

/* ---------- parking slots ---------- */
function buildSlots() {
  const xs = (a, b) => { const out = []; for (let x = a; x <= b + 0.01; x += 1.25) if (Math.abs(x - MAP.pedX) > 0.8) out.push(round2(x)); return out; };
  const L = xs(1.8, 20.9), R = xs(24.3, 44.3);
  const slots = { new: [], used: [], park: [] };
  for (const [row, aisle] of [[MAP.rowC, MAP.aisleB], [MAP.rowB, MAP.aisleB], [MAP.rowA, MAP.aisleA]]) for (const x of L) slots.new.push({ gx: x, gy: row, aisle });
  for (const x of R) slots.park.push({ gx: x, gy: MAP.rowA, aisle: MAP.aisleA });
  for (const x of R) (x < 33.6 ? slots.park : slots.used).push({ gx: x, gy: MAP.rowB, aisle: MAP.aisleB });
  for (const x of R) slots.used.push({ gx: x, gy: MAP.rowC, aisle: MAP.aisleB });
  return slots;
}
const SLOTS = buildSlots();
const DISPLAY = [{ gx: 5.4, gy: 10.0, dir: 'x' }, { gx: 10.6, gy: 9.0, dir: 'y' }, { gx: 15.4, gy: 10.2, dir: 'x' }];
const WAIT_SPOTS = [[4.2, 13.4], [6.2, 14.1], [8.6, 13.2], [12.8, 13.5], [15.2, 14.0], [16.8, 12.6], [3.6, 9.0], [7.6, 11.6], [13.4, 11.9], [17.2, 9.0], [4.8, 15.6], [16.4, 15.6], [9.0, 15.4], [12.4, 15.6]];
const DESKS = [[5.6, 15.4], [8.4, 15.4], [12.8, 15.4], [15.6, 15.4]];
function bayPos(i) { return { gx: MAP.svc.x0 + 1.2 + i * 2.02, gy: MAP.bayY }; }
const MAX_BAYS = 10;

function takeSlot(kind, id) {
  if (Wd.slotOf[id] && Wd.slotOf[id].kind === kind) return Wd.slotOf[id].i;
  const used = Wd.slotUsed[kind];
  for (let i = 0; i < SLOTS[kind].length; i++) if (!used[i]) { used[i] = id; Wd.slotOf[id] = { kind, i }; return i; }
  return -1;
}
function freeSlot(id) { const s = Wd.slotOf[id]; if (s) { Wd.slotUsed[s.kind][s.i] = null; delete Wd.slotOf[id]; } }

/* ---------- entity helpers ---------- */
const PAINTS = ['#eef0f0', '#15171a', '#4a4f55', '#b9bec4', '#1d3a5f', '#9b2423', '#2c4a36', '#b9a483', '#7a1f2b', '#26507a', '#cfcfcf', '#3b3b3b'];
function paintFor(id) { return PAINTS[hashStr(String(id)) % PAINTS.length]; }
function carColor(v) { if (!v) return '#888'; const c = EXT_COLORS.find(x => x.n === v.ext); return c ? c.hex : paintFor(v.id); }
function entCar(id, ref, spot, color, opt = {}) {
  return { id, type: 'car', ref, gx: spot.gx, gy: spot.gy, dir: spot.dir || 'y', color, z: 0, zt: opt.zt || 0, path: [], speed: 4.2, delay: 0, leaving: false, born: Wd.time, tag: opt.tag || null };
}
function entPerson(id, ref, gx, gy, look, opt = {}) {
  return { id, type: 'person', ref, gx, gy, look, path: [], speed: opt.speed || 1.7, delay: 0, walk: hrand(hashStr(id), 3) * 6, leaving: false, role: opt.role || 'customer', face: 1 };
}
/* Cars keep right: inbound and outbound use separate lanes of the driveway and aisles,
   and only a few cars move at once. Anything beyond that fades in or out in place. */
const MAX_MOVERS = 5, IN = 0.32, OUT = -0.32;
function movers() { let n = 0; for (const e of Wd.ents.values()) if (e.type === 'car' && !e.ambient && e.path.length) n++; return n; }
function fadeIn(e) { e.alpha = 0; e.fade = 'in'; e.path = []; e.delay = 0; }
function fadeOut(e) { e.fade = 'out'; e.leaving = true; e.path = []; e.delay = 0; e.zt = 0; }
function routeCarIn(e, target, aisle, delay = 0) {
  if (movers() >= MAX_MOVERS) { e.gx = target.gx; e.gy = target.gy; e.dir = target.dir || 'y'; fadeIn(e); return false; }
  const fromW = Math.random() < 0.5;
  e.gx = fromW ? -3 : WORLD_W + 3; e.gy = fromW ? MAP.laneE : MAP.laneW; e.dir = 'x';
  e.path = [[MAP.drvX + 0.4, e.gy], [MAP.drvX + 0.4, aisle + IN], [target.gx, aisle + IN], [target.gx, target.gy]];
  e.delay = delay; e.final = target;
  return true;
}
function routeCarOut(e, aisle, delay = 0) {
  if (movers() >= MAX_MOVERS) { fadeOut(e); return false; }
  const east = Math.random() < 0.5;
  e.path = [[e.gx, aisle + OUT], [MAP.drvX - 0.4, aisle + OUT], [MAP.drvX - 0.4, east ? MAP.laneE : MAP.laneW], [east ? WORLD_W + 4 : -4, east ? MAP.laneE : MAP.laneW]];
  e.leaving = true; e.delay = delay; e.zt = 0;
  return true;
}
function routeCarToBay(e, bay, delay = 0) {
  const c = MAP.canopy;
  e.path = [[e.gx, MAP.aisleA], [clamp(bay.gx, c.x0 + 0.6, c.x1 - 0.6), MAP.aisleA], [clamp(bay.gx, c.x0 + 0.6, c.x1 - 0.6), 15.9], [bay.gx, 15.9], [bay.gx, bay.gy]];
  e.delay = delay; e.final = bay; e.zt = 0; e.toBay = true;
}
function routePersonIn(e, spot, delay = 0) {
  const fromW = e.gx < MAP.pedX;
  e.path = [[MAP.pedX + (fromW ? -0.3 : 0.3), 29.7], [MAP.pedX, MAP.aisleA], [MAP.show.door, 17.4], [MAP.show.door, 16.2], [spot[0], spot[1]]];
  e.delay = delay;
}
function routePersonOut(e, delay = 0) {
  const east = Math.random() < 0.5;
  e.path = [[MAP.show.door, 16.2], [MAP.show.door, 17.4], [MAP.pedX, MAP.aisleA], [MAP.pedX, 29.7], [east ? WORLD_W + 2 : -2, 29.7]];
  e.leaving = true; e.delay = delay;
}

/* ---------- sync world with the simulation ---------- */
function syncWorld(initial) {
  if (!S) return;
  const ents = Wd.ents, seen = new Set();
  const live = !initial;
  // Work out what should exist, and let everything else leave first so its stall is free
  const want = new Set();
  for (const v of availableNew()) want.add('v' + v.id);
  for (const u of S.used) if (u.status === 'available' || u.status === 'appraisal') want.add('u' + u.id);
  for (const r of S.svc.ros) if (r.status !== 'done') want.add('r' + r.id);
  for (const v of visibleVisits()) want.add('w' + v.id);
  for (const e of S.emps) if (e.status === 'active' && !e.absent) want.add('e' + e.id);
  {
    const seen = want;
    let outN = 0;
  for (const [id, e] of ents) {
    if (seen.has(id) || e.leaving || e.ambient) continue;
    if (e.type === 'car') {
      if (e.ref.kind === 'new' || e.ref.kind === 'used') {
        const deal = S.deals.find(d => d.day >= S.day - 1 && d.stock === e.stock);
        const u = e.ref.kind === 'used' ? S.used.find(x => x.id === e.ref.id) : null;
        if (deal && live) addFloat(e.gx, e.gy, `+${moneyK(deal.total)}`, deal.total >= 0 ? 'good' : 'bad', deal.by === 'You' ? 'Sold by you' : 'Sold');
        else if (live) addFloat(e.gx, e.gy, u ? (u.status === 'recon' ? 'To recon' : u.status === 'auction' ? 'To auction' : 'Moved') : e.ref.kind === 'used' ? 'Wholesaled' : 'Dealer trade', 'info');
      }
      const aisle = e.bay != null ? MAP.aisleA : (Wd.slotOf[id] ? SLOTS[Wd.slotOf[id].kind][Wd.slotOf[id].i].aisle : (e.gy > 23 ? MAP.aisleB : MAP.aisleA));
      freeSlot(id);
      if (initial) { ents.delete(id); continue; }
      if (e.bay != null) { e.bay = null; if (routeCarOut(e, MAP.aisleA, outN * 1.1)) e.path.unshift([e.gx, 15.9]); }
      else if (e.gy < 17) { if (routeCarOut(e, MAP.aisleA, outN * 1.1)) e.path.splice(0, 1, [MAP.show.door, 16.0], [MAP.show.door, MAP.aisleA + OUT]); }
      else routeCarOut(e, aisle, outN * 1.1);
      outN++;
    } else if (e.type === 'person') {
      if (e.role === 'staff' || initial) { ents.delete(id); continue; }
      routePersonOut(e, outN * 0.3); outN++;
    }
  }
  }
  // New inventory: display pads first (most expensive), then the lot
  const avail = availableNew();
  Wd.display = Wd.display.filter(id => avail.some(v => v.id === id));
  if (Wd.display.length < 3) {
    const cands = avail.filter(v => !Wd.display.includes(v.id)).sort((a, b) => b.msrp - a.msrp);
    while (Wd.display.length < 3 && cands.length) Wd.display.push(cands.shift().id);
  }
  let arrivalN = 0;
  for (const v of avail) {
    const id = 'v' + v.id; seen.add(id);
    let e = ents.get(id);
    const di = Wd.display.indexOf(v.id);
    if (!e) {
      let spot, aisle = MAP.aisleA;
      if (di >= 0) spot = DISPLAY[di];
      else { const i = takeSlot('new', id); if (i < 0) continue; spot = SLOTS.new[i]; aisle = spot.aisle; }
      e = entCar(id, { kind: 'new', id: v.id }, spot, carColor(v), { tag: daysIn(v) > 90 ? 'aged' : null }); e.stock = v.stock;
      if (live && v.arrived >= S.day - 1 && di < 0) routeCarIn(e, spot, aisle, arrivalN++ * 1.2);
      ents.set(id, e);
    } else e.tag = daysIn(v) > 90 ? 'aged' : null;
  }
  // Used inventory
  for (const u of S.used) {
    if (u.status !== 'available' && u.status !== 'appraisal') continue;
    const id = 'u' + u.id; seen.add(id);
    let e = ents.get(id);
    if (!e) {
      const i = takeSlot('used', id); if (i < 0) continue;
      const spot = SLOTS.used[i];
      e = entCar(id, { kind: 'used', id: u.id }, spot, carColor(u)); e.stock = u.stock;
      if (live && u.acquired >= S.day - 1 && u.source === 'auction') routeCarIn(e, spot, spot.aisle, arrivalN++ * 1.2);
      ents.set(id, e);
    }
    e.tag = u.status === 'appraisal' ? 'appraise' : daysIn(u) > 60 ? 'aged' : null;
  }
  // Repair orders: the busiest go in the bays, the rest wait in service parking
  const ros = S.svc.ros.filter(r => r.status !== 'done').slice().sort((a, b) => (b.status === 'working') - (a.status === 'working') || roPriority(b) - roPriority(a));
  const nb = Math.min(MAX_BAYS, bayCount());
  const bayTaken = [];
  for (const e of ents.values()) if (e.type === 'car' && e.ref.kind === 'ro' && e.bay != null && !e.leaving) bayTaken[e.bay] = e.id;
  let roN = 0;
  for (const ro of ros) {
    const id = 'r' + ro.id; seen.add(id);
    let e = ents.get(id);
    const color = ro.uid ? carColor(S.used.find(u => u.id === ro.uid)) : paintFor(ro.cid || ro.id);
    if (!e) {
      e = entCar(id, { kind: 'ro', id: ro.id }, { gx: 0, gy: 0 }, color);
      let b = -1; for (let i = 0; i < nb; i++) if (!bayTaken[i]) { b = i; break; }
      if (b >= 0 && roN < nb) { bayTaken[b] = id; e.bay = b; const bp = bayPos(b); e.gx = bp.gx; e.gy = bp.gy; e.zt = 16; e.z = initial ? 16 : 0; if (live) { if (routeCarIn(e, { gx: 27.5, gy: 15.9 }, MAP.aisleA, roN * 1.2)) { e.gx = e.gx; e.path.push([bp.gx, 15.9], [bp.gx, bp.gy]); e.toBay = true; e.zt = 0; } else { e.gx = bp.gx; e.gy = bp.gy; e.z = 16; e.zt = 16; } } }
      else { const i = takeSlot('park', id); if (i < 0) continue; const sp = SLOTS.park[i]; e.gx = sp.gx; e.gy = sp.gy; if (live) routeCarIn(e, sp, sp.aisle, roN * 1.2); }
      ents.set(id, e); roN++;
    } else if (e.bay == null && !e.path.length) {
      let b = -1; for (let i = 0; i < nb; i++) if (!bayTaken[i]) { b = i; break; }
      if (b >= 0) { bayTaken[b] = id; e.bay = b; freeSlot(id); routeCarToBay(e, bayPos(b)); }
    }
  }
  // Customers in the showroom
  const visits = visibleVisits();
  const spotsUsed = new Set();
  for (const e of ents.values()) if (e.type === 'person' && e.role === 'customer' && !e.leaving && e.spot != null) spotsUsed.add(e.spot);
  let pn = 0;
  for (const v of visits) {
    const id = 'w' + v.id; seen.add(id);
    let e = ents.get(id);
    if (!e) {
      let si = WAIT_SPOTS.findIndex((_, i) => !spotsUsed.has(i)); if (si < 0) si = pn % WAIT_SPOTS.length;
      spotsUsed.add(si);
      const sp = WAIT_SPOTS[si];
      e = entPerson(id, { kind: 'visit', id: v.id }, sp[0], sp[1], lookOf(v.cid));
      e.spot = si;
      if (live) { e.gx = Math.random() < 0.5 ? -1 : WORLD_W + 1; e.gy = 29.7; routePersonIn(e, sp, pn * 0.7); }
      ents.set(id, e); pn++;
    }
  }
  // Staff at their stations
  const staff = [];
  present('sales').concat(present('gsm')).slice(0, DESKS.length).forEach((emp, i) => staff.push([emp, DESKS[i][0], DESKS[i][1] - 0.7]));
  present('advisor').slice(0, 3).forEach((emp, i) => staff.push([emp, 26.4 + i * 1.6, 15.6]));
  present('svcmgr').slice(0, 1).forEach(emp => staff.push([emp, 31.2, 15.2]));
  present('parts').slice(0, 2).forEach((emp, i) => staff.push([emp, 41.8 + i * 1.2, 6.4]));
  present('detail').slice(0, 2).forEach((emp, i) => staff.push([emp, 21.0 + i * 0.5, 17.2]));
  present('bdc').slice(0, 2).forEach((emp, i) => staff.push([emp, 3.4 + i * 1.2, 7.6]));
  const techsHere = techs().filter(t => t.status === 'active' && !t.absent);
  techsHere.slice(0, nb).forEach((emp, i) => { const b = bayPos(i); staff.push([emp, b.gx + 0.85, b.gy + 0.6]); });
  for (const [emp, gx, gy] of staff) {
    const id = 'e' + emp.id; seen.add(id);
    let e = ents.get(id);
    const uni = { sales: '#1e2b38', gsm: '#1e2b38', fi: '#1e2b38', advisor: '#f2f4f6', svcmgr: '#f2f4f6', tech: '#2f5f8a', parts: '#2f5f8a', detail: '#4a6b3a', bdc: '#5b4a7a' }[emp.role];
    if (!e) { e = entPerson(id, { kind: 'emp', id: emp.id }, gx, gy, lookOf(emp.id, { uniform: uni }), { role: 'staff' }); ents.set(id, e); }
    else if (!e.path.length && (Math.abs(e.gx - gx) > 0.05 || Math.abs(e.gy - gy) > 0.05)) e.path = [[gx, gy]];
  }
}
function addFloat(gx, gy, text, tone, sub) { Wd.floats.push({ gx, gy, text, tone, sub, t: 0 }); }

/* ---------- animation ---------- */
function stepEnts(dt) {
  for (const [id, e] of Wd.ents) {
    if (e.fade === 'in') { e.alpha = Math.min(1, (e.alpha || 0) + dt * 1.2); if (e.alpha >= 1) { e.fade = null; e.alpha = 1; } }
    if (e.fade === 'out') { e.alpha = (e.alpha == null ? 1 : e.alpha) - dt * 1.2; if (e.alpha <= 0) Wd.ents.delete(id); continue; }
    if (e.delay > 0) { e.delay -= dt; continue; }
    if (e.type === 'car') e.z += (e.zt - e.z) * Math.min(1, dt * 3);
    if (!e.path.length) {
      e.moving = false;
      if (e.leaving) Wd.ents.delete(id);
      if (e.toBay && e.bay != null) { e.toBay = false; e.zt = 16; }
      continue;
    }
    const [tx, ty] = e.path[0];
    const dx = tx - e.gx, dy = ty - e.gy, d = Math.hypot(dx, dy);
    const sp = e.speed * dt;
    e.moving = true;
    if (e.type === 'car' && d > 0.02) e.dir = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (e.type === 'person') { e.walk += dt; if (Math.abs(dx) > 0.01) e.face = dx > 0 ? 1 : -1; }
    if (d <= sp) { e.gx = tx; e.gy = ty; e.path.shift(); if (!e.path.length && e.final && e.type === 'car') e.dir = e.final.dir || 'y'; }
    else { e.gx += dx / d * sp; e.gy += dy / d * sp; }
  }
  // passing traffic on the road
  Wd.trafficT -= dt;
  if (Wd.trafficT <= 0) {
    Wd.trafficT = randUI(1.8, 4.2);
    const east = Math.random() < 0.5, id = 'amb' + Math.random().toString(36).slice(2, 8);
    const e = entCar(id, { kind: 'amb' }, { gx: east ? -4 : WORLD_W + 4, gy: east ? MAP.laneE : MAP.laneW, dir: 'x' }, PAINTS[Math.floor(Math.random() * PAINTS.length)]);
    e.path = [[east ? WORLD_W + 5 : -5, e.gy]]; e.speed = 6; e.leaving = true; e.ambient = true;
    if (Math.random() < 0.1) e.truck = true;
    Wd.ents.set(id, e);
    if (Math.random() < 0.35) {
      const pid = 'ped' + id, fromW = Math.random() < 0.5;
      const p = entPerson(pid, { kind: 'amb' }, fromW ? -1 : WORLD_W + 1, 29.75, lookOf(pid), { speed: 1.3 });
      p.path = [[fromW ? WORLD_W + 2 : -2, 29.75]]; p.leaving = true; p.ambient = true; Wd.ents.set(pid, p);
    }
  }
  for (const f of Wd.floats) f.t += dt;
  Wd.floats = Wd.floats.filter(f => f.t < 2.6);
  Wd.night = Math.max(0, Wd.night - dt * 0.7);
}
function randUI(a, b) { return a + Math.random() * (b - a); }

/* ---------- static scenery ---------- */
function buildStatics() {
  const items = [];
  const add = (k, f) => items.push({ k, f });
  const sh = MAP.show, sv = MAP.svc, cn = MAP.canopy, bc = brandColor();
  const wall = { base: '#eef0f1', top: '#ffffff', left: '#e3e7ea', right: '#cfd5da' };
  // trees around the property
  const trees = [];
  for (let x = 1; x < WORLD_W; x += 3.2) trees.push([x, 2.2]);
  for (let y = 5; y < 28; y += 3.4) { trees.push([0.4, y]); trees.push([45.6, y]); }
  trees.push([19.8, 8], [20.6, 12.6], [22.2, 5.4], [19.6, 4.2]);
  for (const [x, y] of trees) add(x + y, c => drawTree(c, x, y));
  // lamp posts
  for (const [x, y] of [[1.1, 18], [11.4, 18], [21.3, 18.1], [23.5, 18.1], [34, 18], [44.8, 18], [1.1, 29], [11.4, 29], [21.3, 29.1], [23.5, 29.1], [34, 29], [44.8, 29]]) add(x + y + 0.2, c => drawLamp(c, x, y));
  // showroom back walls (segmented so depth sorting works)
  for (let x = sh.x0; x < sh.x1; x += 1) { const x2 = Math.min(sh.x1, x + 1); add(x + sh.y0 + 0.31, c => box(c, x, sh.y0, x2, sh.y0 + 0.3, 0, 74, wall)); }
  for (let y = sh.y0; y < sh.y1; y += 1) { const y2 = Math.min(sh.y1, y + 1); add(sh.x0 + y + 0.31, c => box(c, sh.x0, y, sh.x0 + 0.3, y2, 0, 74, wall)); }
  add(sh.x1 + sh.y0 + 0.4, c => { // brand fascia on the back wall
    poly(c, [P(sh.x0 + 2, sh.y0 + 0.31, 46), P(sh.x1 - 2, sh.y0 + 0.31, 46), P(sh.x1 - 2, sh.y0 + 0.31, 66), P(sh.x0 + 2, sh.y0 + 0.31, 66)], bc);
    wallText(c, sh.x0 + 3, sh.y0 + 0.31, 50, 'AUREX', 15, '#ffffff', true);
    wallText(c, sh.x0 + 9.2, sh.y0 + 0.31, 51, S ? S.dealerName.toUpperCase() : '', 9, 'rgba(255,255,255,.85)', true);
  });
  // interior: reception counter, desks, lounge, plants
  add(10.6 + 12.8, c => box(c, 9.6, 12.4, 11.6, 13.1, 0, 14, { base: bc }));
  for (const [x, y] of DESKS) add(x + y, c => { box(c, x - 0.6, y - 0.35, x + 0.6, y + 0.35, 0, 12, { base: '#d9dde2', top: '#f6f7f8' }); box(c, x - 0.2, y + 0.45, x + 0.2, y + 0.8, 0, 7, { base: '#2c3440' }); });
  add(3.4 + 13.6, c => box(c, 2.6, 12.4, 4.2, 13.2, 0, 7, { base: '#6b7f8f' }));
  add(16 + 7.8, c => box(c, 15.4, 7.2, 17.6, 7.9, 0, 7, { base: '#6b7f8f' }));
  for (const [x, y] of [[2.7, 7.2], [17.8, 16.3], [2.7, 16.3]]) add(x + y, c => drawPlant(c, x, y));
  // showroom glass (front & side), drawn in front of the interior
  for (let x = sh.x0; x < sh.x1; x += 1) {
    const x2 = Math.min(sh.x1, x + 1);
    if (x2 > sh.door - 1 && x < sh.door + 1) continue;
    add(x + 0.5 + sh.y1 + 0.02, c => drawGlass(c, x, sh.y1, x2, sh.y1, 56));
  }
  for (let y = sh.y0; y < sh.y1; y += 1) { const y2 = Math.min(sh.y1, y + 1); add(sh.x1 + y + 0.5 + 0.02, c => drawGlass(c, sh.x1, y, sh.x1, y2, 56)); }
  add(sh.door + sh.y1 + 0.05, c => { // entry portal
    box(c, sh.door - 1.05, sh.y1 - 0.15, sh.door - 0.85, sh.y1 + 0.15, 0, 62, { base: bc });
    box(c, sh.door + 0.85, sh.y1 - 0.15, sh.door + 1.05, sh.y1 + 0.15, 0, 62, { base: bc });
    box(c, sh.door - 1.05, sh.y1 - 0.15, sh.door + 1.05, sh.y1 + 0.15, 56, 64, { base: bc });
    if (S && dparts(S.day).dow === 0) wallText(c, sh.door - 0.7, sh.y1 + 0.16, 30, 'CLOSED', 10, '#c0392b', true);
  });
  // service building
  const metal = { base: '#d5dade', top: '#eef1f3', left: '#c8ced3', right: '#b5bdc4' };
  for (let x = sv.x0; x < sv.x1; x += 1) { const x2 = Math.min(sv.x1, x + 1); add(x + sv.y0 + 0.31, c => box(c, x, sv.y0, x2, sv.y0 + 0.3, 0, 84, metal)); }
  for (let y = sv.y0; y < sv.y1; y += 1) { const y2 = Math.min(sv.y1, y + 1); add(sv.x0 + y + 0.31, c => box(c, sv.x0, y, sv.x0 + 0.3, y2, 0, 84, metal)); }
  add(sv.x1 + sv.y0 + 0.4, c => {
    poly(c, [P(sv.x0 + 1, sv.y0 + 0.31, 60), P(sv.x1 - 1, sv.y0 + 0.31, 60), P(sv.x1 - 1, sv.y0 + 0.31, 72), P(sv.x0 + 1, sv.y0 + 0.31, 72)], bc);
    wallText(c, sv.x0 + 1.6, sv.y0 + 0.31, 62, 'AUREX SERVICE', 11, '#ffffff', true);
  });
  // parts racks along the back wall and the parts counter
  for (let x = sv.x0 + 0.6; x < sv.x1 - 4; x += 4.1) add(x + 5.3, c => drawRack(c, x, 4.95));
  add(42 + 6.4, c => { box(c, 40.6, 5.0, 44.3, 5.6, 0, 40, { base: '#8a96a1' }); box(c, 40.8, 6.9, 44.2, 7.5, 0, 13, { base: bc }); wallText(c, 41.0, 7.51, 6, 'PARTS', 8, '#fff', true); });
  const nb = Math.min(MAX_BAYS, S ? bayCount() : 6);
  for (let i = 0; i < MAX_BAYS; i++) {
    const b = bayPos(i);
    if (i < nb) {
      add(b.gx + b.gy - 0.5, c => drawLift(c, b.gx, b.gy));
      add(b.gx + 1.0 + 6.0, c => box(c, b.gx + 0.55, 5.2, b.gx + 0.95, 5.9, 0, 16, { base: '#c0392b' }));
    }
    const x0 = b.gx - 1.0, x1 = b.gx + 1.0;
    if (i < nb) {
      add(x0 + sv.y1 + 0.03, c => box(c, x0, sv.y1 - 0.12, x0 + 0.14, sv.y1 + 0.12, 0, 60, metal));
      add(x0 + 0.5 + sv.y1 + 0.03, c => { box(c, x0, sv.y1 - 0.12, x1, sv.y1 + 0.12, 50, 62, metal); });
    } else {
      add(x0 + 1 + sv.y1 + 0.05, c => { box(c, x0, sv.y1 - 0.12, x1, sv.y1 + 0.12, 0, 62, { base: '#b8c0c7', left: '#c3cad0' }); for (let z = 6; z < 60; z += 6) { const a = P(x0, sv.y1 + 0.12, z), bb = P(x1, sv.y1 + 0.12, z); c.strokeStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(bb[0], bb[1]); c.stroke(); } });
    }
  }
  add(sv.x1 + sv.y1, c => box(c, sv.x1 - 0.2, sv.y1 - 0.12, sv.x1, sv.y1 + 0.12, 0, 62, metal));
  for (let y = sv.y0; y < sv.y1; y += 1) { const y2 = Math.min(sv.y1, y + 1); add(sv.x1 + y + 0.5, c => box(c, sv.x1 - 0.12, y, sv.x1 + 0.12, y2, 0, 14, metal)); }
  // service drive canopy
  for (const x of [cn.x0, cn.x1 - 0.25]) add(x + cn.y1 + 0.1, c => box(c, x, cn.y1 - 0.25, x + 0.25, cn.y1, 0, 58, { base: '#e7eaec' }));
  for (let x = cn.x0; x < cn.x1; x += 1) { const x2 = Math.min(cn.x1, x + 1); add(x + 0.5 + cn.y1 + 0.2, c => box(c, x, cn.y1 - 0.3, x2, cn.y1, 56, 64, { base: bc })); }
  add(cn.x1 + cn.y1 + 0.3, c => wallText(c, cn.x0 + 2.2, cn.y1, 58, 'SERVICE DRIVE', 7, '#ffffff', true));
  add(27 + 15.3, c => box(c, 26, 15.0, 28.8, 15.5, 0, 12, { base: '#d9dde2', top: '#f6f7f8' }));
  // pylon sign at the driveway
  add(MAP.drvX - 1.1 + 28.6 + 0.6, c => drawPylon(c, MAP.drvX - 1.4, 28.6));
  add(34.2 + 28.9, c => drawSmallSign(c, 34.2, 29.0, 'PRE-OWNED'));
  return items;
}
function drawTree(c, x, y) {
  const [sx, sy] = P(x, y, 0);
  ell(c, sx + 4, sy, 15, 7, 'rgba(0,0,0,.16)');
  c.fillStyle = '#6b4f37'; c.fillRect(sx - 2, sy - 18, 4, 18);
  ell(c, sx, sy - 30, 15, 14, '#4f8a4a'); ell(c, sx - 7, sy - 24, 10, 9, '#5f9a55'); ell(c, sx + 6, sy - 36, 9, 8, '#6dad62');
}
function drawPlant(c, x, y) { const [sx, sy] = P(x, y, 0); c.fillStyle = '#9a8c7c'; c.fillRect(sx - 4, sy - 8, 8, 8); ell(c, sx, sy - 13, 7, 7, '#4f8a4a'); ell(c, sx - 3, sy - 16, 4, 4, '#6dad62'); }
function drawLamp(c, x, y) {
  const [sx, sy] = P(x, y, 0);
  c.strokeStyle = '#59626b'; c.lineWidth = 2; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx, sy - 70); c.lineTo(sx + 8, sy - 70); c.stroke();
  ell(c, sx + 9, sy - 69, 4, 2, Wd.dark > 0.12 ? '#fff4c6' : '#cfd6dc');
}
function drawGlass(c, x0, y0, x1, y1, h) {
  const pts = [P(x0, y0, 0), P(x1, y1, 0), P(x1, y1, h), P(x0, y0, h)];
  poly(c, pts, 'rgba(150,205,222,.22)');
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(pts[3][0], pts[3][1]); c.lineTo(pts[2][0], pts[2][1]); c.stroke();
  c.strokeStyle = 'rgba(90,110,125,.5)'; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); c.lineTo(pts[3][0], pts[3][1]); c.stroke();
}
function drawRack(c, x, y) { box(c, x, y - 0.3, x + 3.6, y + 0.3, 0, 34, { base: '#7f8b96' }); for (let z = 8; z < 34; z += 9) { const a = P(x, y + 0.3, z), b = P(x + 3.6, y + 0.3, z); c.strokeStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); } }
function drawLift(c, x, y) {
  poly(c, quad(x - 0.85, y - 1.25, x + 0.85, y + 1.25, 0.5), 'rgba(242,196,48,.35)');
  box(c, x - 0.98, y - 0.1, x - 0.82, y + 0.1, 0, 36, { base: '#3f78b5' });
  box(c, x + 0.82, y - 0.1, x + 0.98, y + 0.1, 0, 36, { base: '#3f78b5' });
}
function drawPylon(c, x, y) {
  const bc = brandColor();
  box(c, x, y - 0.2, x + 0.25, y + 0.2, 0, 70, { base: '#59626b' });
  box(c, x + 0.6, y - 0.2, x + 0.85, y + 0.2, 0, 70, { base: '#59626b' });
  box(c, x - 0.3, y - 0.25, x + 1.15, y + 0.25, 70, 120, { base: bc });
  wallText(c, x - 0.1, y + 0.26, 98, 'AUREX', 13, '#ffffff', true);
  wallText(c, x - 0.1, y + 0.26, 82, (S ? S.dealerName : '').slice(0, 18), 7, 'rgba(255,255,255,.9)', true);
}
function drawSmallSign(c, x, y, t) { box(c, x, y - 0.1, x + 0.12, y + 0.1, 0, 26, { base: '#59626b' }); box(c, x - 0.8, y - 0.12, x + 1.0, y + 0.12, 26, 40, { base: '#1f2b36' }); wallText(c, x - 0.6, y + 0.13, 29, t, 8, '#fff', true); }

/* ---------- ground ---------- */
function drawGround(c) {
  poly(c, quad(-6, -6, WORLD_W + 6, WORLD_H + 6), '#8fb874');
  // subtle grass variation
  c.globalAlpha = 0.18;
  for (let i = 0; i < 40; i++) { const x = (i * 7.3) % WORLD_W, y = (i * 11.7) % 28; poly(c, quad(x, y, x + 2.4, y + 1.6), '#7aa862'); }
  c.globalAlpha = 1;
  const asphalt = '#5c656e';
  poly(c, quad(0.8, 17.6, 21.6, 29.2), asphalt);
  poly(c, quad(23.2, 17.6, 45.2, 29.2), asphalt);
  poly(c, quad(21.6, 17.6, 23.2, 30.2), '#606a73');
  poly(c, quad(0.8, 17.4, 45.2, 19.4), '#636d76');
  poly(c, quad(MAP.canopy.x0, MAP.svc.y1, MAP.canopy.x1 + 0.1, 17.6), '#6a737c');
  poly(c, quad(MAP.canopy.x1 + 0.1, MAP.svc.y1, MAP.svc.x1, 17.4), '#7c8790');
  // showroom apron and walkway
  poly(c, quad(MAP.show.x0 - 0.4, MAP.show.y1, MAP.show.x1 + 0.4, 17.4), '#d7d3cb');
  poly(c, quad(MAP.pedX - 0.5, 17.4, MAP.pedX + 0.5, 29.2), '#cfcac0');
  // floors
  poly(c, quad(MAP.show.x0, MAP.show.y0, MAP.show.x1, MAP.show.y1, 0.5), '#e8ecef');
  c.strokeStyle = 'rgba(0,0,0,.05)'; c.lineWidth = 1;
  for (let x = MAP.show.x0 + 1.5; x < MAP.show.x1; x += 1.5) { const a = P(x, MAP.show.y0, 0.5), b = P(x, MAP.show.y1, 0.5); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  for (let y = MAP.show.y0 + 1.5; y < MAP.show.y1; y += 1.5) { const a = P(MAP.show.x0, y, 0.5), b = P(MAP.show.x1, y, 0.5); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  for (const d of DISPLAY) { const [sx, sy] = P(d.gx, d.gy, 0.6); ell(c, sx, sy, 50, 25, 'rgba(255,255,255,.75)'); c.strokeStyle = 'rgba(0,0,0,.08)'; c.stroke(); }
  poly(c, quad(MAP.svc.x0, MAP.svc.y0, MAP.svc.x1, MAP.svc.y1, 0.5), '#c9cfd4');
  for (let i = 0; i <= Math.min(MAX_BAYS, S ? bayCount() : 6); i++) { const x = MAP.svc.x0 + 0.2 + i * 2.02; const a = P(x, 6.6, 0.6), b = P(x, MAP.svc.y1, 0.6); c.strokeStyle = 'rgba(232,184,40,.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  // sidewalk & road
  poly(c, quad(-6, MAP.walkY0, WORLD_W + 6, MAP.walkY1), '#d9d6cf');
  poly(c, quad(-6, MAP.roadY0, WORLD_W + 6, MAP.roadY1), '#474e55');
  c.strokeStyle = '#e2c14a'; c.lineWidth = 2; c.setLineDash([14, 12]);
  { const a = P(-6, 32, 0), b = P(WORLD_W + 6, 32, 0); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  c.setLineDash([]);
  // parking stall lines
  c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.4;
  const stall = s => { for (const dx of [-0.62, 0.62]) { const a = P(s.gx + dx, s.gy - 0.9), b = P(s.gx + dx, s.gy + 0.9); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); } };
  SLOTS.new.forEach(stall); SLOTS.park.forEach(stall); SLOTS.used.forEach(stall);
  // lot labels painted on the asphalt
  c.save(); c.globalAlpha = 0.55;
  wallGroundText(c, 2, 18.2, 'NEW AUREX');
  wallGroundText(c, 24.4, 18.2, 'SERVICE PARKING');
  wallGroundText(c, 35, 23.1, 'PRE-OWNED');
  c.restore();
}
function wallGroundText(c, x, y, t) { const [sx, sy] = P(x, y, 0); c.save(); c.translate(sx, sy); c.transform(0.894, 0.447, -0.894, 0.447, 0, 0); c.font = '700 11px "Barlow Semi Condensed", sans-serif'; c.fillStyle = '#fff'; c.fillText(t, 0, 0); c.restore(); }

/* ---------- dynamic drawing ---------- */
function drawCar(c, e) {
  const hl = e.truck ? 1.6 : 0.72, hw = e.truck ? 0.55 : 0.3;
  const [hx, hy] = e.dir === 'x' ? [hl, hw] : [hw, hl];
  const x0 = e.gx - hx, x1 = e.gx + hx, y0 = e.gy - hy, y1 = e.gy + hy, z = e.z || 0;
  const A = e.alpha == null ? 1 : e.alpha;
  c.globalAlpha = 0.2 * A; poly(c, quad(x0, y0 + 0.06, x1 + 0.1, y1 + 0.1, 0), '#000'); c.globalAlpha = A;
  if (z > 2) { box(c, x0 + 0.2, y0 + 0.3, x1 - 0.2, y1 - 0.3, z - 3, z, { base: '#3f78b5' }); }
  box(c, x0 + 0.08, y0 + 0.06, x1 - 0.08, y1 - 0.06, z, z + 4, { base: '#1b1e22' });
  if (e.truck) {
    box(c, x0, y0, x1, y1, z + 3, z + 26, { base: '#e9ecef' });
    const cab = e.dir === 'x' ? [x1 - 0.7, y0 + 0.05, x1 + 0.2, y1 - 0.05] : [x0 + 0.05, y1 - 0.7, x1 - 0.05, y1 + 0.2];
    box(c, cab[0], cab[1], cab[2], cab[3], z + 3, z + 20, { base: e.color });
    return;
  }
  box(c, x0, y0, x1, y1, z + 3, z + 9.5, { base: e.color, line: 'rgba(0,0,0,.12)' });
  const ci = e.dir === 'x' ? [x0 + 0.34, y0 + 0.05, x1 - 0.3, y1 - 0.05] : [x0 + 0.05, y0 + 0.34, x1 - 0.05, y1 - 0.3];
  box(c, ci[0], ci[1], ci[2], ci[3], z + 9.5, z + 15, { top: shade(e.color, 0.08), left: '#2b3a47', right: '#1e2933' });
  if (e.tag && !e.moving) {
    const [sx, sy] = P(e.gx, e.gy, z + 30);
    const col = e.tag === 'aged' ? '#d08a2c' : '#2a67ad';
    ell(c, sx, sy, 7, 7, col); c.fillStyle = '#fff'; c.font = '700 10px Inter, sans-serif'; c.textAlign = 'center'; c.fillText(e.tag === 'aged' ? '!' : '?', sx, sy + 3.5); c.textAlign = 'start';
  }
}
function drawPerson(c, e) {
  const [sx, sy] = P(e.gx, e.gy, 0), L = e.look, h = L.height;
  ell(c, sx, sy, 6.5, 2.8, 'rgba(0,0,0,.2)');
  const sw = e.moving ? Math.sin(e.walk * 11) * 2.4 : 0;
  c.lineCap = 'round'; c.lineWidth = 2.8; c.strokeStyle = L.pants;
  c.beginPath(); c.moveTo(sx - 1.7, sy - 10 * h); c.lineTo(sx - 1.7 + sw, sy - 0.5); c.moveTo(sx + 1.7, sy - 10 * h); c.lineTo(sx + 1.7 - sw, sy - 0.5); c.stroke();
  c.fillStyle = L.shirt; c.beginPath(); c.roundRect(sx - 5, sy - 22 * h, 10, 13 * h, 3); c.fill();
  c.strokeStyle = shade(L.shirt, -0.15); c.lineWidth = 2.4;
  c.beginPath(); c.moveTo(sx - 5, sy - 19 * h); c.lineTo(sx - 6.5 - sw * 0.6, sy - 11 * h); c.moveTo(sx + 5, sy - 19 * h); c.lineTo(sx + 6.5 + sw * 0.6, sy - 11 * h); c.stroke();
  ell(c, sx, sy - 26 * h, 4.4, 4.6, L.skin);
  c.fillStyle = L.hair; c.beginPath(); c.arc(sx, sy - 27 * h, 4.7, Math.PI * 1.05, Math.PI * 1.95); c.fill();
  if (e.role === 'customer' && !e.leaving && !e.moving) {
    const v = S.showroom.find(x => x.id === e.ref.id);
    if (v) {
      const s = sentimentForVisit(v), col = { good: '#2f9e5b', warn: '#d39b22', bad: '#cf3f33' }[s.tone] || '#888';
      const by = sy - 42 * h;
      c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(sx - 9, by - 9, 18, 14, 5); c.fill();
      c.beginPath(); c.moveTo(sx - 3, by + 5); c.lineTo(sx, by + 9); c.lineTo(sx + 3, by + 5); c.fill();
      if (v.vip) { c.fillStyle = '#d39b22'; c.font = '700 11px Inter, sans-serif'; c.textAlign = 'center'; c.fillText('★', sx, by + 2.5); }
      else if (v.state === 'negotiating') { c.fillStyle = '#555'; for (let i = -1; i <= 1; i++) ell(c, sx + i * 4, by - 2, 1.5, 1.5, '#555'); }
      else ell(c, sx, by - 2, 4, 4, col);
      c.textAlign = 'start';
    }
  }
}
function drawFloats(c) {
  for (const f of Wd.floats) {
    const [sx, sy] = P(f.gx, f.gy, 40 + f.t * 26);
    const a = f.t < 2 ? 1 : 1 - (f.t - 2) / 0.6;
    c.globalAlpha = Math.max(0, a);
    c.font = '700 20px "Barlow Semi Condensed", sans-serif'; c.textAlign = 'center';
    c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.45)'; c.strokeText(f.text, sx, sy);
    c.fillStyle = f.tone === 'good' ? '#7ee2a0' : f.tone === 'bad' ? '#ff8f84' : '#e7eef5'; c.fillText(f.text, sx, sy);
    if (f.sub) { c.font = '600 11px Inter, sans-serif'; c.strokeText(f.sub, sx, sy + 14); c.fillStyle = '#fff'; c.fillText(f.sub, sx, sy + 14); }
    c.textAlign = 'start'; c.globalAlpha = 1;
  }
}

/* ---------- frame ---------- */
function worldFrame(ts) {
  requestAnimationFrame(worldFrame);
  if (!Wd.cv || !S) return;
  const dt = Math.min(0.1, (ts - (Wd.last || ts)) / 1000); Wd.last = ts;
  if (isStory()) { storyFrame(dt); return; }
  const running = UI.screen !== 'game' || canRun();
  const mul = UI.screen !== 'game' ? 0.6 : running ? 1 : 0;
  Wd.time += dt * mul;
  Wd.syncT -= dt;
  if (Wd.syncT <= 0) { syncWorld(false); Wd.syncT = 0.25; }
  if (mul > 0) stepEnts(dt * mul);
  if (UI.screen === 'title') { Wd.cam.x -= dt * 6; if (Wd.cam.x < Wd.titleX - 260) Wd.cam.x = Wd.titleX + 260; }
  draw();
}
function draw() {
  const c = Wd.ctx, z = Wd.cam.z;
  c.setTransform(Wd.dpr, 0, 0, Wd.dpr, 0, 0);
  c.fillStyle = '#7fa866'; c.fillRect(0, 0, Wd.vw, Wd.vh);
  c.setTransform(Wd.dpr * z, 0, 0, Wd.dpr * z, Wd.dpr * Wd.cam.x, Wd.dpr * Wd.cam.y);
  const t = S ? (S.clock || 0) / DAY_MIN : 0.4;
  Wd.dark = Math.max(Wd.night * 0.7, t > 0.78 ? (t - 0.78) / 0.22 * 0.38 : 0);
  drawGround(c);
  const sig = (S ? bayCount() + S.dealerName + S.color + dparts(S.day).dow : '') + (Wd.dark > 0.12);
  if (sig !== Wd.staticSig) { Wd.statics = buildStatics(); Wd.staticSig = sig; }
  const items = Wd.statics.slice();
  Wd.hits = [];
  for (const e of Wd.ents.values()) {
    if (e.delay > 0 && e.path.length && (e.gx < -2 || e.gx > WORLD_W + 2)) continue;
    const k = e.gx + e.gy + (e.type === 'car' ? 0.45 : 0.05);
    items.push({ k, f: cc => { if (e.type === 'car') { drawCar(cc, e); cc.globalAlpha = 1; } else drawPerson(cc, e); } });
    if (!e.ambient && !e.leaving) {
      const [sx, sy] = P(e.gx, e.gy, e.z || 0);
      Wd.hits.push(e.type === 'car' ? { x: sx - 28, y: sy - 28, w: 56, h: 36, e, k } : { x: sx - 9, y: sy - 46, w: 18, h: 48, e, k: k + 10 });
    }
  }
  items.sort((a, b) => a.k - b.k);
  for (const it of items) it.f(c);
  // hover highlight
  if (Wd.hover && Wd.hover.e) {
    const e = Wd.hover.e, [sx, sy] = P(e.gx, e.gy, 0);
    c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.setLineDash([4, 3]);
    c.beginPath(); c.ellipse(sx, sy, e.type === 'car' ? 32 : 11, e.type === 'car' ? 16 : 5.5, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
  }
  drawFloats(c);
  // light: warm morning, dusk toward closing, night between days
  c.setTransform(Wd.dpr, 0, 0, Wd.dpr, 0, 0);
  if (t < 0.08) { c.fillStyle = `rgba(255,190,120,${(0.08 - t) * 1.4})`; c.fillRect(0, 0, Wd.vw, Wd.vh); }
  if (Wd.dark > 0) {
    c.fillStyle = `rgba(18,28,58,${Wd.dark})`; c.fillRect(0, 0, Wd.vw, Wd.vh);
    c.setTransform(Wd.dpr * z, 0, 0, Wd.dpr * z, Wd.dpr * Wd.cam.x, Wd.dpr * Wd.cam.y);
    c.globalCompositeOperation = 'lighter';
    const g = Math.min(1, Wd.dark * 2.2);
    poly(c, quad(MAP.show.x0, MAP.show.y0, MAP.show.x1, MAP.show.y1, 1), `rgba(255,210,140,${0.18 * g})`);
    for (const [x, y] of [[1.1, 18], [11.4, 18], [21.3, 18.1], [23.5, 18.1], [34, 18], [44.8, 18], [1.1, 29], [11.4, 29], [21.3, 29.1], [23.5, 29.1], [34, 29], [44.8, 29]]) {
      const [sx, sy] = P(x, y, 0); const gr = c.createRadialGradient(sx + 9, sy - 30, 4, sx + 9, sy, 90);
      gr.addColorStop(0, `rgba(255,230,160,${0.35 * g})`); gr.addColorStop(1, 'rgba(255,230,160,0)'); c.fillStyle = gr; c.beginPath(); c.ellipse(sx + 9, sy, 90, 45, 0, 0, Math.PI * 2); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  }
}

/* ---------- camera & input ---------- */
function worldBounds() { const l = P(0, WORLD_H)[0], r = P(WORLD_W, 0)[0], tp = P(0, 0, 130)[1], b = P(WORLD_W, WORLD_H)[1]; return { l, r, t: tp, b }; }
function fitCamera() {
  const b = worldBounds(), top = 70, bottom = Wd.vw < 700 ? 150 : 96;
  const availH = Wd.vh - top - bottom;
  const z = clamp(Math.min(Wd.vw / (b.r - b.l), availH / (b.b - b.t)) * 1.32, 0.3, 2);
  Wd.fitZ = z; Wd.cam.z = Wd.vw < 700 ? Math.max(z, 0.5) : z;
  const cx = P(22, 17)[0], cy = P(22, 17)[1];
  Wd.cam.x = Wd.vw / 2 - cx * Wd.cam.z;
  Wd.cam.y = top + availH / 2 - (cy - 30) * Wd.cam.z;
  Wd.titleX = Wd.cam.x;
}
function resizeWorld() {
  const cv = Wd.cv; if (!cv) return;
  Wd.dpr = Math.min(2, window.devicePixelRatio || 1);
  Wd.vw = cv.clientWidth; Wd.vh = cv.clientHeight;
  cv.width = Math.round(Wd.vw * Wd.dpr); cv.height = Math.round(Wd.vh * Wd.dpr);
  if (!Wd.inited) { fitCamera(); Wd.inited = true; }
}
function toWorld(px, py) { return [(px - Wd.cam.x) / Wd.cam.z, (py - Wd.cam.y) / Wd.cam.z]; }
function screenToGrid(px, py) { const [wx, wy] = toWorld(px, py); const a = wx / (TW / 2), b = wy / (TH / 2); return [(a + b) / 2, (b - a) / 2]; }
function hitAt(px, py) {
  const [wx, wy] = toWorld(px, py);
  let best = null;
  for (const h of Wd.hits) if (wx >= h.x && wx <= h.x + h.w && wy >= h.y && wy <= h.y + h.h) { if (!best || h.k > best.k) best = h; }
  if (best) return best;
  const [gx, gy] = screenToGrid(px, py);
  const inR = (x0, y0, x1, y1) => gx >= x0 && gx <= x1 && gy >= y0 && gy <= y1;
  if (inR(MAP.show.x0, MAP.show.y0, MAP.show.x1, MAP.show.y1 + 0.6)) return { zone: 'showroom' };
  if (inR(40.4, 4.6, 44.6, 7.6)) return { zone: 'parts' };
  if (inR(MAP.svc.x0, MAP.svc.y0, MAP.svc.x1, 17.4)) return { zone: 'service' };
  if (inR(0.8, 17.6, 21.6, 29.2)) return { zone: 'inventory' };
  if (inR(33.6, 23.6, 45.2, 29.2)) return { zone: 'used' };
  if (inR(23.2, 17.6, 45.2, 29.2)) return { zone: 'service' };
  if (inR(MAP.drvX - 2, 27.6, MAP.drvX + 0.2, 29.4)) return { zone: 'dashboard' };
  return null;
}
const ZONE_LABEL = { showroom: 'Showroom', parts: 'Parts department', service: 'Service department', inventory: 'New vehicle lot', used: 'Pre-owned lot', dashboard: 'GM office' };
function hitLabel(h) {
  if (!h) return '';
  if (h.zone) return `<b>${ZONE_LABEL[h.zone]}</b><br><span>Click to manage</span>`;
  const e = h.e;
  if (e.type === 'car') {
    if (e.ref.kind === 'new' || e.ref.kind === 'used') { const v = vehById(e.ref.id); if (!v) return ''; return `<b>${esc(vehName(v, true))}</b><br>${v.kind === 'new' ? money(v.msrp - (v.discount || 0)) : money(v.ask)} · ${daysIn(v)} days${v.kind === 'used' && v.status === 'appraisal' ? '<br>Needs a decision' : ''}`; }
    if (e.ref.kind === 'ro') { const ro = S.svc.ros.find(r => r.id === e.ref.id); if (!ro) return ''; return `<b>RO ${ro.num} · ${esc(ro.desc)}</b><br>${esc(roCustomerName(ro))}${ro.vehDesc ? ' · ' + esc(ro.vehDesc) : ''}<br>${{ queued: 'Waiting for a technician', working: 'In the bay', parts: 'Waiting on parts' }[ro.status] || ''}`; }
  }
  if (e.type === 'person') {
    if (e.ref.kind === 'visit') { const v = S.showroom.find(x => x.id === e.ref.id); if (!v) return ''; const c = cust(v.cid); return `<b>${esc(fullName(c))}</b><br>Looking for a ${c.wantNew === 'used' ? 'used ' : ''}${CLS_LABEL[c.wantCls].toLowerCase()} · ~${money(v.targetPmt)}/mo<br>${sentimentForVisit(v).label} — click to talk`; }
    if (e.ref.kind === 'emp') { const m = empById(e.ref.id); if (!m) return ''; return `<b>${esc(empName(m))}</b><br>${m.role === 'tech' ? TECH_TIERS[m.tier] : ROLES[m.role].title} · morale ${Math.round(m.morale)}`; }
  }
  return '';
}
function clickHit(h) {
  if (!h) return;
  if (h.zone) { openPanel(h.zone); return; }
  const e = h.e;
  if (e.type === 'person' && e.ref.kind === 'visit') { openNegotiation(e.ref.id); return; }
  if (e.type === 'person' && e.ref.kind === 'emp') { openPanel('employees'); return; }
  if (e.type === 'car' && e.ref.kind === 'new') { UI.drawer = { type: 'veh', id: e.ref.id }; render(); return; }
  if (e.type === 'car' && e.ref.kind === 'used') { openPanel('used'); return; }
  if (e.type === 'car' && e.ref.kind === 'ro') { openPanel('service'); return; }
}
function initWorld(canvas) {
  Wd.cv = canvas; Wd.ctx = canvas.getContext('2d');
  resizeWorld();
  window.addEventListener('resize', () => { const was = Wd.vw; resizeWorld(); if (Math.abs(was - Wd.vw) > 120) { if (isStory()) stFitCamera(); else fitCamera(); } });
  const tip = document.getElementById('tip');
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    Wd.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Wd.ptr.size === 1) Wd.drag = { x: e.clientX, y: e.clientY, cx: Wd.cam.x, cy: Wd.cam.y, moved: false };
    if (Wd.ptr.size === 2) { const [a, b] = [...Wd.ptr.values()]; Wd.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: Wd.cam.z }; }
  });
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    if (Wd.ptr.has(e.pointerId)) Wd.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Wd.pinch && Wd.ptr.size === 2) {
      const [a, b] = [...Wd.ptr.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, clamp(Wd.pinch.z * d / Wd.pinch.d, 0.3, 2.6) / Wd.cam.z);
      if (Wd.drag) Wd.drag.moved = true;
      return;
    }
    if (Wd.drag) {
      const dx = e.clientX - Wd.drag.x, dy = e.clientY - Wd.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) Wd.drag.moved = true;
      if (Wd.drag.moved) { Wd.cam.x = Wd.drag.cx + dx; Wd.cam.y = Wd.drag.cy + dy; canvas.style.cursor = 'grabbing'; tip.classList.remove('on'); return; }
    }
    if (UI.screen === 'story') {
      const h = storyHitAt(px, py); Wd.hover = h;
      canvas.style.cursor = h ? 'pointer' : 'grab';
      const lbl = storyLabel(h);
      if (lbl) { tip.innerHTML = lbl; tip.classList.add('on'); tip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 16}px)`; } else tip.classList.remove('on');
      return;
    }
    if (UI.screen !== 'game') return;
    const h = hitAt(px, py);
    Wd.hover = h;
    canvas.style.cursor = h ? 'pointer' : 'grab';
    const lbl = hitLabel(h);
    if (lbl) { tip.innerHTML = lbl; tip.classList.add('on'); tip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 16}px)`; }
    else tip.classList.remove('on');
  });
  const end = e => {
    const r = canvas.getBoundingClientRect();
    const wasDrag = Wd.drag && Wd.drag.moved;
    Wd.ptr.delete(e.pointerId);
    if (Wd.ptr.size < 2) Wd.pinch = null;
    if (Wd.ptr.size === 0) { Wd.drag = null; canvas.style.cursor = 'grab'; }
    if (!wasDrag && e.type === 'pointerup' && UI.screen === 'story') { tip.classList.remove('on'); storyClick(storyHitAt(e.clientX - r.left, e.clientY - r.top)); return; }
    if (!wasDrag && e.type === 'pointerup' && UI.screen === 'game') { tip.classList.remove('on'); clickHit(hitAt(e.clientX - r.left, e.clientY - r.top)); }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => { Wd.hover = null; tip.classList.remove('on'); });
  canvas.addEventListener('wheel', e => { e.preventDefault(); const r = canvas.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
  syncWorld(true);
  requestAnimationFrame(worldFrame);
}
function zoomAt(px, py, f) {
  const nz = clamp(Wd.cam.z * f, 0.3, 2.6); f = nz / Wd.cam.z;
  Wd.cam.x = px - (px - Wd.cam.x) * f; Wd.cam.y = py - (py - Wd.cam.y) * f; Wd.cam.z = nz;
}
function resetWorld() { Wd.ents.clear(); Wd.slotOf = {}; Wd.slotUsed = { new: [], used: [], park: [] }; Wd.display = []; Wd.floats = []; Wd.staticSig = ''; syncWorld(true); }
