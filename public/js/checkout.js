import { api } from './api.js';
import { posterArt } from './poster.js';
import { prefs, store } from './store.js';
import { t } from './i18n.js';
import { $, $$, dateTime, epCode, fcfa, html, mount, openModal, raw, sleep, toast } from './ui.js';

// ---------------------------------------------------------------- auth

export function openAuth({ mode = 'login', reason = '' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const modal = openModal('', { onClose: () => !done && resolve(null) });

    const draw = () => {
      const signup = mode === 'signup';
      mount(modal.body, html`
        <p class="eyebrow">${t(signup ? 'auth.eyebrowJoin' : 'auth.eyebrowBack')}</p>
        <h2>${raw(t(signup ? 'auth.titleJoin' : 'auth.titleBack'))}</h2>
        <p class="modal__lede">${reason || t(signup ? 'auth.ledeJoin' : 'auth.ledeBack')}</p>
        <div class="tabs" role="tablist">
          <button type="button" class="${!signup ? 'is-active' : ''}" data-mode="login">${t('auth.tabLogin')}</button>
          <button type="button" class="${signup ? 'is-active' : ''}" data-mode="signup">${t('auth.tabSignup')}</button>
        </div>
        <form novalidate>
          ${signup ? html`<div class="field"><label for="a-name">${t('auth.name')}</label><input class="input" id="a-name" name="name" autocomplete="name" required></div>` : ''}
          <div class="field"><label for="a-email">${t('auth.email')}</label><input class="input" id="a-email" name="email" type="email" autocomplete="email" required></div>
          <div class="field"><label for="a-pass">${t('auth.password')}</label><input class="input" id="a-pass" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="8" required></div>
          <p class="form-error" role="alert"></p>
          <button class="btn btn--primary btn--block" type="submit">${t(signup ? 'auth.submitJoin' : 'auth.submitLogin')}</button>
        </form>`);
      $$('[data-mode]', modal.body).forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; draw(); }));
      $('input', modal.body).focus();

      $('form', modal.body).addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const btn = $('button[type=submit]', form);
        btn.disabled = true;
        try {
          const { user } = await api.post(`/auth/${mode}`, Object.fromEntries(new FormData(form)));
          done = true;
          modal.close();
          store.setUser(user);
          toast(t(signup ? 'auth.welcomeNew' : 'auth.welcomeBack', { name: user.name.split(' ')[0] }), 'success');
          resolve(user);
        } catch (err) {
          $('.form-error', form).textContent = err.message;
          btn.disabled = false;
        }
      });
    };
    draw();
  });
}

export const requireUser = (reason) => (store.user ? Promise.resolve(store.user) : openAuth({ reason }));

// ---------------------------------------------------------------- checkout

/**
 * item: { kind: 'episode', series, episode } | { kind: 'season', series, season }
 * Resolves with the checkout result, or null if the customer backed out.
 */
