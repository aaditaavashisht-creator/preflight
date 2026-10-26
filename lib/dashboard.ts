/**
 * Selectors that shape engine output into what the dashboard screens read.
 *
 * Pure: no I/O, no React, no network. Every figure here is derived from a
 * Booking and the CheckResult the engine already produced for it — nothing
 * is re-checked, re-scored or re-worded. If a number looks wrong on a
 * screen, it is wrong in the engine, not here.
 */

import { fmtDate, gbp } from './format';
import { readiness } from './readiness';
import { RULE_IDS, ruleStatuses, type RuleStatus } from './rules';
import type { Booking, CheckResult } from './types';

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
  const exposure = shipments.filter((s) => s.riskGbp !== null).map((s) => sliceOf(s, totalExposure));

  const topExposureId = exposure.length > 0 ? exposure[0].id : null;
  const priorities = sorted
    .map((e, i) => ({ e, s: shipments[i] }))
    .filter(({ s }) => bandOf(s) !== 'clear')
    .slice(0, 3)
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
