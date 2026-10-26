import type { Severity, Verdict } from '@/lib/types';
import { RULES, type RuleStatus } from '@/lib/rules';

export type Tone = 'red' | 'amber' | 'green' | 'none';

export function toneOfSeverity(s: Severity): Tone {
  return s === 'Red' ? 'red' : 'amber';
}

export function toneOfVerdict(v: Verdict): Tone {
  return v === 'Red' ? 'red' : v === 'Amber' ? 'amber' : 'green';
}

export function sevClass(tone: Tone): string {
  return `sev-${tone === 'none' ? 'none' : tone}`;
}

export function SevChip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`sev-chip ${sevClass(tone)}`}>
      <span className="dot" aria-hidden="true" />
      {children}
    </span>
  );
}

/**
 * Ten cells, one per rule. A judge scanning fifty bookings sees the shape of
 * each one's problems before clicking in.
 */
export function RuleStrip({
  statuses, large = false,
}: {
  statuses: Record<string, RuleStatus>;
  large?: boolean;
}) {
  const label = (id: string, status: RuleStatus) => {
    const meta = RULES.find((r) => r.id === id);
    const word =
      status === 'red' ? 'failing' :
      status === 'amber' ? 'caution' :
      status === 'clear' ? 'clear' : 'not applicable to this booking';
    return `${id} ${meta?.name ?? ''} — ${word}`;
  };
  return (
    <div className={`rule-strip${large ? ' rule-strip-lg' : ''}`} role="img" aria-label="Rule results, ten rules">
      {RULES.map((r) => (
        <span
          key={r.id}
          className="rule-cell"
          data-status={statuses[r.id] ?? 'na'}
          title={label(r.id, statuses[r.id] ?? 'na')}
        />
      ))}
    </div>
  );
}
