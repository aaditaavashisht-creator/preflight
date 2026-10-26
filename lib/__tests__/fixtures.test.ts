import { describe, expect, it } from 'vitest';
import { cloneBooking, makeFixtures } from '../fixtures';
import { applyAllFixes, validate, verdictOf } from '../rules';
import { feasibility, palletFixFor, recommend } from '../carrier';
import { detectDg } from '../diagnose';
import { round2 } from '../format';
import type { Booking } from '../types';

const TODAY = new Date(2026, 5, 1); // 1 June 2026

function fx(id: string): Booking {
  const b = makeFixtures(TODAY).find((x) => x.id === id);
  if (!b) throw new Error(`no fixture ${id}`);
  return b;
}
const rulesFired = (b: Booking) => [...new Set(validate(b, TODAY).map((i) => i.rule))].sort();
const issue = (b: Booking, rule: string, sku?: string) => {
  const found = validate(b, TODAY).find((i) => i.rule === rule && (sku === undefined || i.sku === sku));
  if (!found) throw new Error(`no ${rule}${sku ? ` for ${sku}` : ''} on ${b.id}`);
  return found;
};

describe('BK-101 Northfield Goods — the booking header is the typo', () => {
  const b = fx('BK-101');

  it('is Red on R-04 and nothing else', () => {
    expect(verdictOf(validate(b, TODAY))).toBe('Red');
    expect(rulesFired(b)).toEqual(['R-04']);
  });

  it('names the booking header, not the item rows', () => {
    const i = issue(b, 'R-04');
    expect(i.branch).toBe('header');
    expect(i.confidence).toBe('High');
    expect(i.diagnosis).toMatch(/header/i);
    expect(i.observed).toContain('90');
    expect(i.observed).toContain('96');
  });

  it('fix sets cartons 90 to 96', () => {
    const i = issue(b, 'R-04');
    expect(i.fix?.label).toBe('Set booking cartons to 96');
    const copy = cloneBooking(b);
    expect(copy.cartons).toBe(90);
    i.fix!.apply(copy);
    expect(copy.cartons).toBe(96);
    expect(validate(copy, TODAY)).toHaveLength(0);
  });

  it('recommends Carrier A road economy at £540 with nothing excluded', () => {
    const r = recommend(b);
    expect(r.feasible).toBe(true);
    expect(r.winner?.row.carrier).toBe('Carrier A');
    expect(r.winner?.row.service).toBe('Road economy');
    expect(r.winner?.cost).toBe(540);
    expect(r.excluded).toHaveLength(0);
  });
});

describe('BK-102 Orrell Textiles — one item price, one carton count', () => {
  const b = fx('BK-102');

  it('is Red on R-02, R-03, R-04 and R-07', () => {
    expect(verdictOf(validate(b, TODAY))).toBe('Red');
    expect(rulesFired(b)).toEqual(['R-02', 'R-03', 'R-04', 'R-07']);
  });

  it('R-02 names TEE-10 and proposes £10.00 rather than changing the header', () => {
    const i = issue(b, 'R-02');
    expect(i.branch).toBe('item-price');
    expect(i.sku).toBe('TEE-10');
    expect(i.confidence).toBe('High');
    expect(i.fix?.label).toBe('Set TEE-10 unit price to £10.00');
    expect(i.diagnosis).toMatch(/header is not the problem/i);
    const copy = cloneBooking(b);
    i.fix!.apply(copy);
    expect(copy.declaredValue).toBe(11600);
    expect(copy.items.find((x) => x.sku === 'TEE-10')?.unitPrice).toBe(10);
    expect(validate(copy, TODAY).some((x) => x.rule === 'R-02')).toBe(false);
  });

  it('R-03 on SOK-03 proposes cartons 12 to 10', () => {
    const i = issue(b, 'R-03', 'SOK-03');
    expect(i.branch).toBe('cartons');
    expect(i.fix?.label).toBe('Set SOK-03 cartons to 10');
    const copy = cloneBooking(b);
    i.fix!.apply(copy);
    expect(copy.items.find((x) => x.sku === 'SOK-03')?.cartons).toBe(10);
  });

  it('R-04 takes the one-item-failed-and-fixing-it-reconciles branch', () => {
    const i = issue(b, 'R-04');
    expect(i.branch).toBe('single-item');
    expect(i.sku).toBe('SOK-03');
    expect(i.confidence).toBe('High');
    expect(i.fix?.delta).toMatch(/closes R-03 and R-04/);
    const copy = cloneBooking(b);
    i.fix!.apply(copy);
    const after = validate(copy, TODAY).map((x) => x.rule);
    expect(after).not.toContain('R-03');
    expect(after).not.toContain('R-04');
  });

  it('recommends Carrier B road standard at £400', () => {
    const r = recommend(b);
    expect(r.winner?.row.carrier).toBe('Carrier B');
    expect(r.winner?.row.service).toBe('Road standard');
    expect(r.winner?.cost).toBe(400);
    expect(r.winner?.score).toBe(0.65);
  });
});

