'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import type { QueueEntry } from '@/components/Queue';
import { download } from '@/components/Upload';
import { toBook, type Book } from '@/lib/dashboard';
import { blankBooking, cloneBooking, makeFixtures } from '@/lib/fixtures';
import { startOfDay } from '@/lib/format';
import type { ParseResult, ParseWarning } from '@/lib/parse-xlsx';
import { applyAllFixes, check } from '@/lib/rules';
import { buildCorrectedWorkbook } from '@/lib/sample-xlsx';
import type { Booking, CheckResult, Issue, Weights } from '@/lib/types';

/**
 * The session, lifted out of the page.
 *
 * Every screen reads the same bookings and the same engine results, so the
 * control tower cannot disagree with the dossier. It lives in the layout
 * shared by all the app routes, which means moving between them keeps the
 * work loaded — a full page reload does not, and should not, because nothing
 * is stored anywhere.
 */

export const DRAFT_ID = 'BK-NEW';

export type Pane = 'queue' | 'check' | 'chat';
export type Theme = 'system' | 'light' | 'dark';

export function hasContent(b: Booking): boolean {
  return b.items.length > 0 || b.seller !== '' || b.destCity !== '' || b.pallets !== null;
}

interface Session {
  bookings: Booking[];
  entries: QueueEntry[];
  selected: Booking;
  selectedId: string;
  result: CheckResult;
  book: Book;
  today: Date;
  weights: Weights | null;
  warnings: ParseWarning[];
  drawer: boolean;
  pane: Pane;
  theme: Theme;
  loaded: boolean;
  showDossier: boolean;

  select: (id: string) => void;
  setToday: (d: Date) => void;
  setWeights: (w: Weights | null) => void;
  setDrawer: (open: boolean | ((v: boolean) => boolean)) => void;
  setPane: (p: Pane) => void;
  setTheme: (t: Theme) => void;

  mutate: (id: string, fn: (b: Booking) => void) => void;
  applyToSelected: (fn: (b: Booking) => void) => void;
  onApplyFix: (issue: Issue) => void;
  onApplyAllFixes: () => void;
  /** Every safe fix the engine offers, on every booking in the book. */
  applyAllAcrossBook: () => void;
  loadDemo: () => void;
  onParsed: (r: ParseResult) => void;
  downloadCorrected: () => Promise<void>;
}

const Ctx = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession outside BookingsProvider');
  return s;
}

export function BookingsProvider({ children }: { children: React.ReactNode }) {
  const [bookings, setBookings] = useState<Booking[]>(() => [blankBooking(DRAFT_ID)]);
  const [selectedId, setSelectedId] = useState<string>(DRAFT_ID);
  const [today, setToday] = useState<Date>(() => startOfDay(new Date()));
  const [weights, setWeights] = useState<Weights | null>(null);
  const [warnings, setWarnings] = useState<ParseWarning[]>([]);
  const [drawer, setDrawer] = useState(false);
  const [pane, setPane] = useState<Pane>('check');
  const [theme, setThemeState] = useState<Theme>('system');
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

  useEffect(() => {
    try {
      const saved = localStorage.getItem('preflight-theme');
      if (saved === 'dark' || saved === 'light') setThemeState(saved);
    } catch { /* private window */ }
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    const root = document.documentElement;
    if (next === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', next);
    try {
      if (next === 'system') localStorage.removeItem('preflight-theme');
      else localStorage.setItem('preflight-theme', next);
    } catch { /* private window */ }
  }, []);

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

  /** Every portfolio screen reads this, never its own copy of the engine. */
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

  const applyAllAcrossBook = useCallback(() => {
    setBookings((list) => list.map((b) => {
      const copy = cloneBooking(b);
      applyAllFixes(copy, today, { hsTitles });
      return copy;
    }));
  }, [today, hsTitles]);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setWeights(null);
    setDrawer(false);
  }, []);

  const loadDemo = useCallback(() => {
    setBookings((list) => {
      const draft = list.find((b) => b.id === DRAFT_ID) ?? blankBooking(DRAFT_ID);
      return [...makeFixtures(today), draft];
    });
    setSelectedId('BK-101');
    setWarnings([]);
    setWeights(null);
    setDrawer(false);
    setPane('check');
  }, [today]);

  /**
   * Any app route reached with #demo arrives with the book already loaded,
   * so a link from the landing page never lands on an empty screen. The hash
   * is cleared afterwards so a reload is an honest empty start.
   */
  const demoAsked = useRef(false);
  useEffect(() => {
    if (demoAsked.current) return;
    if (typeof window === 'undefined' || window.location.hash !== '#demo') return;
    demoAsked.current = true;
    loadDemo();
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, [loadDemo]);

  const onParsed = useCallback((r: ParseResult) => {
    setWarnings(r.warnings);
    if (r.bookings.length === 0) return;
    setBookings((list) => {
      const draft = list.find((b) => b.id === DRAFT_ID) ?? blankBooking(DRAFT_ID);
      return [...r.bookings, draft];
    });
    setSelectedId(r.bookings[0].id);
    setWeights(null);
    setDrawer(false);
    setPane('check');
  }, []);

  const downloadCorrected = useCallback(async () => {
    const corrected = bookings
      .filter((b) => b.id !== DRAFT_ID || hasContent(b))
      .map((b) => {
        const copy = cloneBooking(b);
        applyAllFixes(copy, today, { highConfidenceOnly: true });
        return copy;
      });
    download(await buildCorrectedWorkbook(corrected), 'preflight-corrected.xlsx');
  }, [bookings, today]);

  const value: Session = {
    bookings, entries, selected, selectedId, result, book, today, weights, warnings,
    drawer, pane, theme,
    loaded: entries.length > 0,
    showDossier: hasContent(selected) || selected.items.length > 0,
    select, setToday, setWeights, setDrawer, setPane, setTheme,
    mutate, applyToSelected, onApplyFix, onApplyAllFixes, applyAllAcrossBook,
    loadDemo, onParsed, downloadCorrected,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
