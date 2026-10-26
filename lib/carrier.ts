import { lane, MAX_PALLET_CEILING, serviceName } from './carriers';
import { gbp, round2 } from './format';
import type {
  Booking, CarrierRow, ExcludedCarrier, PalletFix, Priority,
  Recommendation, ScoredCarrier, Weights,
} from './types';

export const PRIORITY_WEIGHTS: Record<Priority, Weights> = {
  Cheapest: { cost: 1, speed: 0, reliability: 0 },
  Fastest: { cost: 0, speed: 1, reliability: 0 },
  'Most reliable': { cost: 0, speed: 0, reliability: 1 },
  Balanced: { cost: 0.4, speed: 0.3, reliability: 0.3 },
};

export interface Feasibility {
  weightPerPallet: number | null;
  all: CarrierRow[];
  survivors: CarrierRow[];
  excluded: CarrierRow[];
  laneKnown: boolean;
  measurable: boolean;
}

/**
 * Weight per pallet filters the lane before anything is ranked. R-05 only
 * fails when this leaves nothing standing.
 */
export function feasibility(b: Booking): Feasibility {
  const all = lane(b.destCountry);
  const measurable =
    b.grossWeight !== null && b.grossWeight > 0 && b.pallets !== null && b.pallets > 0;
  const weightPerPallet = measurable ? b.grossWeight! / b.pallets! : null;

  if (!measurable) {
    return { weightPerPallet: null, all, survivors: all, excluded: [], laneKnown: all.length > 0, measurable: false };
  }
  const survivors = all.filter((c) => weightPerPallet! <= c.maxPerPallet);
  const excluded = all.filter((c) => weightPerPallet! > c.maxPerPallet);
  return { weightPerPallet, all, survivors, excluded, laneKnown: all.length > 0, measurable: true };
}

/** Fewest pallets that bring the load under the heaviest ceiling on the lane. */
export function palletFixFor(b: Booking): PalletFix | null {
  const all = lane(b.destCountry);
  if (!b.grossWeight || all.length === 0) return null;
  const ceiling = Math.max(...all.map((c) => c.maxPerPallet), MAX_PALLET_CEILING);
  const pallets = Math.ceil(b.grossWeight / ceiling);
  const kgPerPallet = b.grossWeight / pallets;
  const opens = all.filter((c) => kgPerPallet <= c.maxPerPallet).map(serviceName);
  return { pallets, kgPerPallet, opens };
}

function normalise(value: number, min: number, max: number, lowerIsBetter: boolean): number {
  if (max === min) return 1;
  const t = (value - min) / (max - min);
  return lowerIsBetter ? 1 - t : t;
}

function tieBreak(priority: Priority, a: ScoredCarrier, z: ScoredCarrier): number {
  switch (priority) {
    case 'Cheapest':
      return a.row.days - z.row.days;
    case 'Fastest':
    case 'Most reliable':
      return a.cost - z.cost;
    case 'Balanced':
      return z.row.onTime - a.row.onTime;
  }
}

