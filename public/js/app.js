import { api } from './api.js';
import { openAuth } from './checkout.js';
import { navigate, setRenderer } from './router.js';
import { store } from './store.js';
import { applyDocumentLang, getLang, LANGS, onLangChange, setLang, t } from './i18n.js';
import { $, html, mount, toast } from './ui.js';
import home from './views/home.js';
import series from './views/series.js';
import watch from './views/watch.js';
import library from './views/library.js';
import admin from './views/admin.js';
import notFound from './views/not-found.js';

const routes = [
  [/^\/$/, home],
  [/^\/series\/([\w-]+)$/, series],
  [/^\/watch\/(\d+)$/, watch],
  [/^\/library$/, library],
  [/^\/admin$/, admin],
];

let seq = 0;
let cleanup = null;

async function render({ keepScroll = false } = {}) {
  const token = ++seq;
  cleanup?.();
  cleanup = null;
  if (!keepScroll) window.scrollTo({ top: 0, behavior: 'instant' });

  const path = location.pathname;
  const [view, params] = routes.reduce((found, [re, fn]) => found || (re.test(path) ? [fn, path.match(re).slice(1)] : null), null)
    ?? [notFound, []];

  const el = document.createElement('div');
  $('#app').replaceChildren(el);
  renderHeader();
  try {
    const dispose = await view({ el, params, isCurrent: () => token === seq });
    if (token === seq) cleanup = dispose ?? null;
    else dispose?.();
  } catch (err) {
    console.error(err);
    if (token === seq) mount(el, html`<div class="page wrap"><div class="empty"><h3>${t('error.title')}</h3><p>${err.message}</p><a class="btn btn--line" href="/">${t('error.home')}</a></div></div>`);
  }
}

function renderHeader() {
  const { user } = store;
  const path = location.pathname;
  const link = (href, label, match) => html`<a href="${href}" class="${match ? 'is-active' : ''}">${label}</a>`;
  mount($('#nav'), html`
    ${link('/', t('nav.browse'), path === '/' || path.startsWith('/series'))}
    ${link('/library', t('nav.library'), path === '/library')}
    ${user?.role === 'admin' ? link('/admin', t('nav.studio'), path === '/admin') : ''}`);

  const langSwitch = html`
    <div class="lang" role="group" aria-label="${t('lang.label')}">
      <svg class="lang__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>
      ${LANGS.map(([code, short, name]) => html`<button type="button" data-lang="${code}" lang="${code}" title="${name}" aria-pressed="${code === getLang()}">${short}</button>`)}
    </div>`;

  const initials = user?.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  mount($('#header-right'), user
    ? html`
      ${langSwitch}
      <div class="menu" id="menu">
        <button class="avatar" aria-haspopup="menu" aria-label="${t('header.account')}">${initials}</button>
        <div class="menu__panel" role="menu">
          <div class="menu__head"><strong>${user.name}</strong><span>${user.email}</span></div>
          <a class="menu__item" href="/library">${t('menu.library')}</a>
          ${user.role === 'admin' ? html`<a class="menu__item" href="/admin">${t('menu.studio')}</a>` : ''}
          <button class="menu__item" data-logout>${t('menu.signout')}</button>
        </div>
      </div>`
    : html`
      ${langSwitch}
      <button class="btn btn--sm btn--line" data-auth="login">${t('header.signin')}</button>
      <button class="btn btn--sm btn--primary header__join" data-auth="signup">${t('header.join')}</button>`);
}

function renderFooter() {
  mount($('#footer'), html`
    <div>
      <div class="footer__tag">${t('footer.tag')}</div>
      <div style="margin-top:6px">${t('footer.cities', { year: new Date().getFullYear() })}</div>
    </div>
    <div>${t('footer.pay')}</div>`);
}

document.addEventListener('click', async (e) => {
  const menu = $('#menu');
  if (menu) menu.classList.toggle('is-open', !!e.target.closest('.avatar') && !menu.classList.contains('is-open'));

  const langBtn = e.target.closest('[data-lang]');
  if (langBtn) return setLang(langBtn.dataset.lang);

  const authBtn = e.target.closest('[data-auth]');
  if (authBtn) return openAuth({ mode: authBtn.dataset.auth });

  if (e.target.closest('[data-logout]')) {
    await api.post('/auth/logout');
    store.setUser(null);
    toast(t('toast.signedOut'));
    return navigate('/');
  }

  const a = e.target.closest('a[href]');
  if (!a || a.target || a.origin !== location.origin || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  if (/^\/(api|stream)\//.test(a.pathname)) return;
  e.preventDefault();
  navigate(a.pathname + a.search);
});

window.addEventListener('popstate', () => render());
window.addEventListener('scroll', () => $('#header').classList.toggle('is-solid', window.scrollY > 40), { passive: true });

setRenderer(render);
store.subscribe(() => render({ keepScroll: true }));
onLangChange(() => {
  renderFooter();
  render({ keepScroll: true });
});

applyDocumentLang();
renderFooter();

const [{ user }, payment] = await Promise.all([api.get('/auth/me'), api.get('/payment-methods')]);
store.user = user;
store.methods = payment.methods;
store.rentalHours = payment.rentalHours;
store.provider = payment.provider;
render();
