/**
 * Selectors that shape engine output into what the dashboard screens read.
 *
 * Pure: no I/O, no React, no network. Every figure here is derived from a
 * Booking and the CheckResult the engine already produced for it — nothing
 * is re-checked, re-scored or re-worded. If a number looks wrong on a
 * screen, it is wrong in the engine, not here.
 */

import { fmtDate, gbp } from './format';
import { STAGES, readiness } from './readiness';
import { RULE_IDS, RULES, itemCartonsOf, ruleStatuses, type RuleStatus } from './rules';
import type { Booking, CheckResult, Issue } from './types';

/** The screens' vocabulary for a single rule cell. */
export type Verdict = 'pass' | 'fail' | 'warn' | 'na';

const AS_VERDICT: Record<RuleStatus, Verdict> = {
  clear: 'pass',
  red: 'fail',
  amber: 'warn',
  na: 'na',
};

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

export interface Entry {
  booking: Booking;
  result: CheckResult;
}

export interface ExposureSlice {
  id: string;
  name: string;
  amount: number;
  /** Share of the book's exposure, rounded for display. */
  pct: number;
  /** Unrounded share as a CSS width, so the bar still totals 100%. */
  width: string;
}

export interface Priority {
  id: string;
  /** Reads after the booking id: "BK-102 — 3 blocking rules, ...". */
  why: string;
}

export type Band = 'all' | 'blocked' | 'caution' | 'clear';

export interface Book {
  today: Date;
  shipments: Shipment[];
  totalExposure: number;
  /** How many bookings sit in each band. `all` is the whole book. */
  counts: Record<Band, number>;
  /** Red issues across the book — rules that stop a shipment. */
  blockingFailures: number;
  /** Amber issues across the book — rules that cost time or money. */
  costFlags: number;
  /** The note under the "Clear to ship" tile. */
  clearNote: string;
  exposure: ExposureSlice[];
  priorities: Priority[];
  /** One sentence on where the money sits. */
  moneyBlurb: string;
  /** The line under the page title. */
  blurb: string;
}

/* ------------------------------------------------------------------ */

function lanesOf(b: Booking): string {
  const from = b.originCity.trim();
  const to = b.destCity.trim();
  if (from && to) return `${from} to ${to}`;
  if (to) return `To ${to}`;
  if (from) return `From ${from}`;
  return 'Route not stated';
}

/** Unique rule ids at one severity, in rule order. */
function rulesAt(e: Entry, severity: 'Red' | 'Amber'): string[] {
  const hit = new Set(e.result.issues.filter((i) => i.severity === severity).map((i) => i.rule));
  return RULE_IDS.filter((id) => hit.has(id));
}

function tallyOf(e: Entry, rules: Verdict[]): string {
  const reds = rulesAt(e, 'Red');
  if (reds.length > 0) return `${reds.join(', ')} blocking`;
  const ambers = rulesAt(e, 'Amber');
  if (ambers.length > 0) return `${ambers.join(', ')} to watch`;
  const na = rules.filter((v) => v === 'na').length;
  if (na === 0) return 'All ten pass';
  return `${rules.length - na} rules pass, ${na} not applicable`;
}

export function toShipment(e: Entry): Shipment {
  const statuses = ruleStatuses(e.booking, e.result.issues);
  const rules = RULE_IDS.map((id) => AS_VERDICT[statuses[id]]);
  const held = readiness(e.booking, e.result.issues, statuses).heldAt;

  return {
    id: e.booking.id,
    seller: e.booking.seller.trim() || 'Seller not stated',
    lane: lanesOf(e.booking),
    riskGbp: e.result.exposure > 0 ? e.result.exposure : null,
    tally: tallyOf(e, rules),
    stage: held ? held.name : 'Clear',
    blocked: e.result.verdict === 'Red',
    rules,
  };
}

