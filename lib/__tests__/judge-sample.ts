/**
 * Sample test data in the judges' exact upload format.
 *
 * Layout matters as much as content: row 1 is an instruction sentence, row 2
 * holds the column names, row 3 is the grey example, and data starts at row 4.
 * Column names are the template's, not ours.
 */

export const BOOKING_HEADER = [
  'Booking ID', 'Seller name', 'Origin city', 'Origin country',
  'Destination city', 'Destination country', 'Destination type',
  'Ready to ship date', 'Seller priority', 'Pallets', 'Cartons',
  'Total declared value', 'Currency', 'Total gross weight (kg)',
  'Delivery appointment booked',
];

export const ITEM_HEADER = [
  'Booking ID', 'SKU', 'Description', 'HS code', 'Quantity (units)',
  'Unit price', 'Units per carton', 'Cartons', 'Unit weight (kg)',
  'Country of origin',
];

export const BOOKING_NOTICE =
  'Bookings — one row per record. Row 3 is an example (grey); enter data from row 4.';
export const ITEM_NOTICE =
  'Items — one row per record. Row 3 is an example (grey); enter data from row 4.';

/** The template's own grey example row. It must not reach the queue. */
export const EXAMPLE_BOOKING = [
  'BK-001', 'Northfield Goods', 'Manchester', 'United Kingdom', 'Frankfurt',
  'Germany', 'Warehouse', '05-11-2026', 'Cheapest', 3, 90, 5400, 'GBP', 620, 'Yes',
];
export const EXAMPLE_ITEM = [
  'BK-001', 'MUG-01', 'Ceramic coffee mug, 350 ml', '691200', 1080, 5, 12, 90, 0.5, 'United Kingdom',
];

/** Ten bookings. Every rule is planted at least once, and one is clean. */
export const SAMPLE_BOOKINGS: Array<Array<string | number>> = [
  // R-04 header typo: the header counts MUG-01's cartons alone.
  ['BK-101', 'Northfield Goods', 'Manchester', 'United Kingdom', 'Frankfurt', 'Germany', 'Warehouse', '06-11-2026', 'Cheapest', 3, 90, 6480, 'GBP', 700, 'Yes'],
  // R-02 item price, R-03 carton count, R-04 single-item, R-07 under net.
  ['BK-102', 'Orrell Textiles', 'Leeds', 'United Kingdom', 'Amsterdam', 'Netherlands', 'Warehouse', '13-11-2026', 'Balanced', 2, 50, 11600, 'GBP', 240, 'Yes'],
  // R-01 dropped leading zero, R-05 nothing takes it, R-08, R-09, R-10.
  ['BK-103', 'Severn Roasters', 'Birmingham', 'United Kingdom', 'Berlin', 'Germany', 'Warehouse', '21-10-2026', 'Most reliable', 2, 60, 12000, 'GBP', 1600, 'No'],
  // R-06 both detectors.
  ['BK-104', 'Kitfield Electronics', 'London', 'United Kingdom', 'Rotterdam', 'Netherlands', 'Business address', '04-11-2026', 'Fastest', 1, 24, 4800, 'GBP', 180, 'No'],
  // Clean.
  ['BK-105', 'Harrow Home', 'London', 'United Kingdom', 'Paris', 'France', 'Business address', '11-11-2026', 'Cheapest', 2, 48, 7200, 'GBP', 410, 'No'],
  // R-02 header zero: a ten times too large booking total.
  ['BK-106', 'Calder Mills', 'Leeds', 'United Kingdom', 'Lyon', 'France', 'Warehouse', '09-11-2026', 'Balanced', 2, 64, 64000, 'GBP', 520, 'Yes'],
  // R-03 pack size branch, and a lane where only the express service is excluded.
  ['BK-107', 'Pennine Supply', 'Birmingham', 'United Kingdom', 'Hamburg', 'Germany', 'Business address', '16-11-2026', 'Most reliable', 3, 60, 9000, 'GBP', 1250, 'No'],
  // R-01 blank code, which gets a suggestion and no fix.
  ['BK-108', 'Welbeck Trading', 'London', 'United Kingdom', 'Berlin', 'Germany', 'Warehouse', '05-11-2026', 'Fastest', 2, 90, 8400, 'GBP', 600, 'Yes'],
  // Four at once: R-04, R-05, R-08, R-10.
  ['BK-109', 'Thorne and Co', 'Manchester', 'United Kingdom', 'Paris', 'France', 'Warehouse', '23-10-2026', 'Cheapest', 4, 200, 15000, 'GBP', 3200, 'No'],
  // R-06 by keyword and by HS heading 3303.
  ['BK-110', 'Ashgrove Naturals', 'Leeds', 'United Kingdom', 'Hamburg', 'Germany', 'Business address', '18-11-2026', 'Balanced', 1, 30, 3600, 'GBP', 240, 'No'],
];

