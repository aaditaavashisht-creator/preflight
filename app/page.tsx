'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookingCard } from '@/components/BookingCard';
import { Carrier } from '@/components/Carrier';
import { Chat } from '@/components/Chat';
import { CheckRun } from '@/components/CheckRun';
import { Confirmation } from '@/components/Confirmation';
import { Issues } from '@/components/Issues';
import { ItemsTable } from '@/components/ItemsTable';
import { Queue, type QueueEntry } from '@/components/Queue';
import { Readiness } from '@/components/Readiness';
import { Upload, download } from '@/components/Upload';
import ControlTower from '@/components/preflight/ControlTower';
import { VerdictBand } from '@/components/Verdict';
import { toBook } from '@/lib/dashboard';
import { blankBooking, cloneBooking, makeFixtures } from '@/lib/fixtures';
import { fmtDate, startOfDay } from '@/lib/format';
import type { ParseResult, ParseWarning } from '@/lib/parse-xlsx';
import { applyAllFixes, check } from '@/lib/rules';
import { buildCorrectedWorkbook } from '@/lib/sample-xlsx';
import type { Booking, Issue, Weights } from '@/lib/types';

const DRAFT_ID = 'BK-NEW';

function hasContent(b: Booking): boolean {
  return b.items.length > 0 || b.seller !== '' || b.destCity !== '' || b.pallets !== null;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Pane = 'queue' | 'check' | 'chat';
/** The whole book at once, or the one booking in front of you. */
type View = 'book' | 'shipment';

export default function Page() {
  const [bookings, setBookings] = useState<Booking[]>(() => [blankBooking(DRAFT_ID)]);
  const [selectedId, setSelectedId] = useState<string>(DRAFT_ID);
  const [today, setToday] = useState<Date>(() => startOfDay(new Date()));
  const [weights, setWeights] = useState<Weights | null>(null);
  const [warnings, setWarnings] = useState<ParseWarning[]>([]);
  const [drawer, setDrawer] = useState(false);
  const [pane, setPane] = useState<Pane>('check');
  const [view, setView] = useState<View>('shipment');
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');
  const [hsTitles, setHsTitles] = useState<Record<string, string>>({});

  /**
   * The official tariff vocabulary is 204 KB, so it is not in the first load.
   * It arrives a moment later and only widens the suggestions; the rules and
   * the verdicts are identical with or without it, because code validity is
   * checked against the subheading list that ships in the bundle.
   */
  useEffect(() => {
    let alive = true;
    import('@/lib/generated/hs-lookup.json')
      .then((m) => { if (alive) setHsTitles(m.default as Record<string, string>); })
      .catch(() => { /* the curated table still covers the common goods */ });
    return () => { alive = false; };
  }, []);
  const masthead = useRef<HTMLElement>(null);

  // The masthead wraps on narrow screens, so the sticky columns have to learn
  // its real height rather than assume one.
  useEffect(() => {
    const el = masthead.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const sync = () => {
      document.documentElement.style.setProperty('--masthead-h', `${Math.round(el.getBoundingClientRect().height)}px`);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('preflight-theme');
      if (saved === 'dark' || saved === 'light') setTheme(saved);
    } catch { /* private window */ }
  }, []);

  const setThemeAndStore = (next: 'system' | 'light' | 'dark') => {
    setTheme(next);
    const root = document.documentElement;
    if (next === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', next);
    try {
      if (next === 'system') localStorage.removeItem('preflight-theme');
      else localStorage.setItem('preflight-theme', next);
    } catch { /* private window */ }
  };

  const selected = bookings.find((b) => b.id === selectedId) ?? bookings[0];

  /** The queue uses the booking's own priority; only the dossier takes slider overrides. */
  const entries: QueueEntry[] = useMemo(
    () => bookings
      .filter((b) => b.id !== DRAFT_ID || hasContent(b))
      .map((b) => ({ booking: b, result: check(b, today, undefined, { hsTitles }) })),
    [bookings, today, hsTitles],
  );

  const result = useMemo(
    () => check(selected, today, weights ?? undefined, { hsTitles }),
    [selected, today, weights, hsTitles],
  );

  /** The portfolio view reads the same results the queue does, never its own. */
  const book = useMemo(() => toBook(entries, today), [entries, today]);

  const mutate = useCallback((id: string, fn: (b: Booking) => void) => {
    setBookings((list) => list.map((b) => {
      if (b.id !== id) return b;
      const copy = cloneBooking(b);
      fn(copy);
      return copy;
    }));
  }, []);

  const applyToSelected = useCallback(
    (fn: (b: Booking) => void) => mutate(selectedId, fn),
    [mutate, selectedId],
  );

  const onApplyFix = useCallback((issue: Issue) => {
    if (!issue.fix) return;
    applyToSelected((b) => issue.fix!.apply(b));
  }, [applyToSelected]);

  /** Every fix on the booking, applied in order, re-running the rules between each. */
  const onApplyAllFixes = useCallback(() => {
    applyToSelected((b) => { applyAllFixes(b, today, { hsTitles }); });
  }, [applyToSelected, today, hsTitles]);

  function loadDemo() {
    const draft = bookings.find((b) => b.id === DRAFT_ID) ?? blankBooking(DRAFT_ID);
    setBookings([...makeFixtures(today), draft]);
    setSelectedId('BK-101');
    setWarnings([]);
    setWeights(null);
    setDrawer(false);
    setPane('check');
  }

  function onParsed(r: ParseResult) {
    const draft = bookings.find((b) => b.id === DRAFT_ID) ?? blankBooking(DRAFT_ID);
    setWarnings(r.warnings);
    if (r.bookings.length === 0) return;
    setBookings([...r.bookings, draft]);
    setSelectedId(r.bookings[0].id);
    setWeights(null);
    setDrawer(false);
    setPane('check');
  }

  async function downloadCorrected() {
    const corrected = bookings
      .filter((b) => b.id !== DRAFT_ID || hasContent(b))
      .map((b) => {
        const copy = cloneBooking(b);
        applyAllFixes(copy, today, { highConfidenceOnly: true });
        return copy;
      });
    download(await buildCorrectedWorkbook(corrected), 'preflight-corrected.xlsx');
  }

  const loaded = entries.length > 0;
  const showDossier = hasContent(selected) || selected.items.length > 0;

  return (
    <div className="shell">
      <header className="masthead" ref={masthead}>
        <div className="masthead-inner">
          {/* The control tower already is the shipment list, so the drawer
              that opens the queue has nothing to add while it is up. */}
          {view === 'shipment' && (
            <button
              type="button"
              className="btn drawer-btn"
              aria-expanded={drawer}
              onClick={() => setDrawer((d) => !d)}
            >
              Shipments
            </button>
          )}

          <div style={{ minWidth: 0 }}>
            <p className="t-section" style={{ letterSpacing: '-.01em' }}>Pre-flight</p>
            <p className="t-label" style={{ color: 'inherit', opacity: .8 }}>
              Catch it before it ships, not after it is stuck
            </p>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="t-label" style={{ color: 'inherit', opacity: .85 }} htmlFor="today">
              Treat today as
            </label>
            {/* Tabbing into a date field focuses a segment inside its shadow
                tree, so the ring has to live on a wrapper that can see it. */}
            <span className="date-wrap">
              <input
                id="today"
                type="date"
                className="input"
                value={isoDate(today)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  const [y, m, d] = v.split('-').map(Number);
                  setToday(new Date(y, m - 1, d));
                }}
              />
            </span>
            <button
              type="button"
              className="btn"
              aria-pressed={view === 'book'}
              disabled={!loaded}
              onClick={() => setView((v) => (v === 'book' ? 'shipment' : 'book'))}
            >
              {view === 'book' ? 'Back to the shipment' : 'Control tower'}
            </button>
            <button type="button" className="btn" onClick={downloadCorrected} disabled={!loaded}>
              Download corrected sheet
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setThemeAndStore(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Switch between light and dark"
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>
      </header>

      {view === 'shipment' && (
      <nav className="segmented" aria-label="Panes">
        <button type="button" aria-pressed={pane === 'queue'} onClick={() => setPane('queue')}>Shipments</button>
        <button type="button" aria-pressed={pane === 'check'} onClick={() => setPane('check')}>Check</button>
        <button type="button" aria-pressed={pane === 'chat'} onClick={() => setPane('chat')}>Chat</button>
      </nav>
      )}

      {view === 'book' ? (
        <ControlTower
          book={book}
          onOpen={(id) => {
            setSelectedId(id);
            setWeights(null);
            setView('shipment');
            setPane('check');
          }}
          onQueue={() => {
            setView('shipment');
            setPane('queue');
            setDrawer(true);
          }}
        />
      ) : (
      <div className="workspace">
        {drawer && <div className="drawer-scrim" onClick={() => setDrawer(false)} />}

        <aside className="col-queue pane" data-open={drawer ? 'true' : 'false'} data-active={pane === 'queue'}>
          <Upload today={today} onParsed={onParsed} onDemo={loadDemo} warnings={warnings} />
          <Queue
            entries={entries}
            selectedId={selectedId}
            onSelect={(id) => { setSelectedId(id); setDrawer(false); setWeights(null); setPane('check'); }}
          />
        </aside>

        <main className="col-dossier pane" data-active={pane === 'check'}>
          <div className="dossier-inner">
            {!showDossier ? (
              <EmptyState onDemo={loadDemo} onChat={() => setPane('chat')} />
            ) : (
              <>
                <VerdictBand booking={selected} result={result} />
                <Issues
                  issues={result.issues}
                  onApply={onApplyFix}
                  onApplyAll={onApplyAllFixes}
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
            onApply={applyToSelected}
            onSelectBooking={(id) => { setSelectedId(id); setWeights(null); }}
          />
        </aside>
      </div>
      )}
    </div>
  );
}

function EmptyState({ onDemo, onChat }: { onDemo: () => void; onChat: () => void }) {
  return (
    <section className="card empty">
      <h2 className="t-section">Two ways to start</h2>
      <p className="t-body prose" style={{ marginTop: 8 }}>
        Describe a shipment in the conversation on the right and I will ask for whatever you leave
        out. Or drop your own Bookings and Items spreadsheet on the left and I will check every row
        against the same ten rules.
      </p>
      <div className="empty-actions">
        <button type="button" className="btn btn-primary" onClick={onDemo}>Load the demo set</button>
        <button type="button" className="btn" onClick={onChat}>Describe a shipment</button>
      </div>
      <hr className="hr" />
      <p className="t-small muted prose">
        Ten rules, each one a thing that actually holds shipments at a border or short-receives them
        at a warehouse. Every failure says which field is wrong and what to put there instead.
      </p>
    </section>
  );
}
