import { describe, expect, it } from 'vitest';
import {
  BOOKING_HEADER, ITEM_HEADER, buildJudgeWorkbook, judgeSheets,
} from './judge-sample';
import {
  BOOKING_HEADERS, ITEM_HEADERS, exampleRowFromNotice, findHeaderRow,
  mapHeaders, parseWorkbook,
} from '../parse-xlsx';
import { applyAllFixes, check, validate } from '../rules';
import { serviceName } from '../carriers';
import { cloneBooking } from '../fixtures';
import type { Booking } from '../types';

const TODAY = new Date(2026, 9, 26); // 26 October 2026

async function load(): Promise<Map<string, Booking>> {
  const bytes = await buildJudgeWorkbook();
  const parsed = await parseWorkbook(bytes.buffer as ArrayBuffer);
  return new Map(parsed.bookings.map((b) => [b.id, b]));
}

const rulesOf = (b: Booking) =>
  [...new Set(validate(b, TODAY).map((i) => i.rule))].sort();

describe('the judges upload template layout', () => {
  it('finds the column names on row 2, not row 1', () => {
    const { bookings, items } = judgeSheets();
    expect(findHeaderRow(bookings, BOOKING_HEADERS)).toBe(1);
    expect(findHeaderRow(items, ITEM_HEADERS)).toBe(1);
  });

  it('reads the example row number out of the sheet.s own notice', () => {
    const { bookings } = judgeSheets();
    expect(exampleRowFromNotice(bookings, 1)).toBe(3);
    expect(exampleRowFromNotice([['no notice here'], []], 1)).toBeNull();
  });

  it('maps every template column name onto a field', () => {
    const b = mapHeaders(BOOKING_HEADER, BOOKING_HEADERS);
    expect(b.unknown).toEqual([]);
    expect(b.map.seller).toBe('Seller name');
    expect(b.map.readyDate).toBe('Ready to ship date');
    expect(b.map.priority).toBe('Seller priority');
    expect(b.map.declaredValue).toBe('Total declared value');
    expect(b.map.grossWeight).toBe('Total gross weight (kg)');
    expect(b.map.appointment).toBe('Delivery appointment booked');

    const i = mapHeaders(ITEM_HEADER, ITEM_HEADERS);
    expect(i.unknown).toEqual([]);
    expect(i.map.quantity).toBe('Quantity (units)');
    expect(i.map.unitWeight).toBe('Unit weight (kg)');
    expect(i.map.hsCode).toBe('HS code');
  });

  it('loads the ten bookings and drops the grey example from both sheets', async () => {
    const bytes = await buildJudgeWorkbook();
    const parsed = await parseWorkbook(bytes.buffer as ArrayBuffer);
    expect(parsed.bookings.map((b) => b.id)).toEqual([
      'BK-101', 'BK-102', 'BK-103', 'BK-104', 'BK-105',
      'BK-106', 'BK-107', 'BK-108', 'BK-109', 'BK-110',
    ]);
    expect(parsed.droppedExampleRows).toBe(2);
    // Dropping is never silent.
    expect(parsed.warnings.filter((w) => w.kind === 'example-row')).toHaveLength(2);
    expect(parsed.warnings.filter((w) => w.kind === 'header-row')).toHaveLength(2);
    expect(parsed.bookings.every((b) => b.items.length > 0)).toBe(true);
    expect(parsed.warnings.filter((w) => w.kind === 'orphan-item')).toHaveLength(0);
  });
});

describe('every rule fires at least once across the sample', () => {
  it('covers R-01 to R-10', async () => {
    const byId = await load();
    const fired = new Set<string>();
    for (const b of byId.values()) for (const i of validate(b, TODAY)) fired.add(i.rule);
    expect([...fired].sort()).toEqual([
      'R-01', 'R-02', 'R-03', 'R-04', 'R-05', 'R-06', 'R-07', 'R-08', 'R-09', 'R-10',
    ]);
  });
});

