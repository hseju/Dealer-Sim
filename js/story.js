'use strict';
/* =====================================================================
   Dealer Empire — Story mode, Act 1: The Service Drive.
   A small, hands-on version of a dealership service department that
   teaches one idea per chapter. Rosa, the retiring service manager,
   explains what happened and why.
   ===================================================================== */

/* ---------- content ---------- */
const HOUR = 6; // seconds of play per hour of shop work
const VIC_RATE = 95;
const SJOB = {
  oil: { name: 'Oil change', icon: 'drop', hrs: 0.5, part: 'oil', line: "It's due for an oil change." },
  brakes: { name: 'Brake pads', icon: 'brake', hrs: 1.5, part: 'pads', line: 'My brakes squeal every time I stop.' },
  battery: { name: 'New battery', icon: 'battery', hrs: 0.5, part: 'battery', line: 'It barely started this morning.' },
  tires: { name: 'Tire swap', icon: 'tire', hrs: 1.0, part: null, line: 'Time to put the winter tires on.' },
  light: { name: 'Warning light check', icon: 'engine', hrs: 1.0, part: 'sensor', line: 'A little engine light came on yesterday.' },
  recall: { name: 'Recall repair', icon: 'mail', hrs: 1.0, part: 'recall', line: 'I got a letter from Aurex about a recall.', brand: true },
};
const SPART = {
  oil: { name: 'Oil & filter', price: 45, cost: 20, icon: 'drop' },
  pads: { name: 'Brake pads', price: 120, cost: 50, icon: 'brake' },
  battery: { name: 'Battery', price: 180, cost: 90, icon: 'battery' },
  sensor: { name: 'Engine sensor', price: 140, cost: 60, icon: 'engine' },
  wipers: { name: 'Wiper blades', price: 40, cost: 15, icon: 'wiper' },
  recall: { name: 'Recall kit', price: 60, cost: 0, icon: 'mail' },
};
const SFIND = {
  wipers: { name: 'worn wiper blades', hrs: 0.2, part: 'wipers' },
  rpads: { name: 'thin rear brake pads', hrs: 1.0, part: 'pads' },
};
const BRAND_RATE = 90;
const TECHS = { mike: { name: 'Mike', speed: 1.0 }, jess: { name: 'Jess', speed: 0.7 }, sam: { name: 'Sam', speed: 0.9 } };
const CARS = ['Aurex Terra', 'Aurex Strada', 'Aurex Pico', 'Aurex Atlas', 'Aurex Ridge', 'Aurex Strada Hybrid'];

const PLAYBOOK = [
  { id: 'quote', icon: 'tag', title: 'The quote', text: 'Every repair is priced the same way: hours of work × your labour rate + the parts.', term: 'Labour rate · repair order' },
  { id: 'capacity', icon: 'bay', title: 'Bays and time', text: 'You can only fix as many cars at once as you have bays and techs. Quick jobs first keep the line moving. Long waits send people away.', term: 'Shop capacity · hours sold' },
  { id: 'price', icon: 'dollar', title: 'Price vs. trust', text: 'Cheaper shops pull price-shoppers. People who trust you will pay a bit more — but only up to a point.', term: 'Competitive labour rate' },
  { id: 'parts', icon: 'parts', title: 'Parts on the shelf', text: 'No part, no repair. But every box on the shelf is money already spent. Stock what you use most.', term: 'Parts inventory · fill rate' },
  { id: 'recall', icon: 'shield', title: 'Recalls & honest advice', text: 'The car brand pays you to fix its defects. Inspect every car and recommend only what it truly needs — that is how trust is built.', term: 'Warranty work · multi-point inspection' },
  { id: 'retention', icon: 'retention', title: 'Bring them back', text: 'Your easiest customer is one you already have. Happy customers come back — especially when you remind them.', term: 'Customer retention' },
  { id: 'profit', icon: 'finance', title: 'Money in, money out', text: 'Profit is what is left after wages, rent and parts. Service brings in steady money every single day.', term: 'Gross profit · fixed absorption' },
];

/* Each chapter: setup, customers, goals (first goal must be met to move on), Rosa's lines */
const CHAPTERS = [
  { n: 1, title: 'Your first customer', sub: 'Write a quote, fix the car, get paid.', card: 'quote', bays: 1, techs: ['mike'], rate: 120, money: 0, stock: null, vic: false, pat: 120,
    script: [['oil', 1, 'normal'], ['brakes', 15, 'normal'], ['battery', 30, 'normal']],
    intro: ["Welcome to the service drive. Every car that comes in here pays the bills.", "Tap a car when it pulls in. I'll show you how a quote works."],
    goals: [{ t: 'Serve all 3 customers', ok: r => r.served >= 3, prog: r => [r.served, 3] }, { t: 'Average rating 4★ or better', ok: r => r.served >= 3 && r.avg >= 4 }, { t: 'Every customer gives 5★', ok: r => r.served >= 3 && r.min >= 5 }] },
  { n: 2, title: 'Busy Saturday', sub: 'Two bays, a lot of cars. Who goes first?', card: 'capacity', bays: 2, techs: ['mike', 'jess'], rate: 120, money: 0, stock: null, vic: false, pat: 34,
    script: [['tires', 1], ['oil', 3], ['brakes', 5], ['oil', 8], ['battery', 11], ['light', 14], ['tires', 18], ['oil', 22], ['brakes', 26]],
    intro: ["Saturdays are wild. Two bays, two techs, and Jess is still learning — she's slower than Mike.", "Tap a waiting car to send it into a free bay. Quick jobs first keep the line moving."],
    goals: [{ t: 'Serve at least 8 of 9 customers', ok: r => r.served >= 8, prog: r => [r.served, 8] }, { t: 'Earn $1,500', ok: r => r.revenue >= 1500, prog: r => [r.revenue, 1500], money: true }, { t: 'Nobody leaves angry', ok: r => r.lost === 0 && r.served >= 8 }] },
  { n: 3, title: 'The corner garage', sub: 'Vic charges less. What is your time worth?', card: 'price', bays: 2, techs: ['mike', 'jess'], rate: 140, money: 0, stock: null, vic: true, pat: 70,
    script: [['oil', 1, 'budget'], ['brakes', 6, 'loyal'], ['battery', 12, 'normal'], ['tires', 18, 'budget'], ['light', 24, 'normal'], ['brakes', 30, 'normal'], ['oil', 36, 'loyal'], ['battery', 42, 'budget']],
    intro: ["See Vic's sign across the street? $95 an hour. Your aunt set ours at $140.", "You set our rate now — top right. Too high and people walk over to Vic. Too low and we work for free."],
    goals: [{ t: 'Earn $1,100', ok: r => r.revenue >= 1100, prog: r => [r.revenue, 1100], money: true }, { t: 'Lose at most 2 customers to Vic', ok: r => r.declined <= 2 && r.served > 0 }, { t: 'Earn $1,350', ok: r => r.revenue >= 1350, prog: r => [r.revenue, 1350], money: true }] },
  { n: 4, title: 'Out of stock', sub: 'No part, no repair.', card: 'parts', bays: 2, techs: ['mike', 'jess'], rate: null, money: 400, stock: { oil: 2, pads: 0, battery: 1, sensor: 0, wipers: 0, recall: 0 }, vic: true, pat: 70,
    script: [['oil', 4, 'normal'], ['brakes', 9, 'loyal'], ['battery', 14, 'normal'], ['oil', 20, 'loyal'], ['brakes', 26, 'normal'], ['light', 32, 'loyal'], ['battery', 38, 'loyal'], ['oil', 44, 'normal']],
    intro: ["Before it gets busy, check the parts wall. We're low on almost everything.", "Tap the shelves to order. The van takes a little while, and every box costs money up front."],
    goals: [{ t: 'Serve at least 7 customers', ok: r => r.served >= 7, prog: r => [r.served, 7] }, { t: 'Profit $1,000 after parts', ok: r => r.revenue - r.spent >= 1000, prog: r => [r.revenue - r.spent, 1000], money: true }, { t: 'No car ever waits for a part', ok: r => r.partsWaits === 0 && r.served >= 7 }] },
  { n: 5, title: 'The recall letter', sub: 'Aurex pays. You earn trust.', card: 'recall', bays: 3, techs: ['mike', 'jess', 'sam'], rate: null, money: 300, stock: { oil: 5, pads: 3, battery: 2, sensor: 1, wipers: 3, recall: 6 }, vic: true, pat: 70, jessSpeed: 0.85,
    script: [['recall', 2, 'loyal'], ['oil', 6, 'normal', 'wipers'], ['recall', 10, 'normal'], ['brakes', 15, 'loyal', 'rpads'], ['recall', 20, 'budget'], ['battery', 26, 'normal', 'wipers'], ['recall', 31, 'loyal'], ['tires', 37, 'normal'], ['oil', 42, 'loyal'], ['light', 47, 'normal']],
    intro: ["Big news: Aurex is recalling a fuel-pump relay. Aurex pays us to fix every one.", "We hired Sam and opened a third bay. While a car is up, the techs inspect it — recommend only what it really needs."],
    goals: [{ t: 'Fix all 4 recall cars', ok: r => r.recalls >= 4, prog: r => [r.recalls, 4] }, { t: 'Sell 2 recommended repairs', ok: r => r.upsold >= 2, prog: r => [r.upsold, 2] }, { t: 'Earn $2,000', ok: r => r.revenue >= 2000, prog: r => [r.revenue, 2000], money: true }] },
  { n: 6, title: 'Bring them back', sub: 'The cheapest customer is one you already have.', card: 'retention', bays: 3, techs: ['mike', 'jess', 'sam'], rate: null, money: 300, stock: { oil: 6, pads: 3, battery: 3, sensor: 2, wipers: 4, recall: 2 }, vic: true, pat: 70, jessSpeed: 0.9, town: true,
    script: [],
    intro: ["Everyone you've served lives right here in town. Most of them are due for service.", "Remind them and the happy ones come back. The unhappy ones… might not."],
    goals: [{ t: 'Serve at least 6 customers', ok: r => r.served >= 6, prog: r => [r.served, 6] }, { t: '4 returning customers', ok: r => r.returning >= 4, prog: r => [r.returning, 4] }, { t: 'Average rating 4.5★', ok: r => r.served >= 6 && r.avg >= 4.5 }] },
  { n: 7, title: "The bank's deadline", sub: 'Everything at once. Then the books.', card: 'profit', bays: 3, techs: ['mike', 'jess', 'sam'], rate: null, money: 500, stock: { oil: 4, pads: 2, battery: 1, sensor: 1, wipers: 3, recall: 3 }, vic: true, pat: 60, jessSpeed: 0.95, finale: true,
    script: [['oil', 1, 'loyal'], ['recall', 4, 'normal'], ['brakes', 7, 'normal', 'wipers'], ['battery', 11, 'budget'], ['tires', 15, 'loyal'], ['light', 19, 'normal', 'rpads'], ['oil', 23, 'budget'], ['recall', 27, 'loyal'], ['brakes', 31, 'loyal'], ['battery', 36, 'normal'], ['oil', 41, 'normal', 'wipers']],
    intro: ["The bank checks our books tonight. Wages, rent, parts — all of it has to be covered.", "Everything you've learned, all in one day. I'll be watching from the coffee machine."],
    goals: [{ t: 'Make a profit today', ok: r => r.profit > 0, txt: r => `${money(r.profit)} so far` }, { t: 'Profit $800', ok: r => r.profit >= 800, prog: r => [r.profit, 800], money: true }, { t: 'Profit $1,200', ok: r => r.profit >= 1200, prog: r => [r.profit, 1200], money: true }] },
];
const FIXED_COST = { wages: 160, rent: 260 }; // chapter 7 books: per tech, per day

