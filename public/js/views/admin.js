import { api } from '../api.js';
import { t } from '../i18n.js';
import { posterArt } from '../poster.js';
import { refresh } from '../router.js';
import { store } from '../store.js';
import { $, dateTime, fcfa, genreLabel, html, methodLabel, minutes, mount, openModal, raw, toast } from '../ui.js';

const GENRES = ['Drama', 'Thriller', 'Comedy', 'Romance', 'Fantasy', 'Action', 'Documentary', 'Music'];

function bars(rows, label, value, fmt = fcfa) {
  if (!rows.length) return html`<p class="muted">${t('admin.noSales')}</p>`;
  const max = Math.max(...rows.map(value), 1);
  return html`<div class="bars">${rows.map((r) => html`
    <div class="bar-row"><span>${label(r)}</span><div class="bar-row__track"><span style="width:${(value(r) / max) * 100}%"></span></div><span class="bar-row__val">${fmt(value(r))}</span></div>`)}</div>`;
}

function formModal({ eyebrow, title, fields, submit, onSubmit }) {
  const modal = openModal(html`
    <p class="eyebrow">${eyebrow}</p><h2>${title}</h2>
    <form novalidate style="margin-top:20px">
      ${fields}
      <p class="form-error" role="alert"></p>
      <button class="btn btn--primary btn--block" type="submit">${submit}</button>
    </form>`, { wide: true });
  $('form', modal.body).addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    form.querySelectorAll('input[type=checkbox]').forEach((c) => { data[c.name] = c.checked; });
    try {
      await onSubmit(data);
      modal.close();
      refresh();
    } catch (err) {
      $('.form-error', form).textContent = err.message;
    }
  });
}

// English is the primary text; French is optional and falls back to English when empty.
const seriesFields = () => html`
  <div class="field"><label>${t('admin.f.title')}</label><input class="input" name="title" required></div>
  <div class="form-grid">
    <div class="field"><label>${t('admin.f.tagline')}</label><input class="input" name="tagline" placeholder="${t('admin.f.taglineHint')}"></div>
    <div class="field"><label>${t('admin.f.taglineFr')}</label><input class="input" name="tagline_fr" lang="fr" placeholder="${t('admin.f.frHint')}"></div>
  </div>
  <div class="field"><label>${t('admin.f.synopsis')}</label><textarea class="textarea" name="synopsis"></textarea></div>
  <div class="field"><label>${t('admin.f.synopsisFr')}</label><textarea class="textarea" name="synopsis_fr" lang="fr" placeholder="${t('admin.f.frHint')}"></textarea></div>
  <div class="form-grid">
    <div class="field"><label>${t('admin.f.genre')}</label><select class="select input" name="genre">${GENRES.map((g) => html`<option value="${g}">${genreLabel(g)}</option>`)}</select></div>
    <div class="field"><label>${t('admin.f.year')}</label><input class="input" name="year" type="number" value="${new Date().getFullYear()}"></div>
    <div class="field"><label>${t('admin.f.rating')}</label><input class="input" name="rating" value="13+"></div>
  </div>
  <label class="check" style="margin-bottom:18px"><input type="checkbox" name="featured"> ${t('admin.f.featured')}</label>`;

const episodeFields = (next) => html`
  <div class="form-grid">
    <div class="field"><label>${t('admin.f.season')}</label><input class="input" name="season_number" type="number" min="1" value="${next.season}"></div>
    <div class="field"><label>${t('admin.f.episode')}</label><input class="input" name="episode_number" type="number" min="1" value="${next.episode}"></div>
    <div class="field"><label>${t('admin.f.duration')}</label><input class="input" name="duration_min" type="number" min="1" value="30"></div>
    <div class="field"><label>${t('admin.f.price')}</label><input class="input" name="price_xaf" type="number" min="0" step="5" value="10"></div>
  </div>
  <div class="form-grid">
    <div class="field"><label>${t('admin.f.title')}</label><input class="input" name="title" required></div>
    <div class="field"><label>${t('admin.f.titleFr')}</label><input class="input" name="title_fr" lang="fr" placeholder="${t('admin.f.frHint')}"></div>
  </div>
  <div class="field"><label>${t('admin.f.synopsis')}</label><textarea class="textarea" name="synopsis"></textarea></div>
  <div class="field"><label>${t('admin.f.synopsisFr')}</label><textarea class="textarea" name="synopsis_fr" lang="fr" placeholder="${t('admin.f.frHint')}"></textarea></div>
  <div class="field"><label>${t('admin.f.video')}</label><input class="input" name="video_src" placeholder="${t('admin.f.videoHint')}"></div>
  <label class="check" style="margin-bottom:18px"><input type="checkbox" name="is_free"> ${t('admin.f.free')}</label>`;

