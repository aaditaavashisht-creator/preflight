/** Pure formatting and date helpers. No I/O, no locale guessing. */

export function gbp(n: number | null | undefined, opts?: { decimals?: boolean }): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const decimals = opts?.decimals ?? false;
  const abs = Math.abs(n);
  const body = abs.toLocaleString('en-GB', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  });
  return `${n < 0 ? '-' : ''}£${body}`;
}

/** Money that needs its pence, for unit prices. */
export function gbpExact(n: number | null | undefined): string {
  return gbp(n, { decimals: true });
}

export function qty(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-GB', { maximumFractionDigits: 2 });
}

export function kg(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} kg`;
}

export function pct(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n}%`;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const MONTH_WORDS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

/** DD-MM-YYYY, always. Never US order. */
export function fmtDate(d: Date | null | undefined): string {
  if (!d || Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

/** "5 November 2026", for prose. */
export function fmtDateLong(d: Date | null | undefined): string {
  if (!d || Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + n);
  return out;
}

export function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86_400_000);
}

export interface ParsedDate {
  date: Date | null;
  /** Day and month are both <= 12, so a US-ordered source would read differently. */
  ambiguous: boolean;
}

function buildDate(day: number, month: number, year: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }
  return d;
}

function normaliseYear(y: number): number {
  if (y >= 100) return y;
  return y >= 70 ? 1900 + y : 2000 + y;
}

/**
 * Reads DD-MM-YYYY, DD/MM/YYYY and DD.MM.YYYY, day first, always.
 * Returns null rather than guessing when the text is not a date in that shape.
 */
export function parseDMY(input: string | null | undefined): Date | null {
  return parseDMYDetailed(input).date;
}

export function parseDMYDetailed(input: string | null | undefined): ParsedDate {
  if (!input) return { date: null, ambiguous: false };
  const s = String(input).trim();

  // 2026-11-05 — ISO is unambiguous, so accept it.
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (iso) {
    return { date: buildDate(+iso[3], +iso[2], +iso[1]), ambiguous: false };
  }

  const m = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})$/.exec(s);
  if (m) {
    const day = +m[1];
    const month = +m[2];
    const year = normaliseYear(+m[3]);
    return { date: buildDate(day, month, year), ambiguous: day <= 12 && month <= 12 && day !== month };
  }

  // "5 Nov 2026" / "5 November 2026" / "Nov 5 2026"
  const dmWord = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?\s*(\d{2,4})?$/.exec(s);
  if (dmWord) {
    const month = MONTH_WORDS[dmWord[2].toLowerCase()];
    if (month) {
      const year = dmWord[3] ? normaliseYear(+dmWord[3]) : new Date().getFullYear();
      return { date: buildDate(+dmWord[1], month, year), ambiguous: false };
    }
  }
  const mdWord = /^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{2,4})?$/.exec(s);
  if (mdWord) {
    const month = MONTH_WORDS[mdWord[1].toLowerCase()];
    if (month) {
      const year = mdWord[3] ? normaliseYear(+mdWord[3]) : new Date().getFullYear();
      return { date: buildDate(+mdWord[2], month, year), ambiguous: false };
    }
  }

  return { date: null, ambiguous: false };
}

/** Working days, Monday to Friday, ignoring public holidays. */
export function addWorkingDays(from: Date, n: number): Date {
  let d = startOfDay(from);
  let left = n;
  while (left > 0) {
    d = addDays(d, 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) left -= 1;
  }
  return d;
}

export function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

/** Round to two places without the float dust. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
