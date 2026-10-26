import { feasibility, palletFixFor, recommend } from './carrier';
import { lane, serviceName } from './carriers';
import { addDays, daysBetween, fmtDate, round2, startOfDay } from './format';
import {
  COSTS, DG_HS_LABELS, DG_REMEDY, detectDg, diagnoseCartons, diagnoseCounts,
  diagnoseHs, diagnoseValue, type CountDiagnosis,
} from './diagnose';
import type { Booking, CheckResult, Issue, Severity, Verdict, Weights } from './types';

export interface RuleMeta {
  id: string;
  name: string;
  severity: Severity;
  stage: 'Paperwork clear' | 'Counts agree' | 'Freight accepted' | 'Ready for collection';
  /** What it catches, and what happens when it is missed. */
  description: string;
}

export const RULES: RuleMeta[] = [
  {
    id: 'R-01', name: 'Every item needs an HS code of at least 6 digits',
    severity: 'Red', stage: 'Paperwork clear',
    description:
      'The commodity code is what the customs entry is filed on. A short code is usually a ' +
      'six digit code whose leading zero a spreadsheet dropped. Without a full code the entry ' +
      'cannot be filed and the pallet sits at the border.',
  },
  {
    id: 'R-02', name: 'Declared value matches the item lines',
    severity: 'Red', stage: 'Paperwork clear',
    description:
      'The booking total has to equal quantity times unit price across the items, within 1%. ' +
      'A gap means either the header or one line is wrong, and customs query the entry rather ' +
      'than guess which.',
  },
  {
    id: 'R-03', name: 'Units per carton x cartons equals quantity',
    severity: 'Red', stage: 'Counts agree',
    description:
      'Each item line has to pack out. When it does not, the receiving warehouse counts ' +
      'something different from the manifest and raises a shortage against you.',
  },
  {
    id: 'R-04', name: 'Booking cartons equal the sum of item cartons',
    severity: 'Red', stage: 'Counts agree',
    description:
      'The header carton total has to equal the item lines added up. A mismatch means the ' +
      'carrier manifest disagrees with what is on the pallet before it even leaves.',
  },
  {
    id: 'R-05', name: 'Weight per pallet is within a carrier ceiling',
    severity: 'Red', stage: 'Freight accepted',
    description:
      'Gross weight divided by pallets has to be inside at least one service ceiling on the ' +
      'lane. The ceilings are not ordered by price, so a heavy shipment loses the premium ' +
      'service first and can end up with nothing that will take it.',
  },
  {
    id: 'R-06', name: 'No lithium batteries, aerosols or flammable liquids',
    severity: 'Red', stage: 'Freight accepted',
    description:
      'A general road groupage trailer will not carry dangerous goods undeclared, and when ' +
      'they are found at the hub the whole trailer is refused, not just your pallet.',
  },
  {
    id: 'R-07', name: 'Gross weight covers the net weight of the goods',
    severity: 'Amber', stage: 'Counts agree',
    description:
      'Gross includes cartons, pallets and wrap, so it cannot sit below the weight of the ' +
      'goods themselves. The hub weighs every pallet and bills a surcharge for a mismatch.',
  },
  {
    id: 'R-08', name: 'Warehouse deliveries need a booked appointment',
    severity: 'Amber', stage: 'Ready for collection',
    description:
      'A warehouse turns away a trailer that arrives without a slot. Slots at EU fulfilment ' +
      'centres run three to five working days out, so booking late costs a redelivery.',
  },
  {
    id: 'R-09', name: 'Every item needs a country of origin',
    severity: 'Amber', stage: 'Paperwork clear',
    description:
      'Origin is where the goods were made, not where they ship from. Leaving it blank loses ' +
      'any preferential duty on the entry and invites a customs query.',
  },
  {
    id: 'R-10', name: 'Ready-to-ship date must not be in the past',
    severity: 'Amber', stage: 'Ready for collection',
    description:
      'A past ready date does not get a late collection. It gets no collection at all, ' +
      'because the window closed and nothing re-opens it automatically.',
  },
];

export const RULE_IDS = RULES.map((r) => r.id);

export type RuleStatus = 'clear' | 'amber' | 'red' | 'na';

