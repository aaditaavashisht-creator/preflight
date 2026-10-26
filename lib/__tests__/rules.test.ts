import { describe, expect, it } from 'vitest';
import {
  RULES, applicability, check, exposureOf, ruleStatuses, sortIssues,
  validate, verdictOf, worstCaseDelay,
} from '../rules';
import { diagnoseCartons, diagnoseCounts, diagnoseHs, diagnoseValue, detectDg, suggestHs } from '../diagnose';
import { blankBooking, cloneBooking } from '../fixtures';
import { addDays, startOfDay } from '../format';
import type { Booking, Item } from '../types';

const TODAY = startOfDay(new Date(2026, 5, 1));

function mkItem(over: Partial<Item> = {}): Item {
  return {
    sku: 'X-1', description: 'Plain widget', hsCode: '123456',
    quantity: 100, unitPrice: 10, unitsPerCarton: 10, cartons: 10,
    unitWeight: 1, countryOfOrigin: 'United Kingdom',
    ...over,
  };
}

function mkBooking(over: Partial<Booking> = {}, items: Item[] = [mkItem()]): Booking {
  const base: Booking = {
    ...blankBooking('BK-T'),
    seller: 'Test Seller',
    originCity: 'London', originCountry: 'United Kingdom',
    destCity: 'Berlin', destCountry: 'Germany', destType: 'Business address',
    readyDate: addDays(TODAY, 10), priority: 'Balanced',
    pallets: 1, cartons: 10, declaredValue: 1000, grossWeight: 150,
    appointment: 'No', items,
  };
  return { ...base, ...over, items: over.items ?? items };
}

const ruleSet = (b: Booking) => [...new Set(validate(b, TODAY).map((i) => i.rule))].sort();
const find = (b: Booking, rule: string) => validate(b, TODAY).find((i) => i.rule === rule);

