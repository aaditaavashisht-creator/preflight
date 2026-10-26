/**
 * Sample data for the Pre-Flight dashboard screens.
 *
 * Every figure here was read out of the live demo set at
 * preflight-three-mu.vercel.app on 26-10-2026 — the five bookings, the ten
 * rules, the per-booking pass/fail matrix and the carrier tables. The one
 * exception is noted on BK-104 below.
 *
 * Swap this module for your real selectors; the screens only read these types.
 */

export type Verdict = 'pass' | 'fail' | 'warn' | 'na';

export interface Shipment {
  id: string;
  seller: string;
  lane: string;
  /** Planning-estimate exposure. `null` when nothing is at risk. */
  riskGbp: number | null;
  /** Short note on what is firing, e.g. "R-02, R-03, R-04 blocking". */
  tally: string;
  /** The stage the booking is held at, or 'Clear'. */
  stage: string;
  blocked: boolean;
  /** Verdict for R-01..R-10, in order. */
  rules: Verdict[];
}

const P = (n: number) => `£${n.toLocaleString('en-GB')}`;
export const gbp = P;

/** Ordered worst-exposure first, which is how every screen lists them. */
export const shipments: Shipment[] = [
  {
    id: 'BK-102',
    seller: 'Orrell Textiles',
    lane: 'Leeds to Amsterdam',
    riskGbp: 9525,
    tally: 'R-02, R-03, R-04 blocking',
    stage: 'Paperwork clear',
    blocked: true,
    rules: ['pass', 'fail', 'fail', 'fail', 'pass', 'pass', 'warn', 'pass', 'pass', 'pass'],
  },
  {
    id: 'BK-103',
    seller: 'Severn Roasters',
    lane: 'Birmingham to Berlin',
    riskGbp: 1155,
    tally: 'R-01, R-05 blocking',
    stage: 'Paperwork clear',
    blocked: true,
    rules: ['fail', 'pass', 'pass', 'pass', 'fail', 'pass', 'pass', 'warn', 'warn', 'warn'],
  },
  {
    id: 'BK-101',
    seller: 'Northfield Goods',
    lane: 'Manchester to Frankfurt',
    riskGbp: 1080,
    tally: 'R-04 blocking',
    stage: 'Counts agree',
    blocked: true,
    rules: ['pass', 'pass', 'pass', 'fail', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass'],
  },
  {
    id: 'BK-104',
    seller: 'Kitfield Electronics',
    lane: 'London to Rotterdam',
    riskGbp: 900,
    tally: 'R-06 blocking',
    stage: 'Freight accepted',
    blocked: true,
    // R-08 is n/a: this one delivers to a business address, not a warehouse.
    rules: ['pass', 'pass', 'pass', 'pass', 'pass', 'fail', 'pass', 'na', 'pass', 'pass'],
  },
  {
    id: 'BK-105',
    seller: 'Harrow Home',
    lane: 'London to Paris',
    riskGbp: null,
    tally: 'All ten pass',
    stage: 'Clear',
    blocked: false,
    rules: ['pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass'],
  },
];

export const totalExposure = shipments.reduce((sum, s) => sum + (s.riskGbp ?? 0), 0); // 12660

export interface Rule {
  id: string;
  /** Column label for the matrix. */
  short: string;
  title: string;
  why: string;
  /** Red rules stop a shipment; amber ones cost time or money. */
  stops: boolean;
}

export const rules: Rule[] = [
  {
    id: 'R-01',
    short: 'HS code of at least 6 digits',
    title: 'Every item needs an HS code of at least 6 digits',
    why: 'The commodity code is what the customs entry is filed on. Without a full code the entry cannot be filed and the pallet sits at the border.',
    stops: true,
  },
  {
    id: 'R-02',
    short: 'Declared value matches item lines',
    title: 'Declared value matches the item lines',
    why: 'The booking total has to equal quantity times unit price across the items, within 1%. A gap means customs query the entry rather than guess which figure is wrong.',
    stops: true,
  },
  {
    id: 'R-03',
    short: 'Each line packs out',
    title: 'Units per carton x cartons equals quantity',
    why: 'When a line does not pack out, the receiving warehouse counts something different from the manifest and raises a shortage against you.',
    stops: true,
  },
  {
    id: 'R-04',
    short: 'Carton totals agree',
    title: 'Booking cartons equal the sum of item cartons',
    why: 'The header carton total has to equal the item lines added up. A mismatch means the carrier manifest disagrees with the pallet before it leaves.',
    stops: true,
  },
  {
    id: 'R-05',
    short: 'Pallet weight within a ceiling',
    title: 'Weight per pallet is within a carrier ceiling',
    why: 'The ceilings are not ordered by price, so a heavy shipment loses the premium service first and can end up with nothing that will take it.',
    stops: true,
  },
  {
    id: 'R-06',
    short: 'No dangerous goods',
    title: 'No lithium batteries, aerosols or flammable liquids',
    why: 'A general road groupage trailer will not carry dangerous goods undeclared, and when they are found at the hub the whole trailer is refused.',
    stops: true,
  },
  {
    id: 'R-07',
    short: 'Gross covers net',
    title: 'Gross weight covers the net weight of the goods',
    why: 'Gross includes cartons, pallets and wrap, so it cannot sit below the goods themselves. The hub weighs every pallet and bills a surcharge for a mismatch.',
    stops: false,
  },
  {
    id: 'R-08',
    short: 'Warehouse slot booked',
    title: 'Warehouse deliveries need a booked appointment',
    why: 'A warehouse turns away a trailer with no slot. Slots at EU fulfilment centres run three to five working days out, so booking late costs a redelivery.',
    stops: false,
  },
  {
    id: 'R-09',
    short: 'Country of origin present',
    title: 'Every item needs a country of origin',
    why: 'Origin is where the goods were made, not where they ship from. Leaving it blank loses preferential duty and invites a customs query.',
    stops: false,
  },
  {
    id: 'R-10',
    short: 'Ready date not in the past',
    title: 'Ready-to-ship date must not be in the past',
    why: 'A past ready date does not get a late collection. It gets no collection at all, because the window closed and nothing re-opens it.',
    stops: false,
  },
];

/** Which stage each blocked booking is held at, and who owns it. */
export const stageLoad = [
  { name: 'Declared', count: 0, owner: 'Seller fills in the booking' },
  { name: 'Paperwork clear', count: 2, owner: 'Seller, or their customs broker' },
  { name: 'Counts agree', count: 1, owner: 'Whoever packed the cartons' },
  { name: 'Freight accepted', count: 1, owner: 'Freight desk' },
  { name: 'Ready for collection', count: 0, owner: 'Seller and the receiving site' },
];

export interface Finding {
  shipmentId: string;
  rule: string;
  title: string;
  found: string;
  expected: string;
  consequence: string;
  diagnosis: string;
  /** 'high' | 'medium' render green/amber; 'person' means there is no auto-fix. */
  confidence: 'high' | 'medium' | 'person';
  fix: string;
  fixNote: string;
  /** Extra context shown under the finding, when the booking has more going on. */
  also?: string;
  owner: string;
  stage: string;
  riskGbp: number;
  stops: boolean;
}

/** The top finding for each blocked booking, worst money first. */
export const topFindings: Finding[] = [
  {
    shipmentId: 'BK-102',
    rule: 'R-02',
    title: 'Declared value does not match the item lines',
    found: 'Declared £11,600, item lines come to £2,960',
    expected: 'The two agree to within 1%',
    consequence:
      '3 to 7 days held and about £8,640 at risk. £8,640 of declared value does not reconcile to the item lines. That gap is what a customs query is raised against.',
    diagnosis:
      'The header is not the problem. Put TEE-10 at £10.00 a unit instead of £1.00 and the item lines come to exactly £11,600, the figure already on the booking. One unit price is out by a factor of 10; every other line reconciles.',
    confidence: 'high',
    fix: 'Set TEE-10 unit price to £10.00',
    fixNote: 'closes the £8,640 gap',
    also: 'Two more blocking rules sit on this booking. R-03 and R-04 both clear with one change: set SOK-03 cartons to 10.',
    owner: 'Seller, or their customs broker',
    stage: 'Paperwork clear',
    riskGbp: 8640,
    stops: true,
  },
  {
    shipmentId: 'BK-103',
    rule: 'R-01',
    title: 'COF-01 cannot clear customs on the code given',
    found: 'Commodity code 90121 (5 digits)',
    expected: 'A commodity code of at least 6 digits',
    consequence:
      '3 to 7 days held and about £355 at risk. Up to 7 days held at £40 a day storage, plus a £75 broker amendment to re-file the entry.',
    diagnosis:
      'COF-01 shows a five digit code. A five digit commodity code is almost never a wrong code. It is a six digit code that started with a zero, stored in a number formatted spreadsheet column, which drops the leading zero on save. Put the zero back and it reads 090121.',
    confidence: 'high',
    fix: 'Set COF-01 HS code to 090121',
    fixNote: 'clears the customs hold',
    also: 'R-05 also blocks: 800 kg a pallet is over every ceiling on this lane. That one is a re-plan onto 3 pallets, not a paperwork fix.',
    owner: 'Seller, or their customs broker',
    stage: 'Paperwork clear',
    riskGbp: 355,
    stops: true,
  },
  {
    shipmentId: 'BK-101',
    rule: 'R-04',
    title: 'The booking carton total does not match the item lines',
    found: 'Booking says 90 cartons, item lines add up to 96',
    expected: 'The booking total equals the sum of the item lines',
    consequence:
      '2 to 5 days held and about £1,080 at risk. 6 cartons unreconciled, valued at this booking’s dearest carton (£180.00). Worst case that is what the receiving site raises a discrepancy for.',
    diagnosis:
      'Every item line packs out exactly, and the lines add up to 96 cartons. The booking header says 90. The item rows agree with each other, so the header is the number that was typed wrong.',
    confidence: 'high',
    fix: 'Set booking cartons to 96',
    fixNote: '£1,080 no longer at risk',
    owner: 'Whoever packed the cartons',
    stage: 'Counts agree',
    riskGbp: 1080,
    stops: true,
  },
  {
    shipmentId: 'BK-104',
    rule: 'R-06',
    title: 'PWB-20 is a lithium battery on a general groupage trailer',
    found: 'PWB-20, portable power bank, 10000 mAh',
    expected: 'No lithium batteries, aerosols or flammable liquids',
    // NOTE: the live app's finding card for this one was past the read limit.
    // The wording below is written from the rulebook entry and the booking's
    // own figures rather than quoted, and it deliberately offers no one-click
    // fix, because this is a declaration decision rather than a typo.
    consequence:
      'Up to 10 days and about £900 at risk. A general road groupage trailer will not carry dangerous goods undeclared, and when they are found at the hub the whole trailer is refused, not just your pallet.',
    diagnosis:
      'This is not a spreadsheet slip, so there is no field to correct. A power bank is a lithium cell, and it needs declaring and a service that accepts dangerous goods. The freight desk owns that call.',
    confidence: 'person',
    fix: 'Send to the freight desk',
    fixNote: 're-book on a service that takes it',
    owner: 'Freight desk',
    stage: 'Freight accepted',
    riskGbp: 900,
    stops: true,
  },
];

/* ---------- BK-102, used by the detail screen ---------- */

export const bk102 = {
  id: 'BK-102',
  seller: 'Orrell Textiles',
  lane: 'Leeds to Amsterdam',
  blocking: 3,
  watching: 1,
  stats: [
    { value: '£9,525', label: 'Exposure, planning estimate' },
    { value: '7 days', label: 'Worst-case delay' },
    { value: '120 kg', label: 'Weight per pallet' },
    { value: '2 x 50', label: 'Pallets and cartons' },
  ],
  stages: [
    { name: 'Declared', detail: 'Seller fills in the booking.', held: false, clear: true },
    { name: 'Paperwork clear', detail: 'R-02 is holding it.', held: true, clear: false },
    { name: 'Counts agree', detail: 'R-03, R-04, R-07 are holding it.', held: false, clear: false },
    { name: 'Freight accepted', detail: 'R-05, R-06 all pass.', held: false, clear: true },
    { name: 'Ready for collection', detail: 'R-08, R-10 all pass.', held: false, clear: true },
  ],
  findings: [
    {
      rule: 'R-02',
      risk: '£8,640',
      stops: true,
      title: 'Declared value does not match the item lines',
      found: 'Declared £11,600, item lines come to £2,960',
      expected: 'The two agree to within 1%',
      diagnosis:
        'The header is not the problem. Put TEE-10 at £10.00 a unit instead of £1.00 and the item lines come to exactly £11,600, the figure already on the booking. One unit price is out by a factor of 10; every other line reconciles.',
      fix: 'Set TEE-10 unit price to £10.00',
      fixNote: 'closes the £8,640 gap',
      confidence: 'High confidence',
      high: true,
      primary: true,
    },
    {
      rule: 'R-03',
      risk: '£400',
      stops: true,
      title: 'SOK-03 does not pack out',
      found: '50 a carton x 12 cartons = 600 units, quantity says 500',
      expected: 'Units per carton x cartons equals the quantity shipped',
      diagnosis:
        'SOK-03: 500 units at 50 a carton is exactly 10 cartons, so the pack size is right and the carton count is the typo. The sheet says 12, which packs 600 units, 100 more than you are shipping.',
      fix: 'Set SOK-03 cartons to 10',
      fixNote: '£400 no longer at risk',
      confidence: 'High confidence',
      high: true,
      primary: true,
    },
    {
      rule: 'R-04',
      risk: '£400',
      stops: true,
      title: 'The booking carton total does not match the item lines',
      found: 'Booking says 50 cartons, item lines add up to 52',
      expected: 'The booking total equals the sum of the item lines',
      diagnosis:
        'The item lines total 52 cartons against a header of 50, but SOK-03 already fails its own pack-out check. Correcting SOK-03 to 10 cartons brings the lines to 50, which is what the header says. The header was right all along.',
      fix: 'Set SOK-03 cartons to 10',
      fixNote: 'closes R-03 and R-04 together',
      confidence: 'High confidence',
      high: true,
      primary: false,
    },
    {
      rule: 'R-07',
      risk: '£85',
      stops: false,
      title: 'Gross weight is below the weight of the goods themselves',
      found: 'Gross 240 kg against a net of 267 kg',
      expected: 'Gross weight is at least the net weight, plus cartons and pallets',
      diagnosis:
        'Gross has to include the cartons, the pallets and the wrap, so it cannot sit below net. Either a unit weight is in grams where kilos were wanted, or the gross figure is the net figure copied across. On 267 kg over 2 pallets a realistic gross is about 338 kg. Weigh it if you can.',
      fix: 'Set gross weight to 338 kg',
      fixNote: 'estimate, weigh it to be sure',
      confidence: 'Medium confidence',
      high: false,
      primary: false,
    },
  ],
  carriers: [
    {
      name: 'Carrier B road standard',
      total: '£400',
      transit: '3 days',
      onTime: '95%',
      perPallet: '£200',
      score: 0.65,
      why: 'Recommended',
      best: true,
    },
    {
      name: 'Carrier C road express',
      total: '£640',
      transit: '2 days',
      onTime: '98%',
      perPallet: '£320',
      score: 0.6,
      why: 'second on this priority',
      best: false,
    },
    {
      name: 'Carrier A road economy',
      total: '£320',
      transit: '5 days',
      onTime: '92%',
      perPallet: '£160',
      score: 0.4,
      why: 'third on this priority',
      best: false,
    },
  ],
  weights: [
    { id: 'w-cost', name: 'Cost', value: 40 },
    { id: 'w-speed', name: 'Speed', value: 30 },
    { id: 'w-reliability', name: 'Reliability', value: 30 },
  ],
  gate: [
    'Declared value does not match the item lines. Apply the TEE-10 unit price fix above, or make the same change in your own sheet.',
    'SOK-03 does not pack out. Apply the SOK-03 carton fix above, or make the same change in your own sheet.',
    'The booking carton total does not match the item lines. The same SOK-03 change clears this one.',
  ],
  items: [
    {
      sku: 'TEE-10',
      desc: 'Cotton t-shirt, crew neck',
      hs: '610910',
      qty: '960',
      price: '£1.00',
      cartons: '40',
      origin: 'India',
      flagPrice: true,
      flagCartons: false,
    },
    {
      sku: 'SOK-03',
      desc: 'Cotton socks, 5-pack',
      hs: '611595',
      qty: '500',
      price: '£4.00',
      cartons: '12',
      origin: 'Turkey',
      flagPrice: false,
      flagCartons: true,
    },
  ],
};

/* ---------- BK-101, used by the warehouse screen ---------- */

export const bk101Count = {
  id: 'BK-101',
  seller: 'Northfield Goods',
  lane: 'Manchester to Frankfurt',
  rule: 'R-04',
  bookingSays: 90,
  linesSay: 96,
  riskGbp: 1080,
};
