import express from 'express';
import { requireAdmin } from '../auth.js';
import { msg } from '../i18n.js';

export const slugify = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

const str = (v, max = 2000) => String(v ?? '').trim().slice(0, max);
const int = (v, min, max) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

const SERIES_FIELDS = {
  title: (v) => str(v, 120) || null,
  tagline: (v) => str(v, 200),
  tagline_fr: (v) => str(v, 200),
  synopsis: (v) => str(v, 2000),
  synopsis_fr: (v) => str(v, 2000),
  genre: (v) => str(v, 40) || null,
  year: (v) => int(v, 1900, 2100),
  rating: (v) => str(v, 10) || null,
  featured: (v) => (v ? 1 : 0),
  published: (v) => (v ? 1 : 0),
};

const EPISODE_FIELDS = {
  season_number: (v) => int(v, 1, 99),
  episode_number: (v) => int(v, 1, 999),
  title: (v) => str(v, 160) || null,
  title_fr: (v) => str(v, 160),
  synopsis: (v) => str(v, 2000),
  synopsis_fr: (v) => str(v, 2000),
  duration_sec: (v) => int(v, 0, 60 * 60 * 6),
  price_xaf: (v) => int(v, 0, 1_000_000),
  is_free: (v) => (v ? 1 : 0),
  video_src: (v) => str(v, 300),
  published: (v) => (v ? 1 : 0),
};

// Validates only the fields present in `body`; returns { values } or { error, field }.
function pick(body, fields, required = []) {
  const values = {};
  for (const [key, parse] of Object.entries(fields)) {
    if (body?.[key] === undefined) continue;
    const value = parse(body[key]);
    if (value === null) return { error: 'invalid_field', field: key };
    values[key] = value;
  }
  const missing = required.find((k) => values[k] === undefined);
  return missing ? { error: 'required_field', field: missing } : { values };
}

const invalid = (req, res, { error, field }) =>
  res.status(400).json({ error: 'invalid', field, message: msg(req, error, { field: field.replace('_', ' ') }) });

function update(db, table, id, values) {
  const keys = Object.keys(values);
  if (keys.length === 0) return;
  db.prepare(`UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => values[k]), id);
}

const uniqueError = (err, req, res, key) => {
  if (String(err.message).includes('UNIQUE')) return res.status(409).json({ error: 'conflict', message: msg(req, key) });
  throw err;
};

export default function adminRoutes(db) {
  const r = express.Router();
  r.use(requireAdmin);

  r.get('/stats', (_req, res) => {
    const since = Date.now() - 30 * 86400_000;
    const totals = db.prepare(`
      SELECT COALESCE(SUM(amount_xaf), 0) AS revenue, COUNT(*) AS orders,
             COALESCE(SUM(CASE WHEN created_at > ? THEN amount_xaf END), 0) AS revenue30,
             COUNT(DISTINCT user_id) AS buyers
      FROM orders WHERE status = 'paid'`).get(since);
    const customers = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'").get().n;
    const byMethod = db.prepare(`
      SELECT method, COUNT(*) AS orders, SUM(amount_xaf) AS revenue FROM orders
      WHERE status = 'paid' GROUP BY method ORDER BY revenue DESC`).all();
    const daily = db.prepare(`
      SELECT date(created_at / 1000, 'unixepoch') AS day, SUM(amount_xaf) AS revenue FROM orders
      WHERE status = 'paid' AND created_at > ? GROUP BY day ORDER BY day`).all(Date.now() - 14 * 86400_000);
    const topSeries = db.prepare(`
      SELECT s.title, s.slug, COUNT(o.id) AS orders, SUM(o.amount_xaf) AS revenue FROM orders o
      JOIN series s ON s.id = o.series_id WHERE o.status = 'paid'
      GROUP BY s.id ORDER BY revenue DESC LIMIT 5`).all();
    const recent = db.prepare(`
      SELECT o.id, o.kind, o.amount_xaf, o.method, o.status, o.created_at, u.name AS customer,
             s.title AS series_title, o.season_number, e.episode_number
      FROM orders o JOIN users u ON u.id = o.user_id JOIN series s ON s.id = o.series_id
      LEFT JOIN episodes e ON e.id = o.episode_id
      ORDER BY o.created_at DESC LIMIT 12`).all();
    res.json({ ...totals, customers, byMethod, daily, topSeries, recent });
  });

  r.get('/series', (_req, res) => {
    const series = db.prepare('SELECT * FROM series ORDER BY created_at DESC').all();
    const episodes = db.prepare(`
      SELECT e.*, (SELECT COUNT(*) FROM orders o WHERE o.episode_id = e.id AND o.status = 'paid') AS sales
      FROM episodes e ORDER BY season_number, episode_number`).all();
    res.json({ series: series.map((s) => ({ ...s, episodes: episodes.filter((e) => e.series_id === s.id) })) });
  });

  r.post('/series', (req, res) => {
    const { values, ...problem } = pick(req.body, SERIES_FIELDS, ['title']);
    if (problem.error) return invalid(req, res, problem);
    const slug = slugify(req.body.slug || values.title);
    if (!slug) return res.status(400).json({ error: 'invalid', message: msg(req, 'title_letters') });
    try {
      const row = { genre: 'Drama', rating: '13+', ...values, slug, created_at: Date.now() };
      const keys = Object.keys(row);
      const { lastInsertRowid } = db.prepare(
        `INSERT INTO series (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
      ).run(...keys.map((k) => row[k]));
      res.status(201).json({ series: db.prepare('SELECT * FROM series WHERE id = ?').get(lastInsertRowid) });
    } catch (err) {
      uniqueError(err, req, res, 'series_exists');
    }
  });

  r.patch('/series/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT 1 FROM series WHERE id = ?').get(id)) return res.status(404).json({ error: 'not_found', message: msg(req, 'series_not_found') });
    const { values, ...problem } = pick(req.body, SERIES_FIELDS);
    if (problem.error) return invalid(req, res, problem);
    update(db, 'series', id, values);
    res.json({ series: db.prepare('SELECT * FROM series WHERE id = ?').get(id) });
  });

  r.post('/series/:id/episodes', (req, res) => {
    const seriesId = Number(req.params.id);
    if (!db.prepare('SELECT 1 FROM series WHERE id = ?').get(seriesId)) return res.status(404).json({ error: 'not_found', message: msg(req, 'series_not_found') });
    const { values, ...problem } = pick(req.body, EPISODE_FIELDS, ['title', 'episode_number']);
    if (problem.error) return invalid(req, res, problem);
    try {
      const row = { season_number: 1, ...values, series_id: seriesId, created_at: Date.now() };
      const keys = Object.keys(row);
      const { lastInsertRowid } = db.prepare(
        `INSERT INTO episodes (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
      ).run(...keys.map((k) => row[k]));
      res.status(201).json({ episode: db.prepare('SELECT * FROM episodes WHERE id = ?').get(lastInsertRowid) });
    } catch (err) {
      uniqueError(err, req, res, 'episode_number_taken');
    }
  });

  r.patch('/episodes/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT 1 FROM episodes WHERE id = ?').get(id)) return res.status(404).json({ error: 'not_found', message: msg(req, 'episode_not_found') });
    const { values, ...problem } = pick(req.body, EPISODE_FIELDS);
    if (problem.error) return invalid(req, res, problem);
    try {
      update(db, 'episodes', id, values);
    } catch (err) {
      return uniqueError(err, req, res, 'episode_number_taken');
    }
    res.json({ episode: db.prepare('SELECT * FROM episodes WHERE id = ?').get(id) });
  });

  return r;
}
