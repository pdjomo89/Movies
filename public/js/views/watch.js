import { api, ApiError } from '../api.js';
import { openAuth, openCheckout } from '../checkout.js';
import { navigate } from '../router.js';
import { store } from '../store.js';
import { t } from '../i18n.js';
import { $, epCode, fcfa, genreLabel, html, minutes, mount, timeLeft } from '../ui.js';

function gate(el, { eyebrow, title, body, action }) {
  mount(el, html`
    <div class="watch wrap">
      <div class="player player--gate"><div class="player__overlay"><div>
        <p class="eyebrow">${eyebrow}</p><h3>${title}</h3><p class="muted" style="margin:-8px 0 22px">${body}</p>${action}
      </div></div></div>
    </div>`);
}

export default async function watch({ el, params: [id], isCurrent }) {
  if (!store.user) {
    gate(el, { eyebrow: t('gate.members'), title: t('gate.membersTitle'), body: t('gate.membersBody'), action: html`<button class="btn btn--primary" data-auth="login">${t('header.signin')}</button>` });
    return;
  }

  let data;
  try {
    data = await api.get(`/episodes/${id}/play`);
  } catch (err) {
    if (!(err instanceof ApiError) || !isCurrent()) throw err;
    if (err.status === 404) {
      gate(el, { eyebrow: t('gate.notFound'), title: t('gate.notFoundTitle'), body: t('gate.notFoundBody'), action: html`<a class="btn btn--primary" href="/">${t('series.browse')}</a>` });
      return;
    }
    if (err.status === 402) {
      const { series, seasons } = await api.get(`/series/${err.body.slug}`);
      if (!isCurrent()) return;
      const episode = seasons.flatMap((x) => x.episodes).find((x) => x.id === Number(id));
      gate(el, {
        eyebrow: `${series.title} · ${epCode(episode.season_number, episode.episode_number)}`,
        title: episode.title,
        body: t('gate.unlockBody', { price: fcfa(episode.price_xaf), hours: store.rentalHours }),
        action: html`<button class="btn btn--primary" data-buy>${t('ep.unlock', { price: fcfa(episode.price_xaf) })}</button> <a class="btn btn--ghost" href="/series/${series.slug}">${t('gate.all')}</a>`,
      });
      $('[data-buy]', el).addEventListener('click', async () => {
        if (await openCheckout({ kind: 'episode', series, episode }) && isCurrent()) navigate(location.pathname, { replace: true });
      });
      return;
    }
    if (err.status === 401) { openAuth(); return; }
    throw err;
  }
  if (!isCurrent()) return;

  const { episode, series, next } = data;
  mount(el, html`
    <div class="watch wrap">
      <div class="player" id="player">
        <video id="video" src="${data.src}" controls playsinline autoplay preload="metadata" controlslist="nodownload" disablepictureinpicture></video>
      </div>
      <div class="watch__info">
        <div>
          <p class="eyebrow"><a href="/series/${series.slug}">${series.title}</a> · ${epCode(episode.season_number, episode.episode_number)}</p>
          <h1 class="watch__title">${episode.title}</h1>
          <p class="muted" style="max-width:640px">${episode.synopsis}</p>
          <div class="hero__actions" style="margin-top:18px">
            ${episode.is_free ? html`<span class="chip chip--free"><span class="dot"></span>${t('watch.freePilot')}</span>` : html`<span class="chip chip--unlocked" id="timeleft"><span class="dot"></span>${t('chip.unlocked', { left: timeLeft(data.expiresAt) })}</span>`}
            <span class="chip">${minutes(episode.duration_sec)}</span>
            <span class="chip">${genreLabel(series.genre)}</span>
          </div>
        </div>
        ${next ? html`
          <aside class="upnext">
            <p class="eyebrow">${t('watch.upNext')}</p>
            <h4>${next.title}</h4>
            <p class="muted" style="margin:0 0 16px;font-size:13.5px">${epCode(next.season_number, next.episode_number)}</p>
            <a class="btn btn--line btn--sm" href="/watch/${next.id}">${t('watch.playNextArrow')}</a>
          </aside>` : html`<aside class="upnext"><p class="eyebrow">${t('watch.finale')}</p><h4>${t('watch.finaleTitle')}</h4><p class="muted" style="margin:0 0 16px;font-size:13.5px">${t('watch.finaleBody')}</p><a class="btn btn--line btn--sm" href="/">${t('series.browse')}</a></aside>`}
      </div>
    </div>`);

  const video = $('#video', el);
  let lastSaved = 0;
  const save = (force = false) => {
    if (!video.duration || (!force && Math.abs(video.currentTime - lastSaved) < 5)) return;
    lastSaved = video.currentTime;
    fetch('/api/progress', {
      method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ episodeId: episode.id, position: video.currentTime, duration: video.duration }),
    }).catch(() => {});
  };

  video.addEventListener('loadedmetadata', () => {
    if (data.position > 3 && data.position < video.duration - 5) video.currentTime = data.position;
  }, { once: true });
  video.addEventListener('timeupdate', () => save());
  video.addEventListener('pause', () => save(true));
  video.addEventListener('ended', () => {
    save(true);
    if (!next) return;
    const overlay = document.createElement('div');
    overlay.className = 'player__overlay';
    mount(overlay, html`<div><p class="eyebrow">${t('watch.upNextCode', { code: epCode(next.season_number, next.episode_number) })}</p><h3>${next.title}</h3>
      <a class="btn btn--primary" href="/watch/${next.id}">▶&nbsp; ${t('watch.playNext')}</a> <button class="btn btn--ghost" data-replay>${t('watch.replay')}</button></div>`);
    overlay.querySelector('[data-replay]').addEventListener('click', () => { overlay.remove(); video.currentTime = 0; video.play(); });
    $('#player', el).append(overlay);
  });
  video.addEventListener('error', () => {
    const overlay = document.createElement('div');
    overlay.className = 'player__overlay';
    mount(overlay, html`<div><p class="eyebrow">${t('watch.error')}</p><h3>${t('watch.errorTitle')}</h3><p class="muted">${t('watch.errorBody')}</p><button class="btn btn--primary" data-retry>${t('watch.retry')}</button></div>`);
    overlay.querySelector('[data-retry]').addEventListener('click', () => navigate(location.pathname, { replace: true }));
    $('#player', el).append(overlay);
  });

  const onHide = () => save(true);
  window.addEventListener('pagehide', onHide);
  const ticker = data.expiresAt && setInterval(() => {
    const chip = $('#timeleft', el);
    if (chip) mount(chip, html`<span class="dot"></span>${t('chip.unlocked', { left: timeLeft(data.expiresAt) })}`);
  }, 60_000);

  return () => {
    save(true);
    video.pause();
    video.removeAttribute('src');
    video.load();
    clearInterval(ticker);
    window.removeEventListener('pagehide', onHide);
  };
}
