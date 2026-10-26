import { fmtDate } from './format';
import { makeFixtures } from './fixtures';
import { EXAMPLE_ID } from './parse-xlsx';
import type { Booking } from './types';

/** The exact template column names. The parser accepts plenty besides. */
export const BOOKING_COLUMNS = [
  'Booking ID', 'Seller', 'Origin city', 'Origin country',
  'Destination city', 'Destination country', 'Destination type',
  'Ready date', 'Priority', 'Pallets', 'Cartons',
  'Declared value', 'Currency', 'Gross weight', 'Appointment booked',
] as const;

export const ITEM_COLUMNS = [
  'Booking ID', 'SKU', 'Description', 'HS code', 'Quantity',
  'Unit price', 'Units per carton', 'Cartons', 'Unit weight', 'Country of origin',
] as const;

export function bookingRow(b: Booking): Record<string, string | number> {
  return {
    'Booking ID': b.id,
    'Seller': b.seller,
    'Origin city': b.originCity,
    'Origin country': b.originCountry,
    'Destination city': b.destCity,
    'Destination country': b.destCountry,
    'Destination type': b.destType,
    'Ready date': fmtDate(b.readyDate),
    'Priority': b.priority,
    'Pallets': b.pallets ?? '',
    'Cartons': b.cartons ?? '',
    'Declared value': b.declaredValue ?? '',
    'Currency': b.currency,
    'Gross weight': b.grossWeight ?? '',
    'Appointment booked': b.appointment,
  };
}

export function itemRows(b: Booking): Array<Record<string, string | number>> {
  return b.items.map((i) => ({
    'Booking ID': b.id,
    'SKU': i.sku,
    'Description': i.description,
    'HS code': i.hsCode,
    'Quantity': i.quantity ?? '',
    'Unit price': i.unitPrice ?? '',
    'Units per carton': i.unitsPerCarton ?? '',
    'Cartons': i.cartons ?? '',
    'Unit weight': i.unitWeight ?? '',
    'Country of origin': i.countryOfOrigin,
  }));
}

const EXAMPLE_BOOKING: Record<string, string> = {
  'Booking ID': EXAMPLE_ID,
  'Seller': 'Example row, delete this',
  'Origin city': 'London',
  'Origin country': 'United Kingdom',
  'Destination city': 'Berlin',
  'Destination country': 'Germany',
  'Destination type': 'Warehouse',
  'Ready date': '05-11-2026',
  'Priority': 'Balanced',
  'Pallets': '2',
  'Cartons': '40',
  'Declared value': '5000',
  'Currency': 'GBP',
  'Gross weight': '400',
  'Appointment booked': 'Yes',
};

const EXAMPLE_ITEM: Record<string, string> = {
  'Booking ID': EXAMPLE_ID,
  'SKU': 'EX-01',
  'Description': 'Example row, delete this',
  'HS code': '691200',
  'Quantity': '480',
  'Unit price': '10.00',
  'Units per carton': '12',
  'Cartons': '40',
  'Unit weight': '0.5',
  'Country of origin': 'United Kingdom',
};

/** Builds a real workbook of the demo set, in the browser. Nothing leaves it. */
export async function sampleWorkbookBytes(today?: Date): Promise<Uint8Array> {
  const XLSX = await import('xlsx');
  const fixtures = makeFixtures(today);

  const bookings = [EXAMPLE_BOOKING, ...fixtures.map(bookingRow)];
  const items = [EXAMPLE_ITEM, ...fixtures.flatMap(itemRows)];

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(bookings, { header: [...BOOKING_COLUMNS] });
  const ws2 = XLSX.utils.json_to_sheet(items, { header: [...ITEM_COLUMNS] });
  ws1['!cols'] = BOOKING_COLUMNS.map((c) => ({ wch: Math.max(12, c.length + 4) }));
  ws2['!cols'] = ITEM_COLUMNS.map((c) => ({ wch: Math.max(12, c.length + 4) }));
  XLSX.utils.book_append_sheet(wb, ws1, 'Bookings');
  XLSX.utils.book_append_sheet(wb, ws2, 'Items');

  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}

export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function buildSampleWorkbook(today?: Date): Promise<Blob> {
  return new Blob([await sampleWorkbookBytes(today)], { type: XLSX_MIME });
}

/**
 * The corrected sheet: every high-confidence fix applied, anything needing
 * judgement left exactly as the seller wrote it.
 */
export async function correctedWorkbookBytes(bookings: Booking[]): Promise<Uint8Array> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(bookings.map(bookingRow), { header: [...BOOKING_COLUMNS] });
  const ws2 = XLSX.utils.json_to_sheet(bookings.flatMap(itemRows), { header: [...ITEM_COLUMNS] });
  ws1['!cols'] = BOOKING_COLUMNS.map((c) => ({ wch: Math.max(12, c.length + 4) }));
  ws2['!cols'] = ITEM_COLUMNS.map((c) => ({ wch: Math.max(12, c.length + 4) }));
  XLSX.utils.book_append_sheet(wb, ws1, 'Bookings');
  XLSX.utils.book_append_sheet(wb, ws2, 'Items');
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}

export async function buildCorrectedWorkbook(bookings: Booking[]): Promise<Blob> {
  return new Blob([await correctedWorkbookBytes(bookings)], { type: XLSX_MIME });
}
