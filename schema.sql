CREATE TABLE price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recorded_at TEXT NOT NULL,       -- ISO timestamp of scrape
  station_id TEXT NOT NULL,        -- SHA hash station ID
  brand TEXT NOT NULL,
  station_name TEXT NOT NULL,
  fuel_type TEXT NOT NULL,         -- e.g. "Unleaded 95"
  price REAL NOT NULL
);

CREATE INDEX idx_price_history_recorded_at ON price_history(recorded_at);
CREATE INDEX idx_price_history_fuel_type ON price_history(fuel_type);
CREATE INDEX idx_price_history_station ON price_history(station_id);
