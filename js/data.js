'use strict';
/* =====================================================================
   Dealer Empire — static game data (all brands and products are fictional)
   ===================================================================== */

const TAX = 0.13;            // sales tax
const DOC_FEE = 499;         // documentation fee (dealer gross)
const PREP_COST = 340;       // PDI, fuel, plates, delivery prep per new unit
const HOLDBACK = 0.02;       // OEM holdback, % of MSRP, paid to dealer
const WARRANTY_RATE = 138;   // OEM warranty labour reimbursement $/hr
const INTERNAL_RATE = 120;   // internal (recon) labour rate $/hr
const CREDIT_LINE = 1000000; // bank operating line

const BRAND = { id: 'aurex', name: 'Aurex' };

const SEGMENTS = {
  small: 'Small car', compactSUV: 'Compact SUV', midsizeSUV: 'Midsize SUV',
  pickup: 'Pickup', hybrid: 'Hybrid', ev: 'Electric',
};
const CLS_LABEL = { car: 'Car', suv: 'SUV', '3row': '3-row SUV', truck: 'Pickup' };

/* Ten Aurex models. attrs: rel(iability) perf(ormance) eff(iciency) tech space, 0..1 */
const MODELS = [
  { id: 'pico', name: 'Pico', seg: 'small', cls: 'car', body: 'Hatchback', pt: 'ice', msrp: 22995, inv: 0.948, resid: 0.55,
    attrs: { rel: 0.80, perf: 0.32, eff: 0.80, tech: 0.48, space: 0.28 },
    trims: [{ n: 'S', add: 0, eng: '1.5L I4', dr: 'FWD' }, { n: 'SE', add: 2300, eng: '1.5L I4', dr: 'FWD' }, { n: 'Sport', add: 4400, eng: '1.5L Turbo I4', dr: 'FWD' }] },
  { id: 'strada', name: 'Strada', seg: 'small', cls: 'car', body: 'Sedan', pt: 'ice', msrp: 27495, inv: 0.936, resid: 0.56,
    attrs: { rel: 0.84, perf: 0.45, eff: 0.72, tech: 0.60, space: 0.45 },
    trims: [{ n: 'LX', add: 0, eng: '2.0L I4', dr: 'FWD' }, { n: 'EX', add: 2800, eng: '2.0L I4', dr: 'FWD' }, { n: 'Sport', add: 5200, eng: '1.5L Turbo I4', dr: 'FWD' }, { n: 'Touring', add: 7400, eng: '1.5L Turbo I4', dr: 'AWD' }] },
  { id: 'stradah', name: 'Strada Hybrid', seg: 'hybrid', cls: 'car', body: 'Hybrid Sedan', pt: 'hybrid', msrp: 32495, inv: 0.94, resid: 0.60,
    attrs: { rel: 0.87, perf: 0.40, eff: 0.95, tech: 0.70, space: 0.45 },
    trims: [{ n: 'EX-H', add: 0, eng: '2.0L Hybrid', dr: 'FWD' }, { n: 'Touring-H', add: 4800, eng: '2.0L Hybrid', dr: 'FWD' }] },
  { id: 'terra', name: 'Terra', seg: 'compactSUV', cls: 'suv', body: 'Compact SUV', pt: 'ice', msrp: 32995, inv: 0.932, resid: 0.58,
    attrs: { rel: 0.84, perf: 0.45, eff: 0.60, tech: 0.62, space: 0.66 },
    trims: [{ n: 'LX', add: 0, eng: '2.0L I4', dr: 'FWD' }, { n: 'EX', add: 3200, eng: '2.0L I4', dr: 'AWD' }, { n: 'Sport', add: 5600, eng: '1.6L Turbo I4', dr: 'AWD' }, { n: 'Platinum', add: 9200, eng: '1.6L Turbo I4', dr: 'AWD' }] },
  { id: 'terrah', name: 'Terra Hybrid', seg: 'hybrid', cls: 'suv', body: 'Hybrid Compact SUV', pt: 'hybrid', msrp: 38495, inv: 0.936, resid: 0.61,
    attrs: { rel: 0.85, perf: 0.48, eff: 0.90, tech: 0.72, space: 0.66 },
    trims: [{ n: 'EX-H', add: 0, eng: '2.5L Hybrid', dr: 'AWD' }, { n: 'Platinum-H', add: 6400, eng: '2.5L Hybrid', dr: 'AWD' }] },
  { id: 'atlas', name: 'Atlas', seg: 'midsizeSUV', cls: '3row', body: '3-Row SUV', pt: 'ice', msrp: 45995, inv: 0.926, resid: 0.54,
    attrs: { rel: 0.78, perf: 0.56, eff: 0.44, tech: 0.70, space: 0.94 },
    trims: [{ n: 'LX', add: 0, eng: '3.5L V6', dr: 'FWD' }, { n: 'EX', add: 4200, eng: '3.5L V6', dr: 'AWD' }, { n: 'Touring', add: 8600, eng: '3.5L V6', dr: 'AWD' }, { n: 'Elite', add: 12400, eng: '3.5L V6', dr: 'AWD' }] },
  { id: 'ridge', name: 'Ridge', seg: 'pickup', cls: 'truck', body: 'Midsize Pickup', pt: 'ice', msrp: 40995, inv: 0.925, resid: 0.63,
    attrs: { rel: 0.83, perf: 0.60, eff: 0.38, tech: 0.50, space: 0.72 },
    trims: [{ n: 'SR', add: 0, eng: '2.7L Turbo I4', dr: '4WD' }, { n: 'SR5', add: 3900, eng: '2.7L Turbo I4', dr: '4WD' }, { n: 'Trail', add: 7800, eng: '3.0L Turbo V6', dr: '4WD' }] },
  { id: 'forge', name: 'Forge', seg: 'pickup', cls: 'truck', body: 'Full-size Pickup', pt: 'ice', msrp: 53995, inv: 0.918, resid: 0.60,
    attrs: { rel: 0.76, perf: 0.82, eff: 0.26, tech: 0.66, space: 0.86 },
    trims: [{ n: 'XL', add: 0, eng: '5.0L V8', dr: '4WD' }, { n: 'XLT', add: 6800, eng: '5.0L V8', dr: '4WD' }, { n: 'Lariat', add: 14200, eng: '3.5L Twin-Turbo V6', dr: '4WD' }, { n: 'Summit', add: 21800, eng: '3.5L Twin-Turbo V6', dr: '4WD' }] },
  { id: 'volta', name: 'Volta', seg: 'ev', cls: 'suv', body: 'Electric Crossover', pt: 'ev', msrp: 46995, inv: 0.94, resid: 0.50,
    attrs: { rel: 0.80, perf: 0.70, eff: 1.0, tech: 0.92, space: 0.62 },
    trims: [{ n: 'Standard Range', add: 0, eng: '201 hp single motor', dr: 'RWD' }, { n: 'Long Range', add: 5500, eng: '225 hp single motor', dr: 'RWD' }, { n: 'Long Range AWD', add: 9000, eng: '320 hp dual motor', dr: 'AWD' }] },
  { id: 'voltagt', name: 'Volta GT', seg: 'ev', cls: 'car', body: 'Performance EV Sedan', pt: 'ev', msrp: 63995, inv: 0.935, resid: 0.52, exclusive: true,
    attrs: { rel: 0.76, perf: 0.98, eff: 0.90, tech: 1.0, space: 0.50 },
    trims: [{ n: 'GT', add: 0, eng: '480 hp dual motor', dr: 'AWD' }, { n: 'GT Launch Edition', add: 7500, eng: '536 hp dual motor', dr: 'AWD' }] },
];
const MODEL = Object.fromEntries(MODELS.map(m => [m.id, m]));

