import { DEST_CITIES } from './carriers';
import { parseDMYDetailed, titleCase } from './format';
import type { Booking, Item, Priority } from './types';

export type RawRow = Record<string, unknown>;

export interface ParseWarning {
  kind: 'orphan-item' | 'unknown-header' | 'ambiguous-date' | 'missing-sheet' | 'bad-row' | 'unknown-destination';
  message: string;
  row?: number;
  bookingId?: string;
}

export interface ParseResult {
  bookings: Booking[];
  warnings: ParseWarning[];
  droppedExampleRows: number;
}

/* ------------------------------------------------------------------ *
 * Header mapping
 *
 * A judge's file will not be byte-identical to the template, so headers
 * are normalised to lowercase alphanumerics and matched against a variant
 * list per field.
 * ------------------------------------------------------------------ */

export function normaliseHeader(h: unknown): string {
  return String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const BOOKING_HEADERS = {
  id: ['bookingid', 'booking', 'bookingref', 'bookingreference', 'reference', 'ref', 'id', 'shipmentid', 'consignment', 'consignmentid'],
  seller: ['seller', 'sellername', 'shipper', 'shippername', 'company', 'companyname', 'customer', 'account', 'exporter'],
  originCity: ['origincity', 'origin', 'collectioncity', 'fromcity', 'from', 'pickupcity', 'collectionfrom', 'originlocation'],
  originCountry: ['origincountry', 'countryoforiginbooking', 'fromcountry', 'collectioncountry'],
  destCity: ['destinationcity', 'destcity', 'destination', 'tocity', 'to', 'deliverycity', 'deliveryto', 'destinationlocation'],
  destCountry: ['destinationcountry', 'destcountry', 'tocountry', 'deliverycountry', 'country'],
  destType: ['destinationtype', 'desttype', 'deliverytype', 'addresstype', 'destinationaddresstype', 'typeofdestination', 'deliverypoint'],
  readyDate: ['readydate', 'readytoship', 'readytoshipdate', 'readyforcollection', 'collectiondate', 'shipdate', 'dispatchdate', 'readyon'],
  priority: ['priority', 'servicepriority', 'preference', 'servicelevel', 'shippingpriority'],
  pallets: ['pallets', 'palletcount', 'numberofpallets', 'noofpallets', 'totalpallets', 'palletqty'],
  cartons: ['cartons', 'totalcartons', 'cartoncount', 'numberofcartons', 'noofcartons', 'boxes', 'totalboxes', 'cartonsbooking'],
  declaredValue: ['declaredvalue', 'value', 'totalvalue', 'declaredvaluegbp', 'invoicevalue', 'goodsvalue', 'declaredvalue', 'valuegbp'],
  currency: ['currency', 'ccy', 'currencycode'],
  grossWeight: ['grossweight', 'grossweightkg', 'weight', 'weightkg', 'totalweight', 'totalweightkg', 'grosskg'],
  appointment: ['appointment', 'appointmentbooked', 'slotbooked', 'bookingslot', 'deliveryslot', 'deliveryappointment', 'slot', 'appointmentyn'],
} as const;

export const ITEM_HEADERS = {
  bookingId: BOOKING_HEADERS.id,
  sku: ['sku', 'itemcode', 'productcode', 'code', 'partnumber', 'itemsku', 'productsku', 'itemref'],
  description: ['description', 'itemdescription', 'productdescription', 'product', 'goodsdescription', 'goods', 'itemname', 'productname', 'name'],
  hsCode: ['hscode', 'hs', 'commoditycode', 'tariffcode', 'commodity', 'hstariff', 'customscode', 'tariff', 'hscode6'],
  quantity: ['quantity', 'qty', 'units', 'totalunits', 'unitsshipped', 'quantityunits', 'pieces', 'pcs'],
  unitPrice: ['unitprice', 'price', 'priceperunit', 'unitvalue', 'unitpricegbp', 'costperunit', 'unitcost'],
  unitsPerCarton: ['unitspercarton', 'perc arton', 'percarton', 'unitspercase', 'packsize', 'qtypercarton', 'unitsperbox', 'packqty', 'casepack'],
  cartons: ['cartons', 'itemcartons', 'cartoncount', 'boxes', 'numberofcartons', 'noofcartons', 'cases'],
  unitWeight: ['unitweight', 'weightperunit', 'unitweightkg', 'itemweight', 'kgperunit', 'weightkg', 'netunitweight'],
  countryOfOrigin: ['countryoforigin', 'origin', 'origincountry', 'coo', 'madein', 'manufacturedin', 'countrymade'],
} as const;

export type BookingField = keyof typeof BOOKING_HEADERS;
export type ItemField = keyof typeof ITEM_HEADERS;

/**
 * Maps the headers actually present onto our field names. Returns the source
 * header for each field it recognised, so the UI can say what it matched.
 */
export function mapHeaders<T extends Record<string, readonly string[]>>(
  headers: unknown[],
  spec: T,
): { map: Partial<Record<keyof T, string>>; unknown: string[] } {
  const map: Partial<Record<keyof T, string>> = {};
  const used = new Set<string>();
  const unknownHeaders: string[] = [];
  const normalised = headers.map((h) => ({ raw: String(h ?? ''), norm: normaliseHeader(h) }));

  // Exact variant matches first, in variant order, so "cartons" beats "boxes".
  for (const field of Object.keys(spec) as Array<keyof T>) {
    for (const variant of spec[field]) {
      const hit = normalised.find((h) => h.norm === variant && !used.has(h.raw));
      if (hit) {
        map[field] = hit.raw;
        used.add(hit.raw);
        break;
      }
    }
  }
  // Then a contains-match for anything still unclaimed.
  for (const field of Object.keys(spec) as Array<keyof T>) {
    if (map[field]) continue;
    for (const variant of spec[field]) {
      if (variant.length < 5) continue;
      const hit = normalised.find((h) => h.norm.includes(variant) && !used.has(h.raw));
      if (hit) {
        map[field] = hit.raw;
        used.add(hit.raw);
        break;
      }
    }
  }
  for (const h of normalised) {
    if (h.raw.trim() !== '' && !used.has(h.raw)) unknownHeaders.push(h.raw);
  }
  return { map, unknown: unknownHeaders };
}

/* ------------------------------------------------------------------ *
 * Cell coercion
 * ------------------------------------------------------------------ */

export function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

export function cellNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(/[£$€,\s]/g, '').replace(/kg$/i, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Excel serial day numbers, counted from 1900 with the famous leap-year bug. */
export function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial <= 0 || serial > 2_958_465) return null;
  const ms = Math.round((serial - 25569) * 86_400_000);
  const utc = new Date(ms);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

export function cellDate(v: unknown): { date: Date | null; ambiguous: boolean } {
  if (v === null || v === undefined || v === '') return { date: null, ambiguous: false };
  if (v instanceof Date) {
    return { date: new Date(v.getFullYear(), v.getMonth(), v.getDate()), ambiguous: false };
  }
  if (typeof v === 'number') return { date: excelSerialToDate(v), ambiguous: false };
  return parseDMYDetailed(String(v));
}

const PRIORITIES: Priority[] = ['Cheapest', 'Fastest', 'Most reliable', 'Balanced'];

export function cellPriority(v: unknown): Priority | '' {
  const s = cellText(v).toLowerCase();
  if (!s) return '';
  const direct = PRIORITIES.find((p) => p.toLowerCase() === s);
  if (direct) return direct;
  if (/cheap|budget|low ?cost|economy/.test(s)) return 'Cheapest';
  if (/fast|express|urgent|quick|speed/.test(s)) return 'Fastest';
  if (/reliab|on ?time|safe|certain/.test(s)) return 'Most reliable';
  if (/balanc|mixed|standard|normal/.test(s)) return 'Balanced';
  return '';
}

export function cellDestType(v: unknown): Booking['destType'] {
  const s = cellText(v).toLowerCase();
  if (!s) return '';
  if (/wareh|fulfil|fulfill|3pl|dc\b|distribution/.test(s)) return 'Warehouse';
  if (/business|commercial|office|shop|store|retail|address/.test(s)) return 'Business address';
  return '';
}

export function cellYesNo(v: unknown): 'Yes' | 'No' | '' {
  if (v === true) return 'Yes';
  if (v === false) return 'No';
  const s = cellText(v).toLowerCase();
  if (!s) return '';
  if (/^(y|yes|true|booked|confirmed|1)$/.test(s)) return 'Yes';
  if (/^(n|no|false|not booked|unbooked|none|0)$/.test(s)) return 'No';
  return '';
}

/* ------------------------------------------------------------------ *
 * The template's grey example row
 * ------------------------------------------------------------------ */

export const EXAMPLE_ID = 'BK-000';

export function isExampleRow(row: RawRow, idHeader?: string): boolean {
  const id = idHeader ? cellText(row[idHeader]) : '';
  if (id.toUpperCase() === EXAMPLE_ID) return true;
  const joined = Object.values(row).map((v) => cellText(v).toLowerCase()).join(' ');
  return /\bexample row\b|\bdelete this row\b|\bsample row\b/.test(joined);
}

/* ------------------------------------------------------------------ *
 * The join
 * ------------------------------------------------------------------ */

function canonicalCountry(country: string, city: string): string {
  const c = country.trim();
  if (c) {
    const key = c.toLowerCase();
    if (key === 'uk' || key === 'gb' || key === 'united kingdom' || key === 'great britain') return 'United Kingdom';
    if (key === 'de' || key === 'deutschland' || key === 'germany') return 'Germany';
    if (key === 'fr' || key === 'france') return 'France';
    if (key === 'nl' || key === 'netherlands' || key === 'holland' || key === 'the netherlands') return 'Netherlands';
    return titleCase(c);
  }
  return DEST_CITIES[city.trim().toLowerCase()] ?? '';
}

/** A hand-made sheet can leave a column blank on the first row. */
function unionKeys(rows: RawRow[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) { seen.add(k); out.push(k); }
    }
  }
  return out;
}

