-- FUEL::TH D1 Schema v2
-- Normalized with reference tables for provinces, brands, fuel codes

-- ─── Reference Tables ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS provinces (
  id INTEGER PRIMARY KEY,
  name_th TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  region TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name_th TEXT,
  name_en TEXT NOT NULL,
  color TEXT
);

INSERT OR IGNORE INTO brands (id, name_th, name_en, color) VALUES
('PTT', 'พีทีที', 'PTT', '#FFD700'),
('BANGCHAK', 'บางจาก', 'Bangchak', '#2ECC71'),
('PT', 'พีที', 'PT', '#3498DB'),
('SHELL', 'เชลล์', 'Shell', '#E74C3C'),
('CALTEX', 'คาลเท็กซ์', 'Caltex', '#C0392B'),
('SUSCO', 'ซัสโก้', 'SUSCO', '#E67E22'),
('ESSO', 'เอสโซ่', 'Esso', '#2980B9'),
('OTHER', 'อื่นๆ', 'Other', '#95A5A6');

-- ─── Core Tables ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand_id TEXT REFERENCES brands(id),
  province_id INTEGER REFERENCES provinces(id),
  amphoe TEXT,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  last_diesel_status TEXT DEFAULT 'unknown',
  last_report_at TEXT
);

CREATE TABLE IF NOT EXISTS status_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id TEXT NOT NULL REFERENCES stations(id),
  fuel_code TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  reported_at TEXT,
  recorded_at TEXT NOT NULL,
  source TEXT DEFAULT 'doeb'
);

CREATE TABLE IF NOT EXISTS regional_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  province_id INTEGER NOT NULL REFERENCES provinces(id),
  recorded_at TEXT NOT NULL,
  total_stations INTEGER,
  diesel_available INTEGER,
  diesel_limited INTEGER,
  diesel_out INTEGER,
  diesel_pending INTEGER,
  diesel_unknown INTEGER
);

CREATE TABLE IF NOT EXISTS cron_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  stations_fetched INTEGER,
  new_stations INTEGER,
  status_changes INTEGER,
  provinces INTEGER,
  r2_key TEXT,
  error TEXT
);

-- ─── Indexes ─────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_stations_brand ON stations(brand_id);
CREATE INDEX IF NOT EXISTS idx_stations_province ON stations(province_id);
CREATE INDEX IF NOT EXISTS idx_stations_location ON stations(lat, lon);
CREATE INDEX IF NOT EXISTS idx_stations_diesel ON stations(last_diesel_status);
CREATE INDEX IF NOT EXISTS idx_changes_station ON status_changes(station_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_changes_fuel ON status_changes(fuel_code, recorded_at);
CREATE INDEX IF NOT EXISTS idx_regional_province ON regional_stats(province_id, recorded_at);