const EXT_COLORS = [
  { n: 'Polar White', w: 24, add: 0, hex: '#eef0f0' }, { n: 'Obsidian Black', w: 20, add: 450, hex: '#15171a' },
  { n: 'Graphite Grey', w: 18, add: 450, hex: '#4a4f55' }, { n: 'Silver Mist', w: 14, add: 450, hex: '#b9bec4' },
  { n: 'Deep Ocean Blue', w: 9, add: 450, hex: '#1d3a5f' }, { n: 'Ember Red', w: 7, add: 650, hex: '#9b2423' },
  { n: 'Forest Green', w: 4, add: 450, hex: '#2c4a36' }, { n: 'Desert Sand', w: 4, add: 450, hex: '#b9a483' },
];
const INT_COLORS = ['Black cloth', 'Black leatherette', 'Grey leatherette', 'Black leather', 'Saddle leather'];

/* Other makes on the road (customers' current vehicles and trade-ins) */
const ROAD_VEHICLES = [
  { make: 'Takumi', model: 'Rivia', cls: 'suv', pt: 'ice', msrp: 33500, w: 10 },
  { make: 'Takumi', model: 'Senna', cls: 'car', pt: 'ice', msrp: 28500, w: 9 },
  { make: 'Takumi', model: 'Senna Hybrid', cls: 'car', pt: 'hybrid', msrp: 32000, w: 4 },
  { make: 'Takumi', model: 'Haldor', cls: 'truck', pt: 'ice', msrp: 44000, w: 4 },
  { make: 'Brennan', model: 'Halberd', cls: 'truck', pt: 'ice', msrp: 52000, w: 9 },
  { make: 'Brennan', model: 'Cortland', cls: '3row', pt: 'ice', msrp: 47000, w: 5 },
  { make: 'Brennan', model: 'Trailhead', cls: 'suv', pt: 'ice', msrp: 39000, w: 5 },
  { make: 'Kestrel', model: 'Nova', cls: 'car', pt: 'ice', msrp: 21000, w: 7 },
  { make: 'Kestrel', model: 'Orbis', cls: 'suv', pt: 'ice', msrp: 29000, w: 8 },
  { make: 'Kestrel', model: 'Aeon', cls: 'suv', pt: 'ev', msrp: 44000, w: 3 },
  { make: 'Valdis', model: 'Arden', cls: 'suv', pt: 'ice', msrp: 58000, w: 3 },
  { make: 'Valdis', model: 'K4', cls: 'car', pt: 'ice', msrp: 47000, w: 2 },
  { make: 'Solenne', model: 'One', cls: 'car', pt: 'ev', msrp: 52000, w: 2 },
  { make: 'Marlowe', model: 'Pioneer', cls: '3row', pt: 'ice', msrp: 41000, w: 4 },
  { make: 'Marlowe', model: 'Dash', cls: 'car', pt: 'ice', msrp: 19500, w: 4 },
];
const AUREX_LEGACY = [
  { make: 'Aurex', model: 'Comet', cls: 'car', pt: 'ice', msrp: 19500, legacy: true },
  { make: 'Aurex', model: 'Vento', cls: '3row', pt: 'ice', msrp: 39000, legacy: true },
];