/** Which band a row sits in. The screens read this off `rules`, not the verdict. */
export function bandOf(s: Shipment): Exclude<Band, 'all'> {
  if (s.rules.includes('fail')) return 'blocked';
  if (s.rules.includes('warn')) return 'caution';
  return 'clear';
}

/** Severity first, then money — the same order the shipments queue uses. */
const RANK = { Red: 0, Amber: 1, Clear: 2 } as const;

function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, z) => {
    const r = RANK[a.result.verdict] - RANK[z.result.verdict];
    if (r !== 0) return r;
    const m = z.result.exposure - a.result.exposure;
    if (Math.abs(m) > 0.005) return m;
    return a.booking.id.localeCompare(z.booking.id);
  });
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function sliceOf(s: Shipment, total: number): ExposureSlice {
  const share = total > 0 ? ((s.riskGbp ?? 0) / total) * 100 : 0;
  return {
    id: s.id,
    name: s.seller,
    amount: s.riskGbp ?? 0,
    pct: Math.round(share),
    width: `${share.toFixed(1)}%`,
  };
}

function moneyBlurbOf(slices: ExposureSlice[], total: number): string {
  if (slices.length === 0) return 'Nothing in the book carries a cost estimate right now.';
  const top = slices[0];
  if (slices.length === 1) {
    return `All of the exposure sits on ${top.name}. Clear ${top.id} and the book is at zero.`;
  }
  return `${top.name} alone carries ${top.pct}% of the money at risk. Clear ${top.id} and ${gbp(top.amount)} of ${gbp(total)} goes away.`;
}

function priorityOf(e: Entry, s: Shipment, isTopExposure: boolean): Priority {
  const reds = rulesAt(e, 'Red').length;
  const ambers = rulesAt(e, 'Amber').length;
  const bits: string[] = [];
  if (reds > 0) bits.push(plural(reds, 'blocking rule', 'blocking rules'));
  if (ambers > 0) bits.push(plural(ambers, 'cost flag', 'cost flags'));

  let why = bits.join(' and ');
  if (isTopExposure && (s.riskGbp ?? 0) > 0) why += ', the largest single exposure in the book';
  else if (s.riskGbp !== null) why += `, ${gbp(s.riskGbp)} at risk`;
  return { id: s.id, why };
}

function clearNoteOf(clear: Shipment[], total: number): string {
  if (total === 0) return 'nothing loaded yet';
  if (clear.length === 0) return 'every booking has something on it';
  if (clear.length === 1) return `${clear[0].seller}, ${clear[0].lane}`;
  return `${clear.length} bookings with nothing firing`;
}

/**
 * Everything the control tower renders, derived in one pass so the counts,
 * the bars and the prose cannot disagree with the table above them.
 */
export function toBook(entries: Entry[], today: Date): Book {
  const sorted = sortEntries(entries);
  const shipments = sorted.map(toShipment);

  const bands = shipments.map(bandOf);
  const counts: Record<Band, number> = {
    all: shipments.length,
    blocked: bands.filter((b) => b === 'blocked').length,
    caution: bands.filter((b) => b === 'caution').length,
    clear: bands.filter((b) => b === 'clear').length,
  };

  const issues = sorted.flatMap((e) => e.result.issues);
  const totalExposure = shipments.reduce((n, s) => n + (s.riskGbp ?? 0), 0);
  const exposure = shipments
    .filter((s) => s.riskGbp !== null)
    .sort((a, z) => (z.riskGbp ?? 0) - (a.riskGbp ?? 0))
    .map((s) => sliceOf(s, totalExposure));

  const topExposureId = exposure.length > 0 ? exposure[0].id : null;
  const priorities = sorted
    .map((e, i) => ({ e, s: shipments[i] }))
    .filter(({ s }) => bandOf(s) !== 'clear')
    .map(({ e, s }) => priorityOf(e, s, s.id === topExposureId));

  return {
    today,
    shipments,
    totalExposure,
    counts,
    blockingFailures: issues.filter((i) => i.severity === 'Red').length,
    costFlags: issues.filter((i) => i.severity === 'Amber').length,
    clearNote: clearNoteOf(shipments.filter((s) => bandOf(s) === 'clear'), shipments.length),
    exposure,
    priorities,
    moneyBlurb: moneyBlurbOf(exposure, totalExposure),
    blurb: shipments.length === 0
      ? `Nothing loaded yet, treated as ${fmtDate(today)}.`
      : `${plural(shipments.length, 'shipment', 'shipments')} in the book, treated as ${fmtDate(today)}. Worst first.`,
  };
}

