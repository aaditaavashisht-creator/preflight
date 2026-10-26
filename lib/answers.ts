import { recommend } from './carrier';
import { serviceName } from './carriers';
import { addWorkingDays, daysBetween, fmtDate, fmtDateLong, gbp, kg, qty, startOfDay } from './format';
import { RULES, check, ruleStatuses } from './rules';
import { readiness } from './readiness';
import type { Booking, CheckResult } from './types';

/**
 * Deterministic question answering.
 *
 * The conversation does two jobs: it collects a booking, and it answers questions
 * about one. Both are regex over a fixed vocabulary reading the same engine output,
 * so an answer can never drift from what the check panel says.
 */

export type QuestionKind =
  | 'status' | 'timing' | 'carrier' | 'pallets' | 'cost' | 'issues' | 'next' | 'rules';

export interface Question {
  kind: QuestionKind;
  /** A booking the seller named in the question, if any. */
  bookingId: string | null;
  /** A rule the seller named, for 'rules'. */
  ruleId: string | null;
}

const PATTERNS: Array<[RegExp, QuestionKind]> = [
  [/\b(r-?\s?0?\d{1,2})\b|\brules?\b|\bwhat (do|does) (you|it) check\b|\brulebook\b/i, 'rules'],
  [/\bwhen\b|\bhow long\b|\beta\b|\barriv|\bdeliver|\btransit\b|\blead time\b|\bship(ped|ping)? (by|on|date)\b|\bcollect/i, 'timing'],
  [/\bpallet|\bweight\b|\bkg\b|\bkilo|\bheavy\b|\bload\b|\bgross\b/i, 'pallets'],
  [/\bcarrier|\bservice\b|\bwho (will|should)\b|\brecommend|\bwhich (one|carrier|service)\b|\bcheapest\b|\bfastest\b|\bmost reliable\b/i, 'carrier'],
  [/\bcost|\bprice|\bhow much|\bexpensive|\bexposure|\bat risk|\bmoney|£/i, 'cost'],
  [/\bnext\b|\bwhat (should|do) i do\b|\baction|\bsteps?\b|\bconfirm/i, 'next'],
  [/\bissue|\bproblem|\bwrong\b|\berror|\bfail|\bred\b|\bamber\b|\bfix\b|\bbroken\b/i, 'issues'],
  [/\bstatus\b|\bhow is\b|\bsummar|\boverview\b|\bverdict\b|\bwhere (does|do) (it|we) stand\b|\btell me about\b|\bwhat.?s (up|happening|going on)\b|\bcheck\b/i, 'status'],
];

/** "BK-104", "bk104", "booking 104". */
export function bookingIdIn(text: string): string | null {
  const m = /\b(bk)[\s-]?(\d{2,6})\b/i.exec(text) ?? /\bbooking\s+(?:id\s+)?#?\s?()(\d{2,6})\b/i.exec(text);
  if (!m) return null;
  return `BK-${m[2]}`;
}

export function ruleIdIn(text: string): string | null {
  const m = /\br-?\s?(\d{1,2})\b/i.exec(text);
  if (!m) return null;
  const id = `R-${m[1].padStart(2, '0')}`;
  return RULES.some((r) => r.id === id) ? id : null;
}

/**
 * A question, or null when the message is a shipment detail to be parsed instead.
 * A message that carries no extractable field and reads like a question is treated
 * as one, so "what about the pallets" does not fall through to "I did not catch that".
 */
export function detectQuestion(text: string): Question | null {
  const t = text.trim();
  if (!t) return null;
  const bookingId = bookingIdIn(t);
  const interrogative = /\?|^\s*(what|when|where|which|who|why|how|is|are|can|does|do|should|tell|show|explain|give)\b/i.test(t);

  for (const [re, kind] of PATTERNS) {
    if (!re.test(t)) continue;
    // A bare "3 pallets" is a value, not a question about pallets.
    if (!interrogative && !bookingId && !/\b(status|rules?|rulebook)\b/i.test(t)) continue;
    return { kind, bookingId, ruleId: kind === 'rules' ? ruleIdIn(t) : null };
  }
  // Named a booking and asked something, but nothing more specific matched.
  if (bookingId && interrogative) return { kind: 'status', bookingId, ruleId: null };
  return null;
}

