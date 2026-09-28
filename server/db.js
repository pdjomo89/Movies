import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS series (
  id         INTEGER PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  title      TEXT NOT NULL,
  tagline    TEXT NOT NULL DEFAULT '',
  synopsis   TEXT NOT NULL DEFAULT '',
  tagline_fr  TEXT NOT NULL DEFAULT '',
  synopsis_fr TEXT NOT NULL DEFAULT '',
  genre      TEXT NOT NULL DEFAULT 'Drama',
  year       INTEGER,
  rating     TEXT NOT NULL DEFAULT '13+',
  featured   INTEGER NOT NULL DEFAULT 0,
  published  INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS episodes (
  id             INTEGER PRIMARY KEY,
  series_id      INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  season_number  INTEGER NOT NULL DEFAULT 1,
  episode_number INTEGER NOT NULL,
  title          TEXT NOT NULL,
  synopsis       TEXT NOT NULL DEFAULT '',
  title_fr       TEXT NOT NULL DEFAULT '',
  synopsis_fr    TEXT NOT NULL DEFAULT '',
  duration_sec   INTEGER NOT NULL DEFAULT 0,
  price_xaf      INTEGER NOT NULL DEFAULT 500,
  is_free        INTEGER NOT NULL DEFAULT 0,
  video_src      TEXT NOT NULL DEFAULT '',
  published      INTEGER NOT NULL DEFAULT 1,
  created_at     INTEGER NOT NULL,
  UNIQUE (series_id, season_number, episode_number)
);

CREATE TABLE IF NOT EXISTS orders (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  kind          TEXT NOT NULL CHECK (kind IN ('episode', 'season')),
  series_id     INTEGER NOT NULL REFERENCES series(id),
  season_number INTEGER NOT NULL,
  episode_id    INTEGER REFERENCES episodes(id),
  amount_xaf    INTEGER NOT NULL,
  method        TEXT NOT NULL,
  phone_masked  TEXT,
  status        TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed')),
  provider_ref  TEXT,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS entitlements (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  order_id   INTEGER NOT NULL REFERENCES orders(id),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entitlements_user ON entitlements(user_id, episode_id, expires_at);

CREATE TABLE IF NOT EXISTS progress (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  episode_id   INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  position_sec REAL NOT NULL DEFAULT 0,
  duration_sec REAL NOT NULL DEFAULT 0,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, episode_id)
);
`;

export function openDb(file = config.dbPath) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

// Columns added after the first release; CREATE TABLE IF NOT EXISTS won't add them to old databases.
const ADDED_COLUMNS = {
  series: ['tagline_fr', 'synopsis_fr'],
  episodes: ['title_fr', 'synopsis_fr'],
};

function migrate(db) {
  for (const [table, columns] of Object.entries(ADDED_COLUMNS)) {
    const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
    for (const col of columns) {
      if (!existing.has(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`);
    }
  }
}

export function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