/* ---------- scene layout (grid units) ---------- */
const SM = {
  W: 30, H: 26, laneIn: 17.4, laneOut: 19.0,
  bld: { x0: 7, y0: 1, x1: 21.2, y1: 9.6 }, bayY: 5.1, bayX: i => 8.9 + i * 3.1,
  parts: { x0: 19.75, x1: 21.0, y0: 1.3, y1: 9.3 },
  lounge: { x0: 21.8, y0: 2.0, x1: 27.4, y1: 8.4, door: 23.2 },
  canopy: { x0: 1.6, x1: 6.0, y0: 5.4, y1: 12.6 },
  driveX: 3.8, queueY: [9.0, 11.7, 14.4],
  waitY: 13.1, waitXs: [8.7, 10.6, 12.5, 14.4, 16.3, 18.2],
  pick: [[23.7, 12.9], [25.7, 12.9]],
  seats: [[22.7, 3.4], [23.9, 3.4], [25.1, 3.4], [26.3, 3.4], [22.7, 5.3], [23.9, 5.3], [25.1, 5.3], [26.3, 5.3], [24.5, 7.1], [25.7, 7.1]],
  vic: { x0: 2.4, y0: 21.2, x1: 8.6, y1: 23.6 }, vicPark: [[3.3, 24.8], [4.7, 24.8], [6.1, 24.8], [7.5, 24.8]],
};
const ST = { save: null, run: null, ents: new Map(), floats: [], hits: [], hover: null, statics: null, sig: '', modal: null, menu: false, tip: null, page: 0, time: 0, trafficT: 1, inited: false };
const STORY_BRAND = '#0a7480';