/* ------------------------------------------------------------------ */

export interface Answer {
  /** One line, always shown. */
  summary: string;
  /** The reasoning behind it, shown on request. */
  detail: string[];
  /** A booking the rail should switch to before answering. */
  switchTo?: string;
}

const HEADLINE = { Red: 'Do not ship yet', Amber: 'Ship with caution', Clear: 'Clear to book' } as const;

function priorityPhrase(b: Booking): string {
  switch (b.priority) {
    case 'Cheapest': return 'you asked for the cheapest option';
    case 'Fastest': return 'you asked for the fastest option';
    case 'Most reliable': return 'you asked for the most reliable option';
    case 'Balanced': return 'you asked for a balance of cost, speed and reliability';
    default: return 'no priority was given, so this is ranked Balanced by default';
  }
}

/** Recommended service, why it won, and what it costs. */
function carrierLines(b: Booking, r: CheckResult): string[] {
  const rec = r.recommendation;
  if (rec.incomplete) return [rec.incompleteReason];
  if (!rec.feasible) {
    const out = [rec.reason];
    if (rec.palletFix) {
      out.push(
        `Spread the same ${kg(b.grossWeight)} over ${rec.palletFix.pallets} pallets and it comes ` +
        `down to ${Math.round(rec.palletFix.kgPerPallet)} kg a pallet, which opens ` +
        `${rec.palletFix.opens.join(' and ')}.`,
      );
    }
    return out;
  }
  const w = rec.winner!;
  const out = [
    `Recommended service: ${serviceName(w.row)} at ${gbp(w.cost)} for ` +
    `${qty(b.pallets)} pallet${b.pallets === 1 ? '' : 's'}.`,
    `Why: ${priorityPhrase(b)}. ${serviceName(w.row)} runs ${w.row.days} days in transit at ` +
    `${w.row.onTime}% on time, ${gbp(w.row.pricePerPallet)} a pallet.`,
  ];
  if (rec.runnerUp) out.push(`Runner-up: ${rec.runnerUpTradeoff}`);
  if (rec.excluded.length) {
    out.push(
      `Excluded on weight: ${rec.excluded.map((e) => `${serviceName(e.row)} (caps at ${e.ceiling} kg a pallet)`).join(', ')}.`,
    );
  }
  if (rec.nothingToRank) out.push('Only one service on this lane will take the load, so there is nothing to rank.');
  return out;
}

/** The numbered next steps, matching the confirmation panel. */
function nextSteps(b: Booking, r: CheckResult, today: Date): string[] {
  if (r.verdict === 'Red') {
    const reds = r.issues.filter((i) => i.severity === 'Red');
    return [
      `${reds.length} blocking ${reds.length === 1 ? 'item has' : 'items have'} to clear before this can be booked:`,
      ...reds.map((i, n) => `${n + 1}. ${i.title}. ${i.fix ? `Apply "${i.fix.label}".` : 'No safe automatic fix for this one, so it needs a decision from you.'}`),
    ];
  }
  const rec = r.recommendation;
  const ready = b.readyDate ?? today;
  const steps: string[] = [];
  if (rec.winner) steps.push(`1. Book ${serviceName(rec.winner.row)} at ${gbp(rec.winner.cost)}.`);
  steps.push(`${steps.length + 1}. Send your broker the invoice and packing list showing ${gbp(b.declaredValue)} across ${qty(b.cartons)} cartons.`);
  steps.push(
    b.destType === 'Warehouse'
      ? `${steps.length + 1}. ${b.appointment === 'Yes' ? 'Confirm the booked delivery slot against the transit time.' : 'Book the delivery slot. Slots run three to five working days out.'}`
      : `${steps.length + 1}. Confirm someone can take delivery at the business address.`,
  );
  steps.push(`${steps.length + 1}. Have the goods palletised and labelled by ${fmtDateLong(ready)}.`);
  if (rec.winner) {
    steps.push(`${steps.length + 1}. Expect delivery around ${fmtDateLong(addWorkingDays(ready, rec.winner.row.days))}.`);
  }
  return steps;
}

