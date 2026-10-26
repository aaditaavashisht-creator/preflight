import type { Booking, Item } from './types';

/* ------------------------------------------------------------------ *
 * Consequence costing
 *
 * Planning estimates, and the UI must label them as such. Where the
 * shipment's own numbers give a real figure, the rules use those instead.
 * ------------------------------------------------------------------ */

export const COSTS = {
  storagePerDay: 40,
  customsHoldDays: [3, 7] as [number, number],
  brokerAmendment: 75,
  customsQuery: 150,
  redelivery: 145,
  reweigh: 85,
  dgReturn: 900,
};

/* ------------------------------------------------------------------ *
 * Description to HS heading
 *
 * A suggestion only. Classification is the seller's legal responsibility,
 * so this is never offered as an Apply-fix.
 * ------------------------------------------------------------------ */

export const HS_LOOKUP: Array<[RegExp, string, string]> = [
  [/\bmugs?\b/, '691200', 'ceramic tableware'],
  [/\btrays?\b/, '691200', 'ceramic tableware'],
  [/\bplates?\b/, '691200', 'ceramic tableware'],
  [/\bbowls?\b/, '691200', 'ceramic tableware'],
  [/\bvases?\b/, '691390', 'ceramic ornaments'],
  [/\b(t-?shirts?|tees?)\b/, '610910', 'knitted t-shirts'],
  [/\bsocks?\b/, '611595', 'knitted socks'],
  [/\b(hoodies?|sweatshirts?|jumpers?|sweaters?)\b/, '611020', 'knitted jerseys and pullovers'],
  [/\bjeans\b/, '620342', 'cotton trousers'],
  [/\btrousers\b/, '620343', 'synthetic trousers'],
  [/\bdress(es)?\b/, '620443', 'synthetic dresses'],
  [/\bjackets?\b/, '620193', 'outerwear jackets'],
  [/\bscar(f|ves)\b/, '621420', 'wool scarves'],
  [/\b(hats?|caps?)\b/, '650500', 'knitted headgear'],
  [/\bcandles?\b/, '340600', 'candles and tapers'],
  [/\bsoap\b/, '340111', 'toilet soap'],
  [/\bshampoo\b/, '330510', 'shampoo'],
  [/\bcoffee\b/, '090121', 'roasted coffee, not decaffeinated'],
  [/\btea\b/, '090230', 'black tea in packings of 3 kg or less'],
  [/\bhoney\b/, '040900', 'natural honey'],
  [/\bchocolate\b/, '180690', 'chocolate preparations'],
  [/\b(biscuits?|cookies?)\b/, '190531', 'sweet biscuits'],
  [/\bpasta\b/, '190219', 'uncooked pasta'],
  [/\bnotebooks?\b/, '482010', 'registers and notebooks'],
  [/\bpens?\b/, '960810', 'ball point pens'],
  [/\bpencils?\b/, '960910', 'pencils'],
  [/\b(mouse ?mats?|mouse ?pads?)\b/, '392690', 'other articles of plastics'],
  [/\bphone cases?\b/, '392690', 'other articles of plastics'],
  [/\b(tote bags?|shoppers?)\b/, '420222', 'bags with an outer surface of textile'],
  [/\b(backpacks?|rucksacks?)\b/, '420292', 'travel bags with a textile outer surface'],
  [/\btowels?\b/, '630260', 'cotton toilet and kitchen linen'],
  [/\b(duvets?|bedding|bed linen)\b/, '630221', 'printed cotton bed linen'],
  [/\b(cushions?|pillows?)\b/, '630493', 'synthetic furnishing articles'],
  [/\b(posters?|art prints?)\b/, '491191', 'printed pictures and photographs'],
  [/\bstickers?\b/, '482110', 'printed paper labels'],
  [/\bkey ?rings?\b/, '830810', 'base metal clasps and fittings'],
  [/\b(water bottles?|flasks?)\b/, '961700', 'vacuum flasks'],
  [/\b(glasses|glassware|tumblers?)\b/, '701337', 'drinking glasses'],
  [/\b(toys?|puzzles?)\b/, '950300', 'toys and puzzles'],
];

export interface HsSuggestion {
  code: string;
  label: string;
}

