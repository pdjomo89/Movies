import crypto from 'node:crypto';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const env = process.env;

if (!env.APP_SECRET && env.NODE_ENV === 'production') {
  throw new Error('APP_SECRET must be set in production');
}

export const config = {
  root,
  port: Number(env.PORT) || 3000,
  secret: env.APP_SECRET || crypto.randomBytes(32).toString('hex'),
  dbPath: env.DB_PATH === ':memory:' ? ':memory:' : path.resolve(root, env.DB_PATH || 'data/mboa.db'),
  videoDir: path.resolve(root, env.VIDEO_DIR || 'storage/videos'),
  rentalHours: Number(env.RENTAL_HOURS) || 48,
  seasonPassDays: Number(env.SEASON_PASS_DAYS) || 30,
  seasonPassDiscount: env.SEASON_PASS_DISCOUNT !== undefined ? Number(env.SEASON_PASS_DISCOUNT) : 0.2,
  sessionDays: 30,
  streamTokenMinutes: 360,
  adminEmail: env.ADMIN_EMAIL || 'admin@mboareels.cm',
  adminPassword: env.ADMIN_PASSWORD || 'mboa-admin-2026',
  secureCookies: env.SECURE_COOKIES === 'true',
};

export const HOUR = 3600_000;
export const DAY = 24 * HOUR;