export function recommend(b: Booking, overrideWeights?: Weights): Recommendation {
  const priorityDefaulted = b.priority === '';
  const priority: Priority = (b.priority || 'Balanced') as Priority;
  const weights = overrideWeights ?? PRIORITY_WEIGHTS[priority];
  const f = feasibility(b);

  const base: Recommendation = {
    feasible: false,
    incomplete: false,
    incompleteReason: '',
    weightPerPallet: f.weightPerPallet,
    priority,
    priorityDefaulted,
    weights,
    ranked: [],
    excluded: [],
    winner: null,
    runnerUp: null,
    nothingToRank: false,
    reason: '',
    runnerUpTradeoff: '',
    palletFix: null,
  };

  if (!f.laneKnown) {
    return {
      ...base,
      incomplete: true,
      incompleteReason: b.destCountry
        ? `No rate card for ${b.destCountry}. This tool covers Germany, France and the Netherlands.`
        : 'Tell me the destination city and I can price the lane.',
      reason: '',
    };
  }

  if (!f.measurable) {
    const missing: string[] = [];
    if (!b.grossWeight) missing.push('gross weight');
    if (!b.pallets) missing.push('pallet count');
    return {
      ...base,
      incomplete: true,
      incompleteReason: `I need the ${missing.join(' and ')} before I can tell you which services will take this.`,
      reason: '',
    };
  }

  const pallets = b.pallets!;
  const excluded: ExcludedCarrier[] = f.excluded.map((row) => ({
    row,
    ceiling: row.maxPerPallet,
    cost: row.pricePerPallet * pallets,
  }));

  if (f.survivors.length === 0) {
    const palletFix = palletFixFor(b);
    return {
      ...base,
      excluded,
      palletFix,
      reason:
        `At ${round2(f.weightPerPallet!)} kg a pallet nothing on the ${b.destCountry} lane will take this load. ` +
        `The heaviest pallet any service here accepts is ${Math.max(...f.all.map((c) => c.maxPerPallet))} kg.`,
    };
  }

  const costs = f.survivors.map((c) => c.pricePerPallet * pallets);
  const daysArr = f.survivors.map((c) => c.days);
  const onTimes = f.survivors.map((c) => c.onTime);
  const minCost = Math.min(...costs), maxCost = Math.max(...costs);
  const minDays = Math.min(...daysArr), maxDays = Math.max(...daysArr);
  const minOn = Math.min(...onTimes), maxOn = Math.max(...onTimes);

  const scored: ScoredCarrier[] = f.survivors.map((row) => {
    const cost = row.pricePerPallet * pallets;
    const costScore = normalise(cost, minCost, maxCost, true);
    const speedScore = normalise(row.days, minDays, maxDays, true);
    const reliabilityScore = normalise(row.onTime, minOn, maxOn, false);
    const score =
      weights.cost * costScore + weights.speed * speedScore + weights.reliability * reliabilityScore;
    return { row, cost, costScore, speedScore, reliabilityScore, score: round2(score) };
  });

  const ranked = [...scored].sort((a, z) => {
    const d = z.score - a.score;
    if (Math.abs(d) > 1e-9) return d;
    const t = tieBreak(priority, a, z);
    if (t !== 0) return t;
    return a.row.carrier.localeCompare(z.row.carrier);
  });

  const winner = ranked[0];
  const runnerUp = ranked[1] ?? null;
  const nothingToRank = ranked.length === 1;

  const exclusionProse = excluded.length
    ? ` ${excluded.map((e) => `${serviceName(e.row)} is out: it caps at ${e.ceiling} kg a pallet.`).join(' ')}`
    : '';

  let reason: string;
  if (nothingToRank) {
    reason =
      `${serviceName(winner.row)} is the only service on the ${b.destCountry} lane that will take ` +
      `${round2(f.weightPerPallet!)} kg a pallet, so there is nothing to rank.` + exclusionProse;
  } else {
    reason =
      `${serviceName(winner.row)} at ${gbp(winner.cost)} wins on ${priorityPhrase(priority, priorityDefaulted)}: ` +
      `${winner.row.days} days in transit, ${winner.row.onTime}% on time, ${gbp(winner.row.pricePerPallet)} a pallet ` +
      `across ${pallets} pallet${pallets === 1 ? '' : 's'}.` + exclusionProse;
  }

  const runnerUpTradeoff = runnerUp
    ? tradeoff(winner, runnerUp)
    : excluded.length
      ? 'Every other service on this lane is excluded on weight.'
      : '';

  return {
    ...base,
    feasible: true,
    excluded,
    ranked,
    winner,
    runnerUp,
    nothingToRank,
    reason,
    runnerUpTradeoff,
  };
}

function priorityPhrase(p: Priority, defaulted: boolean): string {
  const name = p.toLowerCase();
  return defaulted ? `${name} (the default, since no preference was given)` : name;
}

function tradeoff(winner: ScoredCarrier, runnerUp: ScoredCarrier): string {
  const dCost = runnerUp.cost - winner.cost;
  const dDays = runnerUp.row.days - winner.row.days;
  const dOn = runnerUp.row.onTime - winner.row.onTime;
  const parts: string[] = [];
  if (dCost !== 0) parts.push(`${gbp(Math.abs(dCost))} ${dCost > 0 ? 'more' : 'less'}`);
  if (dDays !== 0) parts.push(`${Math.abs(dDays)} day${Math.abs(dDays) === 1 ? '' : 's'} ${dDays > 0 ? 'slower' : 'faster'}`);
  if (dOn !== 0) parts.push(`${Math.abs(dOn)} point${Math.abs(dOn) === 1 ? '' : 's'} ${dOn > 0 ? 'better' : 'worse'} on time`);
  if (parts.length === 0) return `${serviceName(runnerUp.row)} is identical on every measure.`;
  return `${serviceName(runnerUp.row)} is ${parts.join(', ')}.`;
}
