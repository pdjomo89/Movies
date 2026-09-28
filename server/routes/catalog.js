import express from 'express';
import { requireAuth } from '../auth.js';
import { accessFor, entitlementMap, seasonPassQuote } from '../access.js';
import { localize, msg } from '../i18n.js';

export const seriesSummarySql = `
  SELECT s.id, s.slug, s.title, s.tagline, s.synopsis, s.tagline_fr, s.synopsis_fr, s.genre, s.year, s.rating, s.featured,
         COUNT(e.id) AS episode_count,
         COUNT(DISTINCT e.season_number) AS season_count,
         MIN(CASE WHEN e.is_free = 0 THEN e.price_xaf END) AS from_price,
         MAX(e.is_free) AS has_free
  FROM series s
  LEFT JOIN episodes e ON e.series_id = s.id AND e.published = 1
  WHERE s.published = 1
  GROUP BY s.id`;

export const SERIES_TEXT = ['tagline', 'synopsis'];
export const EPISODE_TEXT = ['title', 'synopsis'];

export default function catalogRoutes(db) {
  const r = express.Router();

  r.get('/home', (req, res) => {
    const series = db.prepare(`${seriesSummarySql} ORDER BY s.featured DESC, s.created_at DESC`).all();
    const continueWatching = req.user ? db.prepare(`
      SELECT e.id AS episode_id, e.title AS episode_title, e.title_fr AS episode_title_fr, e.season_number, e.episode_number,
             p.position_sec, p.duration_sec, s.slug, s.title AS series_title, s.genre
      FROM progress p
      JOIN episodes e ON e.id = p.episode_id
      JOIN series s ON s.id = e.series_id
      WHERE p.user_id = ? AND p.position_sec > 5 AND p.position_sec < p.duration_sec * 0.95
      ORDER BY p.updated_at DESC LIMIT 8`).all(req.user.id) : [];
    res.json({
      series: series.map((s) => localize(s, req.lang, SERIES_TEXT)),
      continueWatching: continueWatching.map((c) => localize(c, req.lang, ['episode_title'])),
    });
  });

  r.get('/series/:slug', (req, res) => {
    const series = localize(db.prepare(`${seriesSummarySql} HAVING s.slug = ?`).get(req.params.slug), req.lang, SERIES_TEXT);
    if (!series) return res.status(404).json({ error: 'not_found', message: msg(req, 'series_not_found') });

    const episodes = db.prepare(`
      SELECT id, season_number, episode_number, title, synopsis, title_fr, synopsis_fr, duration_sec, price_xaf, is_free
      FROM episodes WHERE series_id = ? AND published = 1
      ORDER BY season_number, episode_number`).all(series.id).map((e) => localize(e, req.lang, EPISODE_TEXT));

    const userId = req.user?.id;
    const owned = entitlementMap(db, userId, episodes.map((e) => e.id));
    const progress = new Map(userId
      ? db.prepare('SELECT episode_id, position_sec, duration_sec FROM progress WHERE user_id = ?').all(userId)
        .map((p) => [p.episode_id, p])
      : []);

    const seasons = [];
    for (const ep of episodes) {
      let season = seasons.find((s) => s.number === ep.season_number);
      if (!season) seasons.push(season = { number: ep.season_number, episodes: [] });
      const p = progress.get(ep.id);
      season.episodes.push({
        ...ep,
        is_free: Boolean(ep.is_free),
        access: accessFor(ep, owned),
        progress: p ? Math.min(1, p.position_sec / (p.duration_sec || ep.duration_sec || 1)) : 0,
      });
    }
    for (const season of seasons) {
      const quote = seasonPassQuote(db, userId, series.id, season.number);
      season.pass = { price: quote.price, fullPrice: quote.fullPrice, lockedCount: quote.lockedCount, days: quote.days };
    }

    res.json({ series, seasons });
  });

  r.get('/library', requireAuth, (req, res) => {
    const now = Date.now();
    const active = db.prepare(`
      SELECT e.id AS episode_id, e.title AS episode_title, e.title_fr AS episode_title_fr, e.season_number, e.episode_number, e.duration_sec,
             s.slug, s.title AS series_title, s.genre, MAX(en.expires_at) AS expires_at
      FROM entitlements en
      JOIN episodes e ON e.id = en.episode_id
      JOIN series s ON s.id = e.series_id
      WHERE en.user_id = ? AND en.expires_at > ?
      GROUP BY e.id ORDER BY expires_at ASC`).all(req.user.id, now);
    const orders = db.prepare(`
      SELECT o.id, o.kind, o.amount_xaf, o.method, o.phone_masked, o.status, o.provider_ref, o.created_at,
             o.season_number, s.title AS series_title, s.slug, e.title AS episode_title, e.title_fr AS episode_title_fr, e.episode_number
      FROM orders o
      JOIN series s ON s.id = o.series_id
      LEFT JOIN episodes e ON e.id = o.episode_id
      WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 50`).all(req.user.id);
    const byLang = (row) => localize(row, req.lang, ['episode_title']);
    const spent = orders.filter((o) => o.status === 'paid').reduce((sum, o) => sum + o.amount_xaf, 0);
    res.json({ active: active.map(byLang), orders: orders.map(byLang), spent });
  });

  return r;
}
