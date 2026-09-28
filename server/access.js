import { config } from './config.js';

// Round to 5 FCFA (the smallest coin in everyday use), so tiny prices still round sensibly.
const roundXaf = (amount) => Math.max(5, Math.round(amount / 5) * 5);

export function entitlementMap(db, userId, episodeIds) {
  const map = new Map();
  if (!userId || episodeIds.length === 0) return map;
  const rows = db.prepare(`
    SELECT episode_id, MAX(expires_at) AS expires_at FROM entitlements
    WHERE user_id = ? AND expires_at > ? AND episode_id IN (${episodeIds.map(() => '?').join(',')})
    GROUP BY episode_id`).all(userId, Date.now(), ...episodeIds);
  for (const row of rows) map.set(row.episode_id, row.expires_at);
  return map;
}

export function accessFor(episode, entitlements) {
  if (episode.is_free) return { state: 'free', expiresAt: null };
  const expiresAt = entitlements.get(episode.id);
  return expiresAt ? { state: 'unlocked', expiresAt } : { state: 'locked', expiresAt: null };
}

/** Price to unlock every paid episode of a season, discounted over the ones still locked. */
export function seasonPassQuote(db, userId, seriesId, season) {
  const paid = db.prepare(`
    SELECT id, price_xaf FROM episodes
    WHERE series_id = ? AND season_number = ? AND published = 1 AND is_free = 0`).all(seriesId, season);
  const owned = entitlementMap(db, userId, paid.map((e) => e.id));
  const locked = paid.filter((e) => !owned.has(e.id));
  const fullPrice = locked.reduce((sum, e) => sum + e.price_xaf, 0);
  return {
    season,
    episodeIds: paid.map((e) => e.id),
    lockedCount: locked.length,
    fullPrice,
    // Rounding must never make the pass dearer than buying the episodes one by one.
    price: locked.length > 1 ? Math.min(fullPrice, roundXaf(fullPrice * (1 - config.seasonPassDiscount))) : fullPrice,
    days: config.seasonPassDays,
  };
}
