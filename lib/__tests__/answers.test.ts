import { describe, expect, it } from 'vitest';
import { answerQuestion, bookingIdIn, detectQuestion, respond, ruleIdIn } from '../answers';
import { makeFixtures } from '../fixtures';
import { extract, applyExtraction } from '../parse-chat';
import { blankBooking } from '../fixtures';

const TODAY = new Date(2026, 9, 26);
const ALL = makeFixtures(TODAY);
const fx = (id: string) => ALL.find((b) => b.id === id)!;

describe('spotting a question', () => {
  it('reads the booking id out of the question', () => {
    expect(bookingIdIn('BK-104 what is status of this booking id')).toBe('BK-104');
    expect(bookingIdIn('how is bk104 doing?')).toBe('BK-104');
    expect(bookingIdIn('tell me about booking 103')).toBe('BK-103');
    expect(bookingIdIn('3 pallets to Berlin')).toBeNull();
  });

  it('classifies the questions from the screenshots', () => {
    expect(detectQuestion('BK-104 what is status of this booking id'))
      .toMatchObject({ kind: 'status', bookingId: 'BK-104' });
    expect(detectQuestion('when is it likely to be shipped and delivered?'))
      .toMatchObject({ kind: 'timing' });
    expect(detectQuestion('what is the pallet condition'))
      .toMatchObject({ kind: 'pallets' });
  });

  it('covers the rest of the vocabulary', () => {
    expect(detectQuestion('which carrier should we use?')!.kind).toBe('carrier');
    expect(detectQuestion('how much is at risk?')!.kind).toBe('cost');
    expect(detectQuestion('what do I do next?')!.kind).toBe('next');
    expect(detectQuestion('what is wrong with it?')!.kind).toBe('issues');
    expect(detectQuestion('what does R-05 check?')).toMatchObject({ kind: 'rules', ruleId: 'R-05' });
    expect(ruleIdIn('explain r3')).toBe('R-03');
  });

  it('does not mistake a shipment detail for a question', () => {
    expect(detectQuestion('3 pallets from Manchester to Frankfurt, 700 kg')).toBeNull();
    expect(detectQuestion('add a pallet')).toBeNull();
    expect(detectQuestion('1080 ceramic mugs at £5 each, 12 per carton')).toBeNull();
    expect(detectQuestion('the slot is booked')).toBeNull();
  });

  it('still parses a shipment detail that a question pattern brushes against', () => {
    const b = blankBooking('BK-X');
    applyExtraction(b, extract('2 pallets, 410 kg', b, TODAY));
    expect(b.pallets).toBe(2);
    expect(b.grossWeight).toBe(410);
  });
});

