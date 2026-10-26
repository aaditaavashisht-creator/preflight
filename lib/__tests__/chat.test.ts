import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyExtraction, deriveTotals, extract, extractDate, extractRelative,
  looksLikeItemLine, missingFields, nextQuestion, parseItemLine,
  resetItemCounter, toMoney, toNumber,
} from '../parse-chat';
import { blankBooking } from '../fixtures';
import { fmtDate } from '../format';
import { validate } from '../rules';
import { recommend } from '../carrier';
import type { Booking } from '../types';

const TODAY = new Date(2026, 5, 1); // Monday 1 June 2026

function fresh(): Booking { return blankBooking('BK-CHAT'); }
function say(b: Booking, text: string) {
  return applyExtraction(b, extract(text, b, TODAY));
}

beforeEach(() => resetItemCounter(0));

describe('numbers', () => {
  it('reads digits and words', () => {
    expect(toNumber('3')).toBe(3);
    expect(toNumber('1,080')).toBe(1080);
    expect(toNumber('three')).toBe(3);
    expect(toNumber('twenty four')).toBe(24);
    expect(toNumber('a')).toBe(1);
    expect(toNumber('banana')).toBeNull();
  });

  it('reads £7.2k', () => {
    expect(toMoney('7.2', 'k')).toBe(7200);
    expect(toMoney('7,200')).toBe(7200);
  });
});

describe('dates', () => {
  it('reads an explicit DD-MM-YYYY day first', () => {
    expect(fmtDate(extractDate('ready 05-11-2026', TODAY))).toBe('05-11-2026');
    expect(extractDate('ready 05-11-2026', TODAY)!.getMonth()).toBe(10);
  });

  it('reads the 5th of November, 5 Nov and November 5', () => {
    expect(fmtDate(extractDate('the 5th of November', TODAY))).toBe('05-11-2026');
    expect(fmtDate(extractDate('ready 5 Nov', TODAY))).toBe('05-11-2026');
    expect(fmtDate(extractDate('November 5th', TODAY))).toBe('05-11-2026');
  });

  it('rolls a bare day and month forward only when more than 14 days past', () => {
    // 1 June 2026 is "today". 20 May is 12 days past, so it stays in 2026.
    expect(fmtDate(extractDate('20 May', TODAY))).toBe('20-05-2026');
    // 1 May is 31 days past, so it rolls to next year.
    expect(fmtDate(extractDate('1 May', TODAY))).toBe('01-05-2027');
  });

  it('reads tomorrow, in 7 days and next Monday', () => {
    expect(fmtDate(extractDate('tomorrow', TODAY))).toBe('02-06-2026');
    expect(fmtDate(extractDate('in 7 days', TODAY))).toBe('08-06-2026');
    expect(fmtDate(extractDate('in two weeks', TODAY))).toBe('15-06-2026');
    // Today IS a Monday, so "next Monday" is the next one, not today.
    expect(fmtDate(extractDate('next Monday', TODAY))).toBe('08-06-2026');
    expect(fmtDate(extractDate('on Friday', TODAY))).toBe('05-06-2026');
  });

  it('returns null rather than guessing', () => {
    expect(extractDate('sometime soonish', TODAY)).toBeNull();
  });
});

describe('one message, every field at once', () => {
  it('reads a whole shipment out of one sentence', () => {
    const b = fresh();
    say(b, 'We are Northfield Goods, shipping 3 pallets from Manchester to Frankfurt, 700 kg, £6,480, to a warehouse, slot is booked, ready 5 Nov, cheapest please');
    expect(b.seller).toBe('Northfield Goods');
    expect(b.originCity).toBe('Manchester');
    expect(b.originCountry).toBe('United Kingdom');
    expect(b.destCity).toBe('Frankfurt');
    expect(b.destCountry).toBe('Germany');
    expect(b.pallets).toBe(3);
    expect(b.grossWeight).toBe(700);
    expect(b.declaredValue).toBe(6480);
    expect(b.destType).toBe('Warehouse');
    expect(b.appointment).toBe('Yes');
    expect(fmtDate(b.readyDate)).toBe('05-11-2026');
    expect(b.priority).toBe('Cheapest');
  });

  it('reads the route stated the other way round', () => {
    const b = fresh();
    say(b, 'Going to Amsterdam, collecting from Leeds');
    expect(b.originCity).toBe('Leeds');
    expect(b.destCity).toBe('Amsterdam');
    expect(b.destCountry).toBe('Netherlands');
  });

  it('reads three pallets as well as 3 pallets', () => {
    const a = fresh(); say(a, 'three pallets');
    const z = fresh(); say(z, '3 pallets');
    expect(a.pallets).toBe(3);
    expect(z.pallets).toBe(3);
  });

  it('reads kg, kilos and kilograms', () => {
    for (const unit of ['kg', 'kilos', 'kilograms', 'kgs']) {
      const b = fresh();
      say(b, `it weighs 240 ${unit}`);
      expect(b.grossWeight).toBe(240);
    }
  });

  it('reads £7.2k', () => {
    const b = fresh();
    say(b, 'the goods are worth £7.2k');
    expect(b.declaredValue).toBe(7200);
  });

  it('reads priorities in ordinary words', () => {
    const cases: Array<[string, string]> = [
      ['we need it there urgently', 'Fastest'],
      ['keep it on a budget', 'Cheapest'],
      ['no strong preference', 'Balanced'],
      ["whatever's best", 'Balanced'],
      ['it has to arrive on time', 'Most reliable'],
    ];
    for (const [text, want] of cases) {
      const b = fresh();
      say(b, text);
      expect(b.priority, text).toBe(want);
    }
  });

  it('reads warehouse against business address', () => {
    const a = fresh(); say(a, 'delivering into their fulfilment centre');
    expect(a.destType).toBe('Warehouse');
    const z = fresh(); say(z, 'it goes to a business address');
    expect(z.destType).toBe('Business address');
  });

  it('reads a booked slot stated either way round', () => {
    const yes = ['the slot is booked', 'we booked a delivery slot', 'appointment confirmed', 'we have a slot'];
    const no = ['no slot booked', 'we have not booked a slot', 'the appointment is not booked', 'no appointment yet'];
    for (const t of yes) { const b = fresh(); say(b, t); expect(b.appointment, t).toBe('Yes'); }
    for (const t of no) { const b = fresh(); say(b, t); expect(b.appointment, t).toBe('No'); }
  });
});

