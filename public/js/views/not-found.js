import { t } from '../i18n.js';
import { html, mount } from '../ui.js';

export default function notFound({ el }) {
  mount(el, html`
    <div class="page wrap">
      <div class="empty" style="margin-top:60px">
        <p class="eyebrow">404</p>
        <h3>${t('notFound.title')}</h3>
        <p>${t('notFound.body')}</p>
        <a class="btn btn--primary" href="/">${t('notFound.cta')}</a>
      </div>
    </div>`);
}
