'use client';

import { gbp } from '@/lib/format';
import { ruleStatuses } from '@/lib/rules';
import type { Booking, CheckResult } from '@/lib/types';
import { RuleStrip, sevClass, toneOfVerdict } from './Severity';

export interface QueueEntry {
  booking: Booking;
  result: CheckResult;
}

const RANK = { Red: 0, Amber: 1, Clear: 2 } as const;

/** Severity first, then money at risk. */
export function sortQueue(entries: QueueEntry[]): QueueEntry[] {
  return [...entries].sort((a, z) => {
    const r = RANK[a.result.verdict] - RANK[z.result.verdict];
    if (r !== 0) return r;
    const m = z.result.exposure - a.result.exposure;
    if (Math.abs(m) > 0.005) return m;
    return a.booking.id.localeCompare(z.booking.id);
  });
}

export function Queue({
  entries, selectedId, onSelect,
}: {
  entries: QueueEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const sorted = sortQueue(entries);
  const red = sorted.filter((e) => e.result.verdict === 'Red').length;
  const amber = sorted.filter((e) => e.result.verdict === 'Amber').length;

  return (
    <nav aria-label="Exceptions queue">
      <div className="queue-head">
        <h2 className="t-section">Shipments</h2>
        <p className="t-small muted" style={{ marginTop: 2 }}>
          {sorted.length} loaded
          {red > 0 && <> · {red} blocked</>}
          {amber > 0 && <> · {amber} caution</>}
        </p>
      </div>

      <ul>
        {sorted.map(({ booking, result }) => {
          const tone = toneOfVerdict(result.verdict);
          const statuses = ruleStatuses(booking, result.issues);
          return (
            <li key={booking.id}>
              <button
                type="button"
                className={`queue-row ${sevClass(tone)}`}
                aria-current={booking.id === selectedId}
                onClick={() => onSelect(booking.id)}
              >
                <span className="queue-row-top">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <span className="dot" aria-hidden="true" />
                    <span className="t-mono">{booking.id}</span>
                  </span>
                  <span className="t-small sev-text">
                    {result.verdict === 'Clear'
                      ? 'Clear'
                      : `${result.redCount ? `${result.redCount} red` : ''}${result.redCount && result.amberCount ? ' · ' : ''}${result.amberCount ? `${result.amberCount} amber` : ''}`}
                  </span>
                </span>

                <span className="t-small" style={{ display: 'block', marginTop: 3 }}>
                  {booking.seller || 'Seller not stated'}
                </span>
                <span className="t-small muted" style={{ display: 'block' }}>
                  {[booking.originCity, booking.destCity].filter(Boolean).join(' to ') || 'Route not stated'}
                  {result.exposure > 0 && <> · {gbp(result.exposure)} at risk</>}
                </span>

                <RuleStrip statuses={statuses} />
              </button>
            </li>
          );
        })}
      </ul>

      {sorted.length === 0 && (
        <p className="t-small muted" style={{ padding: '14px' }}>
          Nothing loaded yet. Upload a workbook or load the demo set.
        </p>
      )}
    </nav>
  );
}
