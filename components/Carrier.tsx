'use client';

import { gbp, pct, round2 } from '@/lib/format';
import { PRIORITY_WEIGHTS } from '@/lib/carrier';
import { serviceName } from '@/lib/carriers';
import type { Booking, Recommendation, Weights } from '@/lib/types';
import { SevChip } from './Severity';

export function Carrier({
  booking, rec, weights, onWeights,
}: {
  booking: Booking;
  rec: Recommendation;
  weights: Weights | null;
  onWeights: (w: Weights | null) => void;
}) {
  const showSliders = rec.priority === 'Balanced' && !rec.incomplete;
  const active = weights ?? rec.weights;

  return (
    <section className="card" aria-labelledby="carrier-h">
      <div className="card-head">
        <h3 id="carrier-h" className="t-section">Carrier</h3>
        <span className="t-small muted">
          {rec.priorityDefaulted ? 'Balanced, by default' : rec.priority}
          {booking.pallets ? ` · ${booking.pallets} pallet${booking.pallets === 1 ? '' : 's'}` : ''}
        </span>
      </div>

      {rec.incomplete ? (
        <p className="t-body prose">{rec.incompleteReason}</p>
      ) : !rec.feasible ? (
        <>
          <div style={{ marginBottom: 12 }}>
            <SevChip tone="red">Nothing on this lane will take it</SevChip>
          </div>
          <p className="t-body prose">{rec.reason}</p>
          {rec.palletFix && (
            <p className="t-body prose" style={{ marginTop: 10 }}>
              On {rec.palletFix.pallets} pallets it comes down to{' '}
              {round2(rec.palletFix.kgPerPallet)} kg a pallet, which opens{' '}
              {rec.palletFix.opens.length ? rec.palletFix.opens.join(' and ') : 'nothing on this lane'}.
            </p>
          )}
          <ExcludedOnly rec={rec} />
        </>
      ) : (
        <>
          {rec.priorityDefaulted && (
            <p className="t-label" style={{ marginBottom: 10 }}>
              No priority was given, so this is ranked Balanced. That is this tool&apos;s default,
              not something the seller said.
            </p>
          )}

          <p className="t-body prose">{rec.reason}</p>
          {rec.runnerUpTradeoff && (
            <p className="t-small muted prose" style={{ marginTop: 8 }}>
              {rec.nothingToRank ? '' : 'Runner-up: '}{rec.runnerUpTradeoff}
            </p>
          )}

          <div className="scroll-x" style={{ marginTop: 14 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Service</th>
                  <th scope="col" className="num">Transit</th>
                  <th scope="col" className="num">On time</th>
                  <th scope="col" className="num">Per pallet</th>
                  <th scope="col" className="num">Total</th>
                  <th scope="col" className="num">Score</th>
                  <th scope="col">Why</th>
                </tr>
              </thead>
              <tbody>
                {rec.ranked.map((s, n) => (
                  <tr key={serviceName(s.row)} data-pick={n === 0 ? 'true' : undefined}>
                    <td>{serviceName(s.row)}</td>
                    <td className="num">{s.row.days} days</td>
                    <td className="num">{pct(s.row.onTime)}</td>
                    <td className="num">{gbp(s.row.pricePerPallet)}</td>
                    <td className="num price">{gbp(s.cost)}</td>
                    <td className="num">
                      <span className="score-cell">
                        <span className="score-bar" data-pick={n === 0 ? 'true' : undefined}>
                          <span style={{ width: `${Math.round(scoreWith(s, active) * 100)}%` }} />
                        </span>
                        {round2(scoreWith(s, active)).toFixed(2)}
                      </span>
                    </td>
                    <td className="t-small">
                      {n === 0 ? (rec.nothingToRank ? 'The only service that fits' : 'Recommended') : `${ordinal(n + 1)} on this priority`}
                    </td>
                  </tr>
                ))}
                {rec.excluded.map((e) => (
                  <tr key={serviceName(e.row)} data-excluded="true">
                    <td>{serviceName(e.row)}</td>
                    <td className="num">{e.row.days} days</td>
                    <td className="num">{pct(e.row.onTime)}</td>
                    <td className="num">{gbp(e.row.pricePerPallet)}</td>
                    <td className="num price">{gbp(e.cost)}</td>
                    <td className="num">—</td>
                    <td className="t-small">Excluded, caps at {e.ceiling} kg a pallet</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showSliders && (
            <>
              <hr className="hr" />
              <p className="t-label" style={{ marginBottom: 10 }}>
                Balanced is a judgement call. Move the weights and watch the ranking change.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Slider label="Cost" value={active.cost} onChange={(v) => onWeights({ ...active, cost: v })} />
                <Slider label="Speed" value={active.speed} onChange={(v) => onWeights({ ...active, speed: v })} />
                <Slider label="Reliability" value={active.reliability} onChange={(v) => onWeights({ ...active, reliability: v })} />
              </div>
              {weights && (
                <button type="button" className="btn btn-quiet" style={{ marginTop: 10 }} onClick={() => onWeights(null)}>
                  Put the weights back to 0.4 / 0.3 / 0.3
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function scoreWith(s: { costScore: number; speedScore: number; reliabilityScore: number }, w: Weights): number {
  return w.cost * s.costScore + w.speed * s.speedScore + w.reliability * s.reliabilityScore;
}

function ordinal(n: number): string {
  return ['', 'first', 'second', 'third', 'fourth'][n] ?? `${n}th`;
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const id = `w-${label.toLowerCase()}`;
  return (
    <div className="slider-row">
      <label className="t-small" htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="t-small num" style={{ textAlign: 'right' }}>{value.toFixed(2)}</span>
    </div>
  );
}

function ExcludedOnly({ rec }: { rec: Recommendation }) {
  if (rec.excluded.length === 0) return null;
  return (
    <div className="scroll-x" style={{ marginTop: 14 }}>
      <table className="tbl">
        <thead>
          <tr>
            <th scope="col">Service</th>
            <th scope="col" className="num">Ceiling</th>
            <th scope="col" className="num">Would have cost</th>
            <th scope="col">Why it is out</th>
          </tr>
        </thead>
        <tbody>
          {rec.excluded.map((e) => (
            <tr key={serviceName(e.row)} data-excluded="true">
              <td>{serviceName(e.row)}</td>
              <td className="num">{e.ceiling} kg</td>
              <td className="num price">{gbp(e.cost)}</td>
              <td className="t-small">
                {rec.weightPerPallet} kg a pallet is over its {e.ceiling} kg limit
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const BALANCED_DEFAULT = PRIORITY_WEIGHTS.Balanced;
