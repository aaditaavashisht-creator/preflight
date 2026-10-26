'use client';

import { gbp } from '@/lib/format';
import { RULES } from '@/lib/rules';
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

/** The code stays as a quiet tag; hovering it explains the rule. */
export function RuleTag({ rule }: { rule: string }) {
  const meta = RULES.find((r) => r.id === rule);
  return (
    <span
      className="rule-tag t-mono"
      tabIndex={0}
      title={meta ? `${meta.id} — ${meta.name}.\n\n${meta.description}` : rule}
    >
      {rule}
    </span>
  );
}

export function Issues({
  issues, onApply, onApplyAll, booking,
}: {
  issues: Issue[];
  onApply: (issue: Issue) => void;
  onApplyAll: () => void;
  booking: Booking;
}) {
  const total = issues.reduce((n, i) => n + (i.impactCost || 0), 0);
  const fixable = issues.filter((i) => i.fix).length;
  const reds = issues.filter((i) => i.severity === 'Red').length;
  const ambers = issues.length - reds;

  return (
    <section className="card" aria-labelledby="check-h">
      <div className="card-head">
        <h3 id="check-h" className="t-section">
          {issues.length === 0
            ? 'Nothing is wrong'
            : reds > 0 && ambers > 0
              ? `${reds} will stop this shipment, ${ambers} more worth clearing`
              : reds > 0
                ? `${reds} thing${reds === 1 ? '' : 's'} will stop this shipment`
                : `${ambers} thing${ambers === 1 ? '' : 's'} worth clearing`}
        </h3>
        <span className="t-small muted">{issues.length} of ten rules</span>
      </div>

      {issues.length === 0 ? (
        <>
          <p className="t-body prose">
            The commodity codes are real, the value reconciles to the item lines, the cartons pack
            out, a carrier will take the weight, and the collection date is real.
          </p>
          <RuleGuide booking={booking} issues={issues} />
        </>
      ) : (
        <>
          {fixable > 0 && (
            <div className="fix-all">
              <button type="button" className="btn btn-solid" onClick={onApplyAll}>
                Apply {fixable === issues.length ? 'all ' : ''}{fixable} safe fix{fixable === 1 ? '' : 'es'}
              </button>
              <span className="t-small muted">
                {fixable < issues.length
                  ? `${issues.length - fixable} need${issues.length - fixable === 1 ? 's' : ''} a decision only you can make.`
                  : 'Each one re-runs all ten rules.'}
              </span>
            </div>
          )}

          <div className="issue-list">
            {issues.map((issue, n) => (
              <IssueRow
                key={`${issue.rule}-${issue.sku ?? ''}-${n}`}
                issue={issue}
                share={total > 0 ? (issue.impactCost || 0) / total : 0}
                onApply={onApply}
              />
            ))}
          </div>

          <p className="t-label" style={{ marginTop: 12 }}>
            Days and pounds are planning estimates from typical customs and freight charges, except
            where the shipment&apos;s own numbers give a real figure.
          </p>

          <RuleGuide booking={booking} issues={issues} />
        </>
      )}
    </section>
  );
}

/** Headline, the fix, and the working folded away behind it. */
function IssueRow({
  issue, share, onApply,
}: {
  issue: Issue; share: number; onApply: (i: Issue) => void;
}) {
  const tone = toneOfSeverity(issue.severity);
  return (
    <article className={`issue ${sevClass(tone)}`}>
      <div className="issue-top">
        <p className="t-body issue-headline">{issue.headline}</p>
        <RuleTag rule={issue.rule} />
      </div>

      {issue.impactCost > 0 && (
        <p className="risk t-small">
          <span
            className="risk-track"
            role="img"
            aria-label={`${Math.round(share * 100)} percent of this booking's exposure`}
          >
            <span style={{ width: `${Math.max(share * 100, 4)}%` }} />
          </span>
          <span className="muted">
            {gbp(issue.impactCost)} at risk, {Math.round(share * 100)}% of this booking&apos;s exposure
          </span>
        </p>
      )}

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
          <span>No safe automatic fix. This one needs a number only you can confirm.</span>
        </p>
      )}

      <details className="working">
        <summary className="t-small">Show the working</summary>
        <div className="working-body">
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
          <p className="t-small">{issue.diagnosis}</p>
          {issue.confidence && (
            <p className="t-label" style={{ marginTop: 6 }}>{issue.confidence} confidence in this diagnosis</p>
          )}
          {issue.suggestion && (
            <div className="note">
              <p className="t-label">Suggestion, not a fix</p>
              <p className="t-small" style={{ marginTop: 3 }}>{issue.suggestion}</p>
            </div>
          )}
        </div>
      </details>
    </article>
  );
}
