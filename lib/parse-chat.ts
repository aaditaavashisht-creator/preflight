import { DEST_CITIES, ORIGIN_CITIES } from './carriers';
import { MONTH_WORDS, addDays, daysBetween, fmtDate, gbp, kg, qty, startOfDay } from './format';
import type { Booking, Item, Priority } from './types';

/**
 * Deterministic extraction. Regex over a fixed vocabulary, never a model.
 * A model that is right 95% of the time is wrong on exactly the rows that
 * carry the planted errors.
 */

/* ------------------------------------------------------------------ *
 * Numbers in words
 * ------------------------------------------------------------------ */

const UNITS: Record<string, number> = {
  zero: 0, a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};

const WORD_NUM = Object.keys(UNITS).join('|');
/** Matches 12, 1,080, 7.5, or a number written out. */
const NUM = `(?:\\d[\\d,]*(?:\\.\\d+)?|(?:${WORD_NUM})(?:[ -](?:${WORD_NUM}))?)`;

export function toNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (/^\d[\d,]*(\.\d+)?$/.test(s)) {
    const n = Number(s.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  const parts = s.split(/[ -]+/);
  let total = 0;
  let any = false;
  for (const p of parts) {
    if (!(p in UNITS)) return null;
    total += UNITS[p];
    any = true;
  }
  return any ? total : null;
}

/** £7.2k, £7,200, 7200 pounds. */
export function toMoney(raw: string, suffix?: string): number | null {
  const n = toNumber(raw);
  if (n === null) return null;
  const s = (suffix ?? '').toLowerCase();
  if (s === 'k') return n * 1_000;
  if (s === 'm') return n * 1_000_000;
  return n;
}

/* ------------------------------------------------------------------ *
 * Dates
 * ------------------------------------------------------------------ */

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5, saturday: 6, sat: 6,
};

const MONTH_RE = Object.keys(MONTH_WORDS).sort((a, z) => z.length - a.length).join('|');

/** A bare day and month with no year rolls forward if more than 14 days past. */
function rollForward(d: Date, today: Date): Date {
  if (daysBetween(d, today) > 14) return new Date(d.getFullYear() + 1, d.getMonth(), d.getDate());
  return d;
}

