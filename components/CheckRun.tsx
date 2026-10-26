'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { RUN_GROUPS, runKey, runNodes } from '@/lib/readiness';
import { ruleStatuses } from '@/lib/rules';
import type { Booking, CheckResult } from '@/lib/types';

const STEP_MS = 120;
const SETTLE_MS = 90;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function CheckRun({ booking, result }: { booking: Booking; result: CheckResult }) {
  const statuses = useMemo(
    () => ruleStatuses(booking, result.issues),
    [booking, result.issues],
  );
  const nodes = useMemo(
    () => runNodes(booking, result.issues, statuses, result.recommendation),
    [booking, result.issues, statuses, result.recommendation],
  );
  const key = runKey(result.issues, result.recommendation);

  const [cursor, setCursor] = useState(nodes.length);
  const [narration, setNarration] = useState('');
  const [replayNonce, setReplayNonce] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Suppressed entirely when there is nothing to test against: every rule
  // would light green, and that would be a lie.
  const suppressed = booking.items.length === 0;

  useEffect(() => {
    // Any in-flight run is cancelled before a new one starts, or a stale
    // callback writes into freshly rendered nodes.
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];

    if (suppressed) return;

    if (prefersReducedMotion()) {
      setCursor(nodes.length);
      setNarration(summary(result));
      return;
    }

    setCursor(0);
    setNarration('Running the rulebook…');

    nodes.forEach((node, n) => {
      timers.current.push(setTimeout(() => {
        setCursor(n);
        setNarration(node.narration);
      }, n * STEP_MS));
    });
    timers.current.push(setTimeout(() => {
      setCursor(nodes.length);
      setNarration(summary(result));
    }, nodes.length * STEP_MS + SETTLE_MS));

    return () => {
      for (const t of timers.current) clearTimeout(t);
      timers.current = [];
    };
    // Keyed on the RESULT, so nudging a Balanced slider does not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, replayNonce, suppressed]);

  if (suppressed) return null;

  return (
    <section className="card" aria-labelledby="run-h">
      <div className="card-head">
        <h3 id="run-h" className="t-section">Check run</h3>
        <button type="button" className="btn btn-quiet" onClick={() => setReplayNonce((n) => n + 1)}>
          Replay
        </button>
      </div>

      <div className="scroll-x">
        <div className="run-groups">
          {RUN_GROUPS.map((group) => (
            <div className="run-group" key={group}>
              <p className="t-label">{group}</p>
              <div className="run-nodes">
                {nodes.map((node, n) => {
                  if (node.group !== group) return null;
                  const state = n > cursor ? 'pending' : n === cursor ? 'active' : node.status;
                  return (
                    <div className="node" key={node.id} data-state={state} title={node.narration}>
                      <span className="node-dot" aria-hidden="true" />
                      <span className="t-mono" style={{ fontSize: 11 }}>{node.label}</span>
                      <span style={{ marginLeft: 'auto', opacity: n >= cursor ? 0 : 1, transition: 'opacity .15s ease' }}>
                        {node.working}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="run-status t-small" aria-live="polite">{narration}</p>
    </section>
  );
}

function summary(result: CheckResult): string {
  const rec = result.recommendation;
  if (result.issues.length === 0) {
    return rec.winner
      ? `Ten of ten pass. ${rec.winner.row.carrier} ${rec.winner.row.service.toLowerCase()} at £${rec.winner.cost.toLocaleString('en-GB')}.`
      : 'Ten of ten pass.';
  }
  const red = result.redCount;
  const amber = result.amberCount;
  const bits = [
    red ? `${red} blocking` : '',
    amber ? `${amber} to watch` : '',
  ].filter(Boolean).join(', ');
  return rec.feasible && rec.winner
    ? `${bits}. Carrier would be ${rec.winner.row.carrier} ${rec.winner.row.service.toLowerCase()}.`
    : `${bits}. No carrier on this lane will take it as it stands.`;
}
