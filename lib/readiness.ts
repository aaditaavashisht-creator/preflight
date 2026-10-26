import { RULES, type RuleStatus } from './rules';
import type { Booking, Issue, Recommendation } from './types';

/* ------------------------------------------------------------------ *
 * The readiness pipeline. Every rule maps to exactly one stage, and
 * every stage names who has to act.
 * ------------------------------------------------------------------ */

export type StageName =
  | 'Declared' | 'Paperwork clear' | 'Counts agree' | 'Freight accepted' | 'Ready for collection';

export interface StageMeta {
  name: StageName;
  who: string;
  rules: string[];
}

export const STAGES: StageMeta[] = [
  { name: 'Declared', who: 'Seller fills in the booking', rules: [] },
  { name: 'Paperwork clear', who: 'Seller, or their customs broker', rules: ['R-01', 'R-02', 'R-09'] },
  { name: 'Counts agree', who: 'Whoever packed the cartons', rules: ['R-03', 'R-04', 'R-07'] },
  { name: 'Freight accepted', who: 'Freight desk', rules: ['R-05', 'R-06'] },
  { name: 'Ready for collection', who: 'Seller and the receiving site', rules: ['R-08', 'R-10'] },
];

/** The fields a booking needs before any of the ten rules mean anything. */
export const REQUIRED_FIELDS: Array<{ key: string; label: string; has: (b: Booking) => boolean }> = [
  { key: 'route', label: 'origin and destination', has: (b) => b.originCity !== '' && b.destCity !== '' },
  { key: 'destType', label: 'destination type', has: (b) => b.destType !== '' },
  { key: 'pallets', label: 'pallet count', has: (b) => b.pallets !== null },
  { key: 'grossWeight', label: 'gross weight', has: (b) => b.grossWeight !== null },
  { key: 'readyDate', label: 'ready date', has: (b) => b.readyDate !== null },
  { key: 'items', label: 'item lines', has: (b) => b.items.length > 0 },
  { key: 'value', label: 'declared value', has: (b) => b.declaredValue !== null },
  { key: 'cartons', label: 'carton total', has: (b) => b.cartons !== null },
];

export interface StageState {
  name: StageName;
  who: string;
  status: RuleStatus;
  /** 0 to 1, how much of this stage is settled. */
  progress: number;
  detail: string;
  rules: string[];
}

export interface Readiness {
  stages: StageState[];
  /** The first stage that is not clear. */
  heldAt: StageState | null;
  summary: string;
}

export function readiness(
  b: Booking,
  issues: Issue[],
  statuses: Record<string, RuleStatus>,
): Readiness {
  const stages: StageState[] = STAGES.map((meta) => {
    if (meta.name === 'Declared') {
      const missing = REQUIRED_FIELDS.filter((f) => !f.has(b));
      return {
        name: meta.name,
        who: meta.who,
        status: missing.length === 0 ? 'clear' : 'amber',
        progress: (REQUIRED_FIELDS.length - missing.length) / REQUIRED_FIELDS.length,
        detail: missing.length === 0
          ? 'Everything the rulebook needs is on the booking'
          : `Still missing the ${missing.map((m) => m.label).join(', ')}`,
        rules: [],
      };
    }

    const own = meta.rules;
    const worst: RuleStatus = own.some((r) => statuses[r] === 'red')
      ? 'red'
      : own.some((r) => statuses[r] === 'amber')
        ? 'amber'
        : own.every((r) => statuses[r] === 'na')
          ? 'na'
          : 'clear';
    const settled = own.filter((r) => statuses[r] === 'clear' || statuses[r] === 'na').length;
    const failing = issues.filter((i) => own.includes(i.rule));

    return {
      name: meta.name,
      who: meta.who,
      status: worst,
      progress: own.length === 0 ? 1 : settled / own.length,
      detail: failing.length === 0
        ? worst === 'na'
          ? 'Nothing here could be tested yet'
          : `${own.join(', ')} all pass`
        : failing.map((i) => i.rule).join(', ') + (failing.length === 1 ? ' is holding it' : ' are holding it'),
      rules: own,
    };
  });

  const heldAt = stages.find((s) => s.status === 'red')
    ?? stages.find((s) => s.status === 'amber')
    ?? null;

  const summary = heldAt
    ? `Held at ${heldAt.name.toLowerCase()} — ${heldAt.who.toLowerCase()}`
    : 'Nothing is holding this shipment';

  return { stages, heldAt, summary };
}

/* ------------------------------------------------------------------ *
 * The check run. Twelve nodes in five connected groups.
 * ------------------------------------------------------------------ */

export interface RunNode {
  id: string;
  group: string;
  label: string;
  /** What the node shows once it settles. */
  working: string;
  status: RuleStatus;
  narration: string;
}

export function runNodes(
  b: Booking,
  issues: Issue[],
  statuses: Record<string, RuleStatus>,
  rec: Recommendation,
): RunNode[] {
  const out: RunNode[] = [];

  for (const stage of STAGES) {
    if (stage.rules.length === 0) continue;
    for (const id of stage.rules) {
      const meta = RULES.find((r) => r.id === id)!;
      const hit = issues.find((i) => i.rule === id);
      out.push({
        id,
        group: stage.name,
        label: id,
        working: hit ? (hit.sku ?? 'failed') : statuses[id] === 'na' ? 'n/a' : 'pass',
        status: statuses[id] ?? 'na',
        narration: hit ? hit.title : `${id} — ${meta.name.toLowerCase()}`,
      });
    }
  }

  const lane = rec.ranked.length + rec.excluded.length;
  const wpp = rec.weightPerPallet;
  out.push({
    id: 'C-filter',
    group: 'Carrier',
    label: 'Filter',
    working: wpp === null ? 'no weight' : `${Math.round(wpp)} kg · ${rec.ranked.length} of ${lane}`,
    status: rec.incomplete ? 'na' : rec.feasible ? 'clear' : 'red',
    narration: rec.incomplete
      ? 'Not enough information to filter the lane'
      : wpp === null
        ? 'Filtering the lane'
        : `Weight per pallet ${Math.round(wpp)} kg — ${rec.ranked.length} of ${lane} services will take it`,
  });
  out.push({
    id: 'C-rank',
    group: 'Carrier',
    label: 'Rank',
    working: rec.winner
      ? `${rec.winner.row.carrier.replace('Carrier ', '')} · £${rec.winner.cost.toLocaleString('en-GB')}`
      : 'none',
    status: rec.incomplete ? 'na' : rec.winner ? 'clear' : 'red',
    narration: rec.winner
      ? `${rec.winner.row.carrier} ${rec.winner.row.service.toLowerCase()} at £${rec.winner.cost.toLocaleString('en-GB')}`
      : 'Nothing on this lane will take it',
  });

  return out;
}

export const RUN_GROUPS = [
  'Paperwork clear', 'Counts agree', 'Freight accepted', 'Ready for collection', 'Carrier',
];

/**
 * Replay only when the result changes. Nudging a Balanced slider must not
 * restart the animation, so the key is the issue set and the pick, nothing else.
 */
export function runKey(issues: Issue[], rec: Recommendation): string {
  const ids = issues.map((i) => `${i.rule}:${i.sku ?? ''}`).sort().join(',');
  const pick = rec.winner ? `${rec.winner.row.carrier}/${rec.winner.row.service}` : 'none';
  return `${ids}|${pick}|${rec.feasible ? 'f' : 'x'}`;
}
