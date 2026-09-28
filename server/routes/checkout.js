import express from 'express';
import { requireAuth } from '../auth.js';
import { config, DAY, HOUR } from '../config.js';
import { tx } from '../db.js';
import { entitlementMap, seasonPassQuote } from '../access.js';
import { maskPhone, METHODS, normalizeCameroonPhone, PaymentError } from '../payments.js';
import { msg } from '../i18n.js';

export default function checkoutRoutes(db, payments) {
  const r = express.Router();

  r.get('/payment-methods', (_req, res) => {
    res.json({
      methods: Object.entries(METHODS).map(([id, m]) => ({ id, ...m })),
      rentalHours: config.rentalHours,
      provider: payments.name,
    });
  });

  r.post('/checkout', requireAuth, async (req, res) => {
    const { type, method } = req.body ?? {};
    if (!METHODS[method]) return res.status(400).json({ error: 'invalid_method', message: msg(req, 'choose_method') });

    let phone = null;
    if (METHODS[method].needsPhone) {
      phone = normalizeCameroonPhone(req.body.phone);
      if (!phone) return res.status(400).json({ error: 'invalid_phone', message: msg(req, 'invalid_phone') });
    }

    // Work out exactly what is being bought — prices always come from the database, never the client.
    let purchase;
    if (type === 'episode') {
      const ep = db.prepare('SELECT * FROM episodes WHERE id = ? AND published = 1').get(Number(req.body.episodeId));
      if (!ep) return res.status(404).json({ error: 'not_found', message: msg(req, 'episode_not_found') });
      if (ep.is_free) return res.status(400).json({ error: 'free', message: msg(req, 'episode_free') });
      const existing = entitlementMap(db, req.user.id, [ep.id]).get(ep.id);
      if (existing) return res.status(409).json({ error: 'already_unlocked', message: msg(req, 'episode_owned'), expiresAt: existing });
      purchase = {
        kind: 'episode', seriesId: ep.series_id, season: ep.season_number, episodeId: ep.id,
        amount: ep.price_xaf, episodeIds: [ep.id], expiresAt: Date.now() + config.rentalHours * HOUR,
      };
    } else if (type === 'season') {
      const seriesId = Number(req.body.seriesId);
      const season = Number(req.body.season);
      const quote = seasonPassQuote(db, req.user.id, seriesId, season);
      if (quote.episodeIds.length === 0) return res.status(404).json({ error: 'not_found', message: msg(req, 'season_not_found') });
      if (quote.lockedCount === 0) return res.status(409).json({ error: 'already_unlocked', message: msg(req, 'season_owned') });
      purchase = {
        kind: 'season', seriesId, season, episodeId: null,
        amount: quote.price, episodeIds: quote.episodeIds, expiresAt: Date.now() + config.seasonPassDays * DAY,
      };
    } else {
      return res.status(400).json({ error: 'invalid_type', message: msg(req, 'invalid_type') });
    }

    const { lastInsertRowid: orderId } = db.prepare(`
      INSERT INTO orders (user_id, kind, series_id, season_number, episode_id, amount_xaf, method, phone_masked, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`).run(
      req.user.id, purchase.kind, purchase.seriesId, purchase.season, purchase.episodeId,
      purchase.amount, method, phone ? maskPhone(phone) : null, Date.now(),
    );

    let charge;
    try {
      charge = await payments.charge({ amount: purchase.amount, method, phone, reference: `MBOA-${orderId}` });
    } catch (err) {
      db.prepare("UPDATE orders SET status = 'failed' WHERE id = ?").run(orderId);
      if (err instanceof PaymentError) return res.status(402).json({ error: err.code, message: msg(req, `pay_${err.code}`) });
      throw err;
    }

    tx(db, () => {
      db.prepare("UPDATE orders SET status = 'paid', provider_ref = ? WHERE id = ?").run(charge.providerRef, orderId);
      const grant = db.prepare('INSERT INTO entitlements (user_id, episode_id, order_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)');
      for (const episodeId of purchase.episodeIds) grant.run(req.user.id, episodeId, orderId, purchase.expiresAt, Date.now());
    });

    res.status(201).json({
      order: { id: Number(orderId), amount: purchase.amount, method, reference: charge.providerRef, kind: purchase.kind },
      expiresAt: purchase.expiresAt,
      episodeIds: purchase.episodeIds,
    });
  });

  return r;
}