describe('answers come from the engine, not from prose', () => {
  it('status gives the verdict, the issues, the carrier and the next steps', () => {
    const a = answerQuestion({ kind: 'status', bookingId: null, ruleId: null }, fx('BK-104'), TODAY);
    expect(a.summary).toContain('BK-104');
    expect(a.summary).toContain('Do not ship yet');
    const all = a.detail.join('\n');
    expect(all).toContain('R-06');
    expect(all).toMatch(/Recommended service: Carrier C road express at £320/);
    expect(all).toMatch(/Why: you asked for the fastest option/);
    expect(all).toMatch(/blocking item/);
    // R-06 is not a number anyone can retype, so it must not be described as one.
    expect(all).not.toMatch(/needs a number/);
    expect(all).toMatch(/No safe automatic fix for this one/);
  });

  it('status on a clean booking recommends and confirms', () => {
    const a = answerQuestion({ kind: 'status', bookingId: null, ruleId: null }, fx('BK-105'), TODAY);
    expect(a.summary).toContain('Clear to book');
    expect(a.summary).toContain('all ten checks pass');
    const all = a.detail.join('\n');
    expect(all).toMatch(/Carrier A road economy at £340/);
    expect(all).toMatch(/you asked for the cheapest option/);
    expect(all).toMatch(/Expect delivery around/);
  });

  it('timing works the collection and delivery dates out', () => {
    const a = answerQuestion({ kind: 'timing', bookingId: null, ruleId: null }, fx('BK-105'), TODAY);
    // ready today+16 = 11-11-2026, Carrier A is 5 working days -> 18-11-2026
    expect(a.summary).toContain('11-11-2026');
    expect(a.summary).toContain('18-11-2026');
    expect(a.detail.join('\n')).toMatch(/92% on time/);
  });

  it('timing refuses to invent dates for a past ready date', () => {
    const a = answerQuestion({ kind: 'timing', bookingId: null, ruleId: null }, fx('BK-103'), TODAY);
    expect(a.summary).toMatch(/cannot be scheduled/);
    expect(a.summary).toContain('5 days ago');
  });

  it('timing flags that dates assume the blockers clear', () => {
    const a = answerQuestion({ kind: 'timing', bookingId: null, ruleId: null }, fx('BK-101'), TODAY);
    expect(a.detail.join('\n')).toMatch(/assume the 1 blocking issue clear/);
  });

  it('pallets answers the weight question against every ceiling', () => {
    const a = answerQuestion({ kind: 'pallets', bookingId: null, ruleId: null }, fx('BK-103'), TODAY);
    expect(a.summary).toContain('800 kg a pallet');
    const all = a.detail.join('\n');
    expect(all).toMatch(/Carrier A road economy caps at 500 kg a pallet — too heavy, excluded/);
    expect(all).toMatch(/Carrier B road standard caps at 750 kg a pallet — too heavy, excluded/);
    expect(all).toMatch(/3 pallets/);
  });

  it('carrier names the service, the reason and the exclusions', () => {
    const a = answerQuestion({ kind: 'carrier', bookingId: null, ruleId: null }, fx('BK-102'), TODAY);
    expect(a.summary).toContain('Carrier B road standard at £400');
    expect(a.detail.join('\n')).toMatch(/balance of cost, speed and reliability/);
  });

  it('cost breaks the exposure down per rule', () => {
    const a = answerQuestion({ kind: 'cost', bookingId: null, ruleId: null }, fx('BK-102'), TODAY);
    expect(a.summary).toMatch(/at risk/);
    expect(a.detail.join('\n')).toMatch(/R-03: £400/);
    expect(a.detail.join('\n')).toMatch(/planning estimates/);
  });

  it('rules explains one rule against this booking', () => {
    const a = answerQuestion({ kind: 'rules', bookingId: null, ruleId: 'R-05' }, fx('BK-103'), TODAY);
    expect(a.summary).toContain('R-05');
    expect(a.summary).toMatch(/No service on this lane will take the pallets/);
    expect(a.detail.join('\n')).toMatch(/ceilings are not ordered by price/);
  });

  it('rules with no id lists all ten', () => {
    const a = answerQuestion({ kind: 'rules', bookingId: null, ruleId: null }, fx('BK-101'), TODAY);
    expect(a.detail).toHaveLength(10);
    expect(a.detail[0]).toMatch(/^R-01 Red/);
    expect(a.detail[9]).toMatch(/^R-10 Amber/);
  });
});

describe('asking about a booking other than the one on screen', () => {
  it('switches to it and answers about it', () => {
    const a = respond({ kind: 'status', bookingId: 'BK-104', ruleId: null }, fx('BK-101'), ALL, TODAY);
    expect(a.switchTo).toBe('BK-104');
    expect(a.summary).toContain('BK-104');
  });

  it('does not switch when it is already the one on screen', () => {
    const a = respond({ kind: 'status', bookingId: 'BK-101', ruleId: null }, fx('BK-101'), ALL, TODAY);
    expect(a.switchTo).toBeUndefined();
  });

  it('says so plainly when the booking is not loaded', () => {
    const a = respond({ kind: 'status', bookingId: 'BK-999', ruleId: null }, fx('BK-101'), ALL, TODAY);
    expect(a.summary).toMatch(/nothing loaded under BK-999/);
    expect(a.detail.join(' ')).toContain('BK-101');
  });
});

describe('an answer never contradicts the check panel', () => {
  it('every fixture agrees between the summary and the engine', () => {
    for (const b of ALL) {
      const a = answerQuestion({ kind: 'status', bookingId: null, ruleId: null }, b, TODAY);
      expect(a.summary, b.id).toContain(b.id);
      for (const kind of ['status', 'timing', 'carrier', 'pallets', 'cost', 'issues', 'next', 'rules'] as const) {
        const ans = answerQuestion({ kind, bookingId: null, ruleId: null }, b, TODAY);
        expect(ans.summary.length, `${b.id} ${kind}`).toBeGreaterThan(10);
        expect(ans.detail.length, `${b.id} ${kind}`).toBeGreaterThan(0);
      }
    }
  });
});