const FIRST_NAMES = ['Priya', 'Marcus', 'Elena', 'Daniel', 'Aisha', 'Liam', 'Sofia', 'Noah', 'Mei', 'Owen', 'Fatima', 'Lucas', 'Hannah', 'Mateo', 'Grace', 'Ethan',
  'Chloe', 'Arjun', 'Isabelle', 'Kofi', 'Zara', 'Ryan', 'Yuki', 'Gabriel', 'Amara', 'Jack', 'Leila', 'Diego', 'Nora', 'Samuel', 'Ava', 'Hassan', 'Emily', 'Tomás',
  'Olivia', 'Wei', 'Charlotte', 'Andre', 'Maya', 'Connor', 'Ines', 'Victor', 'Ruby', 'Jamal', 'Clara', 'Felix', 'Anika', 'Rohan', 'Sienna', 'Mohammed', 'Julia',
  'Kenji', 'Layla', 'Patrick', 'Esther', 'Malik', 'Freya', 'Oscar', 'Leah', 'Dmitri', 'Naomi', 'Caleb', 'Rosa', 'Ian', 'Tara', 'Hugo', 'Simone', 'Aaron',
  'Bianca', 'Jasper', 'Keira', 'Nathan', 'Lucia', 'Adrian', 'Mira', 'Graham', 'Talia', 'Desmond', 'Vera', 'Rafael', 'Joanne', 'Theo', 'Sana', 'Martin', 'Brooke'];
const LAST_NAMES = ['Shah', 'Bennett', 'Okafor', 'Tremblay', 'Nguyen', 'MacLeod', 'Rossi', 'Kowalski', 'Haddad', 'Chen', 'Fraser', 'Singh', 'Dubois', 'Park',
  'Morrison', 'Alvarez', 'Lindqvist', 'Mensah', 'Patel', 'Gagnon', "O'Brien", 'Tanaka', 'Moreau', 'Ibrahim', 'Campbell', 'Kaur', 'Sullivan', 'Novak', 'Reyes',
  'Bergeron', 'Achebe', 'Walsh', 'Kim', 'Fontaine', 'Wright', 'Petrov', 'Hughes', 'Mendes', 'Clarke', 'Sato', 'Lavoie', 'Hassan', 'Murphy', 'Ortiz',
  'Lebrun', 'Grant', 'Yamamoto', 'Ferreira', 'Doyle', 'Rahman', 'Stewart', 'Costa', 'Pelletier', 'Adeyemi', 'Brooks', 'Leclerc', 'Zhang', 'Thompson',
  'Bianchi', 'Ross', 'Hoang', 'Fischer', 'Côté', 'Sharma', 'Kelly', 'Vasquez', 'Bouchard', 'Liu', 'Young', 'Mbeki', 'Nielsen', 'Carter', 'Iyer', 'Hale'];