describe('changing a detail mid-conversation', () => {
  it('takes an absolute change', () => {
    const b = fresh();
    say(b, '3 pallets');
    const changes = say(b, 'make it 4 pallets');
    expect(b.pallets).toBe(4);
    expect(changes.map((c) => c.label)).toContain('Pallets 3 to 4');
  });

  it('takes a relative change, and "add a pallet" does not become one pallet', () => {
    const b = fresh();
    say(b, '3 pallets');
    const changes = say(b, 'add a pallet');
    expect(b.pallets).toBe(4);
    expect(changes.map((c) => c.label)).toContain('Pallets 3 to 4');
  });

  it('lets the relative move win over a stray absolute match in the same sentence', () => {
    const b = fresh();
    say(b, '3 pallets');
    const e = extract('add a pallet', b, TODAY);
    expect(e.claimed).toContain('pallets');
    expect(e.patch.pallets).toBeUndefined();
  });

  it('drops two pallets', () => {
    const b = fresh();
    say(b, '5 pallets');
    say(b, 'actually drop two pallets');
    expect(b.pallets).toBe(3);
  });

  it('adds a carton and adds weight without touching anything else', () => {
    const b = fresh();
    say(b, '3 pallets, 90 cartons, 700 kg');
    say(b, 'add 10 cartons and add 50 kg');
    expect(b.pallets).toBe(3);
    expect(b.cartons).toBe(100);
    expect(b.grossWeight).toBe(750);
  });

  it('re-runs the rules and the ranking after a change', () => {
    const b = fresh();
    say(b, 'Shipping from Birmingham to Berlin, 2 pallets, 1600 kg, 60 cartons, £12,000, most reliable, business address, ready in 20 days');
    expect(validate(b, TODAY).some((i) => i.rule === 'R-05')).toBe(true);
    expect(recommend(b).feasible).toBe(false);

    say(b, 'add a pallet');
    expect(b.pallets).toBe(3);
    expect(validate(b, TODAY).some((i) => i.rule === 'R-05')).toBe(false);
    const r = recommend(b);
    expect(r.feasible).toBe(true);
    expect(r.winner?.row.carrier).toBe('Carrier B');
    expect(r.winner?.cost).toBe(660);
  });

  it('echoes every understood change as a capsule line', () => {
    const b = fresh();
    say(b, 'from London to Paris');
    const changes = say(b, 'make it Lyon, 4 pallets, fastest');
    const labels = changes.map((c) => c.label);
    expect(labels).toContain('Destination Paris to Lyon');
    expect(labels).toContain('Pallets set to 4');
    expect(labels).toContain('Priority set to Fastest');
  });

  it('says nothing when a message changes nothing', () => {
    const b = fresh();
    say(b, '3 pallets');
    expect(say(b, '3 pallets')).toEqual([]);
  });
});

