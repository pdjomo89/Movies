import { api } from '../api.js';
import { t, tMarkup } from '../i18n.js';
import { posterArt } from '../poster.js';
import { store } from '../store.js';
import { $, $$, epCode, fcfa, genreLabel, html, mount, raw } from '../ui.js';

export function posterCard(s) {
  return html`
    <a class="poster" href="/series/${s.slug}">
      ${raw(posterArt(s))}
      ${s.featured ? html`<span class="chip chip--hot poster__badge">${t('original')}</span>` : ''}
      <div class="poster__body">
        <div class="poster__genre">${genreLabel(s.genre)}</div>
        <div class="poster__title">${s.title}</div>
        <div class="poster__foot">
          <span>${t('episodes', { n: s.episode_count })}</span>
          <span>${s.from_price ? t('price.from', { price: fcfa(s.from_price) }) : t('free')}</span>
        </div>
      </div>
    </a>`;
}

// Italicise the last word of a title in the accent colour — the house style.
export function styledTitle(title) {
  const words = title.split(' ');
  if (words.length === 1) return html`<em>${title}</em>`;
  const last = words.pop();
  return html`${words.join(' ')} <em>${last}</em>`;
}

function heroSlide(s) {
  return html`
    <p class="eyebrow">${s.featured ? t('mboaOriginal') : t('hero.now')} · ${genreLabel(s.genre)}</p>
    <h1 class="hero__title">${styledTitle(s.title)}</h1>
    <p class="hero__tagline">${s.tagline}</p>
    <div class="hero__meta">
      <span>${s.year}</span><span>${s.rating}</span>
      <span>${t('seasons', { n: s.season_count })}</span><span>${t('episodes', { n: s.episode_count })}</span>
    </div>
    <div class="hero__actions">
      <a class="btn btn--primary" href="/series/${s.slug}">▶&nbsp; ${s.has_free ? t('hero.watchFree') : t('hero.start')}</a>
      <a class="btn btn--ghost" href="/series/${s.slug}">${t('hero.prices')}</a>
      ${s.from_price ? html`<span class="hero__price">${raw(tMarkup('hero.then', { price: fcfa(s.from_price) }))}</span>` : ''}
    </div>`;
}

export default async function home({ el, isCurrent }) {
  mount(el, html`<div class="hero"><div class="hero__content"><div class="skeleton" style="width:min(520px,80vw);height:220px"></div></div></div>`);
  const data = await api.get('/home');
  if (!isCurrent()) return;

  const featured = data.series.filter((s) => s.featured);
  const heroes = featured.length ? featured : data.series.slice(0, 3);
  const genres = ['All', ...new Set(data.series.map((s) => s.genre))];

  mount(el, html`
    <section class="hero" id="hero">
      <div class="hero__art" id="hero-art">${raw(posterArt(heroes[0], { wide: true }))}</div>
      <div class="hero__content" id="hero-content">${heroSlide(heroes[0])}</div>
      ${heroes.length > 1 ? html`<div class="hero__dots">${heroes.map((_, i) => html`<button aria-label="${t('hero.slide', { n: i + 1 })}" data-slide="${i}" class="${i === 0 ? 'is-active' : ''}"></button>`)}</div>` : ''}
    </section>

    <div class="wrap">
      ${data.continueWatching.length ? html`
        <section class="section">
          <div class="section__head"><h2 class="section__title">${raw(t('home.continue'))}</h2></div>
          <div class="rail rail--wide">
            ${data.continueWatching.map((c) => html`
              <a class="cw" href="/watch/${c.episode_id}">
                <div class="cw__art">${raw(posterArt({ slug: c.slug, genre: c.genre }, { wide: true }))}<div class="cw__play"><span class="btn btn--primary btn--sm">▶ ${t('home.resume')}</span></div></div>
                <div class="cw__bar"><span style="width:${Math.round((c.position_sec / c.duration_sec) * 100)}%"></span></div>
                <div class="cw__body"><strong>${c.series_title}</strong><span>${epCode(c.season_number, c.episode_number)} · ${c.episode_title}</span></div>
              </a>`)}
          </div>
        </section>` : ''}

      <section class="section">
        <div class="manifesto">
          <div class="manifesto__lead">
            <p class="eyebrow">${t('manifesto.eyebrow')}</p>
            <h2>${raw(t('manifesto.title'))}</h2>
          </div>
          <div class="step"><div class="step__num">01</div><h3>${t('step1.title')}</h3><p>${t('step1.body')}</p></div>
          <div class="step"><div class="step__num">02</div><h3>${t('step2.title')}</h3><p>${t('step2.body')}</p></div>
          <div class="step"><div class="step__num">03</div><h3>${t('step3.title', { hours: store.rentalHours })}</h3><p>${t('step3.body')}</p></div>
        </div>
      </section>

      <section class="section">
        <div class="section__head">
          <h2 class="section__title">${raw(t('home.originals'))}</h2>
          <span class="muted">${t('home.count', { n: data.series.length })}</span>
        </div>
        <div class="rail">${data.series.map(posterCard)}</div>
      </section>

      <section class="section">
        <div class="section__head">
          <h2 class="section__title">${raw(t('home.mood'))}</h2>
          <div class="genre-tabs" id="genres">${genres.map((g, i) => html`<button data-genre="${g}" class="${i === 0 ? 'is-active' : ''}">${genreLabel(g)}</button>`)}</div>
        </div>
        <div class="grid-posters" id="genre-grid">${data.series.map(posterCard)}</div>
      </section>
    </div>`);

  $('#genres', el).addEventListener('click', (e) => {
    const btn = e.target.closest('[data-genre]');
    if (!btn) return;
    $$('#genres button', el).forEach((b) => b.classList.toggle('is-active', b === btn));
    const g = btn.dataset.genre;
    mount($('#genre-grid', el), html`${data.series.filter((s) => g === 'All' || s.genre === g).map(posterCard)}`);
  });

  let current = 0;
  const show = (i) => {
    current = (i + heroes.length) % heroes.length;
    const art = $('#hero-art', el);
    art.style.opacity = 0;
    setTimeout(() => {
      mount(art, posterArt(heroes[current], { wide: true }));
      mount($('#hero-content', el), heroSlide(heroes[current]));
      art.style.opacity = 1;
    }, 400);
    $$('[data-slide]', el).forEach((b, j) => b.classList.toggle('is-active', j === current));
  };
  $('#hero', el).addEventListener('click', (e) => {
    const dot = e.target.closest('[data-slide]');
    if (dot) { show(Number(dot.dataset.slide)); restart(); }
  });
  let timer;
  const restart = () => { clearInterval(timer); if (heroes.length > 1) timer = setInterval(() => show(current + 1), 9000); };
  restart();
  return () => clearInterval(timer);
}