const HOUSEHOLDS = ['Single', 'Couple', 'Family with kids', 'Single parent', 'Empty nesters', 'Retired', 'Roommates'];

const NEG_STYLES = {
  easygoing: { label: 'Easygoing', difficulty: 'Low', fairAdj: 0.012, base: 0.45 },
  fair: { label: 'Fair-minded', difficulty: 'Moderate', fairAdj: 0, base: 0.15 },
  payment: { label: 'Payment-focused', difficulty: 'Moderate', fairAdj: 0.004, base: 0.15 },
  researcher: { label: 'Researcher', difficulty: 'High', fairAdj: -0.018, base: 0 },
  hardball: { label: 'Hardball', difficulty: 'Very high', fairAdj: -0.026, base: -0.25 },
};

/* F&I protection products and accessories */
const PRODUCTS = [
  { id: 'warranty', name: 'Extended warranty (7yr/160,000 km)', price: 2495, cost: 1050, pref: 'rel', base: 0.36 },
  { id: 'gap', name: 'GAP protection', price: 895, cost: 240, pref: 'gap', base: 0.30 },
  { id: 'tirewheel', name: 'Tire & wheel protection', price: 795, cost: 230, pref: null, base: 0.20 },
  { id: 'ppm', name: 'Prepaid maintenance (3 visits)', price: 695, cost: 330, pref: 'rel', base: 0.26, program: 'ppm' },
  { id: 'appearance', name: 'Appearance protection', price: 595, cost: 115, pref: null, base: 0.16 },
];
const PRODUCT = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
const ACCESSORIES = [
  { id: 'mats', name: 'All-weather mat package', price: 289, cost: 120 },
  { id: 'remote', name: 'Remote start', price: 549, cost: 210 },
  { id: 'hitch', name: 'Tow hitch & wiring', price: 895, cost: 380 },
  { id: 'winter', name: 'Winter tire & wheel package', price: 1795, cost: 1080 },
  { id: 'roof', name: 'Roof rack cross bars', price: 489, cost: 205 },
];
const ACCESSORY = Object.fromEntries(ACCESSORIES.map(a => [a.id, a]));