describe('product lines', () => {
  it('recognises a product line and not a shipment line', () => {
    expect(looksLikeItemLine('1080 ceramic mugs at £5 each, 12 per carton, HS 691200, made in the UK')).toBe(true);
    expect(looksLikeItemLine('3 pallets from Manchester to Frankfurt, 700 kg')).toBe(false);
    expect(looksLikeItemLine('ready on 5 Nov')).toBe(false);
  });

  it('parses the spec example into a complete item', () => {
    const item = parseItemLine('1080 ceramic mugs at £5 each, 12 per carton, HS 691200, made in the UK')!;
    expect(item.quantity).toBe(1080);
    expect(item.unitPrice).toBe(5);
    expect(item.unitsPerCarton).toBe(12);
    expect(item.hsCode).toBe('691200');
    expect(item.countryOfOrigin).toBe('United Kingdom');
    expect(item.description.toLowerCase()).toContain('ceramic mugs');
  });

  it('strips the parsed numbers and the country out of the description', () => {
    const item = parseItemLine('1080 ceramic mugs at £5 each, 12 per carton, HS 691200, made in the UK')!;
    expect(item.description).not.toMatch(/1080|691200|£|5 each|12 per/);
    expect(item.description.toLowerCase()).not.toContain('united kingdom');
    expect(item.description.toLowerCase()).not.toContain(' uk');
  });

  it('reads unit weight in kg and in grams', () => {
    expect(parseItemLine('500 socks at £4 each, 50 per carton, 0.15 kg each')!.unitWeight).toBe(0.15);
    expect(parseItemLine('500 socks at £4 each, 50 per carton, 150 g each')!.unitWeight).toBe(0.15);
  });

  it('takes an explicit sku when one is given', () => {
    expect(parseItemLine('SKU MUG-01, 1080 mugs at £5 each, 12 per carton')!.sku).toBe('MUG-01');
  });

  it('adds the item to the booking and derives the totals it was not told', () => {
    const b = fresh();
    say(b, 'From Manchester to Frankfurt, 3 pallets, 700 kg');
    say(b, '1080 ceramic mugs at £5 each, 12 per carton, 90 cartons, HS 691200, made in the UK');
    expect(b.items).toHaveLength(1);
    expect(b.declaredValue).toBe(5400);
    expect(b.valueInferred).toBe(true);
    expect(b.cartons).toBe(90);
    expect(b.cartonsInferred).toBe(true);
  });

  it('keeps a stated total and does not mark it inferred', () => {
    const b = fresh();
    say(b, '£6,480, 96 cartons');
    say(b, '1080 ceramic mugs at £5 each, 12 per carton, 90 cartons, HS 691200');
    expect(b.declaredValue).toBe(6480);
    expect(b.valueInferred).toBe(false);
    expect(b.cartons).toBe(96);
    expect(b.cartonsInferred).toBe(false);
  });

  it('handles two product lines in one message', () => {
    const b = fresh();
    say(b, '1080 ceramic mugs at £5 each, 12 per carton, HS 691200; 72 ceramic trays at £15 each, 12 per carton, HS 691200');
    expect(b.items).toHaveLength(2);
    expect(b.items[0].quantity).toBe(1080);
    expect(b.items[1].quantity).toBe(72);
  });

  it('does not let a product line leak into the booking fields', () => {
    const b = fresh();
    say(b, '1080 ceramic mugs at £5 each, 12 per carton, HS 691200');
    // "£5" is a unit price, not a declared value of £5. "12 per carton" is not
    // a booking carton total.
    expect(b.declaredValue).toBe(5400);
    expect(b.cartons).toBeNull();
    expect(b.pallets).toBeNull();
  });
});

describe('asking only for what is missing, one question at a time', () => {
  it('never shows a blank form', () => {
    const b = fresh();
    const first = nextQuestion(b)!;
    expect(first.field).toBe('destCity');
    say(b, 'to Berlin');
    expect(nextQuestion(b)!.field).toBe('originCity');
  });

  it('skips everything a single message already answered', () => {
    const b = fresh();
    say(b, 'We are Harrow Home, from London to Paris, business address, 2 pallets, 410 kg, cheapest, ready in 16 days');
    say(b, '576 scented soy candles at £12.50 each, 12 per carton, 48 cartons, HS 340600, made in the UK');
    expect(missingFields(b)).toEqual([]);
    expect(nextQuestion(b)).toBeNull();
  });

  it('only asks about an appointment when it is going to a warehouse', () => {
    const b = fresh();
    say(b, 'from London to Paris, business address, 2 pallets, 410 kg, cheapest, tomorrow');
    say(b, '100 mugs at £5 each, 10 per carton, HS 691200');
    expect(missingFields(b)).not.toContain('appointment');
    b.destType = 'Warehouse';
    expect(missingFields(b)).toContain('appointment');
  });
});

describe('the conversation reaches the same engine as the spreadsheet', () => {
  it('builds BK-105 by conversation and gets the same answer', () => {
    const b = fresh();
    say(b, 'We are Harrow Home. Shipping from London to Paris, business address, no slot booked.');
    say(b, '576 scented soy candles at £12.50 each, 12 per carton, 48 cartons, HS 340600, made in the UK');
    say(b, '2 pallets, 410 kg, £7,200, cheapest, ready in 16 days');

    expect(validate(b, TODAY)).toEqual([]);
    const r = recommend(b);
    expect(r.winner?.row.carrier).toBe('Carrier A');
    expect(r.winner?.cost).toBe(340);
  });
});

describe('deriveTotals', () => {
  it('does nothing without items', () => {
    const b = fresh();
    deriveTotals(b);
    expect(b.declaredValue).toBeNull();
  });
});