export function answerQuestion(
  q: Question, booking: Booking, today: Date,
): Answer {
  const r = check(booking, today);
  const id = booking.id;
  const route = [booking.originCity, booking.destCity].filter(Boolean).join(' to ') || 'this shipment';
  const rec = r.recommendation;

  switch (q.kind) {
    case 'status': {
      const counts = r.issues.length === 0
        ? 'all ten checks pass'
        : `${r.redCount ? `${r.redCount} blocking` : ''}${r.redCount && r.amberCount ? ', ' : ''}${r.amberCount ? `${r.amberCount} to watch` : ''}`;
      const stages = readiness(booking, r.issues, ruleStatuses(booking, r.issues));
      return {
        summary: `${id} — ${HEADLINE[r.verdict]}. ${route}, ${counts}.`,
        detail: [
          stages.summary + '.',
          ...(r.issues.length
            ? r.issues.map((i) => `${i.rule} ${i.severity}: ${i.title}${i.fix ? ` — fix: ${i.fix.label}` : ' — no safe automatic fix'}`)
            : ['Nothing on the rulebook has anything to say about this booking.']),
          '',
          ...carrierLines(booking, r),
          '',
          ...nextSteps(booking, r, today),
        ],
      };
    }

    case 'timing': {
      const ready = booking.readyDate;
      if (!ready) {
        return { summary: `${id} has no ready-to-ship date yet, so nothing can be scheduled.`, detail: ['Tell me when the goods will be packed and ready and I will work the dates out.'] };
      }
      const overdue = daysBetween(startOfDay(ready), startOfDay(today));
      if (overdue > 0) {
        return {
          summary: `${id} cannot be scheduled: the ready date was ${fmtDate(ready)}, ${overdue} day${overdue === 1 ? '' : 's'} ago.`,
          detail: ['A past ready date gets no collection at all, because the window closed and nothing re-opens it automatically.', 'Put a real date on it and the booking enters the collection run again.'],
        };
      }
      if (!rec.winner) {
        return {
          summary: `${id} is ready on ${fmtDate(ready)}, but no service will take it yet, so there is no delivery date.`,
          detail: carrierLines(booking, r),
        };
      }
      const w = rec.winner;
      const arrival = addWorkingDays(ready, w.row.days);
      return {
        summary: `${id} collects on ${fmtDate(ready)} and should deliver around ${fmtDate(arrival)}, ${w.row.days} working days on ${serviceName(w.row)}.`,
        detail: [
          `Ready to collect: ${fmtDateLong(ready)}.`,
          `Transit: ${w.row.days} working days on ${serviceName(w.row)}.`,
          `Estimated delivery: ${fmtDateLong(arrival)}, weekends excluded and public holidays not accounted for.`,
          `${serviceName(w.row)} runs at ${w.row.onTime}% on time, so build slack into anything depending on the stock landing.`,
          ...(r.verdict === 'Red' ? ['', `These dates assume the ${r.redCount} blocking issue${r.redCount === 1 ? '' : 's'} clear first. Until then nothing is collected.`] : []),
        ],
      };
    }

    case 'pallets': {
      const wpp = r.weightPerPallet;
      if (wpp === null) {
        return { summary: `${id} does not have both a gross weight and a pallet count yet.`, detail: ['Weight per pallet is what decides which services will take the load, so I need both.'] };
      }
      const all = [...rec.ranked.map((s) => s.row), ...rec.excluded.map((e) => e.row)];
      return {
        summary: `${id} is ${kg(booking.grossWeight)} over ${qty(booking.pallets)} pallet${booking.pallets === 1 ? '' : 's'}, which is ${kg(wpp)} a pallet.`,
        detail: [
          `Net weight of the goods themselves: ${r.netWeight === null ? 'not stated' : kg(r.netWeight, 1)}.`,
          ...(all.length
            ? [`Ceilings on the ${booking.destCountry} lane:`, ...all.map((c) => `  ${serviceName(c)} caps at ${c.maxPerPallet} kg a pallet — ${wpp <= c.maxPerPallet ? 'accepts this load' : 'too heavy, excluded'}`)]
            : ['No rate card for this lane.']),
          '',
          ...carrierLines(booking, r),
        ],
      };
    }

    case 'carrier':
      return {
        summary: rec.winner
          ? `${id}: ${serviceName(rec.winner.row)} at ${gbp(rec.winner.cost)}.`
          : `${id}: no service on this lane will take it as it stands.`,
        detail: carrierLines(booking, r),
      };

    case 'cost': {
      if (r.issues.length === 0) {
        return {
          summary: `${id} has nothing at risk. Freight is ${rec.winner ? gbp(rec.winner.cost) : 'not priced yet'}.`,
          detail: rec.winner ? carrierLines(booking, r) : ['No carrier priced yet.'],
        };
      }
      return {
        summary: `${id} has about ${gbp(r.exposure)} at risk and up to ${r.worstCaseDelay} days of delay.`,
        detail: [
          'These are planning estimates from typical customs and freight charges, except where the shipment’s own numbers give a real figure.',
          ...r.issues.map((i) => `${i.rule}: ${gbp(i.impactCost)} — ${i.costWhy}`),
          '',
          `Freight itself: ${rec.winner ? gbp(rec.winner.cost) : 'not priced, nothing will take it yet'}.`,
        ],
      };
    }

    case 'issues':
      return {
        summary: r.issues.length === 0
          ? `${id} has no issues. All ten rules pass.`
          : `${id} has ${r.issues.length} issue${r.issues.length === 1 ? '' : 's'}: ${[...new Set(r.issues.map((i) => i.rule))].join(', ')}.`,
        detail: r.issues.length === 0
          ? ['Nothing to fix.']
          : r.issues.flatMap((i) => [
              `${i.rule} ${i.severity} — ${i.title}`,
              `  Found: ${i.observed}`,
              `  Expected: ${i.expected}`,
              `  ${i.diagnosis}`,
              i.fix ? `  Fix available: ${i.fix.label}` : '  No safe automatic fix.',
              '',
            ]),
      };

    case 'next':
      return {
        summary: r.verdict === 'Red'
          ? `${id} cannot be booked yet. ${r.redCount} blocking issue${r.redCount === 1 ? '' : 's'} first.`
          : `${id} is ready to book${rec.winner ? ` on ${serviceName(rec.winner.row)}` : ''}.`,
        detail: nextSteps(booking, r, today),
      };

    case 'rules': {
      if (q.ruleId) {
        const meta = RULES.find((x) => x.id === q.ruleId)!;
        const statuses = ruleStatuses(booking, r.issues);
        const st = statuses[meta.id];
        const hit = r.issues.find((i) => i.rule === meta.id);
        return {
          summary: `${meta.id} — ${meta.name}. On ${id}: ${st === 'na' ? 'not applicable' : st === 'clear' ? 'passes' : hit ? hit.title : st}.`,
          detail: [meta.description, '', `Severity if broken: ${meta.severity}.`, `Cleared by: ${meta.stage}.`, ...(hit ? ['', hit.diagnosis] : [])],
        };
      }
      return {
        summary: 'Ten rules, six that stop a shipment and four that cost you time or money.',
        detail: RULES.map((m) => `${m.id} ${m.severity} — ${m.name}. ${m.description}`),
      };
    }
  }
}

/** Convenience for the rail: resolve the booking, then answer. */
export function respond(
  q: Question, current: Booking, all: Booking[], today: Date,
): Answer {
  if (q.bookingId) {
    const target = all.find((b) => b.id.toUpperCase() === q.bookingId!.toUpperCase());
    if (target) {
      const a = answerQuestion(q, target, today);
      return target.id === current.id ? a : { ...a, switchTo: target.id };
    }
    return {
      summary: `I have nothing loaded under ${q.bookingId}.`,
      detail: [
        all.length ? `Loaded right now: ${all.map((b) => b.id).join(', ')}.` : 'Nothing is loaded yet.',
        'Upload a workbook or load the demo set, then ask again.',
      ],
    };
  }
  return answerQuestion(q, current, today);
}

export { recommend };
