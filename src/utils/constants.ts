export const FUEL_TYPE_MAP: Record<number, string> = {
  1: 'Unleaded 95',
  2: 'Unleaded 98',
  3: 'Diesel',
  4: 'Heating Oil',
  5: 'Kerosene',
};

export const FUEL_TYPE_IDS: Record<string, number> = {
  '95': 1,
  '98': 2,
  diesel: 3,
  heating: 4,
  kerosene: 5,
};

export const DISTRICTS = [
  'Nicosia',
  'Limassol',
  'Larnaca',
  'Paphos',
  'Famagusta',
] as const;

export const EARTH_RADIUS_KM = 6371;

export const DEFAULT_NEARBY_RADIUS_KM = 5;
export const MAX_NEARBY_RADIUS_KM = 50;
export const DEFAULT_CHEAPEST_LIMIT = 10;
export const MAX_CHEAPEST_LIMIT = 50;
