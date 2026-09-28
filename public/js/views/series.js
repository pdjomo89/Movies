import { api, ApiError } from '../api.js';
import { openCheckout, requireUser } from '../checkout.js';
import { t } from '../i18n.js';
import { posterArt } from '../poster.js';
import { navigate } from '../router.js';
import { $, $$, epCode, fcfa, genreLabel, html, minutes, mount, raw, timeLeft } from '../ui.js';
import { styledTitle } from './home.js';

const lastSeason = new Map();

function accessChip(ep) {
  if (ep.access.state === 'free') return html`<span class="chip chip--free"><span class="dot"></span>${t('free')}</span>`;
  if (ep.access.state === 'unlocked') return html`<span class="chip chip--unlocked"><span class="dot"></span>${t('chip.unlocked', { left: timeLeft(ep.access.expiresAt) })}</span>`;
  return '';
}

function episodeRow(ep) {
  const open = ep.access.state !== 'locked';
  return html`
    <article class="episode">
      <div class="episode__num">${String(ep.episode_number).padStart(2, '0')}</div>
      <div>
        <h3 class="episode__title">${ep.title} ${accessChip(ep)}</h3>
        <p class="episode__syn">${ep.synopsis}</p>
        <div class="episode__meta">${epCode(ep.season_number, ep.episode_number)} · ${minutes(ep.duration_sec)}</div>
      </div>
      <div class="episode__action">
        ${open
          ? html`<button class="btn btn--sm ${ep.progress > 0 ? 'btn--primary' : 'btn--line'}" data-play="${ep.id}">▶&nbsp; ${ep.progress > 0.02 ? t('ep.resume') : t('ep.play')}</button>`
          : html`<button class="btn btn--sm btn--primary" data-unlock="${ep.id}">${t('ep.unlock', { price: fcfa(ep.price_xaf) })}</button>`}
      </div>
      ${ep.progress > 0.02 ? html`<div class="episode__progress"><span style="width:${Math.round(ep.progress * 100)}%"></span></div>` : ''}
    </article>`;
}

function passCard(season) {
  const { pass } = season;
  if (pass.lockedCount === 0) {
    return html`<aside class="pass">
      <p class="eyebrow">${t('season.n', { n: season.number })}</p>
      <h3>${t('pass.allSet')}</h3>
      <p>${t('pass.allSetBody')}</p>
    </aside>`;
  }
  const saving = pass.fullPrice - pass.price;
  return html`<aside class="pass">
    <p class="eyebrow">${t('pass.eyebrow', { n: season.number })}</p>
    <h3>${raw(t('pass.headline'))}</h3>
    <p>${t('pass.body', { n: pass.lockedCount })}</p>
    <div class="pass__price"><strong>${fcfa(pass.price)}</strong>${saving > 0 ? html`<s>${fcfa(pass.fullPrice)}</s>` : ''}</div>
    <ul>
      <li>${t('pass.days', { n: pass.days })}</li>
      ${saving > 0 ? html`<li>${t('pass.save', { amount: fcfa(saving) })}</li>` : ''}
      <li>${t('pass.methods')}</li>
    </ul>
    <button class="btn btn--primary btn--block" data-pass="${season.number}">${t('pass.cta')}</button>
  </aside>`;
}

export default async function series({ el, params: [slug], isCurrent }) {
  let data;
  try {
    data = await api.get(`/series/${slug}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      mount(el, html`<div class="page wrap"><div class="empty"><h3>${t('series.notFound')}</h3><p>${t('series.notFoundBody')}</p><a class="btn btn--primary" href="/">${t('series.browse')}</a></div></div>`);
      return;
    }
    throw err;
  }
  if (!isCurrent()) return;

  const { series: s, seasons } = data;
  const all = seasons.flatMap((x) => x.episodes);
  let seasonIdx = Math.min(lastSeason.get(slug) ?? 0, seasons.length - 1);

  // Hero call-to-action: resume > next watchable > first locked.
  const resume = all.find((e) => e.access.state !== 'locked' && e.progress > 0.02 && e.progress < 0.95);
  const watchable = all.find((e) => e.access.state !== 'locked' && e.progress < 0.95);
  const cta = resume
    ? html`<button class="btn btn--primary" data-play="${resume.id}">▶&nbsp; ${t('series.resume', { code: epCode(resume.season_number, resume.episode_number) })}</button>`
    : watchable
      ? html`<button class="btn btn--primary" data-play="${watchable.id}">▶&nbsp; ${t(watchable.access.state === 'free' ? 'series.watchFree' : 'series.play', { n: watchable.episode_number })}</button>`
      : all[0] ? html`<button class="btn btn--primary" data-unlock="${all[0].id}">${t('series.unlockFirst')}</button>` : '';

  mount(el, html`
    <section class="banner">
      ${raw(posterArt(s, { wide: true }))}
      <div class="banner__content">
        <p class="eyebrow">${s.featured ? `${t('mboaOriginal')} · ` : ''}${genreLabel(s.genre)}</p>
        <h1 class="banner__title">${styledTitle(s.title)}</h1>
        <p class="hero__tagline">${s.tagline}</p>
        <div class="hero__meta"><span>${s.year}</span><span>${s.rating}</span><span>${t('episodes', { n: s.episode_count })}</span>${s.from_price ? html`<span>${t('price.perEpisode', { price: fcfa(s.from_price) })}</span>` : ''}</div>
        <p class="banner__synopsis">${s.synopsis}</p>
        <div class="hero__actions">${cta}</div>
      </div>
    </section>
    <div class="wrap">
      <div class="series-layout section" style="margin-top:24px">
        <div>
          <div class="season-tabs" id="season-tabs">
            ${seasons.map((x, i) => html`<button data-season="${i}" class="${i === seasonIdx ? 'is-active' : ''}">${t('season.n', { n: x.number })} <span class="muted">· ${x.episodes.length}</span></button>`)}
          </div>
          <div id="episodes"></div>
        </div>
        <div id="pass"></div>
      </div>
    </div>`);

  const drawSeason = () => {
    const season = seasons[seasonIdx];
    mount($('#episodes', el), html`${season?.episodes.map(episodeRow) ?? html`<div class="empty"><h3>${t('series.soon')}</h3><p>${t('series.soonBody')}</p></div>`}`);
    mount($('#pass', el), season ? passCard(season) : '');
    $$('#season-tabs button', el).forEach((b, i) => b.classList.toggle('is-active', i === seasonIdx));
  };
  drawSeason();

  el.addEventListener('click', async (e) => {
    const tab = e.target.closest('[data-season]');
    if (tab) { seasonIdx = Number(tab.dataset.season); lastSeason.set(slug, seasonIdx); return drawSeason(); }

    const play = e.target.closest('[data-play]');
    if (play) {
      if (await requireUser(t('series.playReason'))) navigate(`/watch/${play.dataset.play}`);
      return;
    }

    const unlock = e.target.closest('[data-unlock]');
    if (unlock) {
      const episode = all.find((x) => x.id === Number(unlock.dataset.unlock));
      const res = await openCheckout({ kind: 'episode', series: s, episode });
      if (res && isCurrent()) navigate(location.pathname, { replace: true });
      return;
    }

    const pass = e.target.closest('[data-pass]');
    if (pass) {
      const season = seasons.find((x) => x.number === Number(pass.dataset.pass));
      const res = await openCheckout({ kind: 'season', series: s, season });
      if (res && isCurrent()) navigate(location.pathname, { replace: true });
    }
  });
}
