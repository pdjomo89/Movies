# Mboa Reels

**Stories from home, one episode at a time.** Mboa Reels is a pay-per-view streaming platform:
no subscription. Every pilot is free, and each episode after that is unlocked individually with
MTN Mobile Money, Orange Money or card.

## Quick start

```bash
npm install
npm run samples   # downloads three short demo clips into storage/videos
npm start         # → http://localhost:3000
```

Requires **Node 22.13+**, which provides the built-in SQLite used here. There is no native build
step and no bundler. Optionally, copy `.env.example` to `.env` to configure it.

| Account | Credentials |
| --- | --- |
| Admin (Studio) | `admin@mboareels.cm` / `mboa-admin-2026` (set via `ADMIN_EMAIL` / `ADMIN_PASSWORD` before first boot) |
| Customer | Sign up in the app |

Demo payments are simulated and no money moves. Any valid Cameroon number such as `670123456`
succeeds. Numbers ending in `000` are declined, so you can see the failure path.

```bash
npm test          # API tests: paywall, signed streams, season pass, declines, admin, CSRF
npm run reset     # wipe the local database and re-seed on next start
```

## How pay-per-view works

- **Free pilot.** Episode 1 of every series is free to watch once you have an account.
- **Episode rental.** One payment unlocks an episode for `RENTAL_HOURS` (default 48h) of unlimited replays.
- **Season pass.** All paid episodes of a season, discounted by `SEASON_PASS_DISCOUNT` (default 20%)
  over the ones not yet unlocked, for `SEASON_PASS_DAYS` (default 30).
- **Prices always come from the server.** The client never sends an amount, and an active rental
  can't be bought twice.
- **Protected playback.** `/api/episodes/:id/play` checks the entitlement, then returns a short-lived
  HMAC-signed `/stream/:id` URL. The URL is bound to the user and the episode, and it expires
  no later than the rental. Video files live outside `public/` and are only served against a valid
  signature, with range requests for seeking.
- **Resume.** Watch progress is saved as you watch and powers "Continue watching".

## Languages (English / Français)

The **EN | FR** switch in the header translates the whole app: the interface, server error
messages, and the catalogue content itself.

- **First visit:** the app follows the browser language (French browsers get French). After that,
  the visitor's choice is remembered on their device.
- **Interface text** lives in `public/js/i18n.js`. There is one dictionary per language, with
  matching keys.
- **API messages** live in `server/i18n.js`. The client sends `X-Lang`; if it doesn't, the
  browser's `Accept-Language` is used.
- **Catalogue content** is stored in `tagline_fr` / `synopsis_fr` (series) and `title_fr` /
  `synopsis_fr` (episodes). Where a French field is empty, the English text is shown. The Studio
  forms have French fields next to the English ones.
- **Adding a language:** add a dictionary in both `i18n.js` files, add it to `LANGS`, and add
  `_xx` columns if its content should be translated too.

## Project layout

```
server/
  index.js         boot: open DB, seed, listen
  app.js           express app + security headers + SPA fallback
  db.js            SQLite schema (node:sqlite)
  auth.js          scrypt passwords, DB-backed sessions, CSRF guard, stream signing
  access.js        entitlement + season-pass pricing logic
  payments.js      payment methods + simulated provider (swap for a real one)
  seed.js          admin account + demo catalogue
  routes/          auth, catalog, checkout, playback/stream, admin
public/
  index.html, css/styles.css
  js/app.js        router + header
  js/checkout.js   sign-in and checkout modals
  js/poster.js     generative key art (see "Brand")
  js/views/        home, series, watch, library (My Reels), admin (Studio)
  img/logo.svg, img/logo-mark.svg
storage/videos/    episode video files (git-ignored)
tests/             node:test API tests
```

## Admin: the Studio

Sign in as admin and open **Studio**. From there you can:

- see revenue (all time and the last 30 days), orders, customers, revenue split by payment
  method, and top series;
- create a series and add episodes;
- change prices inline, mark episodes free, and publish or unpublish them;
- feature a series as a "Mboa Original".

To add a real episode, drop the `.mp4` into `storage/videos/` and enter its filename in the
episode's *Video file* field.

## Brand

- **Name:** Mboa ("home" in Cameroonian slang) + Reels.
- **Logo:** a setting sun cut by horizon lines, with a play button in its centre: home, sunset,
  cinema. It's in `public/img/logo-mark.svg` (the mark, also used as the favicon) and
  `public/img/logo.svg` (the wordmark).
- **Palette:** near-black `#0A0908`, orange `#FF6B1A`, amber `#FFC46B`, ember `#D93A0A`, cream text `#F5EEE6`.
- **Type:** *Instrument Serif* (italic accents on the last word of titles) + *Manrope*.
- **Key art:** every series gets its own generated poster, derived from its slug: sunsets, film reels,
  arches, diagonal bands and Ndop-cloth geometry. The catalogue looks designed before you've
  commissioned any artwork. Real poster images can replace these later.

## Before going live

1. **Payments.** Implement `charge()` in `server/payments.js` against an aggregator such as
   CinetPay, Campay, NotchPay or Flutterwave. Real Mobile Money is asynchronous (the customer
   approves a USSD prompt), so create the order as `pending` and grant entitlements from the
   provider's signed webhook.
2. **Secrets.** Set `APP_SECRET`, run behind HTTPS, and set `SECURE_COOKIES=true`.
3. **Video.** For real catalogues, move to HLS with a CDN that supports signed URLs or tokens
   (e.g. Cloudflare Stream, Mux, Bunny Stream), and DRM if studios require it. The signed-link
   design here carries over directly.
4. **Rate limiting** on login/signup, **password reset** emails, and database backups.
5. **Legal.** Terms, a privacy policy and a refund policy for PPV.
