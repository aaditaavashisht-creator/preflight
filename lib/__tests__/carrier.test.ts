import { describe, expect, it } from 'vitest';
import { PRIORITY_WEIGHTS, feasibility, palletFixFor, recommend } from '../carrier';
import { CARRIERS, lane } from '../carriers';
import { blankBooking } from '../fixtures';
import { validate } from '../rules';
import type { Booking, Priority } from '../types';

function germany(pallets: number, grossWeight: number, priority: Priority | '' = 'Balanced'): Booking {
  return {
    ...blankBooking('BK-T'),
    destCity: 'Berlin', destCountry: 'Germany', destType: 'Business address',
    pallets, grossWeight, priority,
    cartons: 10, declaredValue: 1000,
    items: [{
      sku: 'X-1', description: 'Plain widget', hsCode: '691200',
      quantity: 10, unitPrice: 100, unitsPerCarton: 1, cartons: 10,
      unitWeight: 1, countryOfOrigin: 'United Kingdom',
    }],
  };
}

describe('the rate card', () => {
  it('holds nine services across three lanes', () => {
    expect(CARRIERS).toHaveLength(9);
    expect(lane('Germany')).toHaveLength(3);
    expect(lane('France')).toHaveLength(3);
    expect(lane('Netherlands')).toHaveLength(3);
  });

  it('does not order the pallet ceilings by price', () => {
    const g = lane('Germany');
    const byPrice = [...g].sort((a, z) => a.pricePerPallet - z.pricePerPallet);
    const byCeiling = [...g].sort((a, z) => a.maxPerPallet - z.maxPerPallet);
    expect(byPrice.map((c) => c.carrier)).not.toEqual(byCeiling.map((c) => c.carrier));
    // Standard takes the heaviest pallet, express the lightest.
    expect(g.find((c) => c.service === 'Road standard')!.maxPerPallet).toBe(750);
    expect(g.find((c) => c.service === 'Road express')!.maxPerPallet).toBe(400);
  });
});

describe('weight bands on the Germany lane, 1 pallet', () => {
  it('380 kg leaves 3 survivors and picks Carrier C on speed', () => {
    const b = germany(1, 380, 'Fastest');
    expect(feasibility(b).survivors).toHaveLength(3);
    const r = recommend(b);
    expect(r.winner?.row.carrier).toBe('Carrier C');
    expect(r.excluded).toHaveLength(0);
  });

  it('450 kg leaves 2 survivors with Carrier C excluded', () => {
    const b = germany(1, 450, 'Fastest');
    const f = feasibility(b);
    expect(f.survivors).toHaveLength(2);
    const r = recommend(b);
    expect(r.excluded.map((e) => e.row.carrier)).toEqual(['Carrier C']);
    expect(r.excluded[0].ceiling).toBe(400);
    expect(r.winner?.row.carrier).toBe('Carrier B');
    expect(r.reason).toMatch(/caps at 400 kg a pallet/);
  });

  it('600 kg leaves Carrier B alone, so there is nothing to rank', () => {
    const b = germany(1, 600, 'Cheapest');
    const r = recommend(b);
    expect(feasibility(b).survivors).toHaveLength(1);
    expect(r.winner?.row.carrier).toBe('Carrier B');
    expect(r.nothingToRank).toBe(true);
    expect(r.runnerUp).toBeNull();
    expect(r.reason).toMatch(/nothing to rank/i);
    expect(r.excluded).toHaveLength(2);
  });

  it('800 kg leaves nothing and turns R-05 Red', () => {
    const b = germany(1, 800);
    expect(feasibility(b).survivors).toHaveLength(0);
    const r = recommend(b);
    expect(r.feasible).toBe(false);
    expect(r.winner).toBeNull();
    const issues = validate(b);
    const r05 = issues.find((i) => i.rule === 'R-05');
    expect(r05?.severity).toBe('Red');
    expect(palletFixFor(b)).toEqual({
      pallets: 2, kgPerPallet: 400,
      opens: ['Carrier A road economy', 'Carrier B road standard', 'Carrier C road express'],
    });
  });
});

