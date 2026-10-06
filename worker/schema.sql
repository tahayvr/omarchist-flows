-- Install counts, and what is kept for a day to count each install once.
CREATE TABLE IF NOT EXISTS installs (
  slug  TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS seen (
  key TEXT PRIMARY KEY,
  day TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS seen_day ON seen (day);
