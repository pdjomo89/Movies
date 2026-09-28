// Server-side strings for API error messages, in English and French.
export const LANGS = ['en', 'fr'];

const MESSAGES = {
  en: {
    auth_required: 'Please sign in to continue.',
    forbidden: 'Admins only.',
    json_required: 'Content-Type must be application/json.',
    not_found: 'Not found.',
    bad_json: 'Malformed JSON.',
    server_error: 'Something went wrong on our side.',
    name_required: 'Tell us your name.',
    email_invalid: 'That email address looks off.',
    password_short: 'Use at least 8 characters for your password.',
    email_exists: 'An account with this email already exists.',
    bad_credentials: 'Email or password is incorrect.',
    series_not_found: 'Series not found.',
    episode_not_found: 'Episode not found.',
    season_not_found: 'Season not found.',
    choose_method: 'Choose a payment method.',
    invalid_phone: 'Enter a valid Cameroon mobile number, e.g. 6 70 12 34 56.',
    episode_free: 'This episode is free to watch.',
    episode_owned: 'You already have access to this episode.',
    season_owned: 'You already have every episode of this season.',
    invalid_type: 'Unknown purchase type.',
    payment_required: 'Unlock this episode to watch it.',
    pay_declined: 'The payment was declined by your operator. Please check your balance and try again.',
    pay_invalid_method: 'Unsupported payment method.',
    pay_invalid_amount: 'Invalid amount.',
    pay_failed: 'The payment could not be completed. Please try again.',
    title_letters: 'Title needs some letters.',
    series_exists: 'A series with this title already exists.',
    episode_number_taken: 'That season already has an episode with this number.',
    invalid_field: 'Invalid value for {field}.',
    required_field: '{field} is required.',
    stream_expired: 'This viewing link has expired. Reopen the episode from Mboa Reels.',
    video_missing: 'Video file not found. Run `npm run samples` to download demo clips.',
  },
  fr: {
    auth_required: 'Veuillez vous connecter pour continuer.',
    forbidden: 'Réservé aux administrateurs.',
    json_required: 'Le Content-Type doit être application/json.',
    not_found: 'Introuvable.',
    bad_json: 'JSON mal formé.',
    server_error: 'Une erreur est survenue de notre côté.',
    name_required: 'Indiquez-nous votre nom.',
    email_invalid: 'Cette adresse e-mail semble incorrecte.',
    password_short: 'Utilisez au moins 8 caractères pour votre mot de passe.',
    email_exists: 'Un compte existe déjà avec cet e-mail.',
    bad_credentials: 'E-mail ou mot de passe incorrect.',
    series_not_found: 'Série introuvable.',
    episode_not_found: 'Épisode introuvable.',
    season_not_found: 'Saison introuvable.',
    choose_method: 'Choisissez un moyen de paiement.',
    invalid_phone: 'Saisissez un numéro mobile camerounais valide, ex. 6 70 12 34 56.',
    episode_free: 'Cet épisode est gratuit.',
    episode_owned: 'Vous avez déjà accès à cet épisode.',
    season_owned: 'Vous avez déjà tous les épisodes de cette saison.',
    invalid_type: 'Type d’achat inconnu.',
    payment_required: 'Débloquez cet épisode pour le regarder.',
    pay_declined: 'Le paiement a été refusé par votre opérateur. Vérifiez votre solde et réessayez.',
    pay_invalid_method: 'Moyen de paiement non pris en charge.',
    pay_invalid_amount: 'Montant invalide.',
    pay_failed: 'Le paiement n’a pas pu aboutir. Veuillez réessayer.',
    title_letters: 'Le titre doit contenir des lettres.',
    series_exists: 'Une série porte déjà ce titre.',
    episode_number_taken: 'Cette saison a déjà un épisode avec ce numéro.',
    invalid_field: 'Valeur invalide pour « {field} ».',
    required_field: 'Le champ « {field} » est obligatoire.',
    stream_expired: 'Ce lien de lecture a expiré. Rouvrez l’épisode depuis Mboa Reels.',
    video_missing: 'Fichier vidéo introuvable. Lancez `npm run samples` pour télécharger les extraits de démo.',
  },
};

/** Explicit X-Lang header (set by our client) wins, then the browser's Accept-Language. */
export function langOf(req) {
  const header = req.get('x-lang') || req.get('accept-language') || '';
  return /^\s*fr/i.test(header) ? 'fr' : 'en';
}

export function msg(req, key, vars = {}) {
  const text = MESSAGES[req.lang]?.[key] ?? MESSAGES.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

/** Swap `field` for `field_fr` when the viewer reads French and a translation exists. */
export function localize(row, lang, fields) {
  if (!row) return row;
  const out = { ...row };
  for (const f of fields) {
    const fr = out[`${f}_fr`];
    if (lang === 'fr' && fr) out[f] = fr;
    delete out[`${f}_fr`];
  }
  return out;
}