/* Parts catalogue */
const PARTS_CATALOG = [
  { pn: 'AX-15400', desc: 'Oil filter', cat: 'Maintenance', cost: 6.4, retail: 14.95, lead: 2, min: 50, max: 140 },
  { pn: 'AX-08880', desc: 'Synthetic oil 0W-20 (5 L)', cat: 'Maintenance', cost: 24, retail: 54.95, lead: 2, min: 50, max: 140 },
  { pn: 'AX-17220', desc: 'Engine air filter', cat: 'Maintenance', cost: 9.8, retail: 29.95, lead: 2, min: 16, max: 45 },
  { pn: 'AX-80292', desc: 'Cabin air filter', cat: 'Maintenance', cost: 8.5, retail: 34.95, lead: 2, min: 18, max: 50 },
  { pn: 'AX-76622', desc: 'Wiper blade set', cat: 'Maintenance', cost: 14, retail: 44.95, lead: 2, min: 12, max: 36 },
  { pn: 'AX-12290', desc: 'Spark plug, iridium', cat: 'Maintenance', cost: 9.5, retail: 24.95, lead: 3, min: 24, max: 64 },
  { pn: 'AX-0LC40', desc: 'Coolant, long-life (4 L)', cat: 'Fluids', cost: 16, retail: 39.95, lead: 2, min: 10, max: 30 },
  { pn: 'AX-ATF30', desc: 'Transmission fluid (4 L)', cat: 'Fluids', cost: 28, retail: 64.95, lead: 3, min: 6, max: 18 },
  { pn: 'AX-BF001', desc: 'Brake fluid DOT 4 (1 L)', cat: 'Fluids', cost: 9, retail: 24.95, lead: 2, min: 10, max: 30 },
  { pn: 'AX-45022', desc: 'Brake pad set, front', cat: 'Brakes', cost: 38, retail: 109.95, lead: 3, min: 10, max: 28 },
  { pn: 'AX-43022', desc: 'Brake pad set, rear', cat: 'Brakes', cost: 34, retail: 94.95, lead: 3, min: 6, max: 18 },
  { pn: 'AX-45251', desc: 'Brake rotor, front', cat: 'Brakes', cost: 52, retail: 139.95, lead: 3, min: 14, max: 36 },
  { pn: 'AX-31500', desc: '12V battery, H6 AGM', cat: 'Electrical', cost: 118, retail: 239.95, lead: 3, min: 6, max: 16 },
  { pn: 'AX-36531', desc: 'Oxygen sensor', cat: 'Engine', cost: 74, retail: 189.95, lead: 4, min: 3, max: 8 },
  { pn: 'AX-30520', desc: 'Ignition coil', cat: 'Engine', cost: 48, retail: 129.95, lead: 4, min: 4, max: 12 },
  { pn: 'AX-38920', desc: 'Serpentine belt', cat: 'Engine', cost: 36, retail: 89.95, lead: 3, min: 3, max: 8 },
  { pn: 'AX-19200', desc: 'Water pump assembly', cat: 'Engine', cost: 142, retail: 349.95, lead: 5, min: 2, max: 5 },
  { pn: 'AX-21710', desc: 'Thermostat kit', cat: 'Engine', cost: 42, retail: 109.95, lead: 4, min: 2, max: 6 },
  { pn: 'AX-TCK35', desc: 'Timing chain kit, 3.5L V6', cat: 'Engine', cost: 245, retail: 569.95, lead: 6, min: 1, max: 3 },
  { pn: 'AX-31100', desc: 'Alternator (reman)', cat: 'Electrical', cost: 228, retail: 529.95, lead: 5, min: 1, max: 4 },
  { pn: 'AX-31200', desc: 'Starter motor (reman)', cat: 'Electrical', cost: 186, retail: 429.95, lead: 5, min: 1, max: 3 },
  { pn: 'AX-51350', desc: 'Front strut assembly', cat: 'Suspension', cost: 164, retail: 389.95, lead: 5, min: 2, max: 6 },
  { pn: 'AX-51750', desc: 'Wheel bearing hub', cat: 'Suspension', cost: 118, retail: 299.95, lead: 4, min: 2, max: 6 },
  { pn: 'AX-88320', desc: 'A/C compressor', cat: 'Climate', cost: 390, retail: 899.95, lead: 7, min: 1, max: 2 },
  { pn: 'AX-TPMS2', desc: 'TPMS sensor', cat: 'Tires', cost: 34, retail: 89.95, lead: 3, min: 8, max: 24 },
  { pn: 'AX-TIRAS', desc: 'All-season tire set, 17 in', cat: 'Tires', cost: 560, retail: 999.95, lead: 5, min: 4, max: 10 },
  { pn: 'AX-TIRWN', desc: 'Winter tire set, 17 in', cat: 'Tires', cost: 620, retail: 1099.95, lead: 6, min: 2, max: 8, seasonal: true },
  { pn: 'AX-EVP11', desc: 'EV coolant pump (Volta)', cat: 'EV / Hybrid', cost: 210, retail: 489.95, lead: 7, min: 1, max: 3 },
  { pn: 'AX-HBM04', desc: 'Hybrid battery module', cat: 'EV / Hybrid', cost: 480, retail: 1149.95, lead: 9, min: 1, max: 3 },
  { pn: 'AX-HLT22', desc: 'LED headlamp assembly (Terra)', cat: 'Body', cost: 410, retail: 879.95, lead: 7, min: 1, max: 3 },
  { pn: 'AX-CMB09', desc: 'Brake pad set, Comet (discontinued)', cat: 'Brakes', cost: 31, retail: 84.95, lead: 4, min: 0, max: 0, legacy: true },
  { pn: 'AX-VNR12', desc: 'Sliding door roller, Vento (discontinued)', cat: 'Body', cost: 44, retail: 119.95, lead: 6, min: 0, max: 0, legacy: true },
  { pn: 'AX-RCL27', desc: 'Recall kit, fuel pump relay', cat: 'Recall', cost: 14, retail: 0, lead: 3, min: 0, max: 0, recall: true },
];