export function extractDate(text: string, today: Date): Date | null {
  const t = text.toLowerCase();
  const base = startOfDay(today);

  if (/\btoday\b/.test(t)) return base;
  if (/\btomorrow\b/.test(t)) return addDays(base, 1);
  if (/\bday after tomorrow\b/.test(t)) return addDays(base, 2);

  const inDays = new RegExp(`\\bin\\s+(${NUM})\\s*(day|week|fortnight|month)s?\\b`).exec(t);
  if (inDays) {
    const n = toNumber(inDays[1]) ?? 1;
    const unit = inDays[2];
    if (unit === 'day') return addDays(base, n);
    if (unit === 'week') return addDays(base, n * 7);
    if (unit === 'fortnight') return addDays(base, n * 14);
    return addDays(base, n * 30);
  }
  if (/\bin\s+a\s+week\b/.test(t)) return addDays(base, 7);
  if (/\bnext\s+week\b/.test(t)) return addDays(base, 7);

  const wd = new RegExp(`\\b(?:(next|this)\\s+)?(${Object.keys(WEEKDAYS).join('|')})\\b`).exec(t);
  if (wd) {
    const target = WEEKDAYS[wd[2]];
    let delta = (target - base.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    if (wd[1] === 'next' && delta < 7 && base.getDay() !== 0) {
      // "next Monday" means the Monday of the week after this one when we are
      // already past the start of this week.
      const thisWeek = addDays(base, delta);
      if (daysBetween(base, thisWeek) < 7 && base.getDay() > target) delta += 7;
    }
    return addDays(base, delta);
  }

  // 05-11-2026, 05/11/2026
  const numeric = /\b(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?\b/.exec(t);
  if (numeric) {
    const day = +numeric[1];
    const month = +numeric[2];
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      if (numeric[3]) {
        const y = +numeric[3];
        return new Date(y < 100 ? 2000 + y : y, month - 1, day);
      }
      return rollForward(new Date(base.getFullYear(), month - 1, day), base);
    }
  }

  // "the 5th of November 2026", "5 Nov", "5th Nov"
  const dm = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?(${MONTH_RE})\\b\\.?\\s*(\\d{4})?`).exec(t);
  if (dm) {
    const month = MONTH_WORDS[dm[2]];
    const day = +dm[1];
    if (dm[3]) return new Date(+dm[3], month - 1, day);
    return rollForward(new Date(base.getFullYear(), month - 1, day), base);
  }

  // "November 5", "Nov 5th 2026"
  const md = new RegExp(`\\b(${MONTH_RE})\\b\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(\\d{4})?`).exec(t);
  if (md) {
    const month = MONTH_WORDS[md[1]];
    const day = +md[2];
    if (md[3]) return new Date(+md[3], month - 1, day);
    return rollForward(new Date(base.getFullYear(), month - 1, day), base);
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * Vocabulary
 * ------------------------------------------------------------------ */

const PRIORITY_WORDS: Array<[RegExp, Priority]> = [
  [/\b(no strong preference|no preference|whatever'?s best|whatever is best|don'?t mind|not fussed|no view|balanced|best overall|middle|mix of both)\b/, 'Balanced'],
  [/\b(cheap|cheapest|budget|low cost|lowest cost|save money|as cheap as|economy|least expensive|price matters)\b/, 'Cheapest'],
  [/\b(urgent|urgently|fast|fastest|asap|as soon as possible|quick|quickly|rush|express|speed|in a hurry|time critical)\b/, 'Fastest'],
  [/\b(reliable|reliability|most reliable|on time|on-time|has to arrive|must arrive|certainty|dependable|no risk|safest)\b/, 'Most reliable'],
];

/** [alternation body, canonical name]. Longest alternatives first. */
const COUNTRY_WORDS: Array<[string, string]> = [
  ['great britain|united kingdom|britain|england|scotland|wales|uk|gb', 'United Kingdom'],
  ['chinese|china|prc', 'China'],
  ['indian|india', 'India'],
  ['viet nam|vietnamese|vietnam', 'Vietnam'],
  ['turkish|turkiye|türkiye|turkey', 'Turkey'],
  ['deutschland|germany|german', 'Germany'],
];

const ORIGIN_PREFIX = '(?:made in|produced in|manufactured in|origin(?:ates)?(?: in| from)?|country of origin|from)';

/* ------------------------------------------------------------------ *
 * Product lines
 * ------------------------------------------------------------------ */

export interface ParsedItem extends Item {
  /** What the sentence said, so the inline form can show its working. */
  source: string;
}

const ITEM_MARKERS = [
  /\b(?:per|to a|in a|a)\s+(?:carton|box|case)\b/i,
  /\bhs\s*(?:code|heading)?\s*[:#]?\s*\d{4,10}\b/i,
  /\b(?:commodity|tariff)\s*code\s*[:#]?\s*\d{4,10}\b/i,
  /(?:at|@|for)\s*£?\s*\d[\d,]*(?:\.\d+)?\s*(?:each|a unit|per unit|apiece)\b/i,
  /£\s*\d[\d,]*(?:\.\d+)?\s*(?:each|a unit|per unit|apiece)\b/i,
];

export function looksLikeItemLine(sentence: string): boolean {
  if (!/\b\d[\d,]*\s+[a-z]/i.test(sentence)) return false;
  if (/\b\d[\d,]*\s*(?:pallets?|kg|kilos?|kilograms?)\b/i.test(sentence) && !ITEM_MARKERS.some((m) => m.test(sentence))) {
    return false;
  }
  return ITEM_MARKERS.some((m) => m.test(sentence));
}

let itemCounter = 0;
export function resetItemCounter(n = 0) { itemCounter = n; }

function skuFrom(description: string, explicit: string | null): string {
  if (explicit) return explicit.toUpperCase();
  const word = (description.match(/[a-z]{3,}/i) ?? ['ITEM'])[0].toUpperCase().slice(0, 4);
  itemCounter += 1;
  return `${word}-${String(itemCounter).padStart(2, '0')}`;
}

export function parseItemLine(sentence: string): ParsedItem | null {
  const s = sentence.trim();
  if (!looksLikeItemLine(s)) return null;

  const spans: Array<[number, number]> = [];
  const take = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(s);
    if (m) spans.push([m.index, m.index + m[0].length]);
    return m;
  };

  const hs = take(/\b(?:hs|commodity|tariff)\s*(?:code|heading)?\s*[:#]?\s*(\d{4,10})\b/i);
  const price = take(/(?:at|@|for|,)?\s*£\s*(\d[\d,]*(?:\.\d+)?)\s*(?:each|a unit|per unit|apiece)?/i);
  const perCarton = take(new RegExp(`\\b(${NUM})\\s*(?:per|to a|in a|a)\\s+(?:carton|box|case)\\b`, 'i'));
  const cartons = take(new RegExp(`\\b(${NUM})\\s+(?:cartons?|boxes|cases)\\b`, 'i'));
  const unitWeight = take(new RegExp(`\\b(${NUM})\\s*(?:kg|kilos?|kilograms?|g|grams?)\\s*(?:each|a unit|per unit|apiece)`, 'i'));
  const sku = take(/\bsku\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{1,14})\b/i);

  let origin = '';
  for (const [body, name] of COUNTRY_WORDS) {
    const m = new RegExp(`\\b${ORIGIN_PREFIX}\\s*:?\\s+(?:the\\s+)?(?:${body})\\b`, 'i').exec(s);
    if (m) { origin = name; spans.push([m.index, m.index + m[0].length]); break; }
  }

  // The quantity is the first number not already claimed by something else.
  let quantity: number | null = null;
  let qtySpan: [number, number] | null = null;
  const qtyRe = new RegExp(`(?:^|[^\\w£.])(${NUM})\\s+(?=[a-z])`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = qtyRe.exec(s)) !== null) {
    const start = m.index + m[0].indexOf(m[1]);
    const end = start + m[1].length;
    if (spans.some(([a, b]) => start >= a && start < b)) continue;
    quantity = toNumber(m[1]);
    qtySpan = [start, end];
    break;
  }
  if (qtySpan) spans.push(qtySpan);

  // Everything not claimed, cleaned up, is the description.
  let description = '';
  let cursor = 0;
  const ordered = [...spans].sort((a, z) => a[0] - z[0]);
  for (const [a, b] of ordered) {
    if (a > cursor) description += s.slice(cursor, a);
    cursor = Math.max(cursor, b);
  }
  description += s.slice(cursor);
  description = description
    .replace(/\b(?:at|@|for|each|a unit|per unit|apiece|made in|origin|from|manufactured in|the|sku|hs|commodity|tariff|code|heading)\b/gi, ' ')
    .replace(/[,;:.\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  description = description.replace(/^(?:and|of|with)\s+/i, '').trim();

  let weight = unitWeight ? toNumber(unitWeight[1]) : null;
  if (weight !== null && /\b(?:g|grams?)\s*(?:each|a unit|per unit|apiece)/i.test(unitWeight![0])) {
    weight = weight / 1000;
  }

  return {
    sku: skuFrom(description, sku ? sku[1] : null),
    description: description || 'Item',
    hsCode: hs ? hs[1] : '',
    quantity,
    unitPrice: price ? toNumber(price[1]) : null,
    unitsPerCarton: perCarton ? toNumber(perCarton[1]) : null,
    cartons: cartons ? toNumber(cartons[1]) : null,
    unitWeight: weight,
    countryOfOrigin: origin,
    source: s,
  };
}

/* ------------------------------------------------------------------ *
 * Relative changes. These win over any stray absolute match.
 * ------------------------------------------------------------------ */

type RelativeField = 'pallets' | 'cartons' | 'grossWeight' | 'declaredValue';

const RELATIVE_TARGETS: Array<[RegExp, RelativeField, number]> = [
  [new RegExp(`\\b(?:add|plus|another|one more|include|increase (?:it |them )?by|up (?:it|them) by|bump (?:it|them) by)\\s+(${NUM})?\\s*(?:more\\s+)?pallets?\\b`, 'i'), 'pallets', 1],
  [new RegExp(`\\b(?:drop|remove|minus|take off|take away|lose|reduce (?:it |them )?by|cut|fewer|one less)\\s+(${NUM})?\\s*pallets?\\b`, 'i'), 'pallets', -1],
  [new RegExp(`\\b(?:add|plus|another|one more|include|increase (?:it |them )?by)\\s+(${NUM})?\\s*(?:more\\s+)?(?:cartons?|boxes)\\b`, 'i'), 'cartons', 1],
  [new RegExp(`\\b(?:drop|remove|minus|take off|take away|lose|reduce (?:it |them )?by|cut|fewer|one less)\\s+(${NUM})?\\s*(?:cartons?|boxes)\\b`, 'i'), 'cartons', -1],
  [new RegExp(`\\b(?:add|plus|another|increase (?:it )?by)\\s+(${NUM})\\s*(?:kg|kilos?|kilograms?)\\b`, 'i'), 'grossWeight', 1],
  [new RegExp(`\\b(?:drop|remove|minus|take off|reduce (?:it )?by|knock off)\\s+(${NUM})\\s*(?:kg|kilos?|kilograms?)\\b`, 'i'), 'grossWeight', -1],
];

export interface RelativeChange {
  field: RelativeField;
  by: number;
  span: [number, number];
}

export function extractRelative(text: string): RelativeChange[] {
  const out: RelativeChange[] = [];
  for (const [re, field, sign] of RELATIVE_TARGETS) {
    const m = re.exec(text);
    if (!m) continue;
    if (out.some((o) => o.field === field)) continue;
    const n = m[1] ? (toNumber(m[1]) ?? 1) : 1;
    out.push({ field, by: sign * n, span: [m.index, m.index + m[0].length] });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * The extractor
 * ------------------------------------------------------------------ */

export type BookingField =
  | 'seller' | 'originCity' | 'destCity' | 'destType' | 'readyDate' | 'priority'
  | 'pallets' | 'cartons' | 'declaredValue' | 'grossWeight' | 'appointment';

export interface Extraction {
  /** Absolute values understood from this message. */
  patch: Partial<Booking>;
  /** Relative moves, already resolved against the current booking. */
  relative: RelativeChange[];
  /** Fields the relative handler claimed, removed from the absolute parse. */
  claimed: RelativeField[];
  items: ParsedItem[];
  /** Every field this message touched, in the order they were read. */
  understood: BookingField[];
}

function splitSentences(text: string): string[] {
  return text
    .split(/\s*(?:[;\n]|(?<=[a-z0-9)])\.(?:\s+|$))\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function extract(text: string, current: Booking, today: Date): Extraction {
  const sentences = splitSentences(text);
  const items: ParsedItem[] = [];
  const bookingParts: string[] = [];

  for (const s of sentences) {
    const item = parseItemLine(s);
    if (item) items.push(item);
    else bookingParts.push(s);
  }

  const rest = bookingParts.join('. ');
  const lower = rest.toLowerCase();

  // Relative first, so "add a pallet" cannot be read as "a pallet".
  const relative = extractRelative(rest);
  const claimed = relative.map((r) => r.field);

  // Blank out the relative spans so the absolute pass cannot see them at all.
  let masked = rest;
  for (const r of relative) {
    masked = masked.slice(0, r.span[0]) + ' '.repeat(r.span[1] - r.span[0]) + masked.slice(r.span[1]);
  }
  const m = masked.toLowerCase();

  const patch: Partial<Booking> = {};
  const understood: BookingField[] = [];
  const note = (f: BookingField) => { if (!understood.includes(f)) understood.push(f); };

  // Cities. The origin and destination vocabularies are disjoint, so a
  // direction word is not needed to tell them apart.
  for (const city of ORIGIN_CITIES) {
    if (new RegExp(`\\b${city}\\b`, 'i').test(m)) {
      patch.originCity = city;
      patch.originCountry = 'United Kingdom';
      note('originCity');
      break;
    }
  }
  for (const [city, country] of Object.entries(DEST_CITIES)) {
    if (new RegExp(`\\b${city}\\b`, 'i').test(m)) {
      patch.destCity = city.charAt(0).toUpperCase() + city.slice(1);
      patch.destCountry = country;
      note('destCity');
      break;
    }
  }

  if (!claimed.includes('pallets')) {
    const p = new RegExp(`\\b(${NUM})\\s*(?:x\\s*)?pallets?\\b`, 'i').exec(masked);
    if (p) { const n = toNumber(p[1]); if (n !== null) { patch.pallets = n; note('pallets'); } }
  }

  if (!claimed.includes('cartons')) {
    const c = new RegExp(`\\b(${NUM})\\s*(?:x\\s*)?(?:cartons?|boxes|cases)\\b`, 'i').exec(masked);
    if (c) { const n = toNumber(c[1]); if (n !== null) { patch.cartons = n; patch.cartonsInferred = false; note('cartons'); } }
  }

  if (!claimed.includes('grossWeight')) {
    const w = new RegExp(`\\b(${NUM})\\s*(?:kg|kgs|kilos?|kilograms?)\\b`, 'i').exec(masked);
    if (w) { const n = toNumber(w[1]); if (n !== null) { patch.grossWeight = n; note('grossWeight'); } }
  }

  if (!claimed.includes('declaredValue')) {
    const v = new RegExp(`£\\s*(${NUM})\\s*(k|m)?\\b`, 'i').exec(masked)
      ?? new RegExp(`\\b(${NUM})\\s*(k|m)?\\s*(?:gbp|pounds|quid)\\b`, 'i').exec(masked);
    if (v) {
      const n = toMoney(v[1], v[2]);
      if (n !== null) { patch.declaredValue = n; patch.valueInferred = false; note('declaredValue'); }
    }
  }

  // Destination type.
  if (/\b(warehouse|fulfil?lment cent(?:re|er)|3pl|distribution cent(?:re|er)|\bdc\b|fba)\b/i.test(m)) {
    patch.destType = 'Warehouse';
    note('destType');
  } else if (/\b(business address|business premises|trade address|commercial address|office|shop|store|retail)\b/i.test(m)) {
    patch.destType = 'Business address';
    note('destType');
  }

  // Appointment, stated either way round. Negatives are tested first.
  if (/\b(no (?:delivery )?(?:slot|appointment)|not booked|haven'?t booked|have not booked|without an? (?:slot|appointment)|(?:slot|appointment) (?:is )?(?:not|isn'?t) booked|no booking yet|still to book)\b/i.test(m)) {
    patch.appointment = 'No';
    note('appointment');
  } else if (/\b(?:slot|appointment|delivery) (?:is )?(?:booked|confirmed|arranged)|booked (?:a |the |our )?(?:delivery )?(?:slot|appointment)|we have an? (?:slot|appointment)|got a slot\b/i.test(m)) {
    patch.appointment = 'Yes';
    note('appointment');
  }

  // Priority.
  for (const [re, p] of PRIORITY_WORDS) {
    if (re.test(m)) { patch.priority = p; note('priority'); break; }
  }

  // Ready date.
  const d = extractDate(masked, today);
  if (d) { patch.readyDate = d; note('readyDate'); }

  // Seller.
  // The lead-in is matched either case; the company name must be capitalised.
  const seller = /(?:^|[\s,.])(?:[Ww]e(?:'re| are)|[Ii](?:'m| am)|[Tt]his is|[Ss]eller is|[Cc]ompany is|[Ss]hipping as|[Oo]n behalf of)\s+([A-Z][A-Za-z&'’-]*(?:\s+[A-Z][A-Za-z&'’-]*){0,3})/.exec(rest);
  if (seller && !/^(The|A|An|I|We|It)$/.test(seller[1])) {
    patch.seller = seller[1].trim();
    note('seller');
  }

  void lower;
  void current;
  return { patch, relative, claimed, items, understood };
}

/* ------------------------------------------------------------------ *
 * Applying what was understood, and saying so
 * ------------------------------------------------------------------ */

export interface SystemChange {
  /** "Pallets 3 to 4" */
  label: string;
}

function show(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return 'not set';
  if (v instanceof Date) return fmtDate(v);
  if (field === 'declaredValue') return gbp(v as number);
  if (field === 'grossWeight') return kg(v as number);
  if (typeof v === 'number') return qty(v);
  return String(v);
}

const FIELD_LABELS: Record<string, string> = {
  seller: 'Seller', originCity: 'Origin', destCity: 'Destination',
  destType: 'Destination type', readyDate: 'Ready date', priority: 'Priority',
  pallets: 'Pallets', cartons: 'Cartons', declaredValue: 'Declared value',
  grossWeight: 'Gross weight', appointment: 'Appointment',
};

/**
 * Applies an extraction to a booking in place and returns one capsule line per
 * change, so every understood change is echoed back.
 */
export function applyExtraction(b: Booking, e: Extraction): SystemChange[] {
  const changes: SystemChange[] = [];

  for (const rel of e.relative) {
    const before = b[rel.field] as number | null;
    const next = Math.max(0, (before ?? 0) + rel.by);
    if (next === before) continue;
    b[rel.field] = next as never;
    if (rel.field === 'cartons') b.cartonsInferred = false;
    if (rel.field === 'declaredValue') b.valueInferred = false;
    changes.push({ label: `${FIELD_LABELS[rel.field]} ${show(rel.field, before)} to ${show(rel.field, next)}` });
  }

  for (const [key, value] of Object.entries(e.patch)) {
    if (key === 'valueInferred' || key === 'cartonsInferred') continue;
    const field = key as keyof Booking;
    const before = b[field];
    const same =
      before instanceof Date && value instanceof Date
        ? before.getTime() === value.getTime()
        : before === value;
    if (same) continue;
    (b as unknown as Record<string, unknown>)[key] = value;
    if (key === 'originCity') b.originCountry = 'United Kingdom';
    const label = FIELD_LABELS[key];
    if (!label) continue;
    changes.push({
      label: before === null || before === '' || before === undefined
        ? `${label} set to ${show(key, value)}`
        : `${label} ${show(key, before)} to ${show(key, value)}`,
    });
  }
  if (e.patch.valueInferred === false) b.valueInferred = false;
  if (e.patch.cartonsInferred === false) b.cartonsInferred = false;

  for (const item of e.items) {
    const { source, ...rest } = item;
    void source;
    const existing = b.items.findIndex((i) => i.sku === rest.sku);
    if (existing >= 0) b.items[existing] = { ...rest };
    else b.items.push({ ...rest });
    changes.push({ label: `Item ${rest.sku} added` });
  }

  deriveTotals(b);
  return changes;
}

/** What the seller did not state, derived from the items and marked as derived. */
export function deriveTotals(b: Booking): void {
  if (b.items.length === 0) return;
  const priced = b.items.filter((i) => i.quantity !== null && i.unitPrice !== null);
  if ((b.declaredValue === null || b.valueInferred) && priced.length > 0) {
    b.declaredValue = Math.round(priced.reduce((n, i) => n + i.quantity! * i.unitPrice!, 0) * 100) / 100;
    b.valueInferred = true;
  }
  const carton = b.items.filter((i) => i.cartons !== null);
  if ((b.cartons === null || b.cartonsInferred) && carton.length > 0) {
    b.cartons = carton.reduce((n, i) => n + (i.cartons ?? 0), 0);
    b.cartonsInferred = true;
  }
}

/* ------------------------------------------------------------------ *
 * What to ask next — one question at a time, never a blank form
 * ------------------------------------------------------------------ */

export interface Question {
  field: BookingField | 'items';
  text: string;
  quickReplies: string[];
}

const QUESTIONS: Array<{ field: BookingField | 'items'; when: (b: Booking) => boolean; q: Question }> = [
  {
    field: 'destCity',
    when: (b) => b.destCity === '',
    q: {
      field: 'destCity',
      text: 'Where is it going? I price Berlin, Frankfurt and Hamburg in Germany, Paris and Lyon in France, and Amsterdam and Rotterdam in the Netherlands.',
      quickReplies: ['Berlin', 'Frankfurt', 'Paris', 'Amsterdam', 'Rotterdam'],
    },
  },
  {
    field: 'originCity',
    when: (b) => b.originCity === '',
    q: {
      field: 'originCity',
      text: 'Where does it collect from? London, Manchester, Birmingham or Leeds.',
      quickReplies: ['London', 'Manchester', 'Birmingham', 'Leeds'],
    },
  },
  {
    field: 'items',
    when: (b) => b.items.length === 0,
    q: {
      field: 'items',
      text: 'What is on the pallets? Give me a line like "1080 ceramic mugs at £5 each, 12 per carton, HS 691200, made in the UK" and I will fill in a form you can correct.',
      quickReplies: [],
    },
  },
  {
    field: 'pallets',
    when: (b) => b.pallets === null,
    q: { field: 'pallets', text: 'How many pallets?', quickReplies: ['1 pallet', '2 pallets', '3 pallets', '4 pallets'] },
  },
  {
    field: 'grossWeight',
    when: (b) => b.grossWeight === null,
    q: {
      field: 'grossWeight',
      text: 'What is the gross weight, pallets and packaging included? This is what decides which services will take it.',
      quickReplies: [],
    },
  },
  {
    field: 'destType',
    when: (b) => b.destType === '',
    q: {
      field: 'destType',
      text: 'Is it delivering to a warehouse or to a business address?',
      quickReplies: ['A warehouse', 'A business address'],
    },
  },
  {
    field: 'appointment',
    when: (b) => b.destType === 'Warehouse' && b.appointment === '',
    q: {
      field: 'appointment',
      text: 'Has a delivery slot been booked at that warehouse?',
      quickReplies: ['Yes, the slot is booked', 'No, not booked yet'],
    },
  },
  {
    field: 'readyDate',
    when: (b) => b.readyDate === null,
    q: {
      field: 'readyDate',
      text: 'When will it be ready to collect?',
      quickReplies: ['Tomorrow', 'In 7 days', 'Next Monday'],
    },
  },
  {
    field: 'priority',
    when: (b) => b.priority === '',
    q: {
      field: 'priority',
      text: 'What matters most on this one: price, speed, or arriving when it says it will?',
      quickReplies: ['Cheapest', 'Fastest', 'Most reliable', 'No strong preference'],
    },
  },
  {
    field: 'seller',
    when: (b) => b.seller === '',
    q: { field: 'seller', text: 'Last one: which company is shipping this?', quickReplies: [] },
  },
];

export function nextQuestion(b: Booking): Question | null {
  for (const entry of QUESTIONS) {
    if (entry.when(b)) return entry.q;
  }
  return null;
}

export function missingFields(b: Booking): Array<BookingField | 'items'> {
  return QUESTIONS.filter((e) => e.when(b)).map((e) => e.field);
}
