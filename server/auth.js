import crypto from 'node:crypto';
import { config, DAY } from './config.js';
import { msg } from './i18n.js';

const COOKIE = 'mboa_sid';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function setCookie(res, value, maxAgeSec) {
  const attrs = [`${COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSec}`];
  if (config.secureCookies) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

export function createSession(db, res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + config.sessionDays * DAY;
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), userId, expiresAt);
  setCookie(res, token, config.sessionDays * 86400);
}

export function destroySession(db, req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  setCookie(res, '', 0);
}

export function sessionMiddleware(db) {
  const lookup = db.prepare(`
    SELECT u.id, u.email, u.name, u.role FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?`);
  return (req, _res, next) => {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    req.user = token ? lookup.get(sha256(token), Date.now()) ?? null : null;
    next();
  };
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'auth_required', message: msg(req, 'auth_required') });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'auth_required', message: msg(req, 'auth_required') });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden', message: msg(req, 'forbidden') });
  next();
}

// Mutating API calls must be JSON. Browsers cannot send cross-site JSON without a
// CORS preflight (which we never approve), so this plus SameSite=Lax blocks CSRF.
export function requireJson(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (!req.is('application/json')) return res.status(415).json({ error: 'json_required', message: msg(req, 'json_required') });
  next();
}

// Short-lived signed URLs so a stream link can't be shared beyond its window.
export function signStream(userId, episodeId, exp) {
  return crypto.createHmac('sha256', config.secret).update(`${userId}:${episodeId}:${exp}`).digest('base64url');
}

export function verifyStream(userId, episodeId, exp, sig) {
  if (!sig || !exp || Number(exp) < Date.now()) return false;
  const expected = Buffer.from(signStream(userId, episodeId, exp));
  const actual = Buffer.from(String(sig));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