describe('each booking lands exactly where it should', () => {
  it('BK-101 — the header counted one item.s cartons only', async () => {
    const b = (await load()).get('BK-101')!;
    expect(rulesOf(b)).toEqual(['R-04']);
    const r = check(b, TODAY);
    expect(r.issues[0].branch).toBe('header');
    expect(r.issues[0].fix?.label).toBe('Set booking cartons to 96');
    expect(serviceName(r.recommendation.winner!.row)).toBe('Carrier A road economy');
    expect(r.recommendation.winner!.cost).toBe(540);
  });

  it('BK-102 — one price and one carton count, four rules', async () => {
    const b = (await load()).get('BK-102')!;
    expect(rulesOf(b)).toEqual(['R-02', 'R-03', 'R-04', 'R-07']);
    const issues = validate(b, TODAY);
    expect(issues.find((i) => i.rule === 'R-02')!.fix?.label).toBe('Set TEE-10 unit price to £10.00');
    expect(issues.find((i) => i.rule === 'R-03')!.fix?.label).toBe('Set SOK-03 cartons to 10');
    expect(issues.find((i) => i.rule === 'R-04')!.branch).toBe('single-item');
    expect(check(b, TODAY).recommendation.winner!.cost).toBe(400);
  });

  it('BK-103 — nothing on the lane will take it', async () => {
    const b = (await load()).get('BK-103')!;
    expect(rulesOf(b)).toEqual(['R-01', 'R-05', 'R-08', 'R-09', 'R-10']);
    const r = check(b, TODAY);
    expect(r.recommendation.feasible).toBe(false);
    expect(r.recommendation.excluded).toHaveLength(3);
    expect(validate(b, TODAY).find((i) => i.rule === 'R-01')!.fix?.label)
      .toBe('Set COF-01 HS code to 090121');

    const fixed = cloneBooking(b);
    expect(applyAllFixes(fixed, TODAY)).toBe(4);
    expect(validate(fixed, TODAY).map((i) => i.rule)).toEqual(['R-09']);
    expect(check(fixed, TODAY).recommendation.winner!.cost).toBe(660);
  });

  it('BK-104 — a power bank, by word and by heading', async () => {
    const b = (await load()).get('BK-104')!;
    expect(rulesOf(b)).toEqual(['R-06']);
    const i = validate(b, TODAY)[0];
    expect(i.diagnosis).toMatch(/power bank/);
    expect(i.diagnosis).toMatch(/8507/);
    expect(i.fix).toBeNull();
    expect(check(b, TODAY).recommendation.winner!.cost).toBe(320);
  });

  it('BK-105 — clean, and says so', async () => {
    const b = (await load()).get('BK-105')!;
    expect(validate(b, TODAY)).toEqual([]);
    expect(check(b, TODAY).verdict).toBe('Clear');
    expect(check(b, TODAY).recommendation.winner!.cost).toBe(340);
  });

  it('BK-106 — a zero slipped on the booking total', async () => {
    const b = (await load()).get('BK-106')!;
    expect(rulesOf(b)).toEqual(['R-02']);
    const i = validate(b, TODAY)[0];
    expect(i.branch).toBe('header-zero');
    expect(i.confidence).toBe('High');
    expect(i.fix?.label).toBe('Set declared value to £6,400');
    expect(check(b, TODAY).recommendation.winner!.cost).toBe(420);
  });

  it('BK-107 — the pack size is wrong, and express is too light for the load', async () => {
    const b = (await load()).get('BK-107')!;
    expect(rulesOf(b)).toEqual(['R-03']);
    const i = validate(b, TODAY)[0];
    expect(i.branch).toBe('packsize');
    expect(i.confidence).toBe('Medium');
    expect(i.fix?.label).toBe('Set JAR-11 pack size to 15 a carton');
    const r = check(b, TODAY);
    expect(r.recommendation.excluded.map((e) => e.row.carrier)).toEqual(['Carrier C']);
    expect(r.recommendation.winner!.cost).toBe(660);
  });

  it('BK-108 — a blank code gets a suggestion, never a fix', async () => {
    const b = (await load()).get('BK-108')!;
    expect(rulesOf(b)).toEqual(['R-01']);
    const i = validate(b, TODAY)[0];
    expect(i.branch).toBe('blank');
    expect(i.fix).toBeNull();
    expect(i.suggestion).toMatch(/340600/);
    expect(i.suggestion).toMatch(/legal responsibility/i);
    expect(check(b, TODAY).recommendation.winner!.cost).toBe(680);
  });

  it('BK-109 — four problems at once, two of them blocking', async () => {
    const b = (await load()).get('BK-109')!;
    expect(rulesOf(b)).toEqual(['R-04', 'R-05', 'R-08', 'R-10']);
    const r = check(b, TODAY);
    expect(r.redCount).toBe(2);
    expect(r.amberCount).toBe(2);
    expect(r.recommendation.feasible).toBe(false);
    expect(validate(b, TODAY).find((i) => i.rule === 'R-05')!.fix?.label).toBe('Re-plan on 5 pallets');
  });

  it('BK-110 — perfume, by word and by heading 3303', async () => {
    const b = (await load()).get('BK-110')!;
    expect(rulesOf(b)).toEqual(['R-06']);
    expect(validate(b, TODAY)[0].diagnosis).toMatch(/3303/);
    expect(check(b, TODAY).recommendation.winner!.cost).toBe(220);
  });
});

describe('the fixes converge across the whole sample', () => {
  it('every booking stops needing fixes, and none loops', async () => {
    const byId = await load();
    for (const [id, b] of byId) {
      const copy = cloneBooking(b);
      const applied = applyAllFixes(copy, TODAY, { limit: 50 });
      expect(applied, id).toBeLessThan(50);
      expect(applyAllFixes(copy, TODAY, { limit: 50 }), id).toBe(0);
    }
  });

  it('the corrected set leaves only what needs a human', async () => {
    const byId = await load();
    const left = new Set<string>();
    for (const b of byId.values()) {
      const copy = cloneBooking(b);
      applyAllFixes(copy, TODAY);
      for (const i of validate(copy, TODAY)) left.add(i.rule);
    }
    // R-06 and a blank origin or commodity code cannot be fixed from here.
    expect([...left].sort()).toEqual(['R-01', 'R-06', 'R-09']);
  });
});