export function suggestHs(description: string): HsSuggestion | null {
  const d = (description || '').toLowerCase();
  if (!d) return null;
  for (const [re, code, label] of HS_LOOKUP) {
    if (re.test(d)) return { code, label };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * R-01 — HS code
 * ------------------------------------------------------------------ */

export type HsBranch = 'ok' | 'leading-zero' | 'blank' | 'short' | 'non-numeric';

export interface HsDiagnosis {
  branch: HsBranch;
  code: string;
  proposal: string | null;
  confidence: string;
  diagnosis: string;
  suggestion?: string;
}

export function diagnoseHs(item: Item): HsDiagnosis {
  const raw = (item.hsCode ?? '').toString().trim();
  const code = raw.replace(/[\s.]/g, '');

  if (code === '') {
    const s = suggestHs(item.description);
    return {
      branch: 'blank',
      code: '',
      proposal: null,
      confidence: '',
      diagnosis:
        `${item.sku} has no commodity code. Customs cannot clear a line without one, and nobody ` +
        `downstream can supply it for you.`,
      suggestion: s
        ? `From the description this looks like ${s.label}, heading ${s.code}. Check it against the ` +
          `UK Trade Tariff before you use it. Classification is your legal responsibility, so this is ` +
          `a starting point, not a fix I will apply.`
        : `Look ${item.description || 'this line'} up in the UK Trade Tariff and enter the full ` +
          `commodity code. Classification is your legal responsibility.`,
    };
  }

  if (/\D/.test(code)) {
    return {
      branch: 'non-numeric',
      code,
      proposal: null,
      confidence: '',
      diagnosis:
        `${item.sku} has "${raw}" in the commodity code column. A commodity code is digits only. ` +
        `Retype it from the tariff rather than from a product sheet.`,
    };
  }

  if (code.length >= 6) {
    return { branch: 'ok', code, proposal: null, confidence: '', diagnosis: '' };
  }

  if (code.length === 5) {
    return {
      branch: 'leading-zero',
      code,
      proposal: `0${code}`,
      confidence: 'High',
      diagnosis:
        `${item.sku} shows a five digit code. A five digit commodity code is almost never a wrong ` +
        `code. It is a six digit code that started with a zero, stored in a number formatted ` +
        `spreadsheet column, which drops the leading zero on save. Put the zero back and it reads ` +
        `${`0${code}`}.`,
    };
  }

  const s = suggestHs(item.description);
  return {
    branch: 'short',
    code,
    proposal: null,
    confidence: '',
    diagnosis:
      `${item.sku} has ${code.length} digit${code.length === 1 ? '' : 's'} where six are needed. ` +
      `That is a chapter or heading, not a commodity code, so I will not guess the missing digits. ` +
      `Look the full code up in the UK Trade Tariff and enter all six for ${item.sku}.`,
    suggestion: s
      ? `The description points at ${s.label}, heading ${s.code}. Confirm it in the UK Trade Tariff ` +
        `before you use it. Classification is your legal responsibility.`
      : undefined,
  };
}

/* ------------------------------------------------------------------ *
 * R-03 — units per carton x cartons = quantity
 * ------------------------------------------------------------------ */

export type CountBranch = 'ok' | 'not-applicable' | 'cartons' | 'packsize' | 'recount';

export interface CountDiagnosis {
  branch: CountBranch;
  quantity: number;
  unitsPerCarton: number;
  cartons: number;
  packed: number;
  shortfall: number;
  /** The carton count the item should carry once fixed, when that is the culprit. */
  correctedCartons: number | null;
  correctedUnitsPerCarton: number | null;
  confidence: string;
  diagnosis: string;
  cost: number;
  costWhy: string;
}

export function diagnoseCounts(item: Item): CountDiagnosis {
  const Q = item.quantity;
  const U = item.unitsPerCarton;
  const C = item.cartons;
  const blank: CountDiagnosis = {
    branch: 'not-applicable', quantity: 0, unitsPerCarton: 0, cartons: 0, packed: 0,
    shortfall: 0, correctedCartons: null, correctedUnitsPerCarton: null,
    confidence: '', diagnosis: '', cost: 0, costWhy: '',
  };
  // A blank cell cannot be checked. A typed zero is a number, and a wrong one,
  // so it must not be filed alongside the blanks.
  if (Q === null || U === null || C === null) return blank;

  const packed = U * C;
  if (Q > 0 && U > 0 && C > 0 && packed === Q) {
    return { ...blank, branch: 'ok', quantity: Q, unitsPerCarton: U, cartons: C, packed };
  }

  const shortfall = Math.abs(packed - Q);
  const price = item.unitPrice ?? 0;
  const cost = shortfall * price;
  const direction = packed > Q ? 'more' : 'fewer';
  const costWhy =
    price > 0
      ? `${shortfall.toLocaleString('en-GB')} units at £${price.toFixed(2)}. That is what the ` +
        `receiving warehouse would report ${packed > Q ? 'as an overage' : 'missing'} against the manifest.`
      : `${shortfall.toLocaleString('en-GB')} units unaccounted for. Add a unit price and I can put a figure on it.`;

  const common = {
    quantity: Q, unitsPerCarton: U, cartons: C, packed, shortfall, cost, costWhy,
  };

  if (Q <= 0) {
    return {
      ...blank, ...common,
      branch: 'recount',
      confidence: '',
      diagnosis:
        `${item.sku} has a quantity of ${Q.toLocaleString('en-GB')} against ${U} a carton and ` +
        `${C} carton${C === 1 ? '' : 's'}. A line with nothing on it is not a line. Either put the ` +
        `real quantity in, or take the row off the booking.`,
    };
  }

  if (U > 0 && Q % U === 0) {
    const correct = Q / U;
    const stated = C === 0 ? 'a zero' : String(C);
    return {
      ...blank, ...common,
      branch: 'cartons',
      correctedCartons: correct,
      correctedUnitsPerCarton: null,
      confidence: 'High',
      diagnosis:
        `${item.sku}: ${Q.toLocaleString('en-GB')} units at ${U} a carton is exactly ${correct} ` +
        `cartons, so the pack size is right and the carton count is the typo. The sheet says ` +
        `${stated}, which packs ${packed.toLocaleString('en-GB')} units, ` +
        `${shortfall.toLocaleString('en-GB')} ${direction} than you are shipping. Change the carton ` +
        `count to ${correct}.`,
    };
  }

  if (C > 0 && Q % C === 0) {
    const correct = Q / C;
    const stated = U === 0 ? 'a zero' : String(U);
    return {
      ...blank, ...common,
      branch: 'packsize',
      correctedCartons: null,
      correctedUnitsPerCarton: correct,
      confidence: 'Medium',
      diagnosis:
        `${item.sku}: ${Q.toLocaleString('en-GB')} units does not divide by the ${stated} a carton ` +
        `on the sheet, but it divides exactly by the ${C} cartons, at ${correct} a carton. The ` +
        `carton count looks right and the pack size looks wrong. Check one carton on the pallet ` +
        `before you change it.`,
    };
  }

  return {
    ...blank, ...common,
    branch: 'recount',
    confidence: '',
    diagnosis:
      `${item.sku}: ${Q.toLocaleString('en-GB')} units, ${U} a carton, ${C} cartons. ` +
      `${Q.toLocaleString('en-GB')} divides evenly by neither, so at least two of the three numbers ` +
      `are wrong. Count one carton and count the pallet. I will not guess which two.`,
  };
}

/* ------------------------------------------------------------------ *
 * R-04 — booking cartons = sum of item cartons
 * Reads the R-03 result rather than recomputing it.
 * ------------------------------------------------------------------ */

export type CartonBranch =
  | 'ok' | 'not-applicable' | 'header' | 'single-item' | 'multiple' | 'incomplete';

export interface CartonDiagnosis {
  branch: CartonBranch;
  booking: number;
  itemSum: number;
  gap: number;
  /** The sku whose own correction reconciles the booking, on the single-item branch. */
  culpritSku: string | null;
  confidence: string;
  diagnosis: string;
  cost: number;
  costWhy: string;
}

export function diagnoseCartons(
  b: Booking,
  countDiagnoses: CountDiagnosis[],
): CartonDiagnosis {
  const blank: CartonDiagnosis = {
    branch: 'not-applicable', booking: 0, itemSum: 0, gap: 0, culpritSku: null,
    confidence: '', diagnosis: '', cost: 0, costWhy: '',
  };
  const withCartons = b.items.filter((i) => i.cartons !== null);
  const noCartons = b.items.filter((i) => i.cartons === null);
  if (b.cartons === null || withCartons.length === 0) return blank;

  const S = withCartons.reduce((n, i) => n + (i.cartons ?? 0), 0);
  const B = b.cartons;
  if (B === S && noCartons.length === 0) return { ...blank, branch: 'ok', booking: B, itemSum: S };

  const gap = Math.abs(B - S);

  // Worst case: you do not know which cartons are miscounted, so price the gap
  // at the most valuable carton on the booking.
  const cartonValues = b.items
    .map((i) => (i.unitPrice ?? 0) * (i.unitsPerCarton ?? 0))
    .filter((v) => v > 0);
  const dearestCarton = cartonValues.length ? Math.max(...cartonValues) : 0;
  const cost = gap * dearestCarton;
  const costWhy = dearestCarton
    ? `${gap} carton${gap === 1 ? '' : 's'} unreconciled, valued at this booking's dearest carton ` +
      `(£${dearestCarton.toFixed(2)}). Worst case that is what the receiving site raises a ` +
      `discrepancy for.`
    : `${gap} carton${gap === 1 ? '' : 's'} unreconciled against the item lines.`;

  const common = { booking: B, itemSum: S, gap, cost, costWhy };

  // A row with no carton count is not in the sum at all, so the sum is not a
  // figure anything should be set to.
  if (noCartons.length > 0) {
    const names = noCartons.map((i) => i.sku).join(', ');
    return {
      ...blank, ...common,
      branch: 'incomplete',
      confidence: '',
      diagnosis:
        `${names} ${noCartons.length === 1 ? 'has' : 'have'} no carton count, so the ${S} cartons ` +
        `the item lines add up to leaves ${noCartons.length === 1 ? 'that line' : 'those lines'} ` +
        `out. The header says ${B}. Fill in the missing carton count${noCartons.length === 1 ? '' : 's'} ` +
        `first; until then there is no total worth comparing the header against.`,
    };
  }

  const classify = (i: number) => countDiagnoses[i]?.branch ?? 'not-applicable';
  const failedIdx = b.items.map((_, i) => i).filter((i) => {
    const br = classify(i);
    return br !== 'ok' && br !== 'not-applicable';
  });
  const unverified = b.items.filter((_, i) => classify(i) === 'not-applicable');

  if (failedIdx.length === 0) {
    const everyRowChecked = unverified.length === 0;
    return {
      ...blank, ...common,
      branch: 'header',
      confidence: everyRowChecked ? 'High' : 'Medium',
      diagnosis: everyRowChecked
        ? `Every item line packs out exactly, and the lines add up to ${S} cartons. The booking ` +
          `header says ${B}. The item rows agree with each other, so the header is the number that ` +
          `was typed wrong. Set the booking carton total to ${S}.`
        : `The item lines add up to ${S} cartons against a header of ${B}. Nothing fails its ` +
          `pack-out check, but ${unverified.map((i) => i.sku).join(', ')} ` +
          `${unverified.length === 1 ? 'is missing a quantity or a pack size' : 'are missing a quantity or a pack size'}, ` +
          `so I could not confirm ${unverified.length === 1 ? 'it' : 'they'} agree${unverified.length === 1 ? 's' : ''} ` +
          `with the rest. On what can be checked, the header is the number to change. Set the ` +
          `booking carton total to ${S}, and fill in the missing figures so this can be confirmed.`,
    };
  }

  if (failedIdx.length === 1) {
    const idx = failedIdx[0];
    const culprit = b.items[idx];
    const corrected = countDiagnoses[idx]?.correctedCartons ?? null;
    if (corrected !== null) {
      const reconciled = S - (culprit.cartons ?? 0) + corrected;
      if (reconciled === B) {
        return {
          ...blank, ...common,
          branch: 'single-item',
          culpritSku: culprit.sku,
          confidence: 'High',
          diagnosis:
            `The item lines total ${S} cartons against a header of ${B}, but ${culprit.sku} already ` +
            `fails its own pack-out check. Correcting ${culprit.sku} to ${corrected} carton` +
            `${corrected === 1 ? '' : 's'} brings the lines to ${B}, which is what the header says. ` +
            `The header was right all along. Fix the item row and both checks clear.`,
        };
      }
    }
  }

  return {
    ...blank, ...common,
    branch: 'multiple',
    confidence: '',
    diagnosis:
      `The item lines total ${S} cartons against a header of ${B}, and ${failedIdx.length} item ` +
      `${failedIdx.length === 1 ? 'row does' : 'rows do'} not pack out either. Fix the item rows first. ` +
      `Changing the header now would bury the real error.`,
  };
}

/* ------------------------------------------------------------------ *
 * R-02 — declared value
 * Search for a single cause before reporting a gap.
 * ------------------------------------------------------------------ */

export type ValueBranch =
  | 'ok' | 'not-applicable' | 'header-zero' | 'item-price' | 'item-qty' | 'gap';

export interface ValueDiagnosis {
  branch: ValueBranch;
  declared: number;
  computed: number;
  gap: number;
  culpritSku: string | null;
  proposedUnitPrice: number | null;
  confidence: string;
  diagnosis: string;
  cost: number;
  costWhy: string;
}

function near(a: number, b: number, tol = 0.01): boolean {
  return Math.abs(a - b) <= tol;
}

export function diagnoseValue(b: Booking): ValueDiagnosis {
  const blank: ValueDiagnosis = {
    branch: 'not-applicable', declared: 0, computed: 0, gap: 0, culpritSku: null,
    proposedUnitPrice: null, confidence: '', diagnosis: '', cost: 0, costWhy: '',
  };
  const priced = b.items.filter((i) => i.quantity !== null && i.unitPrice !== null);
  if (b.declaredValue === null || priced.length === 0) return blank;

  const computed = priced.reduce((n, i) => n + i.quantity! * i.unitPrice!, 0);
  const declared = b.declaredValue;
  if (computed <= 0) return blank;

  const gap = declared - computed;
  if (Math.abs(gap) <= 0.01 * computed) {
    return { ...blank, branch: 'ok', declared, computed, gap };
  }

  const costWhy =
    `${`£${Math.abs(gap).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`} of declared value ` +
    `does not reconcile to the item lines. That gap is what a customs query is raised against.`;
  const common = { declared, computed, gap, cost: Math.abs(gap), costWhy };

  // 1. A zero slipped on the header.
  const ratio = declared / computed;
  for (const f of [10, 100, 0.1, 0.01]) {
    if (near(ratio, f, 1e-6)) {
      const dir = f > 1 ? 'too many' : 'too few';
      return {
        ...blank, ...common,
        branch: 'header-zero',
        confidence: 'High',
        diagnosis:
          `The item lines come to £${computed.toLocaleString('en-GB', { maximumFractionDigits: 2 })} ` +
          `and the header says £${declared.toLocaleString('en-GB', { maximumFractionDigits: 2 })}, ` +
          `exactly ${f >= 1 ? f : `1/${Math.round(1 / f)}`} times as much. That is ` +
          `${dir} zeros on the booking total, not a pricing problem. The item lines are internally ` +
          `consistent, so correct the header to ` +
          `£${computed.toLocaleString('en-GB', { maximumFractionDigits: 2 })}.`,
      };
    }
  }

  // Scaling a line's price by f and scaling its quantity by f move the total
  // identically, so step 2 covers step 3 except where a corrected price would
  // not be a price: money below a penny cannot be typed into an invoice, so a
  // quantity is the only explanation left.
  const isMoney = (n: number): boolean => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6 && Math.abs(n) >= 0.01;

  // 2. One item's unit price is out by a factor of ten.
  for (const item of priced) {
    for (const f of [10, 100, 0.1, 0.01]) {
      const newPrice = item.unitPrice! * f;
      const newComputed = computed - item.quantity! * item.unitPrice! + item.quantity! * newPrice;
      if (near(newComputed, declared, 0.01)) {
        if (!isMoney(newPrice)) continue;
        const rounded = Math.round(newPrice * 100) / 100;
        return {
          ...blank, ...common,
          branch: 'item-price',
          culpritSku: item.sku,
          proposedUnitPrice: rounded,
          confidence: 'High',
          diagnosis:
            `The header is not the problem. Put ${item.sku} at £${rounded.toFixed(2)} a unit instead ` +
            `of £${item.unitPrice!.toFixed(2)} and the item lines come to exactly ` +
            `£${declared.toLocaleString('en-GB', { maximumFractionDigits: 2 })}, the figure already ` +
            `on the booking. One unit price is out by a factor of ` +
            `${f >= 1 ? f : Math.round(1 / f)}; every other line reconciles.`,
        };
      }
    }
  }

  // 3. One item's quantity is out by a factor of ten. Flag it, do not fix it.
  for (const item of priced) {
    for (const f of [10, 100, 0.1, 0.01]) {
      const newQty = item.quantity! * f;
      if (!Number.isInteger(newQty)) continue;
      const newComputed = computed - item.quantity! * item.unitPrice! + newQty * item.unitPrice!;
      if (near(newComputed, declared, 0.01)) {
        return {
          ...blank, ...common,
          branch: 'item-qty',
          culpritSku: item.sku,
          confidence: 'Medium',
          diagnosis:
            `${item.sku} at ${newQty.toLocaleString('en-GB')} units rather than ` +
            `${item.quantity!.toLocaleString('en-GB')} would close the gap exactly. A quantity is not ` +
            `a typo I will correct for you, because it changes what is physically on the pallet. ` +
            `Check ${item.sku} against the packing list and against the carton count.`,
        };
      }
    }
  }

  // 4. No single cause.
  return {
    ...blank, ...common,
    branch: 'gap',
    confidence: '',
    diagnosis:
      `The item lines come to £${computed.toLocaleString('en-GB', { maximumFractionDigits: 2 })} ` +
      `and the booking declares £${declared.toLocaleString('en-GB', { maximumFractionDigits: 2 })}, ` +
      `a gap of £${Math.abs(gap).toLocaleString('en-GB', { maximumFractionDigits: 2 })}. No single ` +
      `price or quantity explains it, so a product is probably missing from the item list ` +
      `${gap > 0 ? 'altogether' : 'or a line is listed twice'}. Reconcile the list against the ` +
      `commercial invoice before you book.`,
  };
}

/* ------------------------------------------------------------------ *
 * R-06 — dangerous goods
 * Three independent detectors. Any hit is Red.
 * ------------------------------------------------------------------ */

export const DG_KEYWORDS = [
  'lithium', 'li-ion', 'lithium-ion', 'battery', 'batteries', 'cell pack',
  'power bank', 'powerbank', 'e-scooter', 'escooter', 'hoverboard', 'e-bike', 'ebike',
  'cordless', 'rechargeable', 'drone',
  'aerosol', 'nail polish remover', 'acetone', 'hand sanitiser', 'hand sanitizer',
  'perfume', 'eau de toilette', 'hairspray', 'hair spray', 'lighter', 'lighter fuel',
  'vape', 'e-liquid', 'white spirit', 'thinner', 'thinners', 'petrol', 'flammable',
  'butane', 'propane', 'matches',
];

export const DG_HS_HEADINGS = [
  '8506', '8507', '3303', '3307', '2710', '3208', '3209', '3814', '2207', '2208',
  '9613', '8711', '3604',
];

export const DG_HS_LABELS: Record<string, string> = {
  '8506': 'primary cells and primary batteries',
  '8507': 'electric accumulators, which is to say rechargeable cells',
  '3303': 'perfumes and toilet waters',
  '3307': 'shaving, deodorant and depilatory preparations',
  '2710': 'petroleum oils',
  '3208': 'paints and varnishes in a non-aqueous medium',
  '3209': 'paints and varnishes in an aqueous medium',
  '3814': 'organic composite solvents and thinners',
  '2207': 'undenatured ethyl alcohol of 80% or higher',
  '2208': 'spirits and other spirituous beverages',
  '9613': 'lighters',
  '8711': 'motorcycles and motorised cycles',
  '3604': 'fireworks and pyrotechnic articles',
};

/** Usually contains a cell. Still Red, but worded as a question. */
export const DG_SOFT = ['earbuds', 'earphones', 'laptop', 'smartwatch', 'smart watch', 'tablet', 'camera'];

export interface DgDiagnosis {
  hit: boolean;
  keywords: string[];
  headings: string[];
  soft: string[];
}

function wordHit(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i');
  return re.test(haystack);
}

export function detectDg(item: Item): DgDiagnosis {
  const text = `${item.description ?? ''} ${item.sku ?? ''}`.toLowerCase();
  const keywords = DG_KEYWORDS.filter((k) => wordHit(text, k));
  const code = (item.hsCode ?? '').toString().trim().replace(/[\s.]/g, '');
  // Read the heading both as typed and as leading-zero-padded. A five digit
  // code is ambiguous, and on this rule a false flag is cheaper than a miss.
  const readings = code.length === 5 ? [code, `0${code}`] : [code];
  const headings = [...new Set(
    readings.map((r) => r.slice(0, 4)).filter((h) => DG_HS_HEADINGS.includes(h)),
  )];
  const soft = DG_SOFT.filter((k) => wordHit(text, k));
  return { hit: keywords.length > 0 || headings.length > 0 || soft.length > 0, keywords, headings, soft };
}

export const DG_REMEDY =
  'Raise a dangerous goods declaration, pack to UN marked specification, and move the affected ' +
  'lines as a separate consignment so the rest of the shipment can still travel.';