const toNumbers = (d, keys) => { for (const k of keys) if (d[k] !== undefined && d[k] !== '') d[k] = Number(d[k]); return d; };

export default async function admin({ el, isCurrent }) {
  if (store.user?.role !== 'admin') {
    mount(el, html`<div class="page wrap"><div class="empty" style="margin-top:40px"><p class="eyebrow">${t('nav.studio')}</p><h3>${t('admin.crewOnly')}</h3><p>${t('admin.crewBody')}</p>
      ${store.user ? html`<a class="btn btn--primary" href="/">${t('admin.backBrowsing')}</a>` : html`<button class="btn btn--primary" data-auth="login">${t('header.signin')}</button>`}</div></div>`);
    return;
  }
  const [stats, { series }] = await Promise.all([api.get('/admin/stats'), api.get('/admin/series')]);
  if (!isCurrent()) return;

  mount(el, html`
    <div class="page wrap">
      <div class="section__head" style="align-items:center">
        <div><p class="eyebrow">${t('nav.studio')}</p><h1 class="page-title">${raw(t('admin.title'))}</h1></div>
        <button class="btn btn--primary" data-new-series>${t('admin.newSeries')}</button>
      </div>

      <div class="stats">
        <div class="stat stat--hot"><div class="stat__label">${t('admin.revenueAll')}</div><div class="stat__value">${fcfa(stats.revenue)}</div></div>
        <div class="stat"><div class="stat__label">${t('admin.revenue30')}</div><div class="stat__value">${fcfa(stats.revenue30)}</div></div>
        <div class="stat"><div class="stat__label">${t('admin.orders')}</div><div class="stat__value">${stats.orders}</div></div>
        <div class="stat"><div class="stat__label">${t('admin.customers')}</div><div class="stat__value">${stats.customers} <small>${t('admin.paying', { n: stats.buyers })}</small></div></div>
      </div>

      <div class="admin-grid section" style="margin-top:20px">
        <div class="panel"><h3>${t('admin.byMethod')}</h3>${bars(stats.byMethod, (r) => methodLabel(r.method), (r) => r.revenue)}</div>
        <div class="panel"><h3>${t('admin.topSeries')}</h3>${bars(stats.topSeries, (r) => r.title, (r) => r.revenue)}</div>
      </div>

      <section class="section">
        <div class="section__head"><h2 class="section__title">${raw(t('admin.recent'))}</h2></div>
        ${stats.recent.length ? html`<div class="table-wrap"><table class="table">
          <thead><tr><th>${t('th.when')}</th><th>${t('th.customer')}</th><th>${t('th.item')}</th><th>${t('th.method')}</th><th>${t('th.status')}</th><th class="num">${t('th.amount')}</th></tr></thead>
          <tbody>${stats.recent.map((o) => html`<tr>
            <td>${dateTime(o.created_at)}</td><td>${o.customer}</td>
            <td>${o.series_title} <span class="muted">· ${o.kind === 'season' ? t('admin.passShort', { n: o.season_number }) : `S${o.season_number} E${o.episode_number}`}</span></td>
            <td>${methodLabel(o.method)}</td><td><span class="status status--${o.status}">${t(`status.${o.status}`)}</span></td>
            <td class="num">${fcfa(o.amount_xaf)}</td></tr>`)}</tbody></table></div>`
          : html`<p class="muted">${t('admin.noOrders')}</p>`}
      </section>

      <section class="section">
        <div class="section__head"><h2 class="section__title">${t('admin.catalogue')}</h2><span class="muted">${t('admin.catalogueHint')}</span></div>
        ${series.map((s) => html`
          <details class="admin-series" data-series="${s.id}">
            <summary>
              ${raw(posterArt(s))}
              <div style="flex:1;min-width:0"><strong>${s.title}</strong><div class="muted" style="font-size:13px">${genreLabel(s.genre)} · ${t('episodes', { n: s.episodes.length })}</div></div>
              ${s.featured ? html`<span class="chip chip--hot">${t('original')}</span>` : ''}
              ${s.published ? html`<span class="chip chip--unlocked">${t('admin.live')}</span>` : html`<span class="chip">${t('admin.hidden')}</span>`}
            </summary>
            <div class="admin-series__body">
              <div class="row-actions" style="justify-content:flex-start;margin-bottom:16px">
                <button class="btn btn--sm btn--primary" data-new-episode="${s.id}">${t('admin.addEpisode')}</button>
                <button class="btn btn--sm btn--line" data-toggle-series="${s.id}" data-field="featured" data-value="${s.featured ? 0 : 1}">${s.featured ? t('admin.unfeature') : t('admin.feature')}</button>
                <button class="btn btn--sm btn--line" data-toggle-series="${s.id}" data-field="published" data-value="${s.published ? 0 : 1}">${s.published ? t('admin.hide') : t('admin.publish')}</button>
                <a class="btn btn--sm btn--line" href="/series/${s.slug}">${t('admin.view')}</a>
              </div>
              <div class="table-wrap"><table class="table">
                <thead><tr><th>${t('admin.th.ep')}</th><th>${t('admin.th.title')}</th><th>${t('admin.th.length')}</th><th>${t('admin.th.sales')}</th><th>${t('admin.th.free')}</th><th>${t('admin.th.live')}</th><th class="num">${t('admin.th.price')}</th><th></th></tr></thead>
                <tbody>${s.episodes.map((e) => html`<tr data-episode="${e.id}">
                  <td class="muted">S${e.season_number} E${e.episode_number}</td>
                  <td><strong>${e.title}</strong>${e.title_fr && e.title_fr !== e.title ? html`<br><span class="muted" lang="fr">FR · ${e.title_fr}</span>` : ''}<br><span class="muted" style="font-size:12px">${e.video_src || t('admin.noVideo')}</span></td>
                  <td>${minutes(e.duration_sec)}</td><td>${e.sales}</td>
                  <td><input type="checkbox" name="is_free" ${e.is_free ? 'checked' : ''} aria-label="${t('admin.th.free')}"></td>
                  <td><input type="checkbox" name="published" ${e.published ? 'checked' : ''} aria-label="${t('admin.th.live')}"></td>
                  <td class="num"><input class="inline-input" name="price_xaf" type="number" min="0" step="5" value="${e.price_xaf}"></td>
                  <td><button class="btn btn--sm btn--line" data-save-episode>${t('admin.save')}</button></td>
                </tr>`)}</tbody>
              </table></div>
            </div>
          </details>`)}
      </section>
    </div>`);

  el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-new-series]')) {
      return formModal({
        eyebrow: t('nav.studio'), title: t('admin.newSeriesTitle'), fields: seriesFields(), submit: t('admin.createSeries'),
        onSubmit: async (d) => { await api.post('/admin/series', toNumbers(d, ['year'])); toast(t('admin.toast.seriesCreated'), 'success'); },
      });
    }

    const newEp = e.target.closest('[data-new-episode]');
    if (newEp) {
      const s = series.find((x) => x.id === Number(newEp.dataset.newEpisode));
      const last = s.episodes.at(-1);
      return formModal({
        eyebrow: s.title, title: t('admin.addEpisodeTitle'),
        fields: episodeFields({ season: last?.season_number ?? 1, episode: (last?.episode_number ?? 0) + 1 }), submit: t('admin.addEpisodeCta'),
        onSubmit: async (d) => {
          toNumbers(d, ['season_number', 'episode_number', 'price_xaf', 'duration_min']);
          d.duration_sec = Math.round((d.duration_min || 0) * 60);
          delete d.duration_min;
          await api.post(`/admin/series/${s.id}/episodes`, d);
          toast(t('admin.toast.episodeAdded'), 'success');
        },
      });
    }

    const toggle = e.target.closest('[data-toggle-series]');
    if (toggle) {
      await api.patch(`/admin/series/${toggle.dataset.toggleSeries}`, { [toggle.dataset.field]: Number(toggle.dataset.value) });
      toast(t('admin.toast.seriesUpdated'), 'success');
      return refresh();
    }

    const saveBtn = e.target.closest('[data-save-episode]');
    if (saveBtn) {
      const row = saveBtn.closest('[data-episode]');
      try {
        await api.patch(`/admin/episodes/${row.dataset.episode}`, {
          price_xaf: Number($('[name=price_xaf]', row).value),
          is_free: $('[name=is_free]', row).checked,
          published: $('[name=published]', row).checked,
        });
        toast(t('admin.toast.episodeSaved'), 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  });

  // Keep the catalogue section open across refreshes.
  let open;
  try { open = new Set(JSON.parse(sessionStorage.getItem('mboa:open') || '[]')); } catch { open = new Set(); }
  el.querySelectorAll('[data-series]').forEach((d) => {
    d.open = open.has(d.dataset.series);
    d.addEventListener('toggle', () => {
      d.open ? open.add(d.dataset.series) : open.delete(d.dataset.series);
      try { sessionStorage.setItem('mboa:open', JSON.stringify([...open])); } catch { /* ignore */ }
    });
  });
}