describe('BK-103 Severn Roasters — the heavy, late, unclassified one', () => {
  const b = fx('BK-103');

  it('is Red on R-01, R-05, R-08, R-09 and R-10', () => {
    expect(verdictOf(validate(b, TODAY))).toBe('Red');
    expect(rulesFired(b)).toEqual(['R-01', 'R-05', 'R-08', 'R-09', 'R-10']);
  });

  it('R-01 proposes 090121 and explains the dropped leading zero', () => {
    const i = issue(b, 'R-01');
    expect(i.branch).toBe('leading-zero');
    expect(i.confidence).toBe('High');
    expect(i.fix?.label).toBe('Set COF-01 HS code to 090121');
    expect(i.diagnosis).toMatch(/leading zero/i);
  });

  it('R-05 reports 800 kg a pallet, 0 of 3 surviving, and a 3 pallet re-plan at 533 kg', () => {
    const f = feasibility(b);
    expect(f.weightPerPallet).toBe(800);
    expect(f.all).toHaveLength(3);
    expect(f.survivors).toHaveLength(0);

    const pf = palletFixFor(b)!;
    expect(pf.pallets).toBe(3);
    expect(round2(pf.kgPerPallet)).toBe(533.33);
    expect(pf.opens).toEqual(['Carrier B road standard']);

    const i = issue(b, 'R-05');
    expect(i.severity).toBe('Red');
    expect(i.fix?.label).toBe('Re-plan on 3 pallets');
    expect(i.fix?.delta).toBe('opens 1 service');
  });

  it('has no feasible carrier as it stands', () => {
    const r = recommend(b);
    expect(r.feasible).toBe(false);
    expect(r.winner).toBeNull();
    expect(r.ranked).toHaveLength(0);
    expect(r.excluded).toHaveLength(3);
  });

  it('converges in 4 fixes and leaves only R-09', () => {
    const copy = cloneBooking(b);
    const applied = applyAllFixes(copy, TODAY);
    expect(applied).toBe(4);
    const left = validate(copy, TODAY);
    expect(left).toHaveLength(1);
    expect(left[0].rule).toBe('R-09');
    expect(left[0].fix).toBeNull();
  });

  it('after the fixes it travels on Carrier B road standard at £660 with 2 excluded on weight', () => {
    const copy = cloneBooking(b);
    applyAllFixes(copy, TODAY);
    const r = recommend(copy);
    expect(r.feasible).toBe(true);
    expect(r.winner?.row.carrier).toBe('Carrier B');
    expect(r.winner?.row.service).toBe('Road standard');
    expect(r.winner?.cost).toBe(660);
    expect(r.excluded).toHaveLength(2);
    expect(r.nothingToRank).toBe(true);
    expect(r.reason).toMatch(/nothing to rank/i);
  });
});

describe('BK-104 Kitfield Electronics — dangerous goods', () => {
  const b = fx('BK-104');

  it('is Red on R-06 and nothing else', () => {
    expect(verdictOf(validate(b, TODAY))).toBe('Red');
    expect(rulesFired(b)).toEqual(['R-06']);
  });

  it('fires both the keyword detector and the HS 8507 detector', () => {
    const dg = detectDg(b.items[0]);
    expect(dg.hit).toBe(true);
    expect(dg.keywords).toContain('power bank');
    expect(dg.headings).toEqual(['8507']);
    const i = issue(b, 'R-06');
    expect(i.diagnosis).toMatch(/power bank/);
    expect(i.diagnosis).toMatch(/8507/);
    expect(i.diagnosis).toMatch(/dangerous goods declaration/i);
    expect(i.fix).toBeNull();
  });

  it('recommends Carrier C road express at £320', () => {
    const r = recommend(b);
    expect(r.winner?.row.carrier).toBe('Carrier C');
    expect(r.winner?.row.service).toBe('Road express');
    expect(r.winner?.cost).toBe(320);
  });
});

describe('BK-105 Harrow Home — clear', () => {
  const b = fx('BK-105');

  it('has no issues at all', () => {
    expect(validate(b, TODAY)).toEqual([]);
    expect(verdictOf(validate(b, TODAY))).toBe('Clear');
  });

  it('recommends Carrier A road economy at £340', () => {
    const r = recommend(b);
    expect(r.winner?.row.carrier).toBe('Carrier A');
    expect(r.winner?.row.service).toBe('Road economy');
    expect(r.winner?.cost).toBe(340);
  });
});

describe('fixtures as a set', () => {
  it('applying fixes terminates on every fixture', () => {
    for (const b of makeFixtures(TODAY)) {
      const copy = cloneBooking(b);
      const first = applyAllFixes(copy, TODAY, { limit: 50 });
      expect(first).toBeLessThan(50);
      expect(applyAllFixes(copy, TODAY, { limit: 50 })).toBe(0);
    }
  });

  it('the high-confidence-only pass never touches an issue that needs judgement', () => {
    const b = cloneBooking(fx('BK-103'));
    applyAllFixes(b, TODAY, { highConfidenceOnly: true });
    // R-08 and R-10 both need a human decision, so they survive the corrected sheet.
    const left = validate(b, TODAY).map((i) => i.rule).sort();
    expect(left).toEqual(['R-08', 'R-09', 'R-10']);
  });

  it('dates are relative to the day passed in', () => {
    const a = makeFixtures(new Date(2026, 0, 10)).find((x) => x.id === 'BK-101')!;
    expect(a.readyDate?.getTime()).toBe(new Date(2026, 0, 21).getTime());
    const late = makeFixtures(new Date(2026, 0, 10)).find((x) => x.id === 'BK-103')!;
    expect(late.readyDate?.getTime()).toBe(new Date(2026, 0, 5).getTime());
  });
});
