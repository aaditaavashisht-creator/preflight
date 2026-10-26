import { describe, expect, it } from 'vitest';
import {
  RULE_CARDS, bandOf, toBook, toCountTask, toFindings, toQueueStats, toShipment, toStageLoad,
  type Entry,
} from '../dashboard';
import { blankBooking, makeFixtures } from '../fixtures';
import { RULE_IDS, RULES, check } from '../rules';
import type { Booking } from '../types';

const TODAY = new Date(2026, 5, 1); // 1 June 2026

function entries(bookings: Booking[]): Entry[] {
  return bookings.map((booking) => ({ booking, result: check(booking, TODAY) }));
}
const demo = () => entries(makeFixtures(TODAY));
const book = () => toBook(demo(), TODAY);
const row = (id: string) => {
  const found = book().shipments.find((s) => s.id === id);
  if (!found) throw new Error(`no row ${id}`);
  return found;
};

describe('a shipment row says what the engine said', () => {
  it('carries one verdict per rule, in R-01 to R-10 order', () => {
    for (const s of book().shipments) {
      expect(s.rules).toHaveLength(RULE_IDS.length);
      expect(RULE_IDS).toEqual(['R-01', 'R-02', 'R-03', 'R-04', 'R-05', 'R-06', 'R-07', 'R-08', 'R-09', 'R-10']);
    }
  });

  it('reports a rule that could not be tested as n/a, never as a pass', () => {
    // BK-104 goes to a business address, so the appointment rule never ran.
    expect(row('BK-104').rules[7]).toBe('na');
    expect(row('BK-105').rules[7]).toBe('na');
  });

  it('marks the failing rules red and the cost flags amber', () => {
    const bk102 = row('BK-102');
    expect(bk102.rules[1]).toBe('fail'); // R-02 declared value
    expect(bk102.rules[2]).toBe('fail'); // R-03 pack-out
    expect(bk102.rules[3]).toBe('fail'); // R-04 carton totals
    expect(bk102.rules[6]).toBe('warn'); // R-07 gross under net
    expect(bk102.rules[0]).toBe('pass');
  });

  it('names the failing rules in the tally', () => {
    expect(row('BK-102').tally).toBe('R-02, R-03, R-04 blocking');
    expect(row('BK-101').tally).toBe('R-04 blocking');
  });

  it('says what was not applicable rather than claiming all ten passed', () => {
    expect(row('BK-105').tally).toBe('9 rules pass, 1 not applicable');
  });

  it('holds a booking at the stage the readiness pipeline holds it', () => {
    expect(row('BK-102').stage).toBe('Paperwork clear');
    expect(row('BK-101').stage).toBe('Counts agree');
    expect(row('BK-104').stage).toBe('Freight accepted');
    expect(row('BK-105').stage).toBe('Clear');
  });

  it('leaves the money empty rather than showing a zero', () => {
    expect(row('BK-105').riskGbp).toBeNull();
    expect(row('BK-102').riskGbp).toBe(check(makeFixtures(TODAY)[1], TODAY).exposure);
  });

  it('falls back on a booking with no route or seller typed yet', () => {
    const blank = blankBooking('BK-NEW');
    const s = toShipment({ booking: blank, result: check(blank, TODAY) });
    expect(s.lane).toBe('Route not stated');
    expect(s.seller).toBe('Seller not stated');
  });
});

describe('the bands a row can sit in', () => {
  it('splits the book into blocked, caution and clear with nothing left over', () => {
    const b = book();
    expect(b.counts.blocked + b.counts.caution + b.counts.clear).toBe(b.counts.all);
    expect(b.counts.all).toBe(5);
  });

  it('calls a booking with only cost flags caution, not clear', () => {
    const [onlyAmber] = makeFixtures(TODAY).filter((x) => x.id === 'BK-101');
    onlyAmber.cartons = 96; // clears R-04, the one red
    onlyAmber.grossWeight = 1; // gross below net, an amber
    const s = toShipment({ booking: onlyAmber, result: check(onlyAmber, TODAY) });
    expect(s.blocked).toBe(false);
    expect(bandOf(s)).toBe('caution');
  });
});

