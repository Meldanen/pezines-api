export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Location {
  address: string;
  area: string;
  coordinates: Coordinates;
}

export interface StationPrice {
  fuelType: string;
  price: number;
}

export interface Station {
  id: string;
  brand: string;
  name: string;
  location: Location;
  prices: StationPrice[];
}

export interface StationWithDistance extends Station {
  distance: number; // km
}

export interface ScrapeResult {
  fuelType: string;
  fuelTypeId: number;
  stations: RawStation[];
}

export interface RawStation {
  brand: string;
  name: string;
  location: Location;
  price: number;
}

export interface CacheData {
  stations: Station[];
  scrapedAt: string;
  fuelTypes: string[];
  districts: string[];
}

export interface SessionTokens {
  cookies: string;
  verificationToken: string;
  obtainedAt: number;
}

export interface PriceSummaryItem {
  fuelType: string;
  avg: number;
  min: number;
  max: number;
  stationCount: number;
}

export interface DistrictSummaryItem extends PriceSummaryItem {
  district: string;
}

export interface HealthResponse {
  status: string;
  uptime: number;
  cache: {
    populated: boolean;
    stationCount: number;
    scrapedAt: string | null;
    staleTTL: boolean;
  };
}