export function buildBookings(bookingRows: RawRow[], itemRows: RawRow[]): ParseResult {
  const warnings: ParseWarning[] = [];
  let droppedExampleRows = 0;

  const bHeaders = unionKeys(bookingRows);
  const iHeaders = unionKeys(itemRows);
  const bMap = mapHeaders(bHeaders, BOOKING_HEADERS).map;
  const iMap = mapHeaders(iHeaders, ITEM_HEADERS).map;

  if (bookingRows.length && !bMap.id) {
    warnings.push({ kind: 'unknown-header', message: 'No Booking ID column found on the Bookings sheet. Rows were numbered in order instead.' });
  }

  const get = (row: RawRow, header: string | undefined) => (header ? row[header] : undefined);

  const bookings: Booking[] = [];
  bookingRows.forEach((row, index) => {
    if (isExampleRow(row, bMap.id)) { droppedExampleRows += 1; return; }
    const id = cellText(get(row, bMap.id)) || `ROW-${index + 1}`;
    const allBlank = Object.values(row).every((v) => cellText(v) === '');
    if (allBlank) return;

    const destCity = cellText(get(row, bMap.destCity));
    const destCountry = canonicalCountry(cellText(get(row, bMap.destCountry)), destCity);
    if (destCity && !destCountry) {
      warnings.push({ kind: 'unknown-destination', bookingId: id, message: `${id}: destination "${destCity}" is not on a lane this tool prices.` });
    }
    const { date, ambiguous } = cellDate(get(row, bMap.readyDate));
    if (ambiguous) {
      warnings.push({
        kind: 'ambiguous-date',
        bookingId: id,
        message: `${id}: ready date "${cellText(get(row, bMap.readyDate))}" could be read day-first or month-first. It was read day-first, as DD-MM-YYYY. Check it.`,
      });
    }

    bookings.push({
      id,
      seller: cellText(get(row, bMap.seller)),
      originCity: cellText(get(row, bMap.originCity)),
      originCountry: canonicalCountry(cellText(get(row, bMap.originCountry)) || 'United Kingdom', ''),
      destCity,
      destCountry,
      destType: cellDestType(get(row, bMap.destType)),
      readyDate: date,
      priority: cellPriority(get(row, bMap.priority)),
      pallets: cellNumber(get(row, bMap.pallets)),
      cartons: cellNumber(get(row, bMap.cartons)),
      declaredValue: cellNumber(get(row, bMap.declaredValue)),
      currency: 'GBP',
      grossWeight: cellNumber(get(row, bMap.grossWeight)),
      appointment: cellYesNo(get(row, bMap.appointment)),
      items: [],
      valueInferred: false,
      cartonsInferred: false,
    });
  });

  const byId = new Map(bookings.map((b) => [b.id.trim().toUpperCase(), b]));

  itemRows.forEach((row, index) => {
    if (isExampleRow(row, iMap.bookingId)) { droppedExampleRows += 1; return; }
    const allBlank = Object.values(row).every((v) => cellText(v) === '');
    if (allBlank) return;
    const bookingId = cellText(get(row, iMap.bookingId));
    const item: Item = {
      sku: cellText(get(row, iMap.sku)) || `LINE-${index + 1}`,
      description: cellText(get(row, iMap.description)),
      hsCode: cellText(get(row, iMap.hsCode)),
      quantity: cellNumber(get(row, iMap.quantity)),
      unitPrice: cellNumber(get(row, iMap.unitPrice)),
      unitsPerCarton: cellNumber(get(row, iMap.unitsPerCarton)),
      cartons: cellNumber(get(row, iMap.cartons)),
      unitWeight: cellNumber(get(row, iMap.unitWeight)),
      countryOfOrigin: cellText(get(row, iMap.countryOfOrigin)),
    };
    const target = byId.get(bookingId.trim().toUpperCase());
    if (!target) {
      warnings.push({
        kind: 'orphan-item',
        row: index + 2,
        bookingId,
        message: bookingId
          ? `Item row ${index + 2} (${item.sku}) references booking "${bookingId}", which is not on the Bookings sheet. It was not loaded.`
          : `Item row ${index + 2} (${item.sku}) has no booking id. It was not loaded.`,
      });
      return;
    }
    target.items.push(item);
  });

  // Derive what the sheet left out, and say that it was derived.
  for (const b of bookings) {
    if (b.declaredValue === null && b.items.some((i) => i.quantity !== null && i.unitPrice !== null)) {
      b.declaredValue = Math.round(
        b.items.reduce((n, i) => n + (i.quantity ?? 0) * (i.unitPrice ?? 0), 0) * 100,
      ) / 100;
      b.valueInferred = true;
    }
    if (b.cartons === null && b.items.some((i) => i.cartons !== null)) {
      b.cartons = b.items.reduce((n, i) => n + (i.cartons ?? 0), 0);
      b.cartonsInferred = true;
    }
  }

  return { bookings, warnings, droppedExampleRows };
}