export async function openCheckout(item) {
  const user = await requireUser(t('checkout.reason'));
  if (!user) return null;

  const { series } = item;
  const isEpisode = item.kind === 'episode';
  const amount = isEpisode ? item.episode.price_xaf : item.season.pass.price;
  const title = isEpisode
    ? `${epCode(item.episode.season_number, item.episode.episode_number)} — ${item.episode.title}`
    : t('checkout.passItem', { n: item.season.number, count: item.season.pass.lockedCount });
  const windowText = isEpisode ? t('checkout.hours', { n: store.rentalHours }) : t('checkout.days', { n: item.season.pass.days });

  return new Promise((resolve) => {
    let result = null;
    let busy = false;
    const modal = openModal('', { onClose: () => resolve(result) });
    let method = prefs.get('method', 'mtn_momo');
    let phone = prefs.get('phone', '');

    const drawForm = (error = '') => {
      mount(modal.body, html`
        <p class="eyebrow">${t(isEpisode ? 'checkout.eyebrowEp' : 'checkout.eyebrowSeason')}</p>
        <h2>${raw(t(isEpisode ? 'checkout.titleEp' : 'checkout.titleSeason'))}</h2>
        <p class="modal__lede">${t('checkout.lede', { window: windowText })}</p>
        <div class="summary">
          <div class="summary__art">${raw(posterArt(series))}</div>
          <div class="summary__text"><strong>${series.title}</strong><span>${title}</span></div>
          <div class="summary__price">${fcfa(amount)}</div>
        </div>
        <form novalidate>
          <div class="methods" role="radiogroup" aria-label="${t('checkout.methods')}">
            ${store.methods.map((m) => html`
              <label class="method">
                <input type="radio" name="method" value="${m.id}" ${m.id === method ? 'checked' : ''}>
                <span class="method__logo method__logo--${m.id}">${{ mtn_momo: 'MoMo', orange_money: 'OM', card: 'VISA' }[m.id] ?? ''}</span>
                <span><strong>${m.label}</strong><small>${t(m.needsPhone ? 'checkout.phoneHint' : 'checkout.cardHint')}</small></span>
              </label>`)}
          </div>
          <div class="field" data-phone>
            <label for="c-phone">${t('checkout.phone')}</label>
            <div class="input-group">
              <span class="input-group__prefix">+237</span>
              <input class="input" id="c-phone" name="phone" inputmode="tel" autocomplete="tel-national" placeholder="6 70 12 34 56" value="${phone}">
            </div>
          </div>
          <p class="form-error" role="alert">${error}</p>
          <button class="btn btn--primary btn--block" type="submit">${t('checkout.pay', { amount: fcfa(amount) })}</button>
          ${store.provider === 'simulated' ? html`<p class="fine">${t('checkout.demo')}</p>` : ''}
        </form>`);

      const form = $('form', modal.body);
      const syncPhone = () => {
        const m = store.methods.find((x) => x.id === $('input[name=method]:checked', form)?.value);
        $('[data-phone]', form).hidden = !m?.needsPhone;
      };
      form.addEventListener('change', syncPhone);
      syncPhone();
      form.addEventListener('submit', (e) => { e.preventDefault(); pay(new FormData(form)); });
    };

    const pay = async (data) => {
      if (busy) return;
      busy = true;
      method = data.get('method');
      phone = String(data.get('phone') || '');
      const needsPhone = store.methods.find((m) => m.id === method)?.needsPhone;
      prefs.set('method', method);
      if (needsPhone) prefs.set('phone', phone);

      const label = store.methods.find((m) => m.id === method)?.label;
      mount(modal.body, html`
        <div class="processing">
          <div class="pulse"><img src="/img/logo-mark.svg" alt=""></div>
          <p class="eyebrow">${label}</p>
          <h2>${t(needsPhone ? 'checkout.checkPhone' : 'checkout.securing')}</h2>
          <p class="modal__lede">${needsPhone ? t('checkout.sent', { amount: fcfa(amount), phone }) : t('checkout.bank')}</p>
        </div>`);

      const body = isEpisode
        ? { type: 'episode', episodeId: item.episode.id, method, phone }
        : { type: 'season', seriesId: series.id, season: item.season.number, method, phone };
      try {
        const [res] = await Promise.all([api.post('/checkout', body), sleep(1800)]);
        result = res;
        drawSuccess(res, label);
      } catch (err) {
        busy = false;
        if (err.code === 'already_unlocked') {
          result = { alreadyUnlocked: true };
          modal.close();
          toast(t('checkout.already'), 'success');
          return;
        }
        drawForm(err.message);
      }
    };

    const drawSuccess = (res, label) => {
      const watchId = isEpisode ? item.episode.id : res.episodeIds[0];
      mount(modal.body, html`
        <div class="processing">
          <div class="success-mark">✓</div>
          <p class="eyebrow">${t('checkout.confirmed')}</p>
          <h2>${t('checkout.enjoy')}</h2>
          <p class="modal__lede" style="margin:0">${isEpisode
            ? t('checkout.unlockedEp', { date: dateTime(res.expiresAt) })
            : t('checkout.unlockedSeason', { n: res.episodeIds.length, date: dateTime(res.expiresAt) })}</p>
          <dl class="receipt">
            <dt>${t('checkout.reference')}</dt><dd>${res.order.reference}</dd>
            <dt>${t('checkout.paidWith')}</dt><dd>${label}</dd>
            <dt>${t('checkout.amount')}</dt><dd>${fcfa(res.order.amount)}</dd>
          </dl>
          <a class="btn btn--primary btn--block" href="/watch/${watchId}" data-close>▶  ${t('checkout.watchNow')}</a>
        </div>`);
    };

    drawForm();
  });
}
