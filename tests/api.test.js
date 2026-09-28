import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { seed } from '../server/seed.js';
import { createApp } from '../server/app.js';

let server, base;
const log = console.log;

before(async () => {
  console.log = () => {};
  const db = openDb(':memory:');
  seed(db);
  console.log = log;
  server = createApp({ db }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

// Minimal cookie-keeping client.
function client() {
  let cookie = '';
  return async (method, url, body) => {
    const res = await fetch(base + url, {
      method,
      redirect: 'manual',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const type = res.headers.get('content-type') || '';
    return { status: res.status, body: type.includes('json') ? await res.json() : await res.text(), res };
  };
}

async function customer(email = `fan${Math.random().toString(36).slice(2)}@example.cm`) {
  const call = client();
  const r = await call('POST', '/api/auth/signup', { name: 'Awa Fan', email, password: 'supersecret' });
  assert.equal(r.status, 201);
  return call;
}

async function firstSeries(call) {
  const home = await call('GET', '/api/home');
  const { body } = await call('GET', `/api/series/${home.body.series[0].slug}`);
  return body;
}

test('catalogue is public and pilots are free', async () => {
  const call = client();
  const { body } = await call('GET', '/api/series/douala-nights');
  assert.equal(body.series.title, 'Douala Nights');
  const [pilot, second] = body.seasons[0].episodes;
  assert.equal(pilot.access.state, 'free');
  assert.equal(second.access.state, 'locked');
});

test('locked episode requires payment, then plays after checkout', async () => {
  const call = await customer();
  const { seasons } = await firstSeries(call);
  const ep = seasons[0].episodes[1];

  const locked = await call('GET', `/api/episodes/${ep.id}/play`);
  assert.equal(locked.status, 402);

  const paid = await call('POST', '/api/checkout', { type: 'episode', episodeId: ep.id, method: 'mtn_momo', phone: '+237 670 123 456' });
  assert.equal(paid.status, 201);
  assert.equal(paid.body.order.amount, ep.price_xaf);

  const again = await call('POST', '/api/checkout', { type: 'episode', episodeId: ep.id, method: 'mtn_momo', phone: '670123456' });
  assert.equal(again.status, 409, 'no double charge for an active rental');

  const play = await call('GET', `/api/episodes/${ep.id}/play`);
  assert.equal(play.status, 200);
  assert.match(play.body.src, /^\/stream\/\d+\?u=\d+&exp=\d+&sig=/);

  const library = await call('GET', '/api/library');
  assert.equal(library.body.active.length, 1);
  assert.equal(library.body.spent, ep.price_xaf);
});

test('stream links are signed and cannot be tampered with', async () => {
  const call = await customer();
  const { seasons } = await firstSeries(call);
  const play = await call('GET', `/api/episodes/${seasons[0].episodes[0].id}/play`);
  const tampered = play.body.src.replace(/sig=[^&]+/, 'sig=forged');
  assert.equal((await call('GET', tampered)).status, 403);
  const otherEpisode = play.body.src.replace(/^\/stream\/\d+/, `/stream/${seasons[0].episodes[1].id}`);
  assert.equal((await call('GET', otherEpisode)).status, 403);
  assert.notEqual((await call('GET', play.body.src)).status, 403);
});

test('season pass is discounted and unlocks every paid episode', async () => {
  const call = await customer();
  const { series, seasons } = await firstSeries(call);
  const season = seasons[0];
  const full = season.episodes.filter((e) => !e.is_free).reduce((s, e) => s + e.price_xaf, 0);
  assert.ok(season.pass.price < full);

  const r = await call('POST', '/api/checkout', { type: 'season', seriesId: series.id, season: season.number, method: 'card' });
  assert.equal(r.status, 201);
  assert.equal(r.body.order.amount, season.pass.price);

  const after = await call('GET', `/api/series/${series.slug}`);
  assert.ok(after.body.seasons[0].episodes.every((e) => e.access.state !== 'locked'));
});

test('declined mobile money creates no access', async () => {
  const call = await customer();
  const { seasons } = await firstSeries(call);
  const ep = seasons[0].episodes[2];
  const r = await call('POST', '/api/checkout', { type: 'episode', episodeId: ep.id, method: 'orange_money', phone: '699000000' });
  assert.equal(r.status, 402);
  assert.equal((await call('GET', `/api/episodes/${ep.id}/play`)).status, 402);
});

test('invalid phone numbers are rejected', async () => {
  const call = await customer();
  const { seasons } = await firstSeries(call);
  const r = await call('POST', '/api/checkout', { type: 'episode', episodeId: seasons[0].episodes[1].id, method: 'mtn_momo', phone: '12345' });
  assert.equal(r.status, 400);
});

test('admin API is restricted to admins', async () => {
  const fan = await customer();
  assert.equal((await fan('GET', '/api/admin/stats')).status, 403);

  const admin = client();
  const login = await admin('POST', '/api/auth/login', { email: 'admin@mboareels.cm', password: 'mboa-admin-2026' });
  assert.equal(login.status, 200);
  const created = await admin('POST', '/api/admin/series', { title: 'Bamenda Beats', genre: 'Music' });
  assert.equal(created.status, 201);
  assert.equal(created.body.series.slug, 'bamenda-beats');
  const ep = await admin('POST', `/api/admin/series/${created.body.series.id}/episodes`, { title: 'Intro', episode_number: 1, price_xaf: 250 });
  assert.equal(ep.status, 201);
  const stats = await admin('GET', '/api/admin/stats');
  assert.ok(stats.body.revenue > 0);
});

test('mutations must be JSON (CSRF guard)', async () => {
  const res = await fetch(`${base}/api/auth/login`, { method: 'POST', body: 'email=a&password=b', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  assert.equal(res.status, 415);
});

test('French: catalogue content and error messages follow X-Lang, falling back to English', async () => {
  const fr = { 'X-Lang': 'fr' };
  const series = await (await fetch(`${base}/api/series/douala-nights`, { headers: fr })).json();
  assert.equal(series.series.tagline, 'Quand la ville portuaire s’endort, ses secrets se réveillent.');
  assert.equal(series.seasons[0].episodes[0].title, 'Conteneur 0417');
  assert.ok(!('title_fr' in series.seasons[0].episodes[0]), 'translation columns are not leaked');

  const en = await (await fetch(`${base}/api/series/douala-nights`)).json();
  assert.equal(en.seasons[0].episodes[0].title, 'Container 0417');

  const browserFr = await fetch(`${base}/api/series/nope`, { headers: { 'Accept-Language': 'fr-CM,fr;q=0.9' } });
  assert.equal((await browserFr.json()).message, 'Série introuvable.');

  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { ...fr, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'x@y.cm', password: 'nope' }),
  });
  assert.equal((await login.json()).message, 'E-mail ou mot de passe incorrect.');
});

test('episodes cost 10 FCFA and the season pass is never dearer than buying them singly', async () => {
  const { seasons } = await (await fetch(`${base}/api/series/douala-nights`)).json();
  const paid = seasons.flatMap((s) => s.episodes).filter((e) => !e.is_free);
  assert.ok(paid.every((e) => e.price_xaf === 10));
  for (const s of seasons) {
    assert.ok(s.pass.price <= s.pass.fullPrice, `season ${s.number}: ${s.pass.price} > ${s.pass.fullPrice}`);
    if (s.pass.lockedCount > 1) assert.ok(s.pass.price < s.pass.fullPrice);
  }
});