/* Service operations. hrs = flat-rate (sold) hours. skill = minimum technician tier */
const JOBS = {
  oil: { name: 'Oil change & inspection', hrs: 0.6, skill: 1, pay: 'cp', parts: [['AX-15400', 1], ['AX-08880', 1]] },
  tires: { name: 'Seasonal tire changeover', hrs: 0.8, skill: 1, pay: 'cp', parts: [] },
  tirenew: { name: 'Tire replacement', hrs: 1.0, skill: 1, pay: 'cp', parts: [['AX-TIRAS', 1], ['AX-TPMS2', 1]] },
  brakes: { name: 'Brake replacement', hrs: 1.9, skill: 2, pay: 'cp', parts: [['AX-45022', 1], ['AX-45251', 2]] },
  maint: { name: 'Scheduled maintenance', hrs: 2.1, skill: 2, pay: 'cp', parts: [['AX-15400', 1], ['AX-08880', 1], ['AX-17220', 1], ['AX-80292', 1]] },
  diag: { name: 'Diagnostics & repair', hrs: 1.6, skill: 3, pay: 'cp', parts: [] },
  warranty: { name: 'Warranty repair', hrs: 2.6, skill: 3, pay: 'warranty', parts: [] },
  recall: { name: 'Recall campaign', hrs: 0.9, skill: 2, pay: 'warranty', parts: [['AX-RCL27', 1]] },
  major: { name: 'Major repair', hrs: 6.2, skill: 4, pay: 'cp', parts: [] },
  recon: { name: 'Used vehicle reconditioning', hrs: 4, skill: 2, pay: 'internal', parts: [] },
  comeback: { name: 'Comeback (re-repair)', hrs: 1.2, skill: 3, pay: 'internal', parts: [] },
};
const REPAIR_PARTS = ['AX-36531', 'AX-30520', 'AX-38920', 'AX-19200', 'AX-21710', 'AX-31100', 'AX-31200', 'AX-51350', 'AX-51750', 'AX-31500'];
const MAJOR_PARTS = ['AX-TCK35', 'AX-88320', 'AX-31100', 'AX-HLT22'];
const UPSELLS = [
  { n: 'Wiper blades', hrs: 0.2, parts: [['AX-76622', 1]] },
  { n: 'Cabin air filter', hrs: 0.3, parts: [['AX-80292', 1]] },
  { n: 'Battery replacement', hrs: 0.5, parts: [['AX-31500', 1]] },
  { n: 'Brake fluid flush', hrs: 0.8, parts: [['AX-BF001', 2]] },
  { n: 'Wheel alignment', hrs: 1.2, parts: [] },
  { n: 'Coolant service', hrs: 1.0, parts: [['AX-0LC40', 2]] },
  { n: 'Rear brake pads', hrs: 1.1, parts: [['AX-43022', 1]] },
];

/* Staff roles. base = annual salary; comm = commission share of the department gross named in commOn */
const ROLES = {
  gsm: { title: 'General Sales Manager', short: 'GSM', dept: 'Sales', base: 105000, comm: 0.03, commOn: 'total vehicle gross', max: 1 },
  sales: { title: 'Sales Consultant', short: 'Sales', dept: 'Sales', base: 30000, comm: 0.25, commOn: 'front gross' },
  fi: { title: 'Finance Manager', short: 'F&I', dept: 'Sales', base: 48000, comm: 0.14, commOn: 'F&I gross' },
  svcmgr: { title: 'Service Manager', short: 'Svc Mgr', dept: 'Fixed Ops', base: 92000, comm: 0.01, commOn: 'service gross', max: 1 },
  advisor: { title: 'Service Advisor', short: 'Advisor', dept: 'Fixed Ops', base: 42000, comm: 0.035, commOn: 'customer-pay sales' },
  tech: { title: 'Technician', short: 'Tech', dept: 'Fixed Ops', base: 0, comm: 0, commOn: 'flat-rate hours' },
  parts: { title: 'Parts Advisor', short: 'Parts', dept: 'Fixed Ops', base: 47000, comm: 0, commOn: '' },
  bdc: { title: 'BDC Agent', short: 'BDC', dept: 'Retention', base: 41000, comm: 0, commOn: '' },
  detail: { title: 'Detailer', short: 'Detail', dept: 'Fixed Ops', base: 37000, comm: 0, commOn: '' },
};
const TECH_TIERS = ['', 'Express (Lube)', 'C-Technician', 'B-Technician', 'Master Technician'];
const TECH_FLAT = [0, 27, 35, 43, 51];

