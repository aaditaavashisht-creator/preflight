import type { CarrierRow } from './types';

/**
 * The rate card. Fixed data.
 *
 * The ceilings are deliberately not ordered by price: standard takes the
 * heaviest pallet, express the lightest. A heavy shipment loses the premium
 * service first, which is why weight per pallet has to filter the lane before
 * anything is ranked.
 */
export const CARRIERS: CarrierRow[] = [
  { carrier: 'Carrier A', service: 'Road economy',  dest: 'Germany',     pricePerPallet: 180, days: 5, onTime: 92, maxPerPallet: 500 },
  { carrier: 'Carrier B', service: 'Road standard', dest: 'Germany',     pricePerPallet: 220, days: 3, onTime: 95, maxPerPallet: 750 },
  { carrier: 'Carrier C', service: 'Road express',  dest: 'Germany',     pricePerPallet: 340, days: 2, onTime: 98, maxPerPallet: 400 },
  { carrier: 'Carrier A', service: 'Road economy',  dest: 'France',      pricePerPallet: 170, days: 5, onTime: 92, maxPerPallet: 500 },
  { carrier: 'Carrier B', service: 'Road standard', dest: 'France',      pricePerPallet: 210, days: 3, onTime: 95, maxPerPallet: 750 },
  { carrier: 'Carrier C', service: 'Road express',  dest: 'France',      pricePerPallet: 330, days: 2, onTime: 98, maxPerPallet: 400 },
  { carrier: 'Carrier A', service: 'Road economy',  dest: 'Netherlands', pricePerPallet: 160, days: 5, onTime: 92, maxPerPallet: 500 },
  { carrier: 'Carrier B', service: 'Road standard', dest: 'Netherlands', pricePerPallet: 200, days: 3, onTime: 95, maxPerPallet: 750 },
  { carrier: 'Carrier C', service: 'Road express',  dest: 'Netherlands', pricePerPallet: 320, days: 2, onTime: 98, maxPerPallet: 400 },
];

/** The heaviest pallet any service on any lane will take. */
export const MAX_PALLET_CEILING = Math.max(...CARRIERS.map((c) => c.maxPerPallet));

export function lane(destCountry: string): CarrierRow[] {
  const key = destCountry.trim().toLowerCase();
  return CARRIERS.filter((c) => c.dest.toLowerCase() === key);
}

export const DEST_CITIES: Record<string, string> = {
  berlin: 'Germany',
  frankfurt: 'Germany',
  hamburg: 'Germany',
  paris: 'France',
  lyon: 'France',
  amsterdam: 'Netherlands',
  rotterdam: 'Netherlands',
};

export const ORIGIN_CITIES = ['London', 'Manchester', 'Birmingham', 'Leeds'];

export function serviceName(row: CarrierRow): string {
  return `${row.carrier} ${row.service.toLowerCase()}`;
}