/* ------------------------------------------------------------------ *
 * The exception queue, the rule matrix and the warehouse task.
 * Same discipline as above: these only reshape engine output.
 * ------------------------------------------------------------------ */

export interface Finding {
  shipmentId: string;
  /** Unique per finding, since one booking can fail several rules. */
  key: string;
  rule: string;
  title: string;
  found: string;
  expected: string;
  consequence: string;
  diagnosis: string;
  /** 'high' and 'medium' have a one-click fix; 'person' means a decision. */
  confidence: 'high' | 'medium' | 'person';
  fix: string;
  fixNote: string;
  /** What else is going on with the same booking. */
  also?: string;
  owner: string;
  stage: string;
  riskGbp: number;
  stops: boolean;
}

const OWNER_OF: Record<string, string> = Object.fromEntries(
  STAGES.flatMap((s) => s.rules.map((r) => [r, s.who])),
);
const STAGE_OF: Record<string, string> = Object.fromEntries(RULES.map((r) => [r.id, r.stage]));

function consequenceOf(i: Issue): string {
  const [lo, hi] = i.impactDays;
  const time = hi === 0 ? '' : lo === hi ? `Up to ${hi} days` : `${lo} to ${hi} days held`;
  const money = i.impactCost > 0 ? `about ${gbp(i.impactCost)} at risk` : '';
  const head = [time, money].filter(Boolean).join(' and ');
  return [head ? `${head}.` : '', i.costWhy].filter(Boolean).join(' ').trim();
}

function confidenceOf(i: Issue): Finding['confidence'] {
  if (!i.fix) return 'person';
  return i.confidence === 'High' ? 'high' : 'medium';
}

function alsoOf(i: Issue, all: Issue[]): string | undefined {
  const others = all.filter((x) => x !== i);
  if (others.length === 0) return undefined;
  const reds = [...new Set(others.filter((x) => x.severity === 'Red').map((x) => x.rule))];
  const ambers = [...new Set(others.filter((x) => x.severity === 'Amber').map((x) => x.rule))];
  const bits: string[] = [];
  if (reds.length) bits.push(`${reds.join(', ')} also ${reds.length === 1 ? 'blocks' : 'block'} this booking`);
  if (ambers.length) bits.push(`${ambers.join(', ')} will cost time or money`);
  return `${bits.join('. ')}.`;
}

/** Red before amber, then worst money first — the order you should work them. */
export function toFindings(entries: Entry[]): Finding[] {
  const out: Finding[] = entries.flatMap((e) =>
    e.result.issues.map((i, n) => ({
      shipmentId: e.booking.id,
      key: `${e.booking.id}|${i.rule}|${i.sku ?? n}`,
      rule: i.rule,
      title: i.headline || i.title,
      found: i.observed,
      expected: i.expected,
      consequence: consequenceOf(i),
      diagnosis: i.diagnosis,
      confidence: confidenceOf(i),
      fix: i.fix ? i.fix.label : i.suggestion ? i.suggestion : 'Needs a person to decide',
      fixNote: i.fix ? i.fix.delta : 'no safe one-click correction',
      also: alsoOf(i, e.result.issues),
      owner: OWNER_OF[i.rule] ?? 'Seller',
      stage: STAGE_OF[i.rule] ?? '',
      riskGbp: i.impactCost,
      stops: i.severity === 'Red',
    })),
  );
  return out.sort((a, z) => {
    if (a.stops !== z.stops) return a.stops ? -1 : 1;
    if (Math.abs(z.riskGbp - a.riskGbp) > 0.005) return z.riskGbp - a.riskGbp;
    return a.key.localeCompare(z.key);
  });
}

