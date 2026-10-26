'use client';

import { gbp, kg, qty } from '@/lib/format';
import type { Booking, CheckResult } from '@/lib/types';
import { SevChip, sevClass, toneOfVerdict } from './Severity';

const HEADLINE = {
  Red: 'Do not ship yet',
  Amber: 'Ship with caution',
  Clear: 'Clear to book',
} as const;

function sentence(b: Booking, r: CheckResult): string {
  const route = b.destCity ? `${b.originCity || 'the UK'} to ${b.destCity}` : 'this shipment';
  if (r.verdict === 'Red') {
    const n = r.redCount;
    return `${n} ${n === 1 ? 'thing' : 'things'} on ${route} will stop the shipment or hold it at the ` +
      `border. Each one below says which field is wrong and what to put there instead.`;
  }
  if (r.verdict === 'Amber') {
    return `Nothing here blocks the shipment, but ${r.amberCount} ` +
      `${r.amberCount === 1 ? 'thing is' : 'things are'} likely to cost you time or money on ` +
      `${route}. Worth clearing before the trailer leaves.`;
  }
  return `All ten checks pass on ${route}. The booking reconciles to the item lines and a carrier ` +
    `will take it at this weight.`;
}

export function VerdictBand({ booking, result }: { booking: Booking; result: CheckResult }) {
  const tone = toneOfVerdict(result.verdict);
  const weightDriving = result.issues.some((i) => i.rule === 'R-05');
  const cartonsDriving = result.issues.some((i) => i.rule === 'R-04');
  const rec = result.recommendation;

  return (
    <section aria-labelledby="verdict-h">
      <div className={`verdict-band ${sevClass(tone)}`}>
        <div className="verdict-top">
          <h2 id="verdict-h" className="t-display verdict-head">{HEADLINE[result.verdict]}</h2>
          <div className="verdict-id">
            <span className="t-mono">{booking.id}</span>
            <span className="t-small muted">{booking.seller || 'Seller not stated'}</span>
          </div>
        </div>

        <p className="t-body verdict-line">{sentence(booking, result)}</p>

        <div className="verdict-counts">
          {result.redCount > 0 && (
            <SevChip tone="red">
              {result.redCount} blocking {result.redCount === 1 ? 'issue' : 'issues'}
            </SevChip>
          )}
          {result.amberCount > 0 && (
            <SevChip tone="amber">
              {result.amberCount} to watch
            </SevChip>
          )}
          {result.issues.length === 0 && <SevChip tone="green">Ten of ten checks pass</SevChip>}
        </div>
      </div>

      <div className="stat-strip">
        {/* Exposure and delay are consequences, not drivers, so they stay in
            ink. Only a figure that is itself the failing field takes colour. */}
        <Stat
          value={gbp(result.exposure)}
          label={result.exposure > 0 ? `At risk across ${result.issues.length} issue${result.issues.length === 1 ? '' : 's'}` : 'Nothing at risk'}
          tone={tone}
          driving={false}
        />
        <Stat
          value={result.worstCaseDelay === 0 ? 'None' : `${result.worstCaseDelay} days`}
          label={result.worstCaseDelay > 0 ? 'Worst-case delay, longest single hold' : 'No delay expected'}
          tone={tone}
          driving={false}
        />
        <Stat
          value={result.weightPerPallet === null ? '—' : kg(result.weightPerPallet)}
          label={
            result.weightPerPallet === null
              ? 'Weight per pallet, not stated yet'
              : weightDriving
                ? 'Weight per pallet, over every ceiling'
                : `Weight per pallet, within ${rec.ranked.length || 'the'} service ceiling${rec.ranked.length === 1 ? '' : 's'}`
          }
          tone={tone}
          driving={weightDriving}
        />
        <Stat
          value={`${qty(booking.pallets)} x ${qty(booking.cartons)}`}
          label={
            cartonsDriving && result.itemCartons !== null
              ? `Header cartons, item lines say ${result.itemCartons}`
              : 'Pallets and cartons'
          }
          tone={tone}
          driving={cartonsDriving}
        />
      </div>
    </section>
  );
}

function Stat({
  value, label, tone, driving,
}: {
  value: string; label: string; tone: ReturnType<typeof toneOfVerdict>; driving: boolean;
}) {
  return (
    <div className={`stat ${sevClass(tone)}`} data-driving={driving ? 'true' : 'false'}>
      <span className="t-stat stat-num">{value}</span>
      <span className="t-label stat-label">{label}</span>
    </div>
  );
}
