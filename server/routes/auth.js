import express from 'express';
import { createSession, destroySession, hashPassword, verifyPassword } from '../auth.js';
import { msg } from '../i18n.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const publicUser = (u) => u && { id: u.id, name: u.name, email: u.email, role: u.role };

export default function authRoutes(db) {
  const r = express.Router();

  r.get('/me', (req, res) => res.json({ user: publicUser(req.user) }));

  r.post('/signup', (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (name.length < 2) return res.status(400).json({ error: 'invalid', message: msg(req, 'name_required') });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid', message: msg(req, 'email_invalid') });
    if (password.length < 8) return res.status(400).json({ error: 'invalid', message: msg(req, 'password_short') });
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
      return res.status(409).json({ error: 'exists', message: msg(req, 'email_exists') });
    }
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)',
    ).run(email, name, hashPassword(password), Date.now());
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);
    createSession(db, res, user.id);
    res.status(201).json({ user: publicUser(user) });
  });

  r.post('/login', (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'bad_credentials', message: msg(req, 'bad_credentials') });
    }
    createSession(db, res, user.id);
    res.json({ user: publicUser(user) });
  });

  r.post('/logout', (req, res) => {
    destroySession(db, req, res);
    res.json({ ok: true });
  });

  return r;
}
