import { api } from '../api.js';
import { t } from '../i18n.js';
import { posterArt } from '../poster.js';
import { store } from '../store.js';
import { dateTime, epCode, fcfa, html, methodLabel, mount, raw, timeLeft } from '../ui.js';

export default async function library({ el, isCurrent }) {
  if (!store.user) {
    mount(el, html`<div class="page wrap"><div class="empty" style="margin-top:40px">
      <p class="eyebrow">${t('lib.eyebrow')}</p><h3>${t('lib.outTitle')}</h3>
      <p>${t('lib.outBody')}</p>
      <button class="btn btn--primary" data-auth="login">${t('header.signin')}</button></div></div>`);
    return;
  }
  const data = await api.get('/library');
  if (!isCurrent()) return;
  const soon = (ts) => ts - Date.now() < 6 * 3600_000;

  mount(el, html`
    <div class="page wrap">
      <p class="eyebrow">${t('lib.eyebrow')}</p>
      <h1 class="page-title">${raw(t('lib.title'))}</h1>
      <p class="muted">${t('lib.lede')}</p>

      <div class="stats">
        <div class="stat stat--hot"><div class="stat__label">${t('lib.unlocked')}</div><div class="stat__value">${data.active.length} <small>${t('episodeWord', { n: data.active.length })}</small></div></div>
        <div class="stat"><div class="stat__label">${t('lib.spent')}</div><div class="stat__value">${fcfa(data.spent)}</div></div>
        <div class="stat"><div class="stat__label">${t('lib.purchases')}</div><div class="stat__value">${data.orders.filter((o) => o.status === 'paid').length}</div></div>
      </div>

      <section class="section">
        <div class="section__head"><h2 class="section__title">${raw(t('lib.ready'))}</h2></div>
        ${data.active.length ? html`
          <div class="rentals">
            ${data.active.map((r) => html`
              <a class="rental ${soon(r.expires_at) ? 'is-expiring' : ''}" href="/watch/${r.episode_id}">
                <div class="rental__art">${raw(posterArt({ slug: r.slug, genre: r.genre }, { wide: true }))}<span class="chip">⏱ ${timeLeft(r.expires_at)}</span></div>
                <div class="rental__body">
                  <span class="eyebrow">${r.series_title}</span>
                  <strong>${r.episode_title}</strong>
                  <span class="muted" style="font-size:13px">${t('lib.until', { code: epCode(r.season_number, r.episode_number), date: dateTime(r.expires_at) })}</span>
                </div>
              </a>`)}
          </div>`
          : html`<div class="empty"><h3>${t('lib.emptyTitle')}</h3><p>${t('lib.emptyBody')}</p><a class="btn btn--primary" href="/">${t('series.browse')}</a></div>`}
      </section>

      <section class="section">
        <div class="section__head"><h2 class="section__title">${t('lib.receipts')}</h2></div>
        ${data.orders.length ? html`
          <div class="table-wrap"><table class="table">
            <thead><tr><th>${t('th.date')}</th><th>${t('th.item')}</th><th>${t('th.paidWith')}</th><th>${t('th.reference')}</th><th>${t('th.status')}</th><th class="num">${t('th.amount')}</th></tr></thead>
            <tbody>${data.orders.map((o) => html`<tr>
              <td>${dateTime(o.created_at)}</td>
              <td><a href="/series/${o.slug}"><strong>${o.series_title}</strong></a><br><span class="muted">${o.kind === 'season' ? t('pass.eyebrow', { n: o.season_number }) : `E${o.episode_number} · ${o.episode_title}`}</span></td>
              <td>${methodLabel(o.method)}${o.phone_masked ? html`<br><span class="muted">${o.phone_masked}</span>` : ''}</td>
              <td class="muted">${o.provider_ref ?? '—'}</td>
              <td><span class="status status--${o.status}">${t(`status.${o.status}`)}</span></td>
              <td class="num">${fcfa(o.amount_xaf)}</td>
            </tr>`)}</tbody>
          </table></div>`
          : html`<p class="muted">${t('lib.none')}</p>`}
      </section>
    </div>`);
}
