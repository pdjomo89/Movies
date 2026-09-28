import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { config } from './config.js';
import { requireJson, sessionMiddleware } from './auth.js';
import { simulatedProvider } from './payments.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import checkoutRoutes from './routes/checkout.js';
import playbackRoutes from './routes/playback.js';
import adminRoutes from './routes/admin.js';
import { langOf, msg } from './i18n.js';

export function createApp({ db, payments = simulatedProvider }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Vary', 'X-Lang, Accept-Language');
    next();
  });
  app.use((req, _res, next) => {
    req.lang = langOf(req);
    next();
  });
  app.use(express.json({ limit: '100kb' }));
  app.use(sessionMiddleware(db));

  const api = express.Router();
  api.use(requireJson);
  api.use('/auth', authRoutes(db));
  api.use(catalogRoutes(db));
  api.use(checkoutRoutes(db, payments));
  api.use(playbackRoutes(db));
  api.use('/admin', adminRoutes(db));
  api.use((req, res) => res.status(404).json({ error: 'not_found', message: msg(req, 'not_found') }));
  app.use('/api', api);

  app.use(playbackRoutes.stream(db));

  // Assets are served under /v/<content hash>/..., so every change gets brand-new URLs (including
  // the ES modules app.js imports relatively) and a browser can never run a stale mix of files.
  const publicDir = path.join(config.root, 'public');
  const version = assetVersion(publicDir);
  const indexHtml = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8').replaceAll('__ASSET_VERSION__', version);
  app.use('/v/:version', express.static(publicDir, { index: false, maxAge: '1y', immutable: true }));
  app.use(express.static(publicDir, { index: false, cacheControl: false, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));
  // Client-side routes all render the single-page app.
  app.get('/{*path}', (_req, res) => res.set('Cache-Control', 'no-cache').type('html').send(indexHtml));

  app.use((err, req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'bad_json', message: msg(req, 'bad_json') });
    console.error(err);
    res.status(500).json({ error: 'server_error', message: msg(req, 'server_error') });
  });

  return app;
}

function assetVersion(dir) {
  const hash = crypto.createHash('sha256');
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else hash.update(entry.name).update(fs.readFileSync(full));
    }
  };
  walk(dir);
  return hash.digest('hex').slice(0, 10);
}
