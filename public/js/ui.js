import { locale, t } from './i18n.js';

// Tiny HTML templating that escapes every interpolated value unless it is wrapped in raw().
class Safe {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}
export const raw = (value) => new Safe(String(value));
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function render(value) {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof Safe) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  return esc(value);
}

export function html(strings, ...values) {
  return raw(strings.reduce((out, s, i) => out + s + (i < values.length ? render(values[i]) : ''), ''));
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function mount(el, content) {
  el.innerHTML = String(content);
  return el;
}

// ---------- formatting ----------
// FCFA amounts are written the French way (space thousands separator) in both languages.
const numberFmt = new Intl.NumberFormat('fr-FR');
export const fcfa = (n) => `${numberFmt.format(n)} FCFA`;
export const minutes = (sec) => t('minutes', { n: Math.max(1, Math.round(sec / 60)) });
export const epCode = (season, ep) => `S${String(season).padStart(2, '0')} · E${String(ep).padStart(2, '0')}`;

export function timeLeft(ts) {
  const ms = ts - Date.now();
  if (ms <= 0) return t('time.expired');
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return t('time.days', { n: Math.floor(h / 24) });
  if (h >= 1) return t('time.hours', { n: h });
  return t('time.minutes', { n: Math.max(1, Math.floor(ms / 60_000)) });
}

export const dateTime = (ts) => new Date(ts).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const methodLabel = (id) => t(`method.${id}`);
export const genreLabel = (genre) => t(`genre.${genre}`) === `genre.${genre}` ? genre : t(`genre.${genre}`);

// ---------- toast ----------
export function toast(message, tone = 'info') {
  let host = $('#toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    host.setAttribute('aria-live', 'polite');
    document.body.append(host);
  }
  const el = document.createElement('div');
  el.className = `toast toast--${tone}`;
  el.textContent = message;
  host.append(el);
  setTimeout(() => el.classList.add('is-leaving'), 3600);
  setTimeout(() => el.remove(), 4000);
}

// ---------- modal ----------
export function openModal(content, { onClose, wide = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `
    <div class="modal__backdrop" data-close></div>
    <div class="modal__panel ${wide ? 'modal__panel--wide' : ''}" role="dialog" aria-modal="true">
      <button class="modal__close" data-close aria-label="${t('modal.close')}">✕</button>
      <div class="modal__body"></div>
    </div>`;
  const body = $('.modal__body', wrap);
  mount(body, content);
  const previousFocus = document.activeElement;

  const close = () => {
    wrap.classList.add('is-leaving');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => wrap.remove(), 200);
    document.body.classList.remove('has-modal');
    previousFocus?.focus?.();
    onClose?.();
  };
  const onKey = (e) => e.key === 'Escape' && close();
  wrap.addEventListener('click', (e) => e.target.closest('[data-close]') && close());
  document.addEventListener('keydown', onKey);

  document.body.append(wrap);
  document.body.classList.add('has-modal');
  requestAnimationFrame(() => {
    wrap.classList.add('is-open');
    $('input, button:not(.modal__close)', body)?.focus();
  });
  return { el: wrap, body, close };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