describe('the rulebook as a whole', () => {
  it('declares exactly ten rules, six Red and four Amber', () => {
    expect(RULES).toHaveLength(10);
    expect(RULES.filter((r) => r.severity === 'Red')).toHaveLength(6);
    expect(RULES.filter((r) => r.severity === 'Amber')).toHaveLength(4);
    expect(RULES.map((r) => r.id)).toEqual([
      'R-01', 'R-02', 'R-03', 'R-04', 'R-05', 'R-06', 'R-07', 'R-08', 'R-09', 'R-10',
    ]);
  });

  it('maps every rule to exactly one readiness stage', () => {
    const stages = new Set(RULES.map((r) => r.stage));
    expect([...stages].sort()).toEqual(['Counts agree', 'Freight accepted', 'Paperwork clear', 'Ready for collection']);
  });

  it('passes a clean booking', () => {
    expect(validate(mkBooking(), TODAY)).toEqual([]);
  });

  it('sorts Red first, then by rule id', () => {
    const sorted = sortIssues([
      { rule: 'R-10', severity: 'Amber' } as never,
      { rule: 'R-05', severity: 'Red' } as never,
      { rule: 'R-08', severity: 'Amber' } as never,
      { rule: 'R-02', severity: 'Red' } as never,
    ]);
    expect(sorted.map((i) => i.rule)).toEqual(['R-02', 'R-05', 'R-08', 'R-10']);
  });

  it('verdicts Red over Amber over Clear', () => {
    expect(verdictOf([{ severity: 'Red' } as never, { severity: 'Amber' } as never])).toBe('Red');
    expect(verdictOf([{ severity: 'Amber' } as never])).toBe('Amber');
    expect(verdictOf([])).toBe('Clear');
  });

  it('every issue names the culprit field, not just the mismatch', () => {
    // Naming the field is the product, so this is asserted against a fixed
    // vocabulary rather than against string length.
    const FIELD_WORDS = /carton|pack size|quantity|unit price|declared value|commodity code|hs|origin|weight|pallet|ready date|slot|appointment|header|booking total/i;
    const IMPERATIVE = /\b(set|change|put|enter|fix|correct|book|look|count|check|weigh|spread|raise|take|fill|move)\b/i;

    const bookings = [
      mkBooking({ cartons: 11, declaredValue: 10000, appointment: 'No', destType: 'Warehouse' },
        [mkItem({ hsCode: '12345', countryOfOrigin: '' })]),
      mkBooking({ grossWeight: 900, pallets: 1, readyDate: addDays(TODAY, -3) },
        [mkItem({ sku: 'PWB-9', description: 'Portable power bank', hsCode: '850760', quantity: 97, unitsPerCarton: 12, cartons: 9, unitWeight: 9 })]),
      mkBooking({ cartons: 50 }, [
        mkItem({ sku: 'TEE', quantity: 960, unitPrice: 1, unitsPerCarton: 24, cartons: 40, unitWeight: 0.2 }),
        mkItem({ sku: 'SOK', quantity: 500, unitPrice: 4, unitsPerCarton: 50, cartons: 12, unitWeight: 0.15 }),
      ]),
    ];

    let checked = 0;
    for (const b of bookings) {
      for (const i of validate(b, TODAY)) {
        checked += 1;
        const where = `${b.id} ${i.rule}${i.sku ? ` ${i.sku}` : ''}`;
        // It names a field from the rulebook's own vocabulary...
        expect(i.diagnosis, where).toMatch(FIELD_WORDS);
        // ...tells the seller to do something about it...
        expect(i.diagnosis, where).toMatch(IMPERATIVE);
        // ...and a per-item issue says which row.
        if (i.sku) expect(i.diagnosis, where).toContain(i.sku);
        // A fix's proposed value is visible in the prose, not only on the button.
        if (i.fix) {
          const digits = i.fix.label.match(/[\d.]+/g) ?? [];
          const last = digits[digits.length - 1];
          if (last) expect(`${i.diagnosis} ${i.observed} ${i.expected}`, `${where} proposes ${last}`).toContain(last);
        }
        expect(i.observed, where).not.toBe('');
        expect(i.expected, where).not.toBe('');
        expect(i.title, where).not.toBe('');
        expect(i.costWhy, where).not.toBe('');
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('takes the longest single hold as the worst case, not the sum', () => {
    const issues = [
      { impactDays: [3, 7], impactCost: 100 } as never,
      { impactDays: [1, 2], impactCost: 50 } as never,
    ];
    expect(worstCaseDelay(issues)).toBe(7);
    expect(exposureOf(issues)).toBe(150);
  });
});

/* ---------------- R-01 ---------------- */

describe('R-01 commodity code', () => {
  it('passes six digits and more', () => {
    expect(diagnoseHs(mkItem({ hsCode: '691200' })).branch).toBe('ok');
    expect(diagnoseHs(mkItem({ hsCode: '69120010' })).branch).toBe('ok');
  });

  it('reads five digits as a dropped leading zero and offers it as a fix', () => {
    const d = diagnoseHs(mkItem({ hsCode: '90121' }));
    expect(d.branch).toBe('leading-zero');
    expect(d.proposal).toBe('090121');
    expect(d.confidence).toBe('High');
    expect(d.diagnosis).toMatch(/number formatted/i);
  });

  it('suggests a heading for a blank code but never offers it as a fix', () => {
    const b = mkBooking({}, [mkItem({ hsCode: '', description: 'Ceramic coffee mug, 350 ml' })]);
    const i = find(b, 'R-01')!;
    expect(i.branch).toBe('blank');
    expect(i.fix).toBeNull();
    expect(i.suggestion).toMatch(/691200/);
    expect(i.suggestion).toMatch(/legal responsibility/i);
  });

  it('will not guess the missing digits of a four digit heading', () => {
    const d = diagnoseHs(mkItem({ hsCode: '6912', description: 'Ceramic mug' }));
    expect(d.branch).toBe('short');
    expect(d.proposal).toBeNull();
    expect(d.suggestion).toMatch(/691200/);
  });

  it('rejects a non-numeric code', () => {
    expect(diagnoseHs(mkItem({ hsCode: '6912AB' })).branch).toBe('non-numeric');
  });

  it('has a lookup that covers the named five and more besides', () => {
    expect(suggestHs('Ceramic coffee mug')?.code).toBe('691200');
    expect(suggestHs('Cotton t-shirt, crew neck')?.code).toBe('610910');
    expect(suggestHs('Scented soy candle, 200 g')?.code).toBe('340600');
    expect(suggestHs('Roasted coffee beans, 1 kg bag')?.code).toBe('090121');
    expect(suggestHs('Cotton socks, 5-pack')?.code).toBe('611595');
    expect(suggestHs('Leather briefcase')).toBeNull();
  });
});

/* ---------------- R-02 ---------------- */

describe('R-02 declared value', () => {
  const twoItems = [
    mkItem({ sku: 'A-1', quantity: 10, unitPrice: 3, unitsPerCarton: 1, cartons: 10, unitWeight: 0.1 }),
    mkItem({ sku: 'B-2', quantity: 20, unitPrice: 5, unitsPerCarton: 1, cartons: 20, unitWeight: 0.1 }),
  ];

  it('tolerates a 1% rounding difference, measured against the item lines', () => {
    expect(diagnoseValue(mkBooking({ declaredValue: 1005 })).branch).toBe('ok');
    expect(diagnoseValue(mkBooking({ declaredValue: 1011 })).branch).not.toBe('ok');
    // Exactly 1% of the computed total is inside the tolerance.
    expect(diagnoseValue(mkBooking({ declaredValue: 1010 })).branch).toBe('ok');
    // A hair over is not. This probe is what pins the tolerance to the item
    // lines rather than to the declared figure.
    expect(diagnoseValue(mkBooking({ declaredValue: 1010.05 })).branch).not.toBe('ok');
  });

  it('finds a zero slipped on the header first', () => {
    const d = diagnoseValue(mkBooking({ declaredValue: 10000 }));
    expect(d.branch).toBe('header-zero');
    expect(d.confidence).toBe('High');
    expect(d.diagnosis).toMatch(/zeros on the booking total/);
  });

  it('finds a single item price out by a factor of ten', () => {
    const d = diagnoseValue(mkBooking({ declaredValue: 400, cartons: 30 }, twoItems));
    expect(d.branch).toBe('item-price');
    expect(d.culpritSku).toBe('A-1');
    expect(d.proposedUnitPrice).toBe(30);
  });

  it('flags a quantity out by ten without offering to change it', () => {
    // Closing this gap by price would put A-1 at half a penny a unit, which is
    // not a price anyone typed. The quantity is the only explanation left.
    const qtyTypo = [
      mkItem({ sku: 'A-1', quantity: 1000, unitPrice: 0.5, unitsPerCarton: 100, cartons: 10, unitWeight: 0.1 }),
      mkItem({ sku: 'B-2', quantity: 10, unitPrice: 10, unitsPerCarton: 10, cartons: 1, unitWeight: 0.1 }),
    ];
    const b = mkBooking({ declaredValue: 105, cartons: 11 }, qtyTypo);
    const d = diagnoseValue(b);
    expect(d.branch).toBe('item-qty');
    expect(d.culpritSku).toBe('A-1');
    expect(d.confidence).toBe('Medium');
    expect(d.diagnosis).toMatch(/packing list/);
    expect(find(b, 'R-02')!.fix).toBeNull();
    // and it does not contradict R-03, which has nothing to say about this row
    expect(validate(b, TODAY).some((i) => i.rule === 'R-03')).toBe(false);
  });

  it('keeps the spec order: a plausible price correction beats a quantity one', () => {
    const b = mkBooking({ declaredValue: 400, cartons: 30 }, [
      mkItem({ sku: 'A-1', quantity: 10, unitPrice: 3, unitsPerCarton: 1, cartons: 10, unitWeight: 0.1 }),
      mkItem({ sku: 'B-2', quantity: 20, unitPrice: 5, unitsPerCarton: 1, cartons: 20, unitWeight: 0.1 }),
    ]);
    const d = diagnoseValue(b);
    expect(d.branch).toBe('item-price');
    expect(d.proposedUnitPrice).toBe(30);
    expect(d.confidence).toBe('High');
  });

  it('reports a plain gap and suspects a missing product when nothing explains it', () => {
    const d = diagnoseValue(mkBooking({ declaredValue: 500, cartons: 30 }, twoItems));
    expect(d.branch).toBe('gap');
    expect(d.diagnosis).toMatch(/missing from the item list/);
    expect(d.confidence).toBe('');
  });

  it('prices the issue at the unreconciled value, not an average', () => {
    const i = find(mkBooking({ declaredValue: 10000 }), 'R-02')!;
    expect(i.impactCost).toBe(9000);
  });

  it('does nothing when there is no declared value to compare', () => {
    expect(diagnoseValue(mkBooking({ declaredValue: null })).branch).toBe('not-applicable');
  });
});

/* ---------------- R-03 ---------------- */

describe('R-03 pack-out', () => {
  it('blames the carton count when the quantity divides by the pack size', () => {
    const d = diagnoseCounts(mkItem({ quantity: 500, unitsPerCarton: 50, cartons: 12, unitPrice: 4 }));
    expect(d.branch).toBe('cartons');
    expect(d.correctedCartons).toBe(10);
    expect(d.confidence).toBe('High');
    expect(d.cost).toBe(400);
    expect(d.costWhy).toMatch(/warehouse would report/);
  });

  it('blames the pack size when only the carton count divides, at medium confidence', () => {
    const d = diagnoseCounts(mkItem({ quantity: 90, unitsPerCarton: 12, cartons: 9 }));
    expect(d.branch).toBe('packsize');
    expect(d.correctedUnitsPerCarton).toBe(10);
    expect(d.confidence).toBe('Medium');
    expect(d.diagnosis).toMatch(/Check one carton/);
  });

  it('asks for a recount and offers nothing when neither divides', () => {
    const d = diagnoseCounts(mkItem({ quantity: 97, unitsPerCarton: 12, cartons: 9 }));
    expect(d.branch).toBe('recount');
    expect(d.confidence).toBe('');
    expect(d.diagnosis).toMatch(/at least two of the three numbers/);
    const b = mkBooking({ cartons: 9 }, [mkItem({ quantity: 97, unitsPerCarton: 12, cartons: 9 })]);
    expect(find(b, 'R-03')!.fix).toBeNull();
  });

  it('sits out when a number is missing', () => {
    expect(diagnoseCounts(mkItem({ unitsPerCarton: null })).branch).toBe('not-applicable');
  });
});

/* ---------------- R-04 ---------------- */

describe('R-04 booking carton total', () => {
  const counts = (b: Booking) => b.items.map((i) => diagnoseCounts(i));

  it('blames the header when every item line packs out', () => {
    const b = mkBooking({ cartons: 11 });
    const d = diagnoseCartons(b, counts(b));
    expect(d.branch).toBe('header');
    expect(d.confidence).toBe('High');
    expect(d.itemSum).toBe(10);
  });

  it('blames the single failing item when correcting it reconciles the header', () => {
    const b = mkBooking({ cartons: 50 }, [
      mkItem({ sku: 'TEE', quantity: 960, unitPrice: 1, unitsPerCarton: 24, cartons: 40, unitWeight: 0.2 }),
      mkItem({ sku: 'SOK', quantity: 500, unitPrice: 4, unitsPerCarton: 50, cartons: 12, unitWeight: 0.15 }),
    ]);
    const d = diagnoseCartons(b, counts(b));
    expect(d.branch).toBe('single-item');
    expect(d.culpritSku).toBe('SOK');
    expect(d.diagnosis).toMatch(/header was right all along/);
  });

  it('offers nothing at booking level when several item rows are wrong', () => {
    const b = mkBooking({ cartons: 99 }, [
      mkItem({ sku: 'A', quantity: 100, unitsPerCarton: 7, cartons: 10 }),
      mkItem({ sku: 'B', quantity: 100, unitsPerCarton: 9, cartons: 10 }),
    ]);
    const d = diagnoseCartons(b, counts(b));
    expect(d.branch).toBe('multiple');
    expect(find(b, 'R-04')!.fix).toBeNull();
    expect(d.diagnosis).toMatch(/Fix the item rows first/);
  });

  it('prices the gap at the dearest carton on the booking', () => {
    const b = mkBooking({ cartons: 90 }, [
      mkItem({ sku: 'MUG-01', quantity: 1080, unitPrice: 5, unitsPerCarton: 12, cartons: 90, unitWeight: 0.5 }),
      mkItem({ sku: 'TRY-02', quantity: 72, unitPrice: 15, unitsPerCarton: 12, cartons: 6, unitWeight: 0.9 }),
    ]);
    // 6 cartons adrift, dearest carton is 12 x £15 = £180.
    expect(find(b, 'R-04')!.impactCost).toBe(1080);
  });
});

/* ---------------- R-05 ---------------- */

describe('R-05 weight per pallet', () => {
  it('stays quiet while any service on the lane will take the load', () => {
    expect(ruleSet(mkBooking({ grossWeight: 740, pallets: 1 }))).toEqual([]);
  });

  it('fires only when nothing on the lane will take it', () => {
    const b = mkBooking({ grossWeight: 800, pallets: 1 });
    const i = find(b, 'R-05')!;
    expect(i.severity).toBe('Red');
    expect(i.observed).toMatch(/800 kg a pallet/);
    expect(i.diagnosis).toMatch(/re-plan, not a paperwork correction/);
  });
});

/* ---------------- R-06 ---------------- */

describe('R-06 dangerous goods', () => {
  it('catches an explicit keyword', () => {
    const dg = detectDg(mkItem({ description: 'Aerosol room spray', hsCode: '330749' }));
    expect(dg.keywords).toContain('aerosol');
  });

  it('catches a restricted HS heading even when the words look harmless', () => {
    const dg = detectDg(mkItem({ description: 'Gift set', hsCode: '330300' }));
    expect(dg.headings).toEqual(['3303']);
    expect(dg.keywords).toEqual([]);
  });

  it('reads a five digit code both as typed and as leading-zero-padded', () => {
    // 96131 could be a truncated 9613 10, so read it as typed too.
    expect(detectDg(mkItem({ description: 'Gift set', hsCode: '96131' })).headings).toEqual(['9613']);
    // 90121 pads to 090121, which is coffee, and neither reading is restricted.
    expect(detectDg(mkItem({ description: 'Coffee beans', hsCode: '90121' })).headings).toEqual([]);
  });

  it('flags the soft list as Red but words it as a question', () => {
    const b = mkBooking({}, [mkItem({ sku: 'EAR-1', description: 'Wireless earbuds', hsCode: '851830' })]);
    const i = find(b, 'R-06')!;
    expect(i.severity).toBe('Red');
    expect(i.branch).toBe('confirm-cell');
    expect(i.diagnosis).toMatch(/confirm whether a cell is fitted/i);
    expect(i.diagnosis).toMatch(/false flag here costs you a phone call/i);
  });

  it('always states the remedy', () => {
    const b = mkBooking({}, [mkItem({ description: 'Portable power bank', hsCode: '850760' })]);
    const i = find(b, 'R-06')!;
    expect(i.diagnosis).toMatch(/UN marked/);
    expect(i.diagnosis).toMatch(/separate consignment/);
  });

  it('does not trip on a candle or a ceramic mug', () => {
    expect(detectDg(mkItem({ description: 'Scented soy candle, 200 g', hsCode: '340600' })).hit).toBe(false);
    expect(detectDg(mkItem({ description: 'Ceramic coffee mug, 350 ml', hsCode: '691200' })).hit).toBe(false);
    expect(detectDg(mkItem({ description: 'Roasted coffee beans, 1 kg bag', hsCode: '090121' })).hit).toBe(false);
  });
});

/* ---------------- R-07 to R-10 ---------------- */

describe('R-07 gross against net', () => {
  it('fires when gross sits below net and suggests an estimate', () => {
    const b = mkBooking({ grossWeight: 50, pallets: 2 }, [mkItem({ quantity: 100, unitWeight: 1 })]);
    const i = find(b, 'R-07')!;
    expect(i.severity).toBe('Amber');
    expect(i.fix?.label).toBe('Set gross weight to 158 kg'); // 100 x 1.08 + 2 x 25
    expect(i.fix?.delta).toMatch(/estimate/);
    expect(i.confidence).toBe('Medium');
    const copy = cloneBooking(b);
    i.fix!.apply(copy);
    expect(validate(copy, TODAY).some((x) => x.rule === 'R-07')).toBe(false);
  });
});

describe('R-08 warehouse appointment', () => {
  it('fires on a warehouse with no slot and gives the operational reason', () => {
    const i = find(mkBooking({ destType: 'Warehouse', appointment: 'No' }), 'R-08')!;
    expect(i.diagnosis).toMatch(/three to five working days/);
    expect(i.fix?.label).toMatch(/Record the delivery slot/);
  });

  it('does not apply to a business address', () => {
    expect(ruleSet(mkBooking({ destType: 'Business address', appointment: 'No' }))).toEqual([]);
    expect(applicability(mkBooking({ destType: 'Business address' }))['R-08']).toBe(false);
  });
});

describe('R-09 country of origin', () => {
  it('explains that origin is where goods were made', () => {
    const i = find(mkBooking({}, [mkItem({ countryOfOrigin: '' })]), 'R-09')!;
    expect(i.diagnosis).toMatch(/where .* was manufactured, not where it is shipping from/);
    expect(i.fix).toBeNull();
  });
});

describe('R-10 ready date', () => {
  it('fires on a past date and explains that no collection gets scheduled', () => {
    const b = mkBooking({ readyDate: addDays(TODAY, -5) });
    const i = find(b, 'R-10')!;
    expect(i.observed).toMatch(/5 days ago/);
    expect(i.diagnosis).toMatch(/no collection at all/);
    expect(i.impactCost).toBe(200); // 5 days x £40
    const copy = cloneBooking(b);
    i.fix!.apply(copy);
    expect(validate(copy, TODAY).some((x) => x.rule === 'R-10')).toBe(false);
  });

  it('does not fire on today', () => {
    expect(ruleSet(mkBooking({ readyDate: TODAY }))).toEqual([]);
  });
});

/* ---------------- the rule strip ---------------- */

describe('the ten-cell rule strip', () => {
  it('marks rules that could not be tested as not applicable rather than green', () => {
    const empty = mkBooking({ items: [], cartons: null, declaredValue: null, readyDate: null, grossWeight: null, pallets: null }, []);
    const statuses = ruleStatuses(empty, validate(empty, TODAY));
    expect(Object.values(statuses).every((s) => s === 'na')).toBe(true);
  });

  it('colours each cell from the worst issue on that rule', () => {
    const b = mkBooking({ cartons: 11, destType: 'Warehouse', appointment: 'No' });
    const s = ruleStatuses(b, validate(b, TODAY));
    expect(s['R-04']).toBe('red');
    expect(s['R-08']).toBe('amber');
    expect(s['R-01']).toBe('clear');
  });

  it('gives a status for all ten rules, always', () => {
    const b = mkBooking();
    expect(Object.keys(ruleStatuses(b, validate(b, TODAY))).sort()).toEqual(RULES.map((r) => r.id));
  });
});

describe('check() bundles the rules, the verdict and the carrier', () => {
  it('returns counts, exposure and a recommendation in one call', () => {
    const b = mkBooking({ cartons: 11, destType: 'Warehouse', appointment: 'No' });
    const r = check(b, TODAY);
    expect(r.verdict).toBe('Red');
    expect(r.redCount).toBe(1);
    expect(r.amberCount).toBe(1);
    expect(r.exposure).toBeGreaterThan(0);
    expect(r.recommendation.winner).not.toBeNull();
    expect(r.weightPerPallet).toBe(150);
    expect(r.netWeight).toBe(100);
    expect(r.computedValue).toBe(1000);
    expect(r.itemCartons).toBe(10);
  });
});

/* ---------------- rows a real sheet actually contains ---------------- */

describe('a stated zero is a number, not a blank', () => {
  it('R-03 catches a zero carton count instead of skipping the row', () => {
    const b = mkBooking({ cartons: 0 }, [
      mkItem({ sku: 'ZER-1', quantity: 1000, unitPrice: 5, unitsPerCarton: 10, cartons: 0 }),
    ]);
    const d = diagnoseCounts(b.items[0]);
    expect(d.branch).toBe('cartons');
    expect(d.correctedCartons).toBe(100);
    expect(d.cost).toBe(5000);

    const i = find(b, 'R-03')!;
    expect(i.severity).toBe('Red');
    expect(i.fix?.label).toBe('Set ZER-1 cartons to 100');
    expect(ruleStatuses(b, validate(b, TODAY))['R-03']).toBe('red');
  });

  it('R-03 catches a zero pack size', () => {
    const d = diagnoseCounts(mkItem({ quantity: 1000, unitsPerCarton: 0, cartons: 10 }));
    expect(d.branch).toBe('packsize');
    expect(d.correctedUnitsPerCarton).toBe(100);
  });

  it('R-03 refuses to treat a zero quantity as a shipment', () => {
    const d = diagnoseCounts(mkItem({ quantity: 0, unitsPerCarton: 10, cartons: 10 }));
    expect(d.branch).toBe('recount');
    expect(d.diagnosis).toMatch(/not a line/);
  });

  it('a genuinely blank cell is still unverifiable', () => {
    expect(diagnoseCounts(mkItem({ cartons: null })).branch).toBe('not-applicable');
  });
});

describe('R-04 does not claim agreement it could not check', () => {
  it('will not propose a total that leaves a row out of the sum', () => {
    const b = mkBooking({ cartons: 110 }, [
      mkItem({ sku: 'OK-1', quantity: 120, unitsPerCarton: 12, cartons: 10 }),
      mkItem({ sku: 'NUL-1', quantity: 1000, unitsPerCarton: 10, cartons: null }),
    ]);
    const i = find(b, 'R-04')!;
    expect(i.branch).toBe('incomplete');
    expect(i.fix).toBeNull();
    expect(i.diagnosis).toContain('NUL-1');
  });

  it('drops to medium confidence when a row could not be pack-out checked', () => {
    const b = mkBooking({ cartons: 11 }, [
      mkItem({ sku: 'OK-1', quantity: 120, unitsPerCarton: 12, cartons: 10 }),
      mkItem({ sku: 'PART-1', quantity: null, unitsPerCarton: null, cartons: 0 }),
    ]);
    const i = find(b, 'R-04')!;
    expect(i.branch).toBe('header');
    expect(i.confidence).toBe('Medium');
    expect(i.diagnosis).toContain('PART-1');
    expect(i.diagnosis).not.toMatch(/Every item line packs out exactly/);
  });

  it('keeps high confidence when every row really was checked', () => {
    expect(find(mkBooking({ cartons: 11 }), 'R-04')!.confidence).toBe('High');
  });
});

describe('a sku is a column, not a key', () => {
  it('checks each row even when two rows share a sku', () => {
    const b = mkBooking({ cartons: 17 }, [
      mkItem({ sku: 'DUP', quantity: 100, unitsPerCarton: 10, cartons: 7 }),
      mkItem({ sku: 'DUP', quantity: 100, unitsPerCarton: 10, cartons: 10 }),
    ]);
    const r03 = validate(b, TODAY).filter((i) => i.rule === 'R-03');
    expect(r03).toHaveLength(1);
    expect(r03[0].fix?.label).toBe('Set DUP cartons to 10');
  });
});

describe('a rule with no rate card behind it is not green', () => {
  it('marks R-05 not applicable on a lane this tool does not price', () => {
    const b = mkBooking({ destCity: 'Madrid', destCountry: 'Spain', grossWeight: 2000, pallets: 1 });
    expect(validate(b, TODAY).some((i) => i.rule === 'R-05')).toBe(false);
    expect(ruleStatuses(b, validate(b, TODAY))['R-05']).toBe('na');
  });

  it('still marks it clear on a lane it does price', () => {
    expect(ruleStatuses(mkBooking(), validate(mkBooking(), TODAY))['R-05']).toBe('clear');
  });
});