export const SAMPLE_ITEMS: Array<Array<string | number>> = [
  ['BK-101', 'MUG-01', 'Ceramic coffee mug, 350 ml', '691200', 1080, 5, 12, 90, 0.5, 'United Kingdom'],
  ['BK-101', 'TRY-02', 'Ceramic serving tray', '691200', 72, 15, 12, 6, 0.9, 'United Kingdom'],

  ['BK-102', 'TEE-10', 'Cotton t-shirt, crew neck', '610910', 960, 1, 24, 40, 0.2, 'India'],
  ['BK-102', 'SOK-03', 'Cotton socks, 5-pack', '611595', 500, 4, 50, 12, 0.15, 'Turkey'],

  // 90121 is 090121 with the leading zero dropped by a number formatted column.
  ['BK-103', 'COF-01', 'Roasted coffee beans, 1 kg bag', '90121', 1200, 10, 20, 60, 1.2, ''],

  ['BK-104', 'PWB-20', 'Portable power bank, 10000 mAh', '850760', 240, 20, 10, 24, 0.25, 'China'],

  ['BK-105', 'CDL-04', 'Scented soy candle, 200 g', '340600', 576, 12.5, 12, 48, 0.45, 'United Kingdom'],

  ['BK-106', 'TWL-07', 'Cotton bath towel', '630260', 640, 10, 10, 64, 0.6, 'Turkey'],

  // 900 does not divide by 16, but it divides by the 60 cartons: pack size is wrong.
  ['BK-107', 'JAR-11', 'Glass storage jar, 1 litre', '701337', 900, 10, 16, 60, 0.8, 'Germany'],

  ['BK-108', 'CND-21', 'Scented candle, 150 g', '', 480, 7.5, 12, 40, 0.3, 'United Kingdom'],
  ['BK-108', 'NTB-05', 'A5 notebook, lined', '482010', 1200, 4, 24, 50, 0.25, 'China'],

  ['BK-109', 'BTL-30', 'Stainless water bottle, 750 ml', '961700', 1500, 10, 10, 150, 0.35, 'China'],

  ['BK-110', 'PRF-08', 'Eau de toilette spray, 50 ml', '330300', 360, 10, 12, 30, 0.2, 'Germany'],
];

/** Rows exactly as the judges' template lays them out. */
export function judgeSheets(): { bookings: unknown[][]; items: unknown[][] } {
  return {
    bookings: [[BOOKING_NOTICE], BOOKING_HEADER, EXAMPLE_BOOKING, ...SAMPLE_BOOKINGS],
    items: [[ITEM_NOTICE], ITEM_HEADER, EXAMPLE_ITEM, ...SAMPLE_ITEMS],
  };
}

/** A real .xlsx in the judges' format. */
export async function buildJudgeWorkbook(): Promise<Uint8Array> {
  const XLSX = await import('xlsx');
  const { bookings, items } = judgeSheets();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bookings), 'Bookings');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(items), 'Items');
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}