describe('the totals above the table', () => {
  it('counts every red issue as a blocking failure and every amber as a cost flag', () => {
    const es = demo();
    const all = es.flatMap((e) => e.result.issues);
    const b = toBook(es, TODAY);
    expect(b.blockingFailures).toBe(all.filter((i) => i.severity === 'Red').length);
    expect(b.costFlags).toBe(all.filter((i) => i.severity === 'Amber').length);
  });

  it('adds the exposure up to exactly what the per-booking results add up to', () => {
    const es = demo();
    const sum = es.reduce((n, e) => n + e.result.exposure, 0);
    expect(toBook(es, TODAY).totalExposure).toBeCloseTo(sum, 2);
  });

  it('shares out the exposure so the slices total 100%', () => {
    const b = book();
    const widths = b.exposure.map((e) => Number.parseFloat(e.width));
    expect(widths.reduce((n, w) => n + w, 0)).toBeCloseTo(100, 0);
    expect(b.exposure.every((e) => e.amount > 0)).toBe(true);
  });

  it('orders the book worst first, severity before money', () => {
    expect(book().shipments.map((s) => s.id)).toEqual([
      'BK-102', 'BK-103', 'BK-101', 'BK-104', 'BK-105',
    ]);
  });
});

describe('the prose is generated, not written in', () => {
  it('names the booking carrying the most money', () => {
    const b = book();
    expect(b.moneyBlurb).toContain('Orrell Textiles');
    expect(b.moneyBlurb).toContain('BK-102');
  });

  it('lists the bookings to act on, worst first', () => {
    const b = book();
    expect(b.priorities.map((p) => p.id)).toEqual(['BK-102', 'BK-103', 'BK-101', 'BK-104']);
    expect(b.priorities[0].why).toContain('3 blocking rules');
    expect(b.priorities[0].why).toContain('largest single exposure');
    expect(b.priorities[2].why).toContain('1 blocking rule');
  });

  it('never claims a clear booking needs doing first', () => {
    expect(book().priorities.some((p) => p.id === 'BK-105')).toBe(false);
  });

  it('says so plainly when there is nothing loaded', () => {
    const b = toBook([], TODAY);
    expect(b.counts.all).toBe(0);
    expect(b.totalExposure).toBe(0);
    expect(b.exposure).toEqual([]);
    expect(b.priorities).toEqual([]);
    expect(b.moneyBlurb).toBe('Nothing in the book carries a cost estimate right now.');
    expect(b.clearNote).toBe('nothing loaded yet');
    expect(b.blurb).toContain('Nothing loaded yet');
  });

  it('does not talk about a share of the exposure when only one booking has any', () => {
    const one = makeFixtures(TODAY).filter((x) => x.id === 'BK-101');
    const b = toBook(entries(one), TODAY);
    expect(b.moneyBlurb).toContain('All of the exposure sits on');
    expect(b.clearNote).toBe('every booking has something on it');
  });

  it('dates the blurb off the day the check was run against', () => {
    expect(book().blurb).toBe('5 shipments in the book, treated as 01-06-2026. Worst first.');
  });
});

describe('the exception queue', () => {
  const findings = () => toFindings(demo());

  it('carries one entry per issue, not one per booking', () => {
    const all = demo().flatMap((e) => e.result.issues);
    expect(findings()).toHaveLength(all.length);
    expect(new Set(findings().map((f) => f.key)).size).toBe(all.length);
  });

  it('puts the blockers first, then the dearest', () => {
    const fs = findings();
    const lastStop = fs.map((f) => f.stops).lastIndexOf(true);
    const firstCost = fs.map((f) => f.stops).indexOf(false);
    expect(lastStop).toBeLessThan(firstCost === -1 ? Infinity : firstCost);
    const stops = fs.filter((f) => f.stops).map((f) => f.riskGbp);
    expect([...stops].sort((a, z) => z - a)).toEqual(stops);
  });

  it('says a person has to decide when the engine offers no fix', () => {
    const dg = findings().find((f) => f.rule === 'R-06');
    expect(dg).toBeDefined();
    expect(dg!.confidence).toBe('person');
    expect(dg!.fixNote).toBe('no safe one-click correction');
  });

  it('names the owner and the stage from the readiness pipeline', () => {
    const hs = findings().find((f) => f.rule === 'R-01')!;
    expect(hs.stage).toBe('Paperwork clear');
    expect(hs.owner).toBe('Seller, or their customs broker');
  });

  it('tells a finding what else is holding its booking', () => {
    const fs = findings();
    const bk102 = fs.filter((f) => f.shipmentId === 'BK-102');
    expect(bk102.length).toBeGreaterThan(1);
    expect(bk102[0].also).toBeTruthy();
    const solo = fs.find((f) => f.shipmentId === 'BK-101')!;
    expect(solo.also).toBeUndefined();
  });

  it('counts the one-click fixes apart from the decisions', () => {
    const fs = findings();
    const stats = toQueueStats(fs, toBook(demo(), TODAY).shipments);
    expect(stats.total).toBe(fs.length);
    expect(stats.oneClick + stats.needsPerson).toBe(stats.total);
    expect(stats.exposure).toBeCloseTo(fs.reduce((n, f) => n + f.riskGbp, 0), 2);
    expect(stats.quiet).toEqual(['BK-105']);
  });

  it('is empty, not broken, when nothing is loaded', () => {
    expect(toFindings([])).toEqual([]);
    const stats = toQueueStats([], []);
    expect(stats).toMatchObject({ total: 0, oneClick: 0, needsPerson: 0, bookings: 0, exposure: 0 });
  });
});