/* ---------- small helpers ---------- */
function srng(seed) { let t = seed >>> 0; return () => { t = (t + 0x6D2B79F5) | 0; let x = Math.imul(t ^ (t >>> 15), t | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const _icCache = {};
function iconOps(name) {
  if (_icCache[name]) return _icCache[name];
  const svg = ICONS[name] || ICONS.info, ops = [];
  const at = (s, k) => { const m = new RegExp('(?:^|\\s)' + k + '="([^"]*)"').exec(s); return m ? m[1] : null; };
  const re = /<(path|circle|rect|line|polyline|polygon)([^>]*)>/g; let m;
  while ((m = re.exec(svg))) {
    const t = m[1], a = m[2], p = new Path2D();
    if (t === 'path') { ops.push(new Path2D(at(a, 'd'))); continue; }
    if (t === 'circle') p.arc(+at(a, 'cx'), +at(a, 'cy'), +at(a, 'r'), 0, Math.PI * 2);
    else if (t === 'rect') p.rect(+(at(a, 'x') || 0), +(at(a, 'y') || 0), +at(a, 'width'), +at(a, 'height'));
    else if (t === 'line') { p.moveTo(+at(a, 'x1'), +at(a, 'y1')); p.lineTo(+at(a, 'x2'), +at(a, 'y2')); }
    else { const pts = at(a, 'points').trim().split(/[\s,]+/).map(Number); for (let i = 0; i < pts.length; i += 2) i ? p.lineTo(pts[i], pts[i + 1]) : p.moveTo(pts[i], pts[i + 1]); if (t === 'polygon') p.closePath(); }
    ops.push(p);
  }
  return (_icCache[name] = ops);
}
function drawIcon(c, name, x, y, size, color) {
  c.save(); c.translate(x - size / 2, y - size / 2); c.scale(size / 24, size / 24);
  c.strokeStyle = color; c.lineWidth = 2.3; c.lineCap = 'round'; c.lineJoin = 'round';
  for (const p of iconOps(name)) c.stroke(p);
  c.restore();
}
function isStory() { return UI.screen === 'story' || UI.screen === 'storymap'; }
function stCustomer(id) { return ST.run && ST.run.customers.find(c => c.id === id); }
function stLook(id) { return STORY_LOOKS[id] ? lookOf(id, { look: STORY_LOOKS[id], uniform: STORY_LOOKS[id].shirt }) : lookOf(id); }
function moodTone(p) { return p > 0.6 ? 'good' : p > 0.3 ? 'warn' : 'bad'; }
function moodColor(p) { return p > 0.6 ? '#2f9e5b' : p > 0.3 ? '#e0a92e' : '#d9443a'; }
function chapterDef(n) { return CHAPTERS.find(c => c.n === n); }
function stRate() { return ST.run ? ST.run.rate : 120; }

/* ---------- persistence ---------- */
async function storyLoad() {
  try { ST.save = await idbGet('story'); } catch (e) { ST.save = null; }
  if (!ST.save) ST.save = { v: 1, stars: {}, cards: [], roster: [], seenIntro: false, act1: false, remind: false, rate: 120 };
  return ST.save;
}
function storySave() { try { idbPut('story', ST.save); } catch (e) { /* storage unavailable */ } }
function storyTotalStars() { return sum(Object.values(ST.save ? ST.save.stars : {})); }
function chapterUnlocked(n) { return n === 1 || (ST.save.stars[n - 1] || 0) > 0; }
function storyProgressLabel() {
  if (!ST.save) return 'Act 1 · The Service Drive';
  const done = CHAPTERS.filter(c => (ST.save.stars[c.n] || 0) > 0).length;
  return done >= CHAPTERS.length ? `Act 1 complete · ${storyTotalStars()}★` : done ? `Chapter ${done + 1} of ${CHAPTERS.length} · ${storyTotalStars()}★` : 'Start Act 1 · The Service Drive';
}

/* ---------- chapter setup ---------- */
function buildCustomers(def) {
  const R = srng(def.n * 7919);
  const out = [];
  const mk = (job, at, type, find, base) => {
    const i = out.length;
    const nm = base ? { fn: base.name.split(' ')[0], ln: base.name.split(' ').slice(1).join(' ') } : { fn: FIRST_NAMES[Math.floor(R() * FIRST_NAMES.length)], ln: LAST_NAMES[Math.floor(R() * LAST_NAMES.length)] };
    const yr = 2019 + Math.floor(R() * 8);
    const c = {
      id: 'c' + def.n + '-' + i, rid: base ? base.rid : 'r' + def.n + '-' + i, name: nm.fn + ' ' + nm.ln, first: nm.fn, look: base ? base.look : 'L' + def.n + '-' + i,
      color: base ? base.color : EXT_COLORS[Math.floor(R() * EXT_COLORS.length)].hex, car: base ? base.car : `${yr} ${CARS[Math.floor(R() * CARS.length)]}`,
      job, hrs: SJOB[job].hrs, part: SJOB[job].part, type: type || 'normal', returning: !!base, brand: !!SJOB[job].brand, find: find || null,
      at, pat: def.pat * (type === 'loyal' ? 1.2 : 1), p: 1, state: 'scheduled', stars: 0, tip: false,
    };
    out.push(c);
  };
  if (def.town) {
    const plan = ST.run.townPlan || [];
    plan.forEach((b, i) => mk(b.job, 2 + i * 6, 'loyal', i % 3 === 1 ? 'wipers' : null, b));
    const walk = [['tires', 'budget'], ['battery', 'normal'], ['brakes', 'normal']];
    walk.forEach(([job, type], k) => mk(job, 5 + k * 13, type, null, null));
    out.sort((a, b) => a.at - b.at);
  } else {
    for (const [job, at, type, find] of def.script) mk(job, at, type, find, null);
    if (def.finale) {
      const back = ST.save.roster.filter(r => r.stars >= 3).slice(-3);
      back.forEach((b, i) => { mk(['oil', 'tires', 'brakes'][i % 3], 9 + i * 12, 'loyal', null, { ...b }); });
      out.sort((a, b) => a.at - b.at);
    }
  }
  return out;
}
function startChapter(n) {
  const def = chapterDef(n);
  ST.run = {
    def, n, t: 0, money: def.money, rate: def.rate || ST.save.rate || 120, revenue: 0, labour: 0, partsRev: 0, spent: 0, reminders: 0,
    stock: def.stock ? { ...def.stock } : null, orders: [], customers: [], driveQ: [], waitSpots: [], pickSpots: [null, null], seatsUsed: [],
    bays: def.techs.slice(0, def.bays).map(id => ({ tech: id, speed: id === 'jess' && def.jessSpeed ? def.jessSpeed : TECHS[id].speed, cust: null })),
    served: 0, lost: 0, declined: 0, recalls: 0, upsold: 0, returning: 0, partsWaits: 0, ratings: [], state: 'intro', endT: null, events: {}, townPlan: null,
  };
  ST.run.customers = def.town ? [] : buildCustomers(def);
  ST.ents.clear(); ST.floats = []; ST.sig = ''; ST.tip = null; ST.menu = false;
  stPlaceStaff();
  UI.screen = 'story';
  ST.modal = def.town ? 'town' : 'intro'; ST.page = 0;
  stFitCamera();
  render();
}
function stPlaceStaff() {
  const run = ST.run;
  const rosa = { id: 'rosa', type: 'person', gx: 5.4, gy: 8.6, look: stLook('rosa'), path: [], speed: 1.6, walk: 0, role: 'story', face: -1 };
  ST.ents.set('rosa', rosa);
  run.bays.forEach((b, i) => {
    const id = 'tech-' + b.tech;
    ST.ents.set(id, { id, type: 'person', gx: SM.bayX(i) + 1.15, gy: SM.bayY + 1.4, look: stLook(b.tech), path: [], speed: 1.6, walk: 0, role: 'story', face: -1, tech: b.tech });
  });
}

/* ---------- entities & movement ---------- */
function stCar(c) { return ST.ents.get('car-' + c.id); }
function stPerson(c) { return ST.ents.get('p-' + c.id); }
function stSpawn(c) {
  const qi = ST.run.driveQ.length;
  ST.run.driveQ.push(c.id);
  const car = { id: 'car-' + c.id, type: 'car', gx: -3, gy: SM.laneIn, dir: 'x', color: c.color, z: 0, zt: 0, path: [[SM.driveX, SM.laneIn], [SM.driveX, SM.queueY[qi]]], speed: 4.2, alpha: 1, cid: c.id };
  car.done = () => { c.state = 'atDrive'; const p = stPerson(c); p.hidden = false; p.gx = car.gx + 0.95; p.gy = car.gy + 0.2; if (ST.run.n === 1 && !ST.run.events.firstArrive) { ST.run.events.firstArrive = true; stTip("A customer! Tap their car to write it up.", { hl: [car.gx, car.gy] }); } };
  ST.ents.set(car.id, car);
  ST.ents.set('p-' + c.id, { id: 'p-' + c.id, type: 'person', gx: -3, gy: SM.laneIn, look: stLook(c.look), path: [], speed: 1.9, walk: 0, role: 'story', hidden: true, cid: c.id, face: 1 });
  c.state = 'arriving';
}
function stQueueShift() {
  ST.run.driveQ.forEach((id, i) => {
    const c = stCustomer(id), car = stCar(c), p = stPerson(c); if (!car) return;
    const y = SM.queueY[i];
    if (c.state === 'arriving') { if (car.path.length) car.path[car.path.length - 1] = [SM.driveX, y]; return; }
    if (c.state === 'atDrive' && Math.abs(car.gy - y) > 0.05) {
      car.path = [[SM.driveX, y]]; car.done = null;
      if (p) p.path = [[SM.driveX + 0.95, y + 0.2]];
    }
  });
}
function stStep(dt) {
  for (const [id, e] of ST.ents) {
    if (e.fade === 'out') { e.alpha -= dt * 1.4; if (e.alpha <= 0) ST.ents.delete(id); continue; }
    if (e.type === 'car') e.z += ((e.zt || 0) - e.z) * Math.min(1, dt * 3);
    if (!e.path.length) { e.moving = false; if (e.leaveWhenDone) ST.ents.delete(id); continue; }
    const [tx, ty] = e.path[0], dx = tx - e.gx, dy = ty - e.gy, d = Math.hypot(dx, dy), sp = e.speed * dt;
    e.moving = true;
    if (e.type === 'car' && d > 0.02) e.dir = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (e.type === 'person') e.walk += dt;
    if (d <= sp) {
      e.gx = tx; e.gy = ty; e.path.shift();
      if (!e.path.length) { if (e.type === 'car' && e.finalDir) e.dir = e.finalDir; const f = e.done; e.done = null; if (f) f(); }
    } else { e.gx += dx / d * sp; e.gy += dy / d * sp; }
  }
  // street traffic
  ST.trafficT -= dt;
  if (ST.trafficT <= 0) {
    ST.trafficT = 2.5 + Math.random() * 3;
    const east = Math.random() < 0.5, id = 'amb' + Math.random().toString(36).slice(2, 7);
    ST.ents.set(id, { id, type: 'car', ambient: true, gx: east ? -4 : SM.W + 4, gy: east ? SM.laneIn - 0.0 : SM.laneOut + 0.2, dir: 'x', color: PAINTS[Math.floor(Math.random() * PAINTS.length)], z: 0, zt: 0, path: [[east ? SM.W + 5 : -5, east ? SM.laneIn : SM.laneOut + 0.2]], speed: 5, alpha: 1, leaveWhenDone: true });
  }
  for (const f of ST.floats) f.t += dt;
  ST.floats = ST.floats.filter(f => f.t < (f.kind === 'say' ? 3.2 : 2.4));
}
function stFloat(gx, gy, text, tone, kind = 'coin') { ST.floats.push({ gx, gy, text, tone, kind, t: 0 }); }
function stSay(c, text) { const car = stCar(c) || stPerson(c); if (car) stFloat(car.gx, car.gy, text, 'say', 'say'); }

/* ---------- customer flow ---------- */
function stQuote(c) {
  const run = ST.run, part = c.part ? SPART[c.part] : null;
  if (c.brand) return { labour: c.hrs * BRAND_RATE, parts: part ? part.price : 0, total: 0, paid: c.hrs * BRAND_RATE + (part ? part.price : 0), payer: 'Aurex', vic: null };
  const labour = c.hrs * run.rate, parts = part ? part.price : 0;
  return { labour, parts, total: labour + parts, paid: labour + parts, payer: c.first, vic: c.hrs * VIC_RATE + parts };
}
function stAcceptChance(c, q) {
  if (!ST.run.def.vic || c.brand) return 1;
  const tol = { loyal: 0.42, normal: 0.18, budget: 0.0 }[c.type] + (c.returning ? 0.12 : 0);
  const over = q.total / q.vic - 1;
  return sigmoid((tol - over) * 14);
}
function stGiveQuote(id) {
  const run = ST.run, c = stCustomer(id); if (!c || c.state !== 'atDrive') return;
  const q = stQuote(c); c.q = q;
  ST.modal = null;
  if (Math.random() < stAcceptChance(c, q)) {
    stSay(c, c.brand ? 'Great — thanks for taking care of it.' : q.vic && q.total > q.vic * 1.15 ? "Pricier than Vic's… but okay." : pick2(['Sounds fair.', "Okay, let's do it.", 'Perfect, thank you!']));
    stToWaiting(c);
    if (run.n === 1 && !run.events.tipBay) { run.events.tipBay = true; stTip('Now tap the waiting car to send it into the bay.', { hlCar: c.id }); }
  } else {
    stSay(c, pick2(["That's too much. I'll try Vic's.", "Vic's is cheaper. No thanks.", "I'll go across the street."]));
    stDecline(c);
  }
  render();
}
function pick2(a) { return a[Math.floor(Math.random() * a.length)]; }
function stToWaiting(c) {
  const run = ST.run;
  run.driveQ = run.driveQ.filter(x => x !== c.id);
  let wi = run.waitSpots.findIndex(x => !x); if (wi < 0) wi = run.waitSpots.length;
  if (wi >= SM.waitXs.length) wi = SM.waitXs.length - 1;
  run.waitSpots[wi] = c.id; c.wi = wi; c.state = 'waiting';
  const car = stCar(c), wx = SM.waitXs[wi];
  car.path = [[6.8, car.gy], [6.8, 14.1], [wx, 14.1], [wx, SM.waitY]]; car.finalDir = 'y'; car.done = null;
  const p = stPerson(c), seat = stSeat(c);
  p.path = [[p.gx, 14.6], [SM.lounge.door, 14.6], [SM.lounge.door, 9.1], [SM.lounge.door, 8.0], seat];
  stQueueShift();
}
function stSeat(c) { const run = ST.run; let i = run.seatsUsed.findIndex(x => !x); if (i < 0) i = run.seatsUsed.length; i = Math.min(i, SM.seats.length - 1); run.seatsUsed[i] = c.id; c.seat = i; return SM.seats[i]; }
function stFreeSeat(c) { if (c.seat != null && ST.run.seatsUsed[c.seat] === c.id) ST.run.seatsUsed[c.seat] = null; }
function stDecline(c) {
  const run = ST.run;
  run.driveQ = run.driveQ.filter(x => x !== c.id); c.state = 'declined'; run.declined++;
  const p = stPerson(c); p.hidden = true;
  const car = stCar(c), vp = SM.vicPark[run.declined % SM.vicPark.length];
  car.path = [[SM.driveX, SM.laneOut], [vp[0], SM.laneOut], [vp[0], vp[1]]]; car.finalDir = 'y';
  car.done = () => { stFloat(car.gx, car.gy, "Went to Vic's", 'bad'); setTimeout(() => { car.fade = 'out'; }, 2500); };
  stQueueShift();
  if (!run.events.declineTip) { run.events.declineTip = true; stTip(`${c.first} took the car to Vic's. Price shoppers go where it's cheaper — loyal owners will pay a little more for trust.`); }
}
function stSendToBay(id) {
  const run = ST.run, c = stCustomer(id); if (!c || c.state !== 'waiting') return;
  const b = run.bays.findIndex(x => !x.cust);
  if (b < 0) { stTip('All bays are busy. Send this one in as soon as a bay opens.'); return; }
  run.bays[b].cust = c.id; c.bay = b; c.state = 'tobay'; run.waitSpots[c.wi] = null;
  const car = stCar(c), bx = SM.bayX(b);
  car.path = [[car.gx, 10.6], [bx, 10.6], [bx, SM.bayY]]; car.finalDir = 'y';
  car.done = () => { car.zt = 16; c.state = 'bay'; c.prog = 0; c.dur = c.hrs * HOUR / run.bays[b].speed; stStartWork(c); };
  if (run.n === 1 && !run.events.tipWait) { run.events.tipWait = true; stTip(`${TECHS[run.bays[b].tech].name} is on it. ${c.first} waits in the lounge — don't keep them too long.`); }
  const tech = ST.ents.get('tech-' + run.bays[b].tech); if (tech) tech.path = [[bx + 1.15, SM.bayY + 1.4]];
}
function stStartWork(c) {
  const run = ST.run;
  if (run.stock && c.part) {
    if ((run.stock[c.part] || 0) > 0) { run.stock[c.part]--; c.held = false; }
    else {
      c.held = true; run.partsWaits++;
      if (!run.events.partsTip) { run.events.partsTip = true; stTip(`No ${SPART[c.part].name.toLowerCase()} on the shelf! Tap the parts wall to order — the van takes a little while.`, { hlParts: true }); }
    }
  }
}
function stFinish(c) {
  const run = ST.run, b = c.bay;
  c.state = 'pickup';
  const car = stCar(c); car.zt = 0;
  let pi = run.pickSpots.findIndex(x => !x);
  if (pi < 0) { c.state = 'bayDone'; return; }
  run.bays[b].cust = null;
  run.pickSpots[pi] = c.id; c.pi = pi;
  const [px, py] = SM.pick[pi];
  car.path = [[car.gx, 10.6], [px, 10.6], [px, py]]; car.finalDir = 'y';
  let carHere = false, personHere = false;
  const both = () => { if (carHere && personHere) stPay(c); };
  car.done = () => { carHere = true; both(); };
  const p = stPerson(c); stFreeSeat(c);
  p.path = [[SM.lounge.door, 8.0], [SM.lounge.door, 9.2], [px + 0.95, 10.4], [px + 0.95, py + 0.1]];
  p.done = () => { personHere = true; both(); };
}
function stPay(c) {
  const run = ST.run, q = c.q || stQuote(c);
  let paid = q.paid, labour = q.labour, partsRev = q.parts;
  if (c.extra) { paid += c.extra.total; labour += c.extra.labour; partsRev += c.extra.parts; }
  run.money += paid; run.revenue += paid; run.labour += labour; run.partsRev += partsRev;
  const fair = !run.def.vic || c.brand || !q.vic ? 1 : 1 - clamp((q.total / q.vic - 1) / 0.6, 0, 1);
  const stars = clamp(Math.round(1 + 4 * (0.7 * c.p + 0.3 * fair) + (c.extra ? 0.2 : 0)), 1, 5);
  c.stars = stars; run.ratings.push(stars); run.served++;
  if (c.brand) run.recalls++;
  if (c.returning) run.returning++;
  c.state = 'paid';
  const car = stCar(c);
  stFloat(car.gx, car.gy, `+${money(paid)}`, 'good');
  setTimeout(() => stFloat(car.gx, car.gy, '★'.repeat(stars) + '☆'.repeat(5 - stars), stars >= 4 ? 'good' : stars >= 3 ? 'info' : 'bad', 'stars'), 450);
  stRemember(c, stars);
  const p = stPerson(c); p.hidden = true;
  run.pickSpots[c.pi] = null;
  car.path = [[car.gx, 14.6], [27.9, 14.6], [27.9, SM.laneOut], [SM.W + 5, SM.laneOut]]; car.leaveWhenDone = true;
  // a car finished in a bay may be waiting for this pickup spot
  const waitingDone = run.customers.find(x => x.state === 'bayDone'); if (waitingDone) stFinish(waitingDone);
  if (run.n === 1 && run.served === 1) stTip('That is a service visit: hours × rate + parts, paid when the car is ready. Two more to go.');
  render();
}
function stLose(c) {
  const run = ST.run;
  const was = c.state;
  c.state = 'lost'; run.lost++;
  if (was === 'atDrive') run.driveQ = run.driveQ.filter(x => x !== c.id);
  if (was === 'waiting') run.waitSpots[c.wi] = null;
  if (was === 'bay') { run.bays[c.bay].cust = null; }
  stFreeSeat(c);
  const car = stCar(c), p = stPerson(c);
  stFloat(car.gx, car.gy, was === 'bay' ? "Gave up — no part" : 'Left angry', 'bad');
  if (was === 'bay') { car.zt = 0; stSay(c, "I'll come back another day."); }
  const drive = () => { p.hidden = true; car.path = (was === 'bay' ? [[car.gx, 10.6], [6.8, 10.6], [6.8, 14.8]] : [[car.gx, 14.8]]).concat([[SM.driveX + 1.2, 14.8], [SM.driveX + 1.2, SM.laneOut], [-5, SM.laneOut]]); car.leaveWhenDone = true; };
  if (was === 'waiting' || was === 'bay') { p.path = [[SM.lounge.door, 8.0], [SM.lounge.door, 9.2], [car.gx + 0.95, was === 'bay' ? 10.4 : 14.0], [car.gx + 0.95, was === 'bay' ? 10.4 : car.gy + 0.2]]; p.done = drive; }
  else drive();
  stRemember(c, 1);
  stQueueShift();
  if (!run.events.lostTip) { run.events.lostTip = true; stTip(`We lost ${c.first}. Every car that leaves is money and a customer gone — and they tell their friends.`); }
}
function stRemember(c, stars) {
  const R = ST.save.roster;
  let r = R.find(x => x.rid === c.rid);
  if (!r) { r = { rid: c.rid, name: c.name, look: c.look, color: c.color, car: c.car, stars, visits: 0, ch: ST.run.n }; R.push(r); }
  r.stars = stars; r.visits++; r.ch = ST.run.n;
  if (R.length > 40) R.splice(0, R.length - 40);
}

/* ---------- the shop's clock-free update ---------- */
function storyUpdate(dt) {
  const run = ST.run; if (!run || run.state !== 'play') return;
  run.t += dt;
  for (const c of run.customers) {
    if (c.state === 'scheduled' && run.t >= c.at && run.driveQ.length < SM.queueY.length) stSpawn(c);
    if (c.state === 'atDrive' || c.state === 'waiting' || (c.state === 'bay' && c.held)) {
      c.p = Math.max(0, c.p - dt / c.pat * (c.state === 'bay' ? 0.5 : 1));
      if (c.p <= 0) { stLose(c); continue; }
      if (c.state === 'waiting' && c.p < 0.35 && !c.tip && run.n === 2) { c.tip = true; stTip(`${c.first} is getting impatient — get that car in next.`); }
    }
    if (c.state === 'bay') {
      if (c.held) { if (run.stock[c.part] > 0) { run.stock[c.part]--; c.held = false; } continue; }
      if (c.find && !c.asked && c.prog > 0.35 && run.n >= 5) { c.asked = true; ST.modal = { kind: 'upsell', id: c.id }; render(); return; }
      c.prog += dt / c.dur;
      if (c.prog >= 1) stFinish(c);
    }
  }
  // parts deliveries
  for (const o of run.orders.filter(o => o.eta <= run.t)) {
    run.stock[o.part] = (run.stock[o.part] || 0) + o.qty;
    stFloat(20.2, 10.4, `+${o.qty} ${SPART[o.part].name.toLowerCase()}`, 'info');
  }
  run.orders = run.orders.filter(o => o.eta > run.t);
  // end of the day
  const open = run.customers.some(c => !['paid', 'lost', 'declined'].includes(c.state));
  if (!open && run.customers.length) {
    if (run.endT == null) run.endT = run.t + 2.5;
    else if (run.t >= run.endT) stEndChapter();
  }
}

/* ---------- results ---------- */
function stResults() {
  const run = ST.run, r = run;
  const res = {
    served: r.served, lost: r.lost, declined: r.declined, revenue: Math.round(r.revenue), spent: Math.round(r.spent), recalls: r.recalls, upsold: r.upsold, returning: r.returning, partsWaits: r.partsWaits,
    avg: r.ratings.length ? avg(r.ratings) : 0, min: r.ratings.length ? Math.min(...r.ratings) : 0,
  };
  res.fixed = run.def.finale ? run.bays.length * FIXED_COST.wages + FIXED_COST.rent : 0;
  res.profit = Math.round(res.revenue - res.spent - res.fixed);
  res.done = run.def.goals.map(g => !!g.ok(res));
  res.stars = res.done[0] ? res.done.filter(Boolean).length : 0;
  return res;
}
function stEndChapter() {
  const run = ST.run;
  run.state = 'over';
  run.res = stResults();
  const s = ST.save;
  if (run.res.stars > (s.stars[run.n] || 0)) s.stars[run.n] = run.res.stars;
  if (run.res.stars > 0 && !s.cards.includes(run.def.card)) { s.cards.push(run.def.card); run.res.newCard = true; }
  if (run.def.finale && run.res.stars > 0) s.act1 = true;
  storySave();
  ST.modal = run.def.finale ? 'monthend' : 'results';
  render();
}
function stGoalProgress(g) {
  const r = stResults();
  const ok = g.ok(r);
  if (g.txt) return { ok, txt: g.txt(r) };
  if (!g.prog) return { ok, txt: '' };
  const [a, b] = g.prog(r);
  return { ok, txt: g.money ? `${money(Math.max(0, a))} / ${money(b)}` : `${Math.max(0, a)}/${b}`, frac: clamp(a / b, 0, 1) };
}

/* ---------- Rosa ---------- */
function stTip(text, opt = {}) { ST.tip = { text, ...opt, t: performance.now() }; renderStory(); }

/* ---------- input from the world ---------- */
function storyHitAt(px, py) {
  if (UI.screen !== 'story' || !ST.run) return null;
  const [wx, wy] = toWorld(px, py);
  let best = null;
  for (const h of ST.hits) if (wx >= h.x && wx <= h.x + h.w && wy >= h.y && wy <= h.y + h.h) { if (!best || h.k > best.k) best = h; }
  if (best) return best;
  const [gx, gy] = screenToGrid(px, py);
  const inR = (b) => gx >= b.x0 && gx <= b.x1 && gy >= b.y0 && gy <= b.y1;
  if (inR({ x0: 19.4, x1: 21.3, y0: 1, y1: 9.7 })) return { zone: 'parts' };
  if (inR(SM.lounge)) return { zone: 'lounge' };
  if (inR(SM.bld)) return { zone: 'shop' };
  if (inR({ x0: 1.5, x1: 9.5, y0: 20.5, y1: 25.5 })) return { zone: 'vic' };
  return null;
}
function storyLabel(h) {
  if (!h) return '';
  const run = ST.run;
  if (h.zone === 'parts') return run.stock ? `<b>Parts wall</b><br>${Object.entries(run.stock).filter(([k]) => k !== 'recall' || run.n >= 5).map(([k, v]) => `${SPART[k].name}: ${v}`).join('<br>')}<br><span>Tap to order</span>` : '<b>Parts wall</b><br>Fully stocked for now';
  if (h.zone === 'lounge') return `<b>Customer lounge</b><br>${run.customers.filter(c => ['waiting', 'tobay', 'bay', 'bayDone'].includes(c.state)).length} customers waiting for their cars`;
  if (h.zone === 'shop') return `<b>Workshop</b><br>${run.bays.length} bay${run.bays.length > 1 ? 's' : ''} · ${run.bays.filter(b => b.cust).length} busy`;
  if (h.zone === 'vic') return `<b>Vic's Quick Fix</b><br>${run.def.vic ? `Charges $${VIC_RATE}/hour` : 'The corner garage'}`;
  const e = h.e, c = stCustomer(e.cid);
  if (e.id === 'rosa') return '<b>Rosa</b><br>Service manager, 31 years';
  if (e.tech) return `<b>${TECHS[e.tech].name}</b><br>Technician`;
  if (!c) return '';
  const st = { arriving: 'Pulling in', atDrive: 'Waiting to be written up — tap', waiting: 'Ready for a bay — tap to send in', tobay: 'Heading into a bay', bay: c.held ? 'Waiting for a part' : 'Being worked on', bayDone: 'Done — waiting for a pickup spot', pickup: 'Ready for pickup' }[c.state] || '';
  return `<b>${esc(c.name)}</b> · ${esc(SJOB[c.job].name)}<br>${st}`;
}
function storyClick(h) {
  const run = ST.run; if (!run || run.state !== 'play' || !h) return;
  if (h.zone === 'parts') { if (run.stock) { ST.modal = 'parts'; render(); } else stTip("The parts wall is fully stocked today. You'll manage it yourself soon."); return; }
  if (!h.e) return;
  const c = stCustomer(h.e.cid);
  if (h.e.id === 'rosa') { stTip(pick2(["Keep the bays busy — an empty bay earns nothing.", "Short jobs first when the line is long.", "Happy customers come back. That's the whole business."])); return; }
  if (!c) return;
  if (c.state === 'atDrive') {
    if (run.driveQ[0] !== c.id) { stTip('Write up the first car in line.'); return; }
    ST.modal = { kind: 'writeup', id: c.id }; ST.tip = null; render(); return;
  }
  if (c.state === 'waiting') { stSendToBay(c.id); render(); return; }
}

/* ---------- camera ---------- */
function stFitCamera() {
  // frame the property itself (drive, workshop, lounge, lots), not the whole street
  const phone = Wd.vw < 700, top = phone ? 200 : 86, bottom = phone ? 120 : 30, availH = Wd.vh - top - bottom;
  const z = phone ? clamp(Wd.vw / 640, 0.5, 0.8) : clamp(Math.min(Wd.vw / 1480, availH / 800) * 1.12, 0.5, 2);
  Wd.cam.z = z;
  const [cx, cy] = P(phone ? 9.5 : 14.5, phone ? 9.5 : 9.0, 20);
  Wd.cam.x = Wd.vw / 2 - cx * z; Wd.cam.y = top + availH / 2 - cy * z;
}

/* ---------- drawing ---------- */
function stGround(c) {
  poly(c, quad(-8, -8, SM.W + 8, SM.H + 8), '#8dbb73');
  poly(c, quad(0.4, 0.4, 28.6, 15.8), '#5e6871');
  poly(c, quad(SM.canopy.x0, SM.canopy.y0, SM.canopy.x1, SM.canopy.y1, 0.2), '#69737c');
  poly(c, quad(SM.bld.x0, SM.bld.y0, SM.bld.x1, SM.bld.y1, 0.4), '#cdd3d8');
  poly(c, quad(SM.lounge.x0, SM.lounge.y0, SM.lounge.x1, SM.lounge.y1, 0.4), '#e9dcc4');
  c.strokeStyle = 'rgba(0,0,0,.05)'; for (let x = SM.lounge.x0 + 0.6; x < SM.lounge.x1; x += 0.6) { const a = P(x, SM.lounge.y0, 0.4), b = P(x, SM.lounge.y1, 0.4); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  for (let i = 0; i <= 4; i++) { const x = SM.bayX(i) - 1.55; const a = P(x, 1.5, 0.5), b = P(x, SM.bld.y1, 0.5); c.strokeStyle = 'rgba(232,184,40,.85)'; c.lineWidth = 2; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  // sidewalk, road, far side
  poly(c, quad(-8, 15.8, SM.W + 8, 16.6), '#dcd8cf');
  poly(c, quad(-8, 16.6, SM.W + 8, 19.8), '#474e55');
  c.strokeStyle = '#e2c14a'; c.lineWidth = 2; c.setLineDash([14, 12]); { const a = P(-8, 18.2), b = P(SM.W + 8, 18.2); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); } c.setLineDash([]);
  poly(c, quad(-8, 19.8, SM.W + 8, 20.6), '#dcd8cf');
  poly(c, quad(1.4, 20.6, 9.6, 25.8), '#626b73');
  // driveways
  poly(c, quad(SM.driveX - 0.9, 15.8, SM.driveX + 2.2, 16.6), '#5e6871');
  poly(c, quad(26.8, 15.8, 29.0, 16.6), '#5e6871');
  // stall markings
  c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.4;
  const stall = (x, y) => { for (const dx of [-0.85, 0.85]) { const a = P(x + dx, y - 0.95), b = P(x + dx, y + 0.95); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); } };
  SM.waitXs.forEach(x => stall(x, SM.waitY)); SM.pick.forEach(([x, y]) => stall(x, y)); SM.vicPark.forEach(([x, y]) => stall(x, y));
  c.save(); c.globalAlpha = 0.6;
  wallGroundText(c, 8.2, 11.6, 'WAITING FOR A BAY'); wallGroundText(c, 22.8, 11.4, 'PICK-UP'); wallGroundText(c, SM.driveX - 0.6, 15.4, 'SERVICE ENTRANCE');
  c.restore();
  // lawn of the houses across the road
  for (let i = 0; i < 4; i++) poly(c, quad(11.5 + i * 4.4, 21, 15 + i * 4.4, 25.5), '#9cc985');
}
function stHouse(c, x, y, col) {
  box(c, x, y, x + 3, y + 2.4, 0, 30, { base: col });
  const r = '#7c4a3a';
  poly(c, [P(x, y, 30), P(x + 3, y, 30), P(x + 3, y + 1.2, 46), P(x, y + 1.2, 46)], shade(r, 0.1));
  poly(c, [P(x, y + 2.4, 30), P(x + 3, y + 2.4, 30), P(x + 3, y + 1.2, 46), P(x, y + 1.2, 46)], r);
  poly(c, [P(x + 3, y, 30), P(x + 3, y + 2.4, 30), P(x + 3, y + 1.2, 46)], shade(col, -0.2));
  box(c, x + 1.2, y + 2.38, x + 1.8, y + 2.42, 0, 16, { base: '#6b4f37' });
}
function stStatics() {
  const items = [], add = (k, f) => items.push({ k, f });
  const b = SM.bld, run = ST.run, nb = run ? run.bays.length : 2, bc = STORY_BRAND, L = SM.lounge;
  const wall = { base: '#eef0f1', top: '#ffffff', left: '#e3e7ea', right: '#cfd5da' };
  const metal = { base: '#d5dade', top: '#eef1f3', left: '#c8ced3', right: '#b5bdc4' };
  for (const [x, y] of [[0.6, 1], [0.6, 4], [0.6, 13.6], [28.9, 1], [28.9, 9.6], [28.9, 13], [3, 0.4], [6, 0.3], [11, 0.3], [16, 0.3], [24, 0.6], [27.6, 0.8], [10.6, 21.4], [26.6, 25.4]]) add(x + y, c => drawTree(c, x, y));
  for (const [x, y] of [[7.1, 15.4], [14.1, 15.4], [21.1, 15.4], [0.9, 10.2]]) add(x + y + 0.2, c => drawLamp(c, x, y));
  // workshop back walls
  for (let x = b.x0; x < b.x1; x += 1) { const x2 = Math.min(b.x1, x + 1); add(x + b.y0 + 0.31, c => box(c, x, b.y0, x2, b.y0 + 0.3, 0, 74, metal)); }
  for (let y = b.y0; y < b.y1; y += 1) { const y2 = Math.min(b.y1, y + 1); add(b.x0 + y + 0.31, c => box(c, b.x0, y, b.x0 + 0.3, y2, 0, 74, metal)); }
  add(b.x1 + b.y0 + 0.4, c => {
    poly(c, [P(b.x0 + 1, b.y0 + 0.31, 54), P(b.x1 - 1.4, b.y0 + 0.31, 54), P(b.x1 - 1.4, b.y0 + 0.31, 68), P(b.x0 + 1, b.y0 + 0.31, 68)], bc);
    wallText(c, b.x0 + 1.6, b.y0 + 0.31, 57, 'HILLCREST AUREX · SERVICE', 10, '#ffffff', true);
  });
  // bays
  for (let i = 0; i < 4; i++) {
    const bx = SM.bayX(i), x0 = bx - 1.55, x1 = bx + 1.55;
    if (i < nb) {
      add(bx + SM.bayY - 0.6, c => drawLift(c, bx, SM.bayY));
      add(bx + 1.3 + 2.2, c => box(c, bx + 0.9, 1.7, bx + 1.4, 2.3, 0, 18, { base: '#c0392b' }));
      add(x0 + b.y1 + 0.03, c => box(c, x0, b.y1 - 0.12, x0 + 0.14, b.y1 + 0.12, 0, 60, metal));
      add(bx + b.y1 + 0.03, c => box(c, x0, b.y1 - 0.12, x1, b.y1 + 0.12, 52, 62, metal));
      add(x0 + 0.4 + b.y1, c => wallText(c, x0 + 0.25, b.y1 + 0.13, 54, `BAY ${i + 1}`, 7, '#5b6670', true));
    } else {
      add(bx + 1 + b.y1 + 0.05, c => {
        box(c, x0, b.y1 - 0.12, x1, b.y1 + 0.12, 0, 62, { base: '#b8c0c7', left: '#c3cad0' });
        for (let z = 6; z < 60; z += 6) { const a = P(x0, b.y1 + 0.12, z), bb = P(x1, b.y1 + 0.12, z); c.strokeStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(bb[0], bb[1]); c.stroke(); }
        wallText(c, x0 + 0.6, b.y1 + 0.13, 26, 'NOT OPEN YET', 7, '#59626b', true);
      });
    }
  }
  // parts wall: shelves fill up with boxes as you stock them
  const stock = run && run.stock ? run.stock : null;
  add(SM.parts.x0 + 5.3, c => {
    box(c, SM.parts.x0, SM.parts.y0, SM.parts.x1, SM.parts.y1, 0, 46, { base: '#7f8b96', top: '#9aa5af' });
    const keys = ['oil', 'pads', 'battery', 'sensor', 'wipers', 'recall'];
    keys.forEach((k, i) => {
      const n = stock ? Math.min(6, stock[k] || 0) : 4, y = SM.parts.y0 + 0.5 + i * 1.3, col = ['#d08a2c', '#c0392b', '#2f6db5', '#7a5bb5', '#3e8e5e', '#2a9ea0'][i];
      for (let j = 0; j < n; j++) { const z = 6 + (j % 3) * 12; const yy = y + Math.floor(j / 3) * 0.5; box(c, SM.parts.x0 - 0.02, yy, SM.parts.x0 + 0.22, yy + 0.38, z, z + 8, { base: col }); }
      if (stock && n === 0 && k !== 'recall') { const [sx, sy] = P(SM.parts.x0, y + 0.4, 30); c.fillStyle = '#d9443a'; c.font = '700 11px Inter, sans-serif'; c.fillText('!', sx - 3, sy); }
    });
  });
  add(b.x1 + b.y1, c => box(c, b.x1 - 0.2, b.y1 - 0.12, b.x1, b.y1 + 0.12, 0, 62, metal));
  for (let y = b.y0; y < b.y1; y += 1) { const y2 = Math.min(b.y1, y + 1); add(b.x1 + y + 0.6, c => box(c, b.x1 - 0.12, y, b.x1 + 0.12, y2, 0, 14, metal)); }
  // lounge
  for (let x = L.x0; x < L.x1; x += 1) { const x2 = Math.min(L.x1, x + 1); add(x + L.y0 + 0.31, c => box(c, x, L.y0, x2, L.y0 + 0.3, 0, 60, wall)); }
  for (let y = L.y0; y < L.y1; y += 1) { const y2 = Math.min(L.y1, y + 1); add(L.x0 + y + 0.31, c => box(c, L.x0, y, L.x0 + 0.3, y2, 0, 60, wall)); }
  add(L.x1 + L.y0 + 0.5, c => { poly(c, [P(L.x0 + 1.4, L.y0 + 0.31, 26), P(L.x0 + 3.4, L.y0 + 0.31, 26), P(L.x0 + 3.4, L.y0 + 0.31, 40), P(L.x0 + 1.4, L.y0 + 0.31, 40)], '#1d2329'); wallText(c, L.x0 + 3.9, L.y0 + 0.31, 30, 'LOUNGE', 9, bc, true); });
  add(L.x1 - 0.8 + L.y0 + 0.8, c => { box(c, L.x1 - 1.1, L.y0 + 0.4, L.x1 - 0.4, L.y0 + 1.0, 0, 20, { base: '#3a3f45' }); box(c, L.x1 - 1.0, L.y0 + 0.45, L.x1 - 0.5, L.y0 + 0.8, 20, 24, { base: '#c0392b' }); });
  for (const [x, y] of SM.seats) add(x + y - 0.1, c => { box(c, x - 0.4, y - 0.1, x + 0.4, y + 0.35, 0, 6, { base: '#556b7d' }); box(c, x - 0.4, y - 0.35, x + 0.4, y - 0.1, 0, 14, { base: '#4a5f71' }); });
  add(L.x0 + 0.6 + L.y1 - 0.6, c => drawPlant(c, L.x0 + 0.6, L.y1 - 0.6));
  for (let x = L.x0; x < L.x1; x += 1) { const x2 = Math.min(L.x1, x + 1); if (x2 > L.door - 0.6 && x < L.door + 0.6) continue; add(x + 0.5 + L.y1 + 0.02, c => drawGlass(c, x, L.y1, x2, L.y1, 46)); }
  for (let y = L.y0; y < L.y1; y += 1) { const y2 = Math.min(L.y1, y + 1); add(L.x1 + y + 0.5 + 0.02, c => drawGlass(c, L.x1, y, L.x1, y2, 46)); }
  // service drive canopy, podium
  const cn = SM.canopy;
  for (const [x, y] of [[cn.x0, cn.y1 - 0.25], [cn.x1 - 0.25, cn.y1 - 0.25]]) add(x + y + 0.1, c => box(c, x, y, x + 0.25, y + 0.25, 0, 60, { base: '#e7eaec' }));
  for (let x = cn.x0; x < cn.x1; x += 1) { const x2 = Math.min(cn.x1, x + 1); add(x + 0.5 + cn.y1 + 0.2, c => box(c, x, cn.y1 - 0.3, x2, cn.y1, 58, 66, { base: bc })); }
  add(cn.x1 + cn.y1 + 0.3, c => wallText(c, cn.x0 + 0.5, cn.y1, 60, 'SERVICE DRIVE', 7, '#ffffff', true));
  add(5.2 + 8.0, c => box(c, 4.9, 7.6, 5.6, 8.2, 0, 14, { base: '#d9dde2', top: '#f6f7f8' }));
  // sign and the competition
  add(0.9 + 15.0 + 0.5, c => {
    box(c, 0.6, 14.8, 0.85, 15.05, 0, 70, { base: '#59626b' }); box(c, 1.4, 14.8, 1.65, 15.05, 0, 70, { base: '#59626b' });
    box(c, 0.3, 14.7, 1.95, 15.15, 70, 112, { base: bc }); wallText(c, 0.45, 15.16, 94, 'HILLCREST', 10, '#fff', true); wallText(c, 0.45, 15.16, 80, 'AUREX', 9, 'rgba(255,255,255,.85)', true);
  });
  const vic = SM.vic;
  add(vic.x1 + vic.y1, c => {
    box(c, vic.x0, vic.y0, vic.x1, vic.y1, 0, 40, { base: '#e9d9b8' });
    poly(c, quad(vic.x0, vic.y0, vic.x1, vic.y1, 40), '#e08a1e');
    box(c, vic.x0 + 2, vic.y1 - 0.02, vic.x0 + 4.2, vic.y1 + 0.02, 0, 28, { base: '#8d96a0' });
    wallText(c, vic.x0 + 0.5, vic.y1 + 0.03, 33, "VIC'S QUICK FIX", 8, '#7a3f05', true);
  });
  add(10 + 21.4, c => {
    box(c, 9.7, 21.2, 9.9, 21.4, 0, 58, { base: '#59626b' });
    box(c, 9.0, 21.15, 10.8, 21.45, 58, 88, { base: '#e08a1e' });
    wallText(c, 9.15, 21.46, 76, "VIC'S", 9, '#fff', true);
    if (ST.run && ST.run.def.vic) wallText(c, 9.15, 21.46, 63, `$${VIC_RATE}/HR`, 9, '#fff', true);
  });
  [['#f3e3c3', 12], ['#cfe0ea', 16.4], ['#f0d0c8', 20.8], ['#dfe8c9', 25.2]].forEach(([col, x]) => add(x + 3 + 21.8, c => stHouse(c, x, 21.6, col)));
  return items;
}
function stBubble(c, gx, gy, z, opt) {
  const [sx, sy] = P(gx, gy, z);
  const w = opt.w || 26, h = 22, pulse = opt.pulse ? 1 + Math.sin(performance.now() / 220) * 0.08 : 1;
  c.save(); c.translate(sx, sy); c.scale(pulse, pulse);
  c.fillStyle = opt.bg || '#ffffff'; c.strokeStyle = opt.ring || 'rgba(0,0,0,.15)'; c.lineWidth = opt.ring ? 3 : 1;
  c.beginPath(); c.roundRect(-w / 2, -h - 8, w, h, 8); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-4, -8.5); c.lineTo(0, -2); c.lineTo(4, -8.5); c.fill();
  if (opt.icon) drawIcon(c, opt.icon, 0, -h / 2 - 8, 14, opt.ic || '#26323d');
  if (opt.text) { c.fillStyle = opt.ic || '#26323d'; c.font = '700 11px Inter, sans-serif'; c.textAlign = 'center'; c.fillText(opt.text, opt.icon ? 9 : 0, -h / 2 - 4); c.textAlign = 'start'; }
  c.restore();
}
function stRing(c, gx, gy, z, frac, color) {
  const [sx, sy] = P(gx, gy, z);
  c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(sx, sy, 11, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = color; c.beginPath(); c.arc(sx, sy, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(frac, 0, 1)); c.stroke();
}
function storyDraw() {
  const c = Wd.ctx, z = Wd.cam.z, run = ST.run;
  c.setTransform(Wd.dpr, 0, 0, Wd.dpr, 0, 0); c.fillStyle = '#86b46c'; c.fillRect(0, 0, Wd.vw, Wd.vh);
  c.setTransform(Wd.dpr * z, 0, 0, Wd.dpr * z, Wd.dpr * Wd.cam.x, Wd.dpr * Wd.cam.y);
  stGround(c);
  const sig = (run ? run.n + ':' + run.bays.length + ':' + (run.stock ? Object.values(run.stock).join(',') : '') : 'none');
  if (sig !== ST.sig) { ST.statics = stStatics(); ST.sig = sig; }
  const items = ST.statics.slice(); ST.hits = [];
  for (const e of ST.ents.values()) {
    if (e.hidden) continue;
    const k = e.gx + e.gy + (e.type === 'car' ? 0.45 : 0.05);
    items.push({ k, f: cc => { if (e.type === 'car') { drawCar(cc, e); cc.globalAlpha = 1; } else drawPerson(cc, e); } });
    if (!e.ambient) { const [sx, sy] = P(e.gx, e.gy, e.z || 0); ST.hits.push(e.type === 'car' ? { x: sx - 30, y: sy - 40, w: 60, h: 48, e, k } : { x: sx - 10, y: sy - 48, w: 20, h: 50, e, k: k + 10 }); }
  }
  items.sort((a, b) => a.k - b.k);
  for (const it of items) it.f(c);
  // overlays: what each customer needs, how the work is going
  if (run) {
    for (const cu of run.customers) {
      const car = stCar(cu); if (!car || car.moving) continue;
      if (cu.state === 'atDrive' && run.driveQ[0] === cu.id) stBubble(c, car.gx, car.gy, 30, { icon: SJOB[cu.job].icon, ring: moodColor(cu.p), pulse: true });
      else if (cu.state === 'atDrive') stBubble(c, car.gx, car.gy, 30, { icon: SJOB[cu.job].icon, ring: moodColor(cu.p) });
      if (cu.state === 'waiting') stBubble(c, car.gx, car.gy, 30, { icon: SJOB[cu.job].icon, ring: moodColor(cu.p), pulse: run.bays.some(b => !b.cust), text: `${cu.hrs}h`, w: 46 });
      if (cu.state === 'bay') {
        if (cu.held) stBubble(c, car.gx, car.gy, 50, { icon: SPART[cu.part].icon, bg: '#fde2df', ring: '#d9443a', ic: '#b1271b', pulse: true });
        else stRing(c, car.gx, car.gy, 52, cu.prog, '#2fa8b3');
      }
      if (cu.state === 'bayDone') stBubble(c, car.gx, car.gy, 50, { icon: 'check', ring: '#2f9e5b' });
      const p = stPerson(cu);
      if (p && !p.hidden && !p.moving && (cu.state === 'waiting' || (cu.state === 'bay' && cu.held))) { const [sx, sy] = P(p.gx, p.gy, 0); ell(c, sx, sy - 40, 4.5, 4.5, moodColor(cu.p)); }
    }
    if (ST.tip && ST.tip.hl) { const [sx, sy] = P(ST.tip.hl[0], ST.tip.hl[1]); const r = 34 + Math.sin(performance.now() / 200) * 4; c.strokeStyle = '#f5c242'; c.lineWidth = 3; c.beginPath(); c.ellipse(sx, sy, r, r / 2, 0, 0, Math.PI * 2); c.stroke(); }
    if (ST.tip && ST.tip.hlCar) { const car = ST.ents.get('car-' + ST.tip.hlCar); const cu = stCustomer(ST.tip.hlCar); if (car && !car.moving && cu && cu.state === 'waiting') { const [sx, sy] = P(car.gx, car.gy); const r = 34 + Math.sin(performance.now() / 200) * 4; c.strokeStyle = '#f5c242'; c.lineWidth = 3; c.beginPath(); c.ellipse(sx, sy, r, r / 2, 0, 0, Math.PI * 2); c.stroke(); } }
    if (ST.tip && ST.tip.hlParts) { const [sx, sy] = P(20.4, 5.3, 30); const r = 40 + Math.sin(performance.now() / 200) * 4; c.strokeStyle = '#f5c242'; c.lineWidth = 3; c.beginPath(); c.ellipse(sx, sy, r * 0.6, r, 0, 0, Math.PI * 2); c.stroke(); }
  }
  if (Wd.hover && isStory() && Wd.hover.e && !Wd.hover.e.ambient) { const e = Wd.hover.e, [sx, sy] = P(e.gx, e.gy, 0); c.strokeStyle = '#fff'; c.lineWidth = 2; c.setLineDash([4, 3]); c.beginPath(); c.ellipse(sx, sy, e.type === 'car' ? 30 : 11, e.type === 'car' ? 15 : 5.5, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
  for (const f of ST.floats) {
    const rise = f.kind === 'say' ? Math.min(1, f.t * 3) * 10 : f.t * 24;
    const [sx, sy] = P(f.gx, f.gy, 44 + rise);
    const a = f.kind === 'say' ? (f.t < 2.6 ? 1 : 1 - (f.t - 2.6) / 0.6) : (f.t < 1.8 ? 1 : 1 - (f.t - 1.8) / 0.6);
    c.globalAlpha = Math.max(0, a); c.textAlign = 'center';
    if (f.kind === 'say') {
      c.font = '600 12px Inter, sans-serif'; const w = Math.min(220, c.measureText(f.text).width + 20);
      c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1; c.beginPath(); c.roundRect(sx - w / 2, sy - 30, w, 24, 10); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(sx - 5, sy - 6.5); c.lineTo(sx, sy); c.lineTo(sx + 5, sy - 6.5); c.fill();
      c.fillStyle = '#26323d'; c.fillText(f.text, sx, sy - 14);
    } else {
      c.font = f.kind === 'stars' ? '700 15px Inter, sans-serif' : '700 20px "Barlow Semi Condensed", sans-serif';
      c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.45)'; c.strokeText(f.text, sx, sy);
      c.fillStyle = f.tone === 'good' ? (f.kind === 'stars' ? '#ffd35a' : '#7ee2a0') : f.tone === 'bad' ? '#ff8f84' : '#e7eef5'; c.fillText(f.text, sx, sy);
    }
    c.textAlign = 'start'; c.globalAlpha = 1;
  }
}
function storyFrame(dt) {
  const live = UI.screen === 'story' && ST.run && ST.run.state === 'play' && !ST.modal && !ST.menu && document.visibilityState !== 'hidden';
  if (live) { storyUpdate(dt); stStep(dt); }
  else if (UI.screen === 'storymap' || (ST.run && ST.run.state === 'over')) stStep(dt * 0.6);
  if (live && performance.now() - (ST.hudT || 0) > 250) { ST.hudT = performance.now(); renderStoryHud(); }
  storyDraw();
}

/* ---------- HTML layer ---------- */
function renderStory() {
  const el = document.getElementById('story'); if (!el) return;
  if (!isStory()) { el.innerHTML = ''; return; }
  if (UI.screen === 'storymap') { el.innerHTML = storyMapHtml() + (ST.modal === 'playbook' ? playbookHtml() : '') + (ST.modal === 'prologue' ? prologueHtml() : ''); return; }
  ST.hudHtml = '';
  el.innerHTML = `<div id="st-hud"></div>${storyTipHtml()}${ST.modal ? `<div class="st-scrim"></div>${storyModalHtml()}` : ''}`;
  renderStoryHud();
}
function renderStoryHud() {
  const el = document.getElementById('st-hud'); if (!el || !ST.run) return;
  const run = ST.run, def = run.def;
  const goals = def.goals.map((g, i) => { const gp = stGoalProgress(g); return `<li class="${gp.ok ? 'ok' : ''}"><i>${gp.ok ? icon('check') : i === 0 ? '' : '★'}</i><span>${esc(g.t)}</span>${gp.txt ? `<small>${gp.txt}</small>` : ''}</li>`; }).join('');
  const inShop = run.customers.filter(c => ['waiting', 'tobay', 'bay', 'bayDone', 'pickup'].includes(c.state)).length;
  const left = run.customers.filter(c => ['scheduled', 'arriving', 'atDrive'].includes(c.state)).length;
  const html = `<div class="st-top">
    <div class="st-card st-goals"><span class="st-k">Chapter ${run.n} of ${CHAPTERS.length}</span><b>${esc(def.title)}</b><ul>${goals}</ul></div>
    <div class="st-side">
      <div class="st-card st-money" data-tip="Money earned today"><span class="st-k">Cash</span><b>${money(run.money)}</b><small>${run.served} served · ${inShop} in the shop · ${left} still to come</small></div>
      ${def.vic ? `<div class="st-card st-rate"><span class="st-k">Your labour rate</span><div class="st-rate-row"><button type="button" class="st-rb" data-act="stRate" data-val="-5" aria-label="Lower rate">${icon('minus')}</button><b>$${run.rate}<small>/hr</small></b><button type="button" class="st-rb" data-act="stRate" data-val="5" aria-label="Raise rate">${icon('plus')}</button></div><small>Vic's: $${VIC_RATE}/hr</small></div>` : ''}
      ${run.stock ? `<button type="button" class="st-card st-btn" data-act="stParts">${icon('parts')}<span>Parts wall</span>${run.orders.length ? `<small>${sum(run.orders, o => o.qty)} on the way</small>` : ''}</button>` : ''}
      <button type="button" class="st-card st-btn st-menu-b" data-act="stMenu" aria-label="Menu">${icon('menu')}</button>
    </div></div>
    ${ST.menu ? `<div class="st-menu"><button type="button" data-act="stRestart">${icon('refresh')} Restart chapter</button><button type="button" data-act="stPlaybook">${icon('book')} Playbook</button><button type="button" data-act="stMap">${icon('flag')} Chapters</button><button type="button" data-act="toTitle">${icon('left')} Main menu</button><button type="button" data-act="stMenu">${icon('play')} Back to the shop</button></div>` : ''}`;
  if (html !== ST.hudHtml) { ST.hudHtml = html; el.innerHTML = html; }
}
function storyTipHtml() {
  if (!ST.tip || ST.modal) return '';
  return `<div class="st-tip"><div class="st-tip-face">${portrait('rosa', 75)}</div><div><b>Rosa</b><p>${esc(ST.tip.text)}</p></div><button type="button" class="icon-btn" data-act="stTipClose" aria-label="Dismiss">${icon('x')}</button></div>`;
}
function storyModalHtml() {
  const run = ST.run, m = ST.modal;
  if (m === 'intro') {
    const def = run.def, line = def.intro[ST.page] || def.intro[0], last = ST.page >= def.intro.length - 1;
    return `<div class="st-sheet st-intro"><div class="st-face-lg">${portrait('rosa', 78)}</div><div class="st-intro-b"><span class="st-k">Chapter ${def.n} · ${esc(def.sub)}</span><h2>${esc(def.title)}</h2><p class="st-line">${esc(line)}</p><p class="st-who">— Rosa, service manager</p>
      <div class="st-actions">${ST.page > 0 ? `<button type="button" class="btn ghost" data-act="stPage" data-val="-1">Back</button>` : '<span></span>'}<button type="button" class="btn primary big" data-act="${last ? 'stBegin' : 'stPage'}" data-val="1">${last ? "Let's open up" : 'Next'}</button></div></div></div>`;
  }
  if (m && m.kind === 'writeup') return writeupHtml(stCustomer(m.id));
  if (m && m.kind === 'upsell') return upsellHtml(stCustomer(m.id));
  if (m === 'parts') return partsHtml();
  if (m === 'town') return townHtml();
  if (m === 'monthend') return monthEndHtml();
  if (m === 'results') return resultsHtml();
  if (m === 'actdone') return actDoneHtml();
  if (m === 'playbook') return playbookHtml();
  return '';
}
function custTag(c) {
  if (c.brand) return '<span class="tag tag-brand">Recall · Aurex pays</span>';
  if (c.returning) return '<span class="tag tag-good">Returning customer</span>';
  if (!ST.run.def.vic) return '';
  return { loyal: '<span class="tag tag-good">Bought here · trusts you</span>', normal: '<span class="tag">New to us</span>', budget: '<span class="tag tag-warn">Watches every dollar</span>' }[c.type];
}
function writeupHtml(c) {
  if (!c) return '';
  const run = ST.run, q = stQuote(c), part = c.part ? SPART[c.part] : null, j = SJOB[c.job];
  const pAcc = stAcceptChance(c, q);
  const read = !run.def.vic || c.brand ? null : pAcc > 0.75 ? ['Looks happy with that', 'good'] : pAcc > 0.4 ? ['Thinking about Vic\'s…', 'warn'] : ['Likely to walk to Vic\'s', 'bad'];
  return `<div class="st-sheet st-writeup">
    <div class="wu-head"><div class="wu-face">${portrait(c.look, Math.round(c.p * 70 + 25))}</div><div><b>${esc(c.name)}</b><small>${esc(c.car)}</small>${custTag(c)}</div></div>
    <p class="wu-say">“${esc(j.line)}”</p>
    <div class="wu-job"><span class="wu-ic">${icon(j.icon)}</span><div><b>${esc(j.name)}</b><small>${c.hrs} hour${c.hrs === 1 ? '' : 's'} of work${part ? ` · needs ${part.name.toLowerCase()}` : ''}</small></div></div>
    <div class="wu-math">
      <div class="eq"><span class="nb">${c.hrs} h</span><span class="op">×</span><span class="nb">$${c.brand ? BRAND_RATE : run.rate}/h</span><span class="op">=</span><b>${money(q.labour)}</b><small>labour</small></div>
      <div class="eq"><span class="op">+</span><span class="nb nb-p">${part ? esc(part.name) : 'No parts'}</span><span class="op"></span><span></span><b>${money(q.parts)}</b><small>parts</small></div>
      <div class="eq tot"><span class="op">=</span><span>${c.brand ? 'Aurex pays you' : `${esc(c.first)} pays`}</span><span></span><span></span><b>${money(c.brand ? q.paid : q.total)}</b></div>
      ${c.brand ? `<p class="wu-note">Recalls are free for the owner. Aurex pays its own rate ($${BRAND_RATE}/h) plus the part.</p>` : ''}
      ${q.vic && !c.brand && run.def.vic ? `<p class="wu-note">Vic's would charge about <b>${money(q.vic)}</b>${read ? ` · <span class="t-${read[1]}">${read[0]}</span>` : ''}</p>` : ''}
    </div>
    <div class="st-actions"><button type="button" class="btn ghost" data-act="stCloseModal">Back</button><button type="button" class="btn primary big" data-act="stQuote" data-id="${c.id}">${icon('deal')}<span>${c.brand ? 'Book the recall' : `Give quote · ${money(q.total)}`}</span></button></div>
  </div>`;
}
function upsellHtml(c) {
  if (!c) return '';
  const f = SFIND[c.find], part = SPART[f.part], run = ST.run;
  const labour = f.hrs * run.rate, total = labour + part.price;
  const tech = TECHS[run.bays[c.bay].tech].name;
  return `<div class="st-sheet st-writeup">
    <div class="wu-head"><div class="wu-face">${portrait(run.bays[c.bay].tech, 70)}</div><div><b>${tech} found something</b><small>On ${esc(c.first)}'s ${esc(c.car)}</small></div></div>
    <p class="wu-say">“While it's up on the lift: ${esc(f.name)}. Want me to call ${esc(c.first)}?”</p>
    <div class="wu-math"><div class="eq"><span class="nb">${f.hrs} h</span><span class="op">×</span><span class="nb">$${run.rate}/h</span><span class="op">=</span><b>${money(labour)}</b><small>labour</small></div>
      <div class="eq"><span class="op">+</span><span class="nb nb-p">${esc(part.name)}</span><span></span><span></span><b>${money(part.price)}</b><small>part</small></div>
      <div class="eq tot"><span class="op">=</span><span>Extra</span><span></span><span></span><b>${money(total)}</b></div>
      <p class="wu-note">It's a real finding. Customers who trust you usually say yes — and they remember who told them the truth.</p></div>
    <div class="st-actions"><button type="button" class="btn ghost" data-act="stUpsell" data-id="${c.id}" data-val="0">Skip it</button><button type="button" class="btn primary big" data-act="stUpsell" data-id="${c.id}" data-val="1">${icon('phone')}<span>Call ${esc(c.first)}</span></button></div>
  </div>`;
}
function partsHtml() {
  const run = ST.run, keys = Object.keys(run.stock).filter(k => k !== 'recall' || run.n >= 5);
  const need = {}; for (const c of run.customers) if (!['paid', 'lost', 'declined'].includes(c.state) && c.part && c.part !== 'recall' && !(c.state === 'bay' && !c.held)) need[c.part] = (need[c.part] || 0) + 1;
  return `<div class="st-sheet st-parts"><div class="st-sheet-h"><div><span class="st-k">Parts wall</span><h2>Order parts</h2></div><b class="st-cash">${money(run.money)}</b></div>
    <p class="st-p">Every box costs money now and earns it back when it goes into a car. The van arrives a little later.</p>
    <div class="pt-list">${keys.map(k => { const p = SPART[k], n = run.stock[k], inc = sum(run.orders.filter(o => o.part === k), o => o.qty); return `<div class="pt-row ${n === 0 ? 'empty' : ''}"><span class="pt-ic">${icon(p.icon)}</span><div class="pt-n"><b>${esc(p.name)}</b><small>Costs ${money(p.cost)} · sells for ${money(p.price)}${need[k] ? ` · <span class="t-warn">${need[k]} needed today so far</span>` : ''}</small></div><div class="pt-shelf">${[...Array(Math.min(8, n))].map(() => '<i></i>').join('')}${n === 0 ? '<span class="t-bad">Empty</span>' : `<span>${n}</span>`}${inc ? `<em>+${inc} coming</em>` : ''}</div><button type="button" class="btn sm" data-act="stOrder" data-val="${k}" ${k === 'recall' || run.money < p.cost ? 'disabled' : ''}>${k === 'recall' ? 'Free from Aurex' : `Order 1 · ${money(p.cost)}`}</button></div>`; }).join('')}</div>
    <div class="st-actions"><span></span><button type="button" class="btn primary" data-act="stCloseModal">Back to the shop</button></div></div>`;
}
function townHtml() {
  const run = ST.run, houses = stTownList();
  const cost = houses.length * 5;
  return `<div class="st-sheet st-town"><div class="st-sheet-h"><div><span class="st-k">Chapter 6 · Hillcrest</span><h2>Who's due for service?</h2></div></div>
    <p class="st-p">These are customers you've served. Happy ones come back on their own sometimes — far more often if you remind them.</p>
    <div class="town">${houses.map((h, i) => `<div class="house ${ST.sent ? 'sent' : ''}" style="--d:${i * 0.12}s"><div class="roof"></div><div class="hface">${portrait(h.look, h.stars * 18 + 5)}</div><b>${esc(h.name.split(' ')[0])}</b><small>${'★'.repeat(h.stars)}${'☆'.repeat(5 - h.stars)}</small>${ST.sent ? '<i class="env"></i>' : ''}</div>`).join('')}</div>
    <div class="st-actions"><button type="button" class="btn ghost" data-act="stTown" data-val="0">Don't bother</button><button type="button" class="btn primary big" data-act="stTown" data-val="1">${icon('mail')}<span>Send reminders · ${money(cost)}</span></button></div></div>`;
}
function stTownList() {
  const R = ST.save.roster.slice(-8);
  const fill = srng(42), out = R.slice();
  while (out.length < 8) { const i = out.length; out.push({ rid: 'aunt-' + i, name: FIRST_NAMES[Math.floor(fill() * FIRST_NAMES.length)] + ' ' + LAST_NAMES[Math.floor(fill() * LAST_NAMES.length)], look: 'aunt-' + i, color: EXT_COLORS[i % EXT_COLORS.length].hex, car: `20${20 + i} Aurex ${['Terra', 'Strada', 'Atlas', 'Pico'][i % 4]}`, stars: [5, 4, 2, 5, 3, 4, 1, 5][i], visits: 2 }); }
  return out;
}
function monthEndHtml() {
  const r = ST.run.res, run = ST.run;
  const out = [['Wages', run.bays.length * FIXED_COST.wages], ['Rent & lights', FIXED_COST.rent], ['Parts bought', r.spent - run.reminders], ['Reminders', run.reminders]].filter(x => x[1] > 0);
  const totalOut = sum(out, x => x[1]);
  const max = Math.max(r.revenue, totalOut, 1);
  return `<div class="st-sheet st-month"><div class="st-sheet-h"><div><span class="st-k">The bank's review</span><h2>Today's books</h2></div></div>
    <div class="books"><div class="col"><div class="stack in" style="--h:${(r.revenue / max * 100).toFixed(0)}%"></div><b>${money(r.revenue)}</b><span>Money in</span><small>Labour ${money(run.labour)} · Parts ${money(run.partsRev)}</small></div>
      <div class="col"><div class="stack out" style="--h:${(totalOut / max * 100).toFixed(0)}%"></div><b>${money(totalOut)}</b><span>Money out</span><small>${out.map(x => `${x[0]} ${money(x[1])}`).join(' · ')}</small></div></div>
    <div class="profit ${r.profit >= 0 ? 'pos' : 'neg'}"><span>Profit</span><b>${money(r.profit)}</b></div>
    <div class="st-rosa"><div class="st-tip-face">${portrait('rosa', r.profit > 0 ? 90 : 30)}</div><p>${r.profit > 0 ? 'Money in beat money out. That is a business. Service pays the wages every single day — car sales are the bonus.' : 'More went out than came in. Busy bays, fair prices and stocked shelves — try the day again.'}</p></div>
    <div class="st-actions"><span></span><button type="button" class="btn primary big" data-act="stToResults">See results</button></div></div>`;
}
function resultsHtml() {
  const run = ST.run, r = run.res, def = run.def, card = PLAYBOOK.find(p => p.id === def.card);
  const next = chapterDef(run.n + 1);
  return `<div class="st-sheet st-results"><span class="st-k">Chapter ${run.n} ${r.stars ? 'complete' : '— not quite'}</span><h2>${esc(def.title)}</h2>
    <div class="bigstars">${[1, 2, 3].map(i => `<i class="${i <= r.stars ? 'on' : ''}" style="--d:${i * 0.25}s">★</i>`).join('')}</div>
    <ul class="st-goallist">${def.goals.map((g, i) => `<li class="${r.done[i] ? 'ok' : ''}">${icon(r.done[i] ? 'check' : 'x')}<span>${esc(g.t)}</span></li>`).join('')}</ul>
    <div class="st-nums"><div><b>${r.served}</b><small>served</small></div><div><b>${r.lost + r.declined}</b><small>lost</small></div><div><b>${money(r.revenue)}</b><small>earned</small></div><div><b>${r.avg ? r.avg.toFixed(1) + '★' : '—'}</b><small>rating</small></div></div>
    ${r.stars && card ? `<div class="pb-card ${r.newCard ? 'new' : ''}"><span class="pb-ic">${icon(card.icon)}</span><div><span class="st-k">${r.newCard ? 'New Playbook card' : 'Playbook'}</span><b>${esc(card.title)}</b><p>${esc(card.text)}</p><small>In the trade: ${esc(card.term)}</small></div></div>` : ''}
    ${!r.stars ? `<p class="st-p">${esc(def.goals[0].t)} to finish this chapter. Rosa believes in you.</p>` : ''}
    <div class="st-actions"><button type="button" class="btn ghost" data-act="stRestart">${icon('refresh')}<span>Try again</span></button><button type="button" class="btn ghost" data-act="stMap">Chapters</button>${r.stars && (next || def.finale) ? `<button type="button" class="btn primary big" data-act="${def.finale ? 'stActDone' : 'stNext'}">${def.finale ? 'Finish Act 1' : 'Next chapter'}</button>` : ''}</div></div>`;
}
function actDoneHtml() {
  return `<div class="st-sheet st-act"><div class="act-photos"><div class="photo">${portrait('may', 85)}<small>Aunt May</small></div><div class="photo">${portrait('rosa', 92)}<small>Rosa</small></div></div>
    <span class="st-k">Act 1 complete</span><h2>Hillcrest Aurex is saved</h2>
    <p class="st-p">The bank extends the loan. Rosa hands you her keys on the way out: “You know how a service drive makes money now. The showroom is next door — that's where the cars you'll be servicing for the next ten years get sold.”</p>
    <div class="pb-strip">${PLAYBOOK.map(p => `<span class="pb-mini" data-tip="${esc(p.title)}">${icon(p.icon)}</span>`).join('')}</div>
    <div class="st-actions"><button type="button" class="btn ghost" data-act="stMap">Chapters</button><button type="button" class="btn primary big" data-act="stFreePlay">Run the whole dealership</button></div>
    <p class="st-foot">Act 2 · The Showroom — coming next</p></div>`;
}
function playbookHtml() {
  const have = ST.save.cards;
  return `<div class="st-scrim" data-act="stCloseModal"></div><div class="st-sheet st-playbook"><div class="st-sheet-h"><div><span class="st-k">${have.length} of ${PLAYBOOK.length} lessons</span><h2>Your Playbook</h2></div><button type="button" class="icon-btn" data-act="stCloseModal" aria-label="Close">${icon('x')}</button></div>
    <div class="pb-grid">${PLAYBOOK.map((p, i) => have.includes(p.id) ? `<div class="pb-card"><span class="pb-ic">${icon(p.icon)}</span><div><span class="st-k">Lesson ${i + 1}</span><b>${esc(p.title)}</b><p>${esc(p.text)}</p><small>In the trade: ${esc(p.term)}</small></div></div>` : `<div class="pb-card locked"><span class="pb-ic">?</span><div><span class="st-k">Lesson ${i + 1}</span><b>Finish chapter ${i + 1}</b><p>Play it to unlock this card.</p></div></div>`).join('')}</div></div>`;
}
function storyMapHtml() {
  const s = ST.save;
  const nodes = CHAPTERS.map(ch => {
    const stars = s.stars[ch.n] || 0, open = chapterUnlocked(ch.n), cur = open && !stars;
    return `<li class="node ${stars ? 'done' : ''} ${cur ? 'current' : ''} ${open ? '' : 'locked'}"><button type="button" ${open ? `data-act="stPlay" data-val="${ch.n}"` : 'disabled'}><span class="num">${open ? ch.n : icon('key')}</span><span class="nt"><b>${esc(ch.title)}</b><small>${esc(ch.sub)}</small></span><span class="nstars">${[1, 2, 3].map(i => `<i class="${i <= stars ? 'on' : ''}">★</i>`).join('')}</span></button></li>`;
  }).join('');
  return `<div class="sm-screen"><div class="sm-card">
    <header class="sm-h"><button type="button" class="btn ghost" data-act="toTitle">${icon('left')}<span>Menu</span></button><button type="button" class="btn ghost" data-act="stPlaybook">${icon('book')}<span>Playbook ${s.cards.length}/${PLAYBOOK.length}</span></button></header>
    <div class="sm-title"><span class="st-k">Act 1</span><h1>The Service Drive</h1><p>Aunt May left you her dealership. The bank wants proof it can make money. Rosa will teach you how service works before she retires.</p></div>
    <ol class="sm-path">${nodes}<li class="node locked act2"><button type="button" disabled><span class="num">${icon('car')}</span><span class="nt"><b>Act 2 · The Showroom</b><small>Selling cars — coming next</small></span></button></li></ol>
  </div></div>`;
}
function prologueHtml() {
  const pages = [
    ['may', 'A letter from Aunt May', "“The dealership is yours now. It isn't doing well — the bank gives it until the end of the month. Rosa knows everything. Listen to her.”"],
    ['rosa', 'Rosa, service manager', "“Thirty-one years on this service drive, and I retire soon. Cars sell once. Service keeps the lights on every day. Let me show you how.”"],
    ['rosa', 'Act 1 · The Service Drive', 'Seven short chapters. Each one teaches one part of how a service department makes money. Earn stars, collect Playbook lessons, and save Hillcrest Aurex.'],
  ];
  const [who, t, line] = pages[ST.page] || pages[0], last = ST.page >= pages.length - 1;
  return `<div class="st-scrim"></div><div class="st-sheet st-intro ${who === 'may' ? 'letter' : ''}"><div class="st-face-lg ${who === 'may' ? 'framed' : ''}">${portrait(who, 80)}</div><div class="st-intro-b"><span class="st-k">Prologue · ${ST.page + 1} of ${pages.length}</span><h2>${esc(t)}</h2><p class="st-line">${esc(line)}</p>
    <div class="st-actions">${ST.page > 0 ? `<button type="button" class="btn ghost" data-act="stProPage" data-val="-1">Back</button>` : '<span></span>'}<button type="button" class="btn primary big" data-act="stProPage" data-val="1">${last ? 'Open the chapters' : 'Next'}</button></div></div></div>`;
}

/* ---------- actions ---------- */
function openStoryMap() {
  UI.screen = 'storymap'; ST.modal = ST.save.seenIntro ? null : 'prologue'; ST.page = 0; ST.menu = false;
  if (!ST.run) { startDemoScene(); }
  render();
}
function startDemoScene() {
  // the map shows the shop idling behind it
  ST.run = null; ST.ents.clear(); ST.floats = []; ST.sig = '';
  const fake = { bays: [{ tech: 'mike' }, { tech: 'jess' }] };
  fake.bays.forEach((b, i) => ST.ents.set('tech-' + b.tech, { id: 'tech-' + b.tech, type: 'person', gx: SM.bayX(i) + 1.15, gy: SM.bayY + 1.4, look: stLook(b.tech), path: [], speed: 1.6, walk: 0, role: 'story', tech: b.tech }));
  ST.ents.set('demo-car', { id: 'demo-car', type: 'car', gx: SM.bayX(0), gy: SM.bayY, dir: 'y', color: '#26507a', z: 16, zt: 16, path: [], speed: 4, alpha: 1 });
  ST.ents.set('rosa', { id: 'rosa', type: 'person', gx: 5.4, gy: 8.6, look: stLook('rosa'), path: [], speed: 1.6, walk: 0, role: 'story' });
  stFitCamera();
}
const STORY_ACT = {
  storyStart() { storyLoad().then(() => openStoryMap()); return 'skip'; },
  stPlay(d) { startChapter(+d.val); return 'skip'; },
  stProPage(d) { ST.page += +d.val; if (ST.page >= 3) { ST.save.seenIntro = true; storySave(); ST.modal = null; ST.page = 0; } if (ST.page < 0) ST.page = 0; },
  stPage(d) { ST.page = Math.max(0, ST.page + +d.val); },
  stBegin() { ST.modal = null; ST.run.state = 'play'; ST.page = 0; },
  stCloseModal() { ST.modal = null; },
  stQuote(d) { stGiveQuote(d.id); return 'skip'; },
  stUpsell(d) {
    const c = stCustomer(d.id); ST.modal = null; if (!c) return;
    if (+d.val) {
      const run = ST.run, f = SFIND[c.find], part = SPART[f.part], trust = c.p > 0.4 ? 0.85 : 0.55;
      if (Math.random() < trust) {
        const labour = f.hrs * run.rate; c.extra = { labour, parts: part.price, total: labour + part.price };
        c.dur += f.hrs * HOUR / run.bays[c.bay].speed; run.upsold++;
        stFloat(stCar(c).gx, stCar(c).gy, `${c.first}: "Yes, do it."`, 'good', 'say');
      } else stFloat(stCar(c).gx, stCar(c).gy, `${c.first}: "Not today, thanks."`, 'info', 'say');
      if (!run.events.upTip) { run.events.upTip = true; stTip('Honest advice. Even when they say no, they remember you told them the truth.'); }
    }
  },
  stParts() { ST.modal = 'parts'; },
  stOrder(d) {
    const run = ST.run, k = d.val, p = SPART[k]; if (!run || run.money < p.cost) return;
    run.money -= p.cost; run.spent += p.cost;
    const pending = run.orders.find(o => o.part === k && o.eta > run.t + 6);
    if (pending) pending.qty++; else run.orders.push({ part: k, qty: 1, eta: run.t + 10 });
    if (!run.events.orderTip) { run.events.orderTip = true; stTip('Ordered. Every box on that shelf is money already spent — stock what you will actually use.'); }
  },
  stRate(d) { const run = ST.run; run.rate = clamp(run.rate + +d.val, 70, 200); ST.save.rate = run.rate; storySave(); renderStoryHud(); return 'skip'; },
  stMenu() { ST.menu = !ST.menu; },
  stTipClose() { ST.tip = null; },
  stRestart() { const n = ST.run.n; ST.menu = false; startChapter(n); return 'skip'; },
  stNext() { startChapter(ST.run.n + 1); return 'skip'; },
  stMap() { ST.menu = false; ST.run = null; openStoryMap(); return 'skip'; },
  stPlaybook() { ST.menu = false; ST.modal = 'playbook'; },
  stToResults() { ST.modal = 'results'; },
  stActDone() { ST.modal = 'actdone'; },
  stFreePlay() { ST.run = null; UI.screen = 'title'; UI.titleView = 'new'; loadMeta().then(render); return 'skip'; },
  stTown(d) {
    const run = ST.run, houses = stTownList(), send = !!+d.val;
    ST.save.remind = send; storySave();
    if (send) { run.reminders = houses.length * 5; run.spent += run.reminders; run.money -= run.reminders; }
    const R = srng(99);
    run.townPlan = houses.filter(h => R() < (send ? (h.stars >= 3 ? 0.92 : 0.3) : (h.stars >= 4 ? 0.3 : 0.1))).slice(0, 7).map((h, i) => ({ ...h, job: ['oil', 'tires', 'brakes', 'battery', 'oil', 'light', 'oil'][i % 7] }));
    run.customers = buildCustomers(run.def);
    if (send) { ST.sent = true; render(); setTimeout(() => { ST.sent = false; ST.modal = 'intro'; ST.page = 0; render(); }, 1500); return 'skip'; }
    ST.modal = 'intro'; ST.page = 0;
  },
};