describe('priority sweep, Germany, 3 pallets, 600 kg', () => {
  const cases: Array<[Priority, string, number]> = [
    ['Cheapest', 'Carrier A', 540],
    ['Fastest', 'Carrier C', 1020],
    ['Most reliable', 'Carrier C', 1020],
    ['Balanced', 'Carrier B', 660],
  ];
  for (const [priority, carrier, cost] of cases) {
    it(`${priority} picks ${carrier} at £${cost}`, () => {
      const r = recommend(germany(3, 600, priority));
      expect(r.winner?.row.carrier).toBe(carrier);
      expect(r.winner?.cost).toBe(cost);
    });
  }

  it('Balanced scores Carrier B at 0.65', () => {
    const r = recommend(germany(3, 600, 'Balanced'));
    expect(r.winner?.score).toBe(0.65);
    const a = r.ranked.find((x) => x.row.carrier === 'Carrier A')!;
    const c = r.ranked.find((x) => x.row.carrier === 'Carrier C')!;
    expect(a.score).toBe(0.4);
    expect(c.score).toBe(0.6);
  });

  it('normalises across survivors only, not the whole lane', () => {
    // At 450 kg a pallet Carrier C is gone, so Carrier B becomes the dearest
    // and must score 0 on cost rather than keeping its three-way score.
    const r = recommend(germany(1, 450, 'Cheapest'));
    expect(r.ranked.map((x) => x.row.carrier)).toEqual(['Carrier A', 'Carrier B']);
    expect(r.ranked[0].costScore).toBe(1);
    expect(r.ranked[1].costScore).toBe(0);
  });

  it('scores 1 when every survivor is identical on a measure', () => {
    const r = recommend(germany(1, 600, 'Cheapest'));
    expect(r.ranked[0].costScore).toBe(1);
    expect(r.ranked[0].speedScore).toBe(1);
    expect(r.ranked[0].reliabilityScore).toBe(1);
  });
});

describe('tie-breaks', () => {
  it('Cheapest breaks a tie on the shorter transit', () => {
    const r = recommend(germany(1, 100, 'Cheapest'), { cost: 0, speed: 0, reliability: 0 });
    expect(r.ranked[0].row.days).toBe(2);
  });

  it('Fastest breaks a tie on the lower cost', () => {
    const b = germany(1, 100, 'Fastest');
    const r = recommend(b, { cost: 0, speed: 0, reliability: 0 });
    expect(r.ranked[0].cost).toBe(180);
  });

  it('Balanced breaks a tie on the better on-time rate', () => {
    const r = recommend(germany(1, 100, 'Balanced'), { cost: 0, speed: 0, reliability: 0 });
    expect(r.ranked[0].row.onTime).toBe(98);
  });
});

describe('missing priority', () => {
  it('is treated as Balanced and labelled a default', () => {
    const r = recommend(germany(3, 600, ''));
    expect(r.priority).toBe('Balanced');
    expect(r.priorityDefaulted).toBe(true);
    expect(r.weights).toEqual(PRIORITY_WEIGHTS.Balanced);
    expect(r.winner?.row.carrier).toBe('Carrier B');
    expect(r.reason).toMatch(/the default, since no preference was given/);
  });

  it('is not labelled a default when the seller actually said it', () => {
    const r = recommend(germany(3, 600, 'Balanced'));
    expect(r.priorityDefaulted).toBe(false);
    expect(r.reason).not.toMatch(/default/);
  });
});

describe('not enough information', () => {
  it('asks for the weight rather than ranking on nothing', () => {
    const b = { ...germany(3, 600), grossWeight: null };
    const r = recommend(b);
    expect(r.incomplete).toBe(true);
    expect(r.incompleteReason).toMatch(/gross weight/);
    expect(r.winner).toBeNull();
  });

  it('says so when the lane is not priced', () => {
    const b = { ...germany(3, 600), destCity: 'Madrid', destCountry: 'Spain' };
    const r = recommend(b);
    expect(r.incomplete).toBe(true);
    expect(r.incompleteReason).toMatch(/Spain/);
  });

  it('does not fire R-05 when there is nothing to measure', () => {
    const b = { ...germany(3, 600), grossWeight: null };
    expect(validate(b).some((i) => i.rule === 'R-05')).toBe(false);
  });
});

describe('the runner-up trade-off is stated in words', () => {
  it('names the money, the days and the on-time difference', () => {
    const r = recommend(germany(3, 600, 'Cheapest'));
    expect(r.runnerUp?.row.carrier).toBe('Carrier B');
    expect(r.runnerUpTradeoff).toContain('£120 more');
    expect(r.runnerUpTradeoff).toContain('2 days faster');
    expect(r.runnerUpTradeoff).toContain('3 points better on time');
  });
});

describe('every lane prices every priority without throwing', () => {
  it('covers 3 lanes x 4 priorities x 4 weights', () => {
    for (const dest of ['Germany', 'France', 'Netherlands']) {
      for (const p of ['Cheapest', 'Fastest', 'Most reliable', 'Balanced'] as Priority[]) {
        for (const w of [100, 450, 600, 800]) {
          const b = { ...germany(1, w, p), destCountry: dest, destCity: 'Berlin' };
          const r = recommend(b);
          if (w === 800) expect(r.feasible).toBe(false);
          else expect(r.winner).not.toBeNull();
        }
      }
    }
  });
});