function nf(n: number): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: 2 });
}
function money(n: number): string {
  return `£${n.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;
}

/* ------------------------------------------------------------------ */

export function validate(booking: Booking, todayInput?: Date): Issue[] {
  const today = startOfDay(todayInput ?? new Date());
  const out: Issue[] = [];
  const items = booking.items;

  /* ---- R-01 HS code ---- */
  for (const item of items) {
    const d = diagnoseHs(item);
    if (d.branch === 'ok') continue;
    const sku = item.sku;
    out.push({
      rule: 'R-01',
      severity: 'Red',
      sku,
      branch: d.branch,
      title: `${sku} cannot clear customs on the code given`,
      observed: d.code === '' ? 'No commodity code' : `Commodity code ${d.code} (${d.code.length} digits)`,
      expected: 'A commodity code of at least 6 digits',
      diagnosis: d.diagnosis,
      confidence: d.confidence,
      suggestion: d.suggestion,
      fix: d.proposal
        ? {
            label: `Set ${sku} HS code to ${d.proposal}`,
            delta: 'clears the customs hold',
            apply: (b) => {
              const it = b.items.find((i) => i.sku === sku);
              if (it) it.hsCode = d.proposal!;
            },
          }
        : null,
      impactDays: COSTS.customsHoldDays,
      impactCost: COSTS.customsHoldDays[1] * COSTS.storagePerDay + COSTS.brokerAmendment,
      costWhy:
        `Up to ${COSTS.customsHoldDays[1]} days held at £${COSTS.storagePerDay} a day storage, ` +
        `plus a £${COSTS.brokerAmendment} broker amendment to re-file the entry.`,
    });
  }

  /* ---- R-02 declared value ---- */
  const value = diagnoseValue(booking);
  if (value.branch !== 'ok' && value.branch !== 'not-applicable') {
    let fix: Issue['fix'] = null;
    if (value.branch === 'header-zero') {
      const target = round2(value.computed);
      fix = {
        label: `Set declared value to ${money(target)}`,
        delta: `closes the ${money(Math.abs(value.gap))} gap`,
        apply: (b) => {
          b.declaredValue = target;
          b.valueInferred = false;
        },
      };
    } else if (value.branch === 'item-price' && value.culpritSku && value.proposedUnitPrice !== null) {
      const sku = value.culpritSku;
      const price = value.proposedUnitPrice;
      fix = {
        label: `Set ${sku} unit price to £${price.toFixed(2)}`,
        delta: `closes the ${money(Math.abs(value.gap))} gap`,
        apply: (b) => {
          const it = b.items.find((i) => i.sku === sku);
          if (it) it.unitPrice = price;
        },
      };
    }
    out.push({
      rule: 'R-02',
      severity: 'Red',
      branch: value.branch,
      sku: value.culpritSku ?? undefined,
      title: 'Declared value does not match the item lines',
      observed: `Declared ${money(value.declared)}, item lines come to ${money(round2(value.computed))}`,
      expected: 'The two agree to within 1%',
      diagnosis: value.diagnosis,
      confidence: value.confidence,
      fix,
      impactDays: COSTS.customsHoldDays,
      impactCost: value.cost,
      costWhy: value.costWhy,
    });
  }

  /* ---- R-03 pack-out, per item ---- */
  // Indexed by row, not by sku: a judge's sheet can list the same sku twice.
  const counts: CountDiagnosis[] = items.map((item) => diagnoseCounts(item));
  for (let n = 0; n < items.length; n += 1) {
    const item = items[n];
    const d = counts[n];
    if (d.branch === 'ok' || d.branch === 'not-applicable') continue;
    const sku = item.sku;
    let fix: Issue['fix'] = null;
    if (d.branch === 'cartons' && d.correctedCartons !== null) {
      const c = d.correctedCartons;
      fix = {
        label: `Set ${sku} cartons to ${c}`,
        delta: d.cost > 0 ? `${money(round2(d.cost))} no longer at risk` : 'reconciles the pack-out',
        apply: (b) => {
          const it = b.items.find((i) => i.sku === sku);
          if (it) it.cartons = c;
        },
      };
    } else if (d.branch === 'packsize' && d.correctedUnitsPerCarton !== null) {
      const u = d.correctedUnitsPerCarton;
      fix = {
        label: `Set ${sku} pack size to ${u} a carton`,
        delta: d.cost > 0 ? `${money(round2(d.cost))} no longer at risk` : 'reconciles the pack-out',
        apply: (b) => {
          const it = b.items.find((i) => i.sku === sku);
          if (it) it.unitsPerCarton = u;
        },
      };
    }
    out.push({
      rule: 'R-03',
      severity: 'Red',
      sku,
      branch: d.branch,
      title: `${sku} does not pack out`,
      observed: `${nf(d.unitsPerCarton)} a carton x ${nf(d.cartons)} cartons = ${nf(d.packed)} units, quantity says ${nf(d.quantity)}`,
      expected: 'Units per carton x cartons equals the quantity shipped',
      diagnosis: d.diagnosis,
      confidence: d.confidence,
      fix,
      impactDays: [2, 5],
      impactCost: round2(d.cost),
      costWhy: d.costWhy,
    });
  }

  /* ---- R-04 booking cartons ---- */
  const cartons = diagnoseCartons(booking, counts);
  if (cartons.branch !== 'ok' && cartons.branch !== 'not-applicable') {
    let fix: Issue['fix'] = null;
    if (cartons.branch === 'header') {
      const target = cartons.itemSum;
      fix = {
        label: `Set booking cartons to ${target}`,
        delta: cartons.cost > 0 ? `${money(round2(cartons.cost))} no longer at risk` : 'reconciles the manifest',
        apply: (b) => {
          b.cartons = target;
          b.cartonsInferred = false;
        },
      };
    } else if (cartons.branch === 'single-item' && cartons.culpritSku) {
      const sku = cartons.culpritSku;
      const corrected = counts[items.findIndex((i) => i.sku === sku)]?.correctedCartons ?? null;
      if (corrected !== null) {
        fix = {
          label: `Set ${sku} cartons to ${corrected}`,
          delta: 'closes R-03 and R-04 together',
          apply: (b) => {
            const it = b.items.find((i) => i.sku === sku);
            if (it) it.cartons = corrected;
          },
        };
      }
    }
    out.push({
      rule: 'R-04',
      severity: 'Red',
      branch: cartons.branch,
      sku: cartons.culpritSku ?? undefined,
      title: 'The booking carton total does not match the item lines',
      observed: `Booking says ${nf(cartons.booking)} cartons, item lines add up to ${nf(cartons.itemSum)}`,
      expected: 'The booking total equals the sum of the item lines',
      diagnosis: cartons.diagnosis,
      confidence: cartons.confidence,
      fix,
      impactDays: [2, 5],
      impactCost: round2(cartons.cost),
      costWhy: cartons.costWhy,
    });
  }

  /* ---- R-05 weight per pallet, as a feasibility filter ---- */
  const feas = feasibility(booking);
  if (feas.measurable && feas.laneKnown && feas.survivors.length === 0) {
    const pf = palletFixFor(booking);
    const wpp = round2(feas.weightPerPallet!);
    const opens = pf?.opens ?? [];
    const cheapestOpen = pf
      ? feas.all
          .filter((c) => pf.kgPerPallet <= c.maxPerPallet)
          .sort((a, z) => a.pricePerPallet - z.pricePerPallet)[0]
      : undefined;
    const extraPallets = pf && booking.pallets ? Math.max(0, pf.pallets - booking.pallets) : 0;
    const cost = (cheapestOpen ? extraPallets * cheapestOpen.pricePerPallet : 0) + COSTS.reweigh;
    out.push({
      rule: 'R-05',
      severity: 'Red',
      branch: 'no-survivors',
      title: 'No service on this lane will take the pallets at this weight',
      observed: `${nf(booking.grossWeight!)} kg over ${nf(booking.pallets!)} pallets is ${nf(wpp)} kg a pallet`,
      expected: `At or under ${Math.max(...feas.all.map((c) => c.maxPerPallet))} kg a pallet, the heaviest ceiling on the ${booking.destCountry} lane`,
      diagnosis:
        `${nf(wpp)} kg a pallet is over every ceiling on this lane: ` +
        `${feas.all.map((c) => `${serviceName(c)} stops at ${c.maxPerPallet} kg`).join(', ')}. ` +
        (pf
          ? `Spread the same ${nf(booking.grossWeight!)} kg over ${pf.pallets} pallets and it comes ` +
            `down to ${nf(round2(pf.kgPerPallet))} kg a pallet, which opens ` +
            `${opens.length === 0 ? 'nothing' : opens.join(' and ')}. ` +
            `This is a re-plan, not a paperwork correction.`
          : ''),
      confidence: 'High',
      fix:
        pf && booking.pallets !== null && pf.pallets !== booking.pallets
          ? {
              label: `Re-plan on ${pf.pallets} pallets`,
              delta: `opens ${opens.length} service${opens.length === 1 ? '' : 's'}`,
              apply: (b) => {
                b.pallets = pf.pallets;
              },
            }
          : null,
      impactDays: [1, 3],
      impactCost: round2(cost),
      costWhy: cheapestOpen
        ? `${extraPallets} extra pallet${extraPallets === 1 ? '' : 's'} at ` +
          `£${cheapestOpen.pricePerPallet} on ${serviceName(cheapestOpen)}, plus a ` +
          `£${COSTS.reweigh} re-weigh and re-manifest surcharge.`
        : `A £${COSTS.reweigh} re-weigh and re-manifest surcharge, before any re-plan cost.`,
    });
  }

  /* ---- R-06 dangerous goods, per item ---- */
  for (const item of items) {
    const dg = detectDg(item);
    if (!dg.hit) continue;
    const sku = item.sku;
    const detectors: string[] = [];
    if (dg.keywords.length) detectors.push(`the description ("${dg.keywords.join('", "')}")`);
    if (dg.headings.length) {
      detectors.push(
        `the commodity code (heading ${dg.headings[0]}, ${DG_HS_LABELS[dg.headings[0]] ?? 'a restricted heading'})`,
      );
    }
    if (dg.soft.length) detectors.push(`a product type that usually contains a cell ("${dg.soft.join('", "')}")`);

    const hardHit = dg.keywords.length > 0 || dg.headings.length > 0;
    out.push({
      rule: 'R-06',
      severity: 'Red',
      sku,
      branch: hardHit ? 'declared' : 'confirm-cell',
      title: hardHit
        ? `${sku} is restricted on a road groupage trailer`
        : `${sku} needs a cell check before it can travel`,
      observed: `${item.description || sku}${item.hsCode ? `, code ${item.hsCode}` : ''}`,
      expected: 'No lithium batteries, aerosols or flammable liquids on a general groupage booking',
      diagnosis: hardHit
        ? `${sku} was flagged by ${detectors.join(' and ')}. A general road groupage trailer will not ` +
          `carry this undeclared, and the whole trailer is refused when it is found at the hub, not ` +
          `just your pallet. Take ${sku} off this consignment. ` + DG_REMEDY
        : `${sku} was flagged by ${detectors.join(' and ')}. Confirm whether a cell is fitted. If one is, this is ` +
          `dangerous goods. A false flag here costs you a phone call; an undeclared cell costs the ` +
          `whole trailer. ` + DG_REMEDY,
      confidence: hardHit ? 'High' : 'Medium',
      fix: null,
      impactDays: [5, 10],
      impactCost: COSTS.dgReturn,
      costWhy:
        `Refusal at the hub and a return leg runs about £${COSTS.dgReturn}, before the cost of ` +
        `re-booking the rest of the consignment.`,
    });
  }

  /* ---- R-07 gross vs net ---- */
  const weighed = items.filter((i) => i.unitWeight !== null && i.quantity !== null);
  if (booking.grossWeight !== null && weighed.length > 0) {
    const net = weighed.reduce((n, i) => n + i.unitWeight! * i.quantity!, 0);
    if (booking.grossWeight < net - 1e-9) {
      const pallets = booking.pallets ?? 0;
      const estimate = Math.round(net * 1.08 + pallets * 25);
      out.push({
        rule: 'R-07',
        severity: 'Amber',
        branch: 'under-net',
        title: 'Gross weight is below the weight of the goods themselves',
        observed: `Gross ${nf(booking.grossWeight)} kg against a net of ${nf(round2(net))} kg`,
        expected: 'Gross weight is at least the net weight, plus cartons and pallets',
        diagnosis:
          `The item lines weigh ${nf(round2(net))} kg of product on their own, and gross is ` +
          `${nf(booking.grossWeight)} kg. Gross has to include the cartons, the pallets and the wrap, ` +
          `so it cannot sit below net. Either a unit weight is in grams where kilos were wanted, or the ` +
          `gross figure is the net figure copied across. On ${nf(round2(net))} kg of product over ` +
          `${pallets || 'these'} pallet${pallets === 1 ? '' : 's'} a realistic gross is about ` +
          `${estimate} kg, which is net plus 8% for packaging plus 25 kg a pallet. Weigh it if you can.`,
        confidence: 'Medium',
        fix: {
          label: `Set gross weight to ${estimate} kg`,
          delta: 'estimate, weigh it to be sure',
          apply: (b) => {
            b.grossWeight = estimate;
          },
        },
        impactDays: [1, 2],
        impactCost: COSTS.reweigh,
        costWhy:
          `The hub weighs every pallet. A mismatch triggers a £${COSTS.reweigh} re-weigh and ` +
          `re-rate surcharge, billed after the shipment has already moved.`,
      });
    }
  }

  /* ---- R-08 warehouse appointment ---- */
  if (booking.destType === 'Warehouse' && booking.appointment !== 'Yes') {
    out.push({
      rule: 'R-08',
      severity: 'Amber',
      branch: booking.appointment === 'No' ? 'not-booked' : 'unknown',
      title: 'No delivery slot booked at the receiving warehouse',
      observed: booking.appointment === 'No' ? 'Appointment: No' : 'Appointment: not stated',
      expected: 'A booked delivery slot before the trailer leaves',
      diagnosis:
        `${booking.destCity || 'The destination'} is a warehouse, and a warehouse turns away a ` +
        `trailer that arrives without a slot. Slots at EU fulfilment centres run three to five ` +
        `working days out, so book it now rather than when the goods are on the road. Book the slot, ` +
        `then record it here.`,
      confidence: '',
      fix: {
        label: 'Record the delivery slot as booked',
        delta: 'clears the refused-delivery risk',
        apply: (b) => {
          b.appointment = 'Yes';
        },
      },
      impactDays: [3, 5],
      impactCost: COSTS.redelivery,
      costWhy:
        `A refused delivery and a redelivery on the next free slot runs about £${COSTS.redelivery}, ` +
        `plus the goods sitting on the vehicle in the meantime.`,
    });
  }

  /* ---- R-09 country of origin, per item ---- */
  for (const item of items) {
    const origin = (item.countryOfOrigin ?? '').trim();
    if (origin !== '') continue;
    const sku = item.sku;
    out.push({
      rule: 'R-09',
      severity: 'Amber',
      sku,
      branch: 'blank',
      title: `${sku} has no country of origin`,
      observed: 'Country of origin is blank',
      expected: 'The country where the goods were made',
      diagnosis:
        `Origin is where ${sku} was manufactured, not where it is shipping from. Leaving it blank ` +
        `means no preferential duty can be claimed and the entry gets queried. Your supplier or ` +
        `your own production record has this; a freight forwarder does not. Enter the country ` +
        `${sku} was made in on the item row.`,
      confidence: '',
      fix: null,
      impactDays: [2, 5],
      impactCost: COSTS.customsQuery,
      costWhy:
        `Handling a customs query runs about £${COSTS.customsQuery} in broker time, and any ` +
        `preferential duty you were entitled to is lost on this entry.`,
    });
  }

  /* ---- R-10 ready date ---- */
  if (booking.readyDate) {
    const ready = startOfDay(booking.readyDate);
    const overdue = daysBetween(ready, today);
    if (overdue > 0) {
      const target = addDays(today, 3);
      out.push({
        rule: 'R-10',
        severity: 'Amber',
        branch: 'past',
        title: 'The ready-to-ship date has already passed',
        observed: `Ready ${fmtDate(ready)}, which was ${overdue} day${overdue === 1 ? '' : 's'} ago`,
        expected: `A date from ${fmtDate(today)} onwards`,
        diagnosis:
          `A ready date in the past does not get a late collection. It gets no collection at all, ` +
          `because the collection window closed and nothing re-opens it automatically. The goods have ` +
          `been sitting for ${overdue} day${overdue === 1 ? '' : 's'}. Put a real date on it and the ` +
          `booking enters the collection run again.`,
        confidence: '',
        fix: {
          label: `Set ready date to ${fmtDate(target)}`,
          delta: 'puts it back in the collection run',
          apply: (b) => {
            b.readyDate = target;
          },
        },
        impactDays: [1, 3],
        impactCost: overdue * COSTS.storagePerDay,
        costWhy:
          `${overdue} day${overdue === 1 ? '' : 's'} past the ready date at about ` +
          `£${COSTS.storagePerDay} a day of origin storage, and the collection still has to be re-booked.`,
      });
    }
  }

  return sortIssues(out);
}

export function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((a, z) => {
    if (a.severity !== z.severity) return a.severity === 'Red' ? -1 : 1;
    if (a.rule !== z.rule) return a.rule.localeCompare(z.rule);
    return (a.sku ?? '').localeCompare(z.sku ?? '');
  });
}

export function verdictOf(issues: Issue[]): Verdict {
  if (issues.some((i) => i.severity === 'Red')) return 'Red';
  return issues.length > 0 ? 'Amber' : 'Clear';
}

/** Which of the ten rules were even applicable to this booking. */
export function applicability(b: Booking): Record<string, boolean> {
  const items = b.items;
  const anyItems = items.length > 0;
  return {
    'R-01': anyItems,
    'R-02': b.declaredValue !== null && items.some((i) => i.quantity !== null && i.unitPrice !== null),
    'R-03': items.some((i) => i.quantity !== null && i.unitsPerCarton !== null && i.cartons !== null),
    'R-04': b.cartons !== null && items.some((i) => i.cartons !== null),
    // Without a rate card there is no ceiling to test against, and a green
    // cell would claim a check that never ran.
    'R-05': b.grossWeight !== null && b.grossWeight > 0 && b.pallets !== null && b.pallets > 0
      && lane(b.destCountry).length > 0,
    'R-06': anyItems,
    'R-07': b.grossWeight !== null && items.some((i) => i.unitWeight !== null && i.quantity !== null),
    'R-08': b.destType === 'Warehouse',
    'R-09': anyItems,
    'R-10': b.readyDate !== null,
  };
}

export function ruleStatuses(b: Booking, issues: Issue[]): Record<string, RuleStatus> {
  const applies = applicability(b);
  const out: Record<string, RuleStatus> = {};
  for (const r of RULES) {
    if (!applies[r.id]) { out[r.id] = 'na'; continue; }
    const hits = issues.filter((i) => i.rule === r.id);
    if (hits.length === 0) { out[r.id] = 'clear'; continue; }
    out[r.id] = hits.some((i) => i.severity === 'Red') ? 'red' : 'amber';
  }
  return out;
}

export function exposureOf(issues: Issue[]): number {
  return round2(issues.reduce((n, i) => n + (i.impactCost || 0), 0));
}

/** The longest single hold, not the sum. Holds overlap; they do not queue. */
export function worstCaseDelay(issues: Issue[]): number {
  return issues.reduce((n, i) => Math.max(n, i.impactDays[1] ?? 0), 0);
}

export function netWeightOf(b: Booking): number | null {
  const weighed = b.items.filter((i) => i.unitWeight !== null && i.quantity !== null);
  if (weighed.length === 0) return null;
  return round2(weighed.reduce((n, i) => n + i.unitWeight! * i.quantity!, 0));
}

export function computedValueOf(b: Booking): number | null {
  const priced = b.items.filter((i) => i.quantity !== null && i.unitPrice !== null);
  if (priced.length === 0) return null;
  return round2(priced.reduce((n, i) => n + i.quantity! * i.unitPrice!, 0));
}

export function itemCartonsOf(b: Booking): number | null {
  const withCartons = b.items.filter((i) => i.cartons !== null);
  if (withCartons.length === 0) return null;
  return withCartons.reduce((n, i) => n + (i.cartons ?? 0), 0);
}

/** One call: rules, verdict, exposure and the carrier ranking together. */
export function check(b: Booking, today?: Date, weights?: Weights): CheckResult {
  const issues = validate(b, today);
  const recommendation = recommend(b, weights);
  const f = feasibility(b);
  return {
    verdict: verdictOf(issues),
    issues,
    redCount: issues.filter((i) => i.severity === 'Red').length,
    amberCount: issues.filter((i) => i.severity === 'Amber').length,
    exposure: exposureOf(issues),
    worstCaseDelay: worstCaseDelay(issues),
    recommendation,
    weightPerPallet: f.weightPerPallet === null ? null : round2(f.weightPerPallet),
    netWeight: netWeightOf(b),
    itemCartons: itemCartonsOf(b),
    computedValue: computedValueOf(b),
  };
}

/**
 * Applies fixes one at a time, re-running the rulebook after each, until no
 * issue offers one. Returns the number of fixes applied. Bounded so a
 * mis-specified fix cannot spin.
 */
export function applyAllFixes(
  b: Booking,
  today?: Date,
  opts?: { highConfidenceOnly?: boolean; limit?: number },
): number {
  const limit = opts?.limit ?? 25;
  let applied = 0;
  const seen = new Set<string>();
  while (applied < limit) {
    const issues = validate(b, today);
    const next = issues.find((i) => {
      if (!i.fix) return false;
      if (opts?.highConfidenceOnly && i.confidence !== 'High') return false;
      return !seen.has(`${i.rule}|${i.sku ?? ''}|${i.fix.label}`);
    });
    if (!next || !next.fix) break;
    seen.add(`${next.rule}|${next.sku ?? ''}|${next.fix.label}`);
    next.fix.apply(b);
    applied += 1;
  }
  return applied;
}