export interface QueueStats {
  total: number;
  /** Findings the engine will correct for you. */
  oneClick: number;
  /** Findings that need a decision. */
  needsPerson: number;
  bookings: number;
  exposure: number;
  /** Bookings with nothing firing at all, named. */
  quiet: string[];
}

export function toQueueStats(findings: Finding[], shipments: Shipment[]): QueueStats {
  return {
    total: findings.length,
    oneClick: findings.filter((f) => f.confidence !== 'person').length,
    needsPerson: findings.filter((f) => f.confidence === 'person').length,
    bookings: new Set(findings.map((f) => f.shipmentId)).size,
    exposure: findings.reduce((n, f) => n + f.riskGbp, 0),
    quiet: shipments.filter((s) => bandOf(s) === 'clear').map((s) => s.id),
  };
}

/* ---------- the rule matrix ---------- */

export interface RuleCard {
  id: string;
  /** Column label for the matrix — short enough to sit in a table head. */
  short: string;
  title: string;
  why: string;
  /** Red rules stop a shipment; amber ones cost time or money. */
  stops: boolean;
}

/** Display labels only. The wording that carries meaning lives in RULES. */
const SHORT: Record<string, string> = {
  'R-01': 'HS code of at least 6 digits',
  'R-02': 'Declared value matches item lines',
  'R-03': 'Each line packs out',
  'R-04': 'Carton totals agree',
  'R-05': 'Pallet weight within a ceiling',
  'R-06': 'No dangerous goods',
  'R-07': 'Gross covers net',
  'R-08': 'Warehouse slot booked',
  'R-09': 'Country of origin present',
  'R-10': 'Ready date not in the past',
};

export const RULE_CARDS: RuleCard[] = RULES.map((r) => ({
  id: r.id,
  short: SHORT[r.id] ?? r.name,
  title: r.name,
  why: r.description,
  stops: r.severity === 'Red',
}));

export interface StageLoad {
  name: string;
  /** Bookings held at this stage. */
  count: number;
  owner: string;
}

/** Where the book is stuck, and who has to move it. */
export function toStageLoad(entries: Entry[]): StageLoad[] {
  const held = entries.map((e) => {
    const statuses = ruleStatuses(e.booking, e.result.issues);
    return readiness(e.booking, e.result.issues, statuses).heldAt?.name ?? null;
  });
  return STAGES.map((s) => ({
    name: s.name,
    count: held.filter((h) => h === s.name).length,
    owner: s.who,
  }));
}

/* ---------- the warehouse task ---------- */

export interface CountTask {
  id: string;
  seller: string;
  lane: string;
  rule: string;
  bookingSays: number;
  linesSay: number;
  riskGbp: number;
  /** True when this count is the only thing left on the booking. */
  onlyThing: boolean;
}

/**
 * The one job a warehouse hand can finish on a phone: a carton count that
 * does not reconcile. Returns null when no loaded booking has one.
 */
export function toCountTask(entries: Entry[]): CountTask | null {
  for (const e of entries) {
    const hit = e.result.issues.find((i) => i.rule === 'R-04');
    if (!hit) continue;
    const linesSay = itemCartonsOf(e.booking);
    if (e.booking.cartons === null || linesSay === null) continue;
    return {
      id: e.booking.id,
      seller: e.booking.seller.trim() || 'Seller not stated',
      lane: lanesOf(e.booking),
      rule: hit.rule,
      bookingSays: e.booking.cartons,
      linesSay,
      riskGbp: hit.impactCost,
      onlyThing: e.result.issues.length === 1,
    };
  }
  return null;
}