const COURSES = [
  { id: 'product', name: 'Aurex Product Certification', roles: ['sales', 'gsm', 'fi', 'bdc'], cost: 1800, days: 2, skill: 6, cert: true },
  { id: 'selling', name: 'Consultative Selling Workshop', roles: ['sales', 'gsm'], cost: 2400, days: 2, skill: 9 },
  { id: 'fi', name: 'F&I Menu Selling & Compliance', roles: ['fi'], cost: 3200, days: 3, skill: 10, cert: true },
  { id: 'techcert', name: 'Aurex Technical Certification', roles: ['tech'], cost: 3800, days: 5, skill: 10, cert: true },
  { id: 'evcert', name: 'EV High-Voltage Certification', roles: ['tech'], cost: 5200, days: 5, skill: 5, cert: true, ev: true },
  { id: 'advisor', name: 'Service Advisor Certification', roles: ['advisor', 'svcmgr'], cost: 2200, days: 2, skill: 9, cert: true },
  { id: 'cx', name: 'Customer Experience Essentials', roles: ['sales', 'fi', 'advisor', 'bdc', 'parts', 'detail', 'svcmgr', 'gsm'], cost: 900, days: 1, skill: 3, csi: 5 },
  { id: 'leader', name: 'Leadership Development', roles: ['gsm', 'svcmgr'], cost: 4500, days: 3, skill: 8 },
];

/* Retention programs: monthly cost, optional per-use costs and effects */
const PROGRAMS = [
  { id: 'reminders', name: 'Service reminders', monthly: 900, desc: 'Automated text and email reminders when maintenance comes due.', effect: 'More due customers book with you, and book sooner.' },
  { id: 'freeoil', name: 'Free first oil change', monthly: 0, perUse: 'Cost of each free service (about $70)', desc: 'Every new-vehicle buyer gets their first oil change free.', effect: 'Builds the service habit in year one.' },
  { id: 'ppm', name: 'Prepaid maintenance', monthly: 1200, desc: 'Lets F&I sell 3-visit prepaid maintenance plans.', effect: 'Plan holders almost always return; adds F&I gross.' },
  { id: 'loyalty', name: 'Loyalty points', monthly: 2500, perUse: '2% of customer-pay spend returned as points', desc: 'Customers earn points on service and purchases.', effect: 'Raises dealer loyalty over time and repeat purchase rate.' },
  { id: 'pickup', name: 'Pickup & delivery', monthly: 6800, desc: 'Drivers collect and return service vehicles.', effect: 'Strong service CSI lift; reduces loaner demand.' },
  { id: 'exthours', name: 'Extended service hours', monthly: 15500, desc: 'Evening shift and full Saturdays in the shop.', effect: 'About 40% more bay capacity; shorter appointment waits.' },
  { id: 'mobile', name: 'Mobile service van', monthly: 18500, desc: 'A technician van for oil changes and tire swaps at the customer.', effect: 'Up to 6 light jobs a day outside the bays; strong retention lift.' },
  { id: 'preferred', name: 'Preferred customer discount', monthly: 0, perUse: '10% off customer-pay labour for owners who bought here', desc: 'A standing discount for your sales customers.', effect: 'Closes the price gap with independent shops.' },
];
const PROGRAM = Object.fromEntries(PROGRAMS.map(p => [p.id, p]));