/* ------------------------------------------------------------------ *
 * SheetJS wrapper. Client side only; nothing is uploaded.
 * ------------------------------------------------------------------ */

export const BOOKINGS_SHEET_NAMES = ['bookings', 'booking', 'shipments', 'shipment', 'headers', 'header'];
export const ITEMS_SHEET_NAMES = ['items', 'item', 'lines', 'lineitems', 'products', 'goods', 'skus'];

export function pickSheet(names: string[], candidates: string[]): string | undefined {
  const norm = names.map((n) => ({ raw: n, norm: normaliseHeader(n) }));
  for (const c of candidates) {
    const hit = norm.find((n) => n.norm === c);
    if (hit) return hit.raw;
  }
  for (const c of candidates) {
    const hit = norm.find((n) => n.norm.includes(c));
    if (hit) return hit.raw;
  }
  return undefined;
}

/** Parses an uploaded workbook entirely in the browser. */
export async function parseWorkbook(data: ArrayBuffer): Promise<ParseResult> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(data, { type: 'array', cellDates: true });
  const names = wb.SheetNames;
  const bookingsName = pickSheet(names, BOOKINGS_SHEET_NAMES) ?? names[0];
  const itemsName = pickSheet(names, ITEMS_SHEET_NAMES) ?? names.find((n) => n !== bookingsName);

  const warnings: ParseWarning[] = [];
  if (!bookingsName) {
    return { bookings: [], warnings: [{ kind: 'missing-sheet', message: 'This workbook has no sheets.' }], droppedExampleRows: 0 };
  }
  const bookingRows = XLSX.utils.sheet_to_json<RawRow>(wb.Sheets[bookingsName], { defval: '', raw: false, dateNF: 'dd-mm-yyyy' });
  const itemRows = itemsName
    ? XLSX.utils.sheet_to_json<RawRow>(wb.Sheets[itemsName], { defval: '', raw: false, dateNF: 'dd-mm-yyyy' })
    : [];
  if (!itemsName) {
    warnings.push({ kind: 'missing-sheet', message: 'No Items sheet found. Bookings were loaded with no item lines, so the item level rules cannot run.' });
  }
  const result = buildBookings(bookingRows, itemRows);
  return { ...result, warnings: [...warnings, ...result.warnings] };
}
