'use client';

import { gbp } from '@/lib/format';
import type { Booking, Issue } from '@/lib/types';
import { sevClass, toneOfSeverity } from './Severity';
import { RuleGuide } from './RuleGuide';

function deltaKind(delta: string): 'good' | 'neutral' {
  return /estimate|weigh it|needs a decision/i.test(delta) ? 'neutral' : 'good';
}

function days([a, b]: [number, number]): string {
  if (a === b) return `${a} day${a === 1 ? '' : 's'}`;
  return `${a} to ${b} days`;
}

export function Issues({
  issues, onApply, booking,
}: {
  issues: Issue[];
  onApply: (issue: Issue) => void;
  booking: Booking;
}) {
  const total = issues.reduce((n, i) => n + (i.impactCost || 0), 0);

  return (
    <section className="card" aria-labelledby="check-h">
      <div className="card-head">
        <h3 id="check-h" className="t-section">Pre-flight check</h3>
        <span className="t-small muted">
          {issues.length === 0
            ? 'Ten of ten rules pass'
            : `${issues.length} of ten rules ${issues.length === 1 ? 'has' : 'have'} something to say`}
        </span>
      </div>

      <RuleGuide booking={booking} issues={issues} />

      {issues.length === 0 ? (
        <p className="t-body prose">
          Nothing to fix. The commodity codes are long enough, the value reconciles to the item
          lines, the cartons pack out, a carrier will take the weight, and the collection date is
          real.
        </p>
      ) : (
        <>
          <p className="t-small muted prose" style={{ marginBottom: 14 }}>
            Worst first. Days and pounds are planning estimates from typical customs and freight
            charges, except where the shipment&apos;s own numbers give a real figure.
          </p>

          <div>
            {issues.map((issue, n) => (
              <IssueCard
                key={`${issue.rule}-${issue.sku ?? ''}-${n}`}
                issue={issue}
                share={total > 0 ? (issue.impactCost || 0) / total : 0}
                onApply={onApply}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function IssueCard({
  issue, share, onApply,
}: {
  issue: Issue; share: number; onApply: (i: Issue) => void;
}) {
  const tone = toneOfSeverity(issue.severity);
  return (
    <article className={`issue ${sevClass(tone)}`}>
      <div className="issue-head">
        <h4 className="t-card-title">{issue.title}</h4>
        <span className="t-mono muted" style={{ flex: 'none' }}>{issue.rule}</span>
      </div>

      <div
        className="risk-bar"
        title={`${gbp(issue.impactCost)} of this booking's exposure`}
        role="img"
        aria-label={`${Math.round(share * 100)} percent of this booking's exposure`}
      >
        <span style={{ width: `${Math.max(share * 100, share > 0 ? 3 : 0)}%` }} />
      </div>

      <dl className="kv">
        <dt>Found</dt>
        <dd>{issue.observed}</dd>
        <dt>Expected</dt>
        <dd>{issue.expected}</dd>
        <dt>Consequence</dt>
        <dd>
          {days(issue.impactDays)} held
          {issue.impactCost > 0 && <> and about {gbp(issue.impactCost)} at risk</>}.{' '}
          <span className="muted">{issue.costWhy}</span>
        </dd>
      </dl>

      <div className="note">
        <p className="t-body">{issue.diagnosis}</p>
        {issue.confidence && (
          <p className="t-label" style={{ marginTop: 6 }}>
            {issue.confidence} confidence in this diagnosis
          </p>
        )}
      </div>

      {issue.suggestion && (
        <div className="note">
          <p className="t-label">Suggestion, not a fix</p>
          <p className="t-small" style={{ marginTop: 3 }}>{issue.suggestion}</p>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        {issue.fix ? (
          <button type="button" className="action" onClick={() => onApply(issue)}>
            <span className="action-glyph" aria-hidden="true">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8.5 6.5 12 13 4" />
              </svg>
            </span>
            <span className="action-label">{issue.fix.label}</span>
            <span className="action-delta" data-kind={deltaKind(issue.fix.delta)}>{issue.fix.delta}</span>
          </button>
        ) : (
          <p className="no-fix">
            <span aria-hidden="true">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <circle cx="8" cy="8" r="6" /><path d="M8 5v4" /><path d="M8 11h.01" />
              </svg>
            </span>
            <span>
              There is no safe automatic fix for this one. It needs a number only you can confirm,
              so changing it here would be a guess dressed up as a correction.
            </span>
          </p>
        )}
      </div>
    </article>
  );
}
