'use client';

import { RULES, ruleStatuses, type RuleStatus } from '@/lib/rules';
import type { Booking, Issue } from '@/lib/types';
import { sevClass } from './Severity';

const TONE = { red: 'red', amber: 'amber', clear: 'green', na: 'none' } as const;
const WORD: Record<RuleStatus, string> = {
  red: 'failing', amber: 'caution', clear: 'passes', na: 'not applicable',
};

/**
 * What each of the ten rules checks, and where this booking stands on it.
 * Collapsed by default: the issue cards are the thing to read first.
 */
export function RuleGuide({ booking, issues }: { booking: Booking; issues: Issue[] }) {
  const statuses = ruleStatuses(booking, issues);
  const red = RULES.filter((r) => r.severity === 'Red');
  const amber = RULES.filter((r) => r.severity === 'Amber');

  return (
    <details className="rule-guide">
      <summary className="t-small">
        What the ten rules check
        <span className="t-label" style={{ marginLeft: 8 }}>
          six stop a shipment, four cost time or money
        </span>
      </summary>

      <div className="rule-guide-body">
        <Group title="Red — the shipment must not go until these clear" rules={red} statuses={statuses} />
        <Group title="Amber — risky, should be fixed or checked" rules={amber} statuses={statuses} />
      </div>
    </details>
  );
}

function Group({
  title, rules, statuses,
}: {
  title: string;
  rules: typeof RULES;
  statuses: Record<string, RuleStatus>;
}) {
  return (
    <section style={{ marginTop: 12 }}>
      <p className="t-label">{title}</p>
      <ul className="rule-list">
        {rules.map((r) => {
          const st = statuses[r.id] ?? 'na';
          return (
            <li key={r.id} className={`rule-item ${sevClass(TONE[st])}`}>
              <span className="rule-item-head">
                <span className="t-mono">{r.id}</span>
                <span className="t-card-title">{r.name}</span>
                <span className="sev-chip" style={{ marginLeft: 'auto', flex: 'none' }}>
                  <span className="dot" aria-hidden="true" />
                  {WORD[st]}
                </span>
              </span>
              <p className="t-small muted">{r.description}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