describe('the rule matrix', () => {
  it('offers a card for every rule, in rule order, with the rulebook wording', () => {
    expect(RULE_CARDS.map((r) => r.id)).toEqual(RULE_IDS);
    for (const card of RULE_CARDS) {
      const meta = RULES.find((r) => r.id === card.id)!;
      expect(card.title).toBe(meta.name);
      expect(card.why).toBe(meta.description);
      expect(card.stops).toBe(meta.severity === 'Red');
      expect(card.short.length).toBeGreaterThan(0);
    }
  });

  it('loads each stage with the bookings actually held there', () => {
    const load = toStageLoad(demo());
    expect(load.map((s) => s.name)).toEqual([
      'Declared', 'Paperwork clear', 'Counts agree', 'Freight accepted', 'Ready for collection',
    ]);
    const held = toBook(demo(), TODAY).shipments.filter((s) => s.stage !== 'Clear').length;
    expect(load.reduce((n, s) => n + s.count, 0)).toBe(held);
    expect(load.find((s) => s.name === 'Paperwork clear')!.count).toBe(2);
    expect(load.find((s) => s.name === 'Counts agree')!.owner).toBe('Whoever packed the cartons');
  });
});

describe('the warehouse count task', () => {
  it('finds the booking whose cartons do not reconcile', () => {
    const task = toCountTask(demo());
    expect(task).not.toBeNull();
    expect(task!.rule).toBe('R-04');
    expect(task!.bookingSays).not.toBe(task!.linesSay);
  });

  it('says whether the count is the last thing holding the booking', () => {
    const task = toCountTask(demo())!;
    const booking = makeFixtures(TODAY).find((b) => b.id === task.id)!;
    expect(task.onlyThing).toBe(check(booking, TODAY).issues.length === 1);
  });

  it('returns nothing when no booking has a carton dispute', () => {
    const clean = makeFixtures(TODAY).filter((b) => b.id === 'BK-105');
    expect(toCountTask(entries(clean))).toBeNull();
    expect(toCountTask([])).toBeNull();
  });
});

describe('the exposure split', () => {
  it('orders the slices by money, not by severity rank', () => {
    const amounts = book().exposure.map((e) => e.amount);
    expect([...amounts].sort((a, z) => z - a)).toEqual(amounts);
  });

  it('names the dearest booking in the blurb even when a cheaper one is worse', () => {
    // An amber-only booking carrying more money than every blocked one.
    const bs = makeFixtures(TODAY);
    const rich = bs.find((b) => b.id === 'BK-105')!;
    rich.appointment = 'No';
    rich.destType = 'Warehouse';
    rich.grossWeight = 1; // gross under net, an amber with a cost
    const b = toBook(entries(bs), TODAY);
    const dearest = [...b.shipments].sort((x, z) => (z.riskGbp ?? 0) - (x.riskGbp ?? 0))[0];
    expect(b.exposure[0].id).toBe(dearest.id);
  });

  it('lists every booking that needs work, with no silent cap', () => {
    const b = book();
    const needsWork = b.shipments.filter((s) => bandOf(s) !== 'clear').length;
    expect(b.priorities).toHaveLength(needsWork);
  });
});
