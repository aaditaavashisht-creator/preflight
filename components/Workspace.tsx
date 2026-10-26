'use client';

import { BookingCard } from '@/components/BookingCard';
import { useSession } from '@/components/BookingsProvider';
import { Carrier } from '@/components/Carrier';
import { Chat } from '@/components/Chat';
import { CheckRun } from '@/components/CheckRun';
import { Confirmation } from '@/components/Confirmation';
import { Issues } from '@/components/Issues';
import { ItemsTable } from '@/components/ItemsTable';
import { Queue } from '@/components/Queue';
import { Readiness } from '@/components/Readiness';
import { Upload } from '@/components/Upload';
import { VerdictBand } from '@/components/Verdict';
import { RULE_CARDS } from '@/lib/dashboard';
import { fmtDate } from '@/lib/format';

/** One booking, in detail: the queue beside it and the conversation to the right. */
export function Workspace() {
  const s = useSession();
  const {
    selected, selectedId, result, entries, today, weights, warnings,
    drawer, pane, setDrawer, setPane, setWeights, showDossier,
  } = s;

  return (
    <>
      <h1 className="sr-only">Check a shipment</h1>
      <nav className="segmented" aria-label="Panes">
        <button type="button" aria-pressed={pane === 'queue'} onClick={() => setPane('queue')}>Shipments</button>
        <button type="button" aria-pressed={pane === 'check'} onClick={() => setPane('check')}>Check</button>
        <button type="button" aria-pressed={pane === 'chat'} onClick={() => setPane('chat')}>Chat</button>
      </nav>

      <div className="workspace">
        {drawer && <div className="drawer-scrim" onClick={() => setDrawer(false)} />}

        <aside className="col-queue pane" data-open={drawer ? 'true' : 'false'} data-active={pane === 'queue'}>
          <Upload today={today} onParsed={s.onParsed} onDemo={s.loadDemo} warnings={warnings} />
          <Queue
            entries={entries}
            selectedId={selectedId}
            onSelect={(id) => { s.select(id); setPane('check'); }}
          />
        </aside>

        <main className="col-dossier pane" data-active={pane === 'check'}>
          <div className="dossier-inner">
            {!showDossier ? (
              <EmptyState onDemo={s.loadDemo} onChat={() => setPane('chat')} />
            ) : (
              <>
                <VerdictBand booking={selected} result={result} />
                <Issues
                  issues={result.issues}
                  onApply={s.onApplyFix}
                  onApplyAll={s.onApplyAllFixes}
                  booking={selected}
                />
                <Carrier
                  booking={selected}
                  rec={result.recommendation}
                  weights={weights}
                  onWeights={setWeights}
                />
                <Confirmation booking={selected} result={result} today={today} />
                <BookingCard booking={selected} result={result} />
                <ItemsTable booking={selected} issues={result.issues} />

                {/* How it was checked, rather than what is wrong. Folded away. */}
                <details className="card explain">
                  <summary className="t-section">Readiness, stage by stage</summary>
                  <div className="explain-body">
                    <Readiness booking={selected} result={result} />
                  </div>
                </details>
                <details className="card explain">
                  <summary className="t-section">How this was checked</summary>
                  <div className="explain-body">
                    <CheckRun booking={selected} result={result} />
                  </div>
                </details>
                <p className="t-label" style={{ textAlign: 'center', padding: '4px 0 0' }}>
                  Today is treated as {fmtDate(today)}. Everything runs in this browser; nothing is
                  uploaded, stored or sent anywhere.
                </p>
              </>
            )}
          </div>
        </main>

        <aside className="col-rail pane" data-active={pane === 'chat'}>
          <Chat
            booking={selected}
            bookings={entries.map((e) => e.booking)}
            today={today}
            onApply={s.applyToSelected}
            onSelectBooking={(id) => s.select(id)}
          />
        </aside>
      </div>
    </>
  );
}

/**
 * Nothing is loaded yet, so show what will be checked rather than a small card
 * in a lot of empty space. The rulebook is the product; it may as well be the
 * first thing a stranger reads.
 */
function EmptyState({ onDemo, onChat }: { onDemo: () => void; onChat: () => void }) {
  return (
    <>
      <section className="card empty">
        <h2 className="t-section">Two ways to start</h2>
        <p className="t-body prose" style={{ marginTop: 8 }}>
          Describe a shipment in the conversation on the right and I will ask for whatever you
          leave out. Or drop your own Bookings and Items spreadsheet on the left and I will check
          every row against the same ten rules.
        </p>
        <div className="empty-actions">
          <button type="button" className="btn btn-primary" onClick={onDemo}>Load the demo set</button>
          <button type="button" className="btn" onClick={onChat}>Describe a shipment</button>
        </div>
      </section>

      <section className="card">
        <div className="rulebook-head">
          <h2 className="t-section">What gets checked</h2>
          <p className="t-label">
            {RULE_CARDS.filter((r) => r.stops).length} stop a shipment ·{' '}
            {RULE_CARDS.filter((r) => !r.stops).length} cost time or money
          </p>
        </div>
        <ul className="rulebook-grid">
          {RULE_CARDS.map((r) => (
            <li key={r.id} className={`rulebook-item ${r.stops ? 'sev-red' : 'sev-amber'}`}>
              <span className="rulebook-top">
                <span className="t-mono rulebook-id">{r.id}</span>
                <span className="t-label sev-text">{r.stops ? 'Stops it' : 'Costs you'}</span>
              </span>
              <span className="t-small rulebook-name">{r.title}</span>
              <span className="t-small muted rulebook-why">{r.why}</span>
            </li>
          ))}
        </ul>
        <p className="t-small muted prose" style={{ marginTop: 4 }}>
          Every failure names the field that is wrong and what to put there instead. Nothing is
          uploaded; the whole rulebook runs in this browser.
        </p>
      </section>
    </>
  );
}