/* Competitors around the dealership */
const COMPETITORS_INIT = [
  { id: 'northgate', name: 'Northgate Aurex', type: 'dealer', brand: 'Aurex', dist: 21, disc: 0.0, svcRate: 162, vol: 52, quality: 0.66, aggr: 0.55 },
  { id: 'bayview', name: 'Bayview Takumi', type: 'dealer', brand: 'Takumi', dist: 6, disc: 0.01, svcRate: 168, vol: 88, quality: 0.74, aggr: 0.45 },
  { id: 'summit', name: 'Summit Brennan', type: 'dealer', brand: 'Brennan', dist: 9, disc: 0.015, svcRate: 159, vol: 74, quality: 0.6, aggr: 0.6 },
  { id: 'crestline', name: 'Crestline Kestrel', type: 'dealer', brand: 'Kestrel', dist: 12, disc: 0.025, svcRate: 149, vol: 61, quality: 0.55, aggr: 0.7 },
  { id: 'automax', name: 'AutoMax Pre-Owned', type: 'used', brand: 'Multi-brand', dist: 8, disc: 0.02, svcRate: 0, vol: 95, quality: 0.5, aggr: 0.65 },
  { id: 'precision', name: 'Precision Auto Care', type: 'indy', brand: 'Independent', dist: 3, disc: 0, svcRate: 126, vol: 0, quality: 0.62, aggr: 0.5 },
  { id: 'speedlane', name: 'SpeedLane Lube', type: 'lube', brand: 'Quick lube', dist: 2, disc: 0, svcRate: 109, oil: 74, vol: 0, quality: 0.45, aggr: 0.6 },
];

/* Expansion projects (progression) */
const EXPANSIONS = [
  { id: 'bdc', name: 'Centralized BDC', cost: 260000, days: 21, monthly: 8000,
    desc: 'A dedicated contact centre with call routing and CRM workflows.', effect: 'BDC agents handle twice the outreach; follow-up leads return more often.', req: { months: 2 } },
  { id: 'superstore', name: 'Used vehicle superstore', cost: 1200000, days: 45, monthly: 22000,
    desc: 'A separate pre-owned building with its own lot of 80 units.', effect: '+35% used-vehicle traffic, +80 used lot spaces, better auction access.', req: { months: 4, usedSold: 20 } },
  { id: 'warehouse', name: 'Parts warehouse', cost: 650000, days: 40, monthly: 14000,
    desc: 'Regional parts distribution with a wholesale delivery route.', effect: 'Supplier lead times halved; about $40K/month of extra wholesale parts sales.', req: { months: 3 } },
  { id: 'bigstore', name: 'Larger dealership', cost: 1900000, days: 60, monthly: 28000,
    desc: 'Showroom extension and a new six-bay service wing.', effect: '+6 service bays, +12% showroom traffic, +60 new lot spaces.', req: { months: 6, standing: 60 } },
  { id: 'collision', name: 'Collision centre', cost: 1500000, days: 60, monthly: 36000,
    desc: 'An OEM-certified body shop for insurance and customer-pay collision work.', effect: 'New collision revenue stream fed by your customer base and insurers.', req: { months: 6, csi: 82 } },
  { id: 'luxury', name: 'Oriel luxury franchise', cost: 3600000, days: 90, monthly: 0,
    desc: 'Award of an Oriel luxury franchise point next door, run by its own GM.', effect: 'Adds a luxury store to your group with its own monthly P&L.', req: { months: 10, standing: 78 } },
  { id: 'acquire', name: 'Acquire Kestrel of Millbrook', cost: 2600000, days: 30, monthly: 0,
    desc: 'Buy an under-performing mainstream store 40 km away.', effect: 'Adds a second rooftop to your group. Its result depends on the GM you install and what you invest.', req: { months: 8, netMonths: 3 } },
];
const EXPANSION = Object.fromEntries(EXPANSIONS.map(e => [e.id, e]));

/* Monthly fixed operating expenses (base) */
const FIXED_EXPENSES = {
  rent: 76000, utilities: 12500, insurance: 10800, technology: 9200, maintenance: 5200, oem: 4100, other: 11800, admin: 26500,
};
const EXPENSE_LABELS = {
  payroll: 'Payroll & commissions', advertising: 'Advertising', rent: 'Rent / mortgage', utilities: 'Utilities', insurance: 'Insurance',
  floorplan: 'Floorplan interest', technology: 'Technology & DMS', loaners: 'Loaner vehicles', training: 'Training', maintenance: 'Facility maintenance',
  oem: 'OEM-related costs', programs: 'Retention programs', expansion: 'Expansion operating costs', interest: 'Bank interest', other: 'Other operating expenses',
};
const DEPTS = [
  { id: 'new', label: 'New vehicles' }, { id: 'used', label: 'Used vehicles' }, { id: 'wholesale', label: 'Used wholesale' },
  { id: 'fi', label: 'F&I' }, { id: 'labor', label: 'Service labour' }, { id: 'parts', label: 'Parts' }, { id: 'acc', label: 'Accessories' },
  { id: 'collision', label: 'Collision' }, { id: 'oemInc', label: 'OEM incentives' },
];
