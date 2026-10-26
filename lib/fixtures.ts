import { addDays, startOfDay } from './format';
import type { Booking, Item } from './types';

function item(
  sku: string, description: string, hsCode: string,
  quantity: number | null, unitPrice: number | null,
  unitsPerCarton: number | null, cartons: number | null,
  unitWeight: number | null, countryOfOrigin: string,
): Item {
  return { sku, description, hsCode, quantity, unitPrice, unitsPerCarton, cartons, unitWeight, countryOfOrigin };
}

export function blankBooking(id = 'BK-NEW'): Booking {
  return {
    id,
    seller: '',
    originCity: '',
    originCountry: 'United Kingdom',
    destCity: '',
    destCountry: '',
    destType: '',
    readyDate: null,
    priority: '',
    pallets: null,
    cartons: null,
    declaredValue: null,
    currency: 'GBP',
    grossWeight: null,
    appointment: '',
    items: [],
    valueInferred: false,
    cartonsInferred: false,
  };
}

/** Deep copy, including the Date and the item rows. */
export function cloneBooking(b: Booking): Booking {
  return {
    ...b,
    readyDate: b.readyDate ? new Date(b.readyDate.getTime()) : null,
    items: b.items.map((i) => ({ ...i })),
  };
}

/**
 * The five demo bookings. Dates are relative to the day passed in so R-10
 * stays meaningful however long this sits on a URL.
 */
export function makeFixtures(todayInput?: Date): Booking[] {
  const today = startOfDay(todayInput ?? new Date());
  const d = (n: number) => addDays(today, n);

  return [
    {
      id: 'BK-101', seller: 'Northfield Goods',
      originCity: 'Manchester', originCountry: 'United Kingdom',
      destCity: 'Frankfurt', destCountry: 'Germany', destType: 'Warehouse',
      readyDate: d(11), priority: 'Cheapest',
      pallets: 3, cartons: 90, declaredValue: 6480, currency: 'GBP',
      grossWeight: 700, appointment: 'Yes',
      valueInferred: false, cartonsInferred: false,
      items: [
        item('MUG-01', 'Ceramic coffee mug, 350 ml', '691200', 1080, 5.0, 12, 90, 0.5, 'United Kingdom'),
        item('TRY-02', 'Ceramic serving tray', '691200', 72, 15.0, 12, 6, 0.9, 'United Kingdom'),
      ],
    },
    {
      id: 'BK-102', seller: 'Orrell Textiles',
      originCity: 'Leeds', originCountry: 'United Kingdom',
      destCity: 'Amsterdam', destCountry: 'Netherlands', destType: 'Warehouse',
      readyDate: d(18), priority: 'Balanced',
      pallets: 2, cartons: 50, declaredValue: 11600, currency: 'GBP',
      grossWeight: 240, appointment: 'Yes',
      valueInferred: false, cartonsInferred: false,
      items: [
        item('TEE-10', 'Cotton t-shirt, crew neck', '610910', 960, 1.0, 24, 40, 0.2, 'India'),
        item('SOK-03', 'Cotton socks, 5-pack', '611595', 500, 4.0, 50, 12, 0.15, 'Turkey'),
      ],
    },
    {
      id: 'BK-103', seller: 'Severn Roasters',
      originCity: 'Birmingham', originCountry: 'United Kingdom',
      destCity: 'Berlin', destCountry: 'Germany', destType: 'Warehouse',
      readyDate: d(-5), priority: 'Most reliable',
      pallets: 2, cartons: 60, declaredValue: 12000, currency: 'GBP',
      grossWeight: 1600, appointment: 'No',
      valueInferred: false, cartonsInferred: false,
      items: [
        item('COF-01', 'Roasted coffee beans, 1 kg bag', '90121', 1200, 10.0, 20, 60, 1.2, ''),
      ],
    },
    {
      id: 'BK-104', seller: 'Kitfield Electronics',
      originCity: 'London', originCountry: 'United Kingdom',
      destCity: 'Rotterdam', destCountry: 'Netherlands', destType: 'Business address',
      readyDate: d(9), priority: 'Fastest',
      pallets: 1, cartons: 24, declaredValue: 4800, currency: 'GBP',
      grossWeight: 180, appointment: 'No',
      valueInferred: false, cartonsInferred: false,
      items: [
        item('PWB-20', 'Portable power bank, 10000 mAh', '850760', 240, 20.0, 10, 24, 0.25, 'China'),
      ],
    },
    {
      id: 'BK-105', seller: 'Harrow Home',
      originCity: 'London', originCountry: 'United Kingdom',
      destCity: 'Paris', destCountry: 'France', destType: 'Business address',
      readyDate: d(16), priority: 'Cheapest',
      pallets: 2, cartons: 48, declaredValue: 7200, currency: 'GBP',
      grossWeight: 410, appointment: 'No',
      valueInferred: false, cartonsInferred: false,
      items: [
        item('CDL-04', 'Scented soy candle, 200 g', '340600', 576, 12.5, 12, 48, 0.45, 'United Kingdom'),
      ],
    },
  ];
}

export function fixtureById(id: string, today?: Date): Booking | undefined {
  return makeFixtures(today).find((b) => b.id === id);
}
