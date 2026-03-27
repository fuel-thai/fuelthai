-- Generic time-series table for all tracked metrics
CREATE TABLE IF NOT EXISTS price_history (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	date TEXT NOT NULL,
	source TEXT NOT NULL,
	metric TEXT NOT NULL,
	value REAL NOT NULL,
	unit TEXT,
	recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
	UNIQUE(date, source, metric)
);

CREATE INDEX IF NOT EXISTS idx_price_history_metric ON price_history(metric, date);
CREATE INDEX IF NOT EXISTS idx_price_history_source ON price_history(source, date);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(date DESC);
