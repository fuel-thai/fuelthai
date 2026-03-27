CREATE TABLE IF NOT EXISTS postal_codes (
	zip TEXT PRIMARY KEY,
	province_id INTEGER,
	district_th TEXT NOT NULL,
	district_en TEXT NOT NULL,
	lat REAL NOT NULL,
	lng REAL NOT NULL,
	geohash5 TEXT NOT NULL,
	FOREIGN KEY (province_id) REFERENCES provinces(id)
);

CREATE INDEX IF NOT EXISTS idx_postal_codes_province ON postal_codes(province_id);
CREATE INDEX IF NOT EXISTS idx_postal_codes_geohash ON postal_codes(geohash5);
