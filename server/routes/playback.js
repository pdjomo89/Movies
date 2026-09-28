import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { requireAuth, signStream, verifyStream } from '../auth.js';
import { config } from '../config.js';
import { entitlementMap } from '../access.js';
import { localize, msg } from '../i18n.js';
import { EPISODE_TEXT } from './catalog.js';

export default function playbackRoutes(db) {
  const r = express.Router();

  r.get('/episodes/:id/play', requireAuth, (req, res) => {
    const ep = localize(db.prepare(`
      SELECT e.*, s.slug, s.title AS series_title, s.genre FROM episodes e
      JOIN series s ON s.id = e.series_id
      WHERE e.id = ? AND e.published = 1 AND s.published = 1`).get(Number(req.params.id)), req.lang, EPISODE_TEXT);
    if (!ep) return res.status(404).json({ error: 'not_found', message: msg(req, 'episode_not_found') });

    const expiresAt = ep.is_free ? null : entitlementMap(db, req.user.id, [ep.id]).get(ep.id);
    if (!ep.is_free && !expiresAt) {
      return res.status(402).json({ error: 'payment_required', message: msg(req, 'payment_required'), price: ep.price_xaf, slug: ep.slug });
    }

    // The signed link never outlives the rental itself.
    const exp = Math.min(Date.now() + config.streamTokenMinutes * 60_000, expiresAt ?? Infinity);
    const sig = signStream(req.user.id, ep.id, exp);
    const progress = db.prepare('SELECT position_sec FROM progress WHERE user_id = ? AND episode_id = ?').get(req.user.id, ep.id);
    const next = db.prepare(`
      SELECT id, title, title_fr, season_number, episode_number, is_free FROM episodes
      WHERE series_id = ? AND published = 1 AND (season_number, episode_number) > (?, ?)
      ORDER BY season_number, episode_number LIMIT 1`).get(ep.series_id, ep.season_number, ep.episode_number);

    res.json({
      episode: {
        id: ep.id, title: ep.title, synopsis: ep.synopsis, season_number: ep.season_number,
        episode_number: ep.episode_number, duration_sec: ep.duration_sec, is_free: Boolean(ep.is_free),
      },
      series: { slug: ep.slug, title: ep.series_title, genre: ep.genre },
      src: `/stream/${ep.id}?u=${req.user.id}&exp=${exp}&sig=${sig}`,
      expiresAt,
      position: progress?.position_sec ?? 0,
      next: next ? { ...localize(next, req.lang, ['title']), is_free: Boolean(next.is_free) } : null,
    });
  });

  r.post('/progress', requireAuth, (req, res) => {
    const episodeId = Number(req.body?.episodeId);
    const position = Math.max(0, Number(req.body?.position) || 0);
    const duration = Math.max(0, Number(req.body?.duration) || 0);
    if (!db.prepare('SELECT 1 FROM episodes WHERE id = ?').get(episodeId)) {
      return res.status(404).json({ error: 'not_found', message: msg(req, 'episode_not_found') });
    }
    db.prepare(`
      INSERT INTO progress (user_id, episode_id, position_sec, duration_sec, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (user_id, episode_id) DO UPDATE SET position_sec = excluded.position_sec,
        duration_sec = excluded.duration_sec, updated_at = excluded.updated_at`).run(req.user.id, episodeId, position, duration, Date.now());
    res.json({ ok: true });
  });

  return r;
}

// Video bytes are served only against a valid signed link (verified on every range request).
playbackRoutes.stream = (db) => {
  const r = express.Router();
  r.get('/stream/:id', (req, res) => {
    const episodeId = Number(req.params.id);
    const { u, exp, sig } = req.query;
    if (!verifyStream(Number(u), episodeId, exp, sig)) {
      return res.status(403).type('text').send(msg(req, 'stream_expired'));
    }
    const ep = db.prepare('SELECT video_src FROM episodes WHERE id = ?').get(episodeId);
    const file = ep && path.resolve(config.videoDir, ep.video_src);
    if (!file || !file.startsWith(config.videoDir + path.sep) || !fs.existsSync(file)) {
      return res.status(404).type('text').send(msg(req, 'video_missing'));
    }
    res.sendFile(file, { headers: { 'Cache-Control': 'private, no-store' }, acceptRanges: true });
  });
  return r;
};
