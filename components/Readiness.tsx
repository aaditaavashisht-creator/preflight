'use client';

import { readiness } from '@/lib/readiness';
import { ruleStatuses } from '@/lib/rules';
import type { Booking, CheckResult } from '@/lib/types';
import { sevClass } from './Severity';

const TONE = { red: 'red', amber: 'amber', clear: 'green', na: 'none' } as const;

export function Readiness({ booking, result }: { booking: Booking; result: CheckResult }) {
  const statuses = ruleStatuses(booking, result.issues);
  const r = readiness(booking, result.issues, statuses);

  return (
    <section className="card" aria-labelledby="ready-h">
      <div className="card-head">
        <h3 id="ready-h" className="t-section">Readiness</h3>
        <span className="t-small muted">Five stages, ten rules, one owner each</span>
      </div>

      <p className={`t-body ${sevClass(r.heldAt ? TONE[r.heldAt.status] : 'green')}`} style={{ marginBottom: 12 }}>
        <span className="sev-text" style={{ fontWeight: 600 }}>{r.summary}</span>
      </p>

      <div className="stages">
        {r.stages.map((s) => {
          const held = r.heldAt?.name === s.name;
          return (
            <div key={s.name} className={`stage ${sevClass(TONE[s.status])}`} data-held={held ? 'true' : 'false'}>
              <span className="dot" aria-hidden="true" />
              <span className="stage-bar" role="img" aria-label={`${Math.round(s.progress * 100)} percent settled`}>
                <span style={{ width: `${Math.round(s.progress * 100)}%` }} />
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="t-card-title">
                  {s.name}
                  {held && <span className="t-label" style={{ marginLeft: 8 }}>held here</span>}
                </span>
                <span className="t-small muted" style={{ display: 'block' }}>
                  {s.who}. {s.detail}.
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
