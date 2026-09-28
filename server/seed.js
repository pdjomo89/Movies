import { config } from './config.js';
import { hashPassword } from './auth.js';
import { tx } from './db.js';
import { slugify } from './routes/admin.js';

// Demo clips downloaded by `npm run samples` into storage/videos.
const CLIPS = ['sample-bunny.mp4', 'sample-jellyfish.mp4', 'sample-sintel.mp4'];

export const EPISODE_PRICE_XAF = 10;

// Episodes are [title, synopsis, title_fr, synopsis_fr].
const CATALOG = [
  {
    title: 'Douala Nights', genre: 'Thriller', year: 2026, rating: '16+', featured: 1,
    tagline: 'When the port city sleeps, its secrets wake.',
    tagline_fr: 'Quand la ville portuaire s’endort, ses secrets se réveillent.',
    synopsis: 'A customs officer at the Port of Douala stumbles on a container that should not exist — and a web of favours reaching from Akwa to the presidency. Every night she digs deeper, the city digs back.',
    synopsis_fr: 'Une douanière du port de Douala tombe sur un conteneur qui ne devrait pas exister — et sur un réseau de faveurs qui s’étend d’Akwa jusqu’à la présidence. Chaque nuit, plus elle creuse, plus la ville riposte.',
    seasons: [[
      ['Container 0417', 'Ngo Esther finds a manifest with no sender and a seal that was never broken.',
        'Conteneur 0417', 'Ngo Esther découvre un manifeste sans expéditeur et un scellé jamais brisé.'],
      ['Bonanjo After Dark', 'A contact at the Hotel Akwa Palace offers answers at a price Esther cannot afford.',
        'Bonanjo, la nuit', 'Un contact à l’hôtel Akwa Palace propose des réponses à un prix qu’Esther ne peut pas payer.'],
      ['The Wouri Bridge', 'A chase across the bridge ends with a name no one dares say aloud.',
        'Le pont du Wouri', 'Une course-poursuite sur le pont s’achève sur un nom que personne n’ose prononcer.'],
      ['Ledger', 'The money trail leads somewhere Esther never expected: home.',
        'Le registre', 'La piste de l’argent mène là où Esther ne l’attendait pas : chez elle.'],
      ['Low Tide', 'Allies turn, the port shuts down, and Esther has one night to get the truth out.',
        'Marée basse', 'Les alliés trahissent, le port ferme, et Esther n’a qu’une nuit pour révéler la vérité.'],
    ], [
      ['Harmattan', 'Six months later, a new shipment arrives — and so does someone from Esther’s past.',
        'Harmattan', 'Six mois plus tard, une nouvelle cargaison arrive — et avec elle, quelqu’un du passé d’Esther.'],
      ['Deido', 'A block party becomes the perfect cover for an exchange gone wrong.',
        'Deido', 'Une fête de quartier devient la couverture parfaite pour un échange qui tourne mal.'],
      ['Silent Partner', 'The investigation needs a sponsor. The only offer comes from the enemy.',
        'L’associé silencieux', 'L’enquête a besoin d’un soutien. La seule offre vient de l’ennemi.'],
    ]],
  },
  {
    title: 'Les Héritiers', genre: 'Drama', year: 2025, rating: '13+',
    tagline: 'One cocoa fortune. Five siblings. One will.',
    tagline_fr: 'Une fortune du cacao. Cinq enfants. Un seul testament.',
    synopsis: 'When the patriarch of Cameroon’s oldest cocoa house dies on the slopes of Mount Cameroon, his five children return to Buea to discover the will names only one heir — and it is not who anyone expected.',
    synopsis_fr: 'Quand le patriarche de la plus ancienne maison de cacao du Cameroun meurt sur les pentes du mont Cameroun, ses cinq enfants reviennent à Buea et découvrent que le testament ne désigne qu’un seul héritier — et ce n’est pas celui qu’on attendait.',
    seasons: [[
      ['La Veillée', 'The family gathers for the wake. The notary brings an envelope.',
        'La Veillée', 'La famille se réunit pour la veillée. Le notaire apporte une enveloppe.'],
      ['Le Testament', 'The will is read. Alliances form before the dust settles.',
        'Le Testament', 'Le testament est lu. Les alliances se forment avant même que la poussière retombe.'],
      ['Soppo', 'The youngest sister returns from Paris with a secret buyer.',
        'Soppo', 'La cadette revient de Paris avec un acheteur secret.'],
      ['Récolte', 'A fire in the drying sheds forces the siblings to work together — briefly.',
        'Récolte', 'Un incendie dans les séchoirs oblige les frères et sœurs à s’unir — brièvement.'],
      ['Mount Fako', 'A climb to their father’s favourite summit reveals why he chose as he did.',
        'Mont Fako', 'L’ascension du sommet préféré de leur père révèle pourquoi il a fait ce choix.'],
      ['La Part du Lion', 'The board votes. Blood proves thinner than cocoa.',
        'La Part du Lion', 'Le conseil vote. Le sang s’avère moins épais que le cacao.'],
    ]],
  },
  {
    title: 'Ndolé & Ambitions', genre: 'Comedy', year: 2026, rating: 'All',
    tagline: 'A chef, a food truck, and all of Yaoundé’s opinions.',
    tagline_fr: 'Une cheffe, un food truck, et tout Yaoundé qui donne son avis.',
    synopsis: 'Brigitte quits her bank job to sell the best ndolé in Yaoundé from a battered food truck. Her mother disapproves, her ex is her landlord, and the rival across the street sells soya with a sound system.',
    synopsis_fr: 'Brigitte quitte la banque pour vendre le meilleur ndolé de Yaoundé dans un food truck cabossé. Sa mère désapprouve, son ex est son propriétaire, et le concurrent d’en face vend du soya avec une sono.',
    seasons: [[
      ['Grand Opening', 'Brigitte launches the truck at Carrefour Warda. The generator has other plans.',
        'Grande ouverture', 'Brigitte lance son camion au carrefour Warda. Le groupe électrogène en a décidé autrement.'],
      ['Soya Wars', 'The rival sets up a speaker. Brigitte sets up a choir.',
        'La guerre du soya', 'Le rival installe une enceinte. Brigitte installe une chorale.'],
      ['Maman Knows Best', 'A surprise inspection from the toughest critic in the city: her mother.',
        'Maman a toujours raison', 'Inspection surprise de la critique la plus redoutable de la ville : sa mère.'],
      ['Food Critic', 'A famous blogger visits on the one day everything burns.',
        'Le critique', 'Un blogueur célèbre passe le seul jour où tout brûle.'],
    ]],
  },
  {
    title: 'Kribi Blue', genre: 'Romance', year: 2024, rating: '13+',
    tagline: 'Some tides bring you home.',
    tagline_fr: 'Certaines marées vous ramènent chez vous.',
    synopsis: 'An architect from Montréal returns to Kribi to sell her grandmother’s beach house — and falls for the fisherman who has been quietly keeping it standing.',
    synopsis_fr: 'Une architecte montréalaise revient à Kribi pour vendre la maison de plage de sa grand-mère — et tombe amoureuse du pêcheur qui, discrètement, l’a empêchée de s’écrouler.',
    seasons: [[
      ['Lobé Falls', 'Where the river meets the sea, an argument turns into something else.',
        'Les chutes de la Lobé', 'Là où le fleuve rejoint la mer, une dispute se transforme en tout autre chose.'],
      ['Grand Batanga', 'A boat ride, a storm, and a night stranded on the wrong side of the bay.',
        'Grand Batanga', 'Une balade en pirogue, un orage, et une nuit bloqués du mauvais côté de la baie.'],
      ['The Offer', 'A developer makes an offer that would change the coastline forever.',
        'L’offre', 'Un promoteur fait une offre qui changerait la côte à jamais.'],
      ['Saltwater', 'Choosing to stay means choosing who to disappoint.',
        'Eau salée', 'Choisir de rester, c’est choisir qui décevoir.'],
    ]],
  },
  {
    title: 'The Last Griot', genre: 'Fantasy', year: 2026, rating: '13+', featured: 1,
    tagline: 'Songs older than borders.',
    tagline_fr: 'Des chants plus anciens que les frontières.',
    synopsis: 'In the grassfields of the Northwest, a teenage beatmaker discovers that the old songs his grandfather sang can bend time. The kingdom that remembers them wants them back.',
    synopsis_fr: 'Dans les Grassfields du Nord-Ouest, un jeune beatmaker découvre que les vieux chants de son grand-père peuvent plier le temps. Le royaume qui s’en souvient veut les récupérer.',
    seasons: [[
      ['The Mvet', 'Tobi inherits an instrument that plays itself at midnight.',
        'Le Mvet', 'Tobi hérite d’un instrument qui joue tout seul à minuit.'],
      ['Foumban', 'In the royal palace museum, a mask recognises him.',
        'Foumban', 'Au musée du palais royal, un masque le reconnaît.'],
      ['Ndop', 'The patterns on his grandmother’s cloth turn out to be a map.',
        'Ndop', 'Les motifs du pagne de sa grand-mère se révèlent être une carte.'],
      ['Echo Chamber', 'Tobi samples a sacred song. The consequences go viral.',
        'Chambre d’écho', 'Tobi sample un chant sacré. Les conséquences deviennent virales.'],
      ['Chorus', 'Every griot who came before him answers at once.',
        'Le chœur', 'Tous les griots qui l’ont précédé répondent d’une seule voix.'],
    ]],
  },
  {
    title: 'Savane Rouge', genre: 'Action', year: 2025, rating: '16+',
    tagline: 'In the far north, the law rides a motorbike.',
    tagline_fr: 'Dans l’Extrême-Nord, la loi roule à moto.',
    synopsis: 'A park ranger in Waza National Park takes on a poaching syndicate with nothing but a dirt bike, a satellite phone, and a village that refuses to look away.',
    synopsis_fr: 'Une garde du parc national de Waza affronte un réseau de braconniers avec pour seules armes une moto tout-terrain, un téléphone satellite et un village qui refuse de détourner le regard.',
    seasons: [[
      ['Waza', 'A herd goes missing overnight. The tracks lead across the border.',
        'Waza', 'Un troupeau disparaît en une nuit. Les traces mènent de l’autre côté de la frontière.'],
      ['Mandara', 'In the mountains, an old friend offers help — and a warning.',
        'Mandara', 'Dans les montagnes, un vieil ami offre son aide — et un avertissement.'],
      ['Dust', 'A sandstorm grounds everyone except the hunters.',
        'Poussière', 'Une tempête de sable cloue tout le monde au sol, sauf les chasseurs.'],
      ['Red Earth', 'The final stand at the waterhole.',
        'Terre rouge', 'L’affrontement final au point d’eau.'],
    ]],
  },
];

export function seed(db) {
  if (!db.prepare('SELECT 1 FROM users WHERE role = ?').get('admin')) {
    db.prepare("INSERT INTO users (email, name, password_hash, role, created_at) VALUES (?, 'Mboa Admin', ?, 'admin', ?)")
      .run(config.adminEmail.toLowerCase(), hashPassword(config.adminPassword), Date.now());
    console.log(`  Seeded admin account: ${config.adminEmail} / ${config.adminPassword}`);
  }
  if (db.prepare('SELECT 1 FROM series').get()) return backfillFrench(db);

  tx(db, () => {
    const insertSeries = db.prepare(`
      INSERT INTO series (slug, title, tagline, synopsis, tagline_fr, synopsis_fr, genre, year, rating, featured, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertEpisode = db.prepare(`
      INSERT INTO episodes (series_id, season_number, episode_number, title, synopsis, title_fr, synopsis_fr,
                            duration_sec, price_xaf, is_free, video_src, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    let clip = 0;
    CATALOG.forEach((s, i) => {
      const { lastInsertRowid: seriesId } = insertSeries.run(
        slugify(s.title), s.title, s.tagline, s.synopsis, s.tagline_fr, s.synopsis_fr,
        s.genre, s.year, s.rating, s.featured ?? 0, Date.now() - i * 60_000,
      );
      s.seasons.forEach((episodes, si) => {
        episodes.forEach(([title, synopsis, titleFr, synopsisFr], ei) => {
          const isFree = si === 0 && ei === 0; // every pilot is on the house
          const duration = 22 * 60 + ((i * 7 + ei * 13) % 24) * 60;
          insertEpisode.run(seriesId, si + 1, ei + 1, title, synopsis, titleFr, synopsisFr,
            duration, EPISODE_PRICE_XAF, isFree ? 1 : 0, CLIPS[clip++ % CLIPS.length], Date.now());
        });
      });
    });
  });
  console.log(`  Seeded ${CATALOG.length} series into the catalogue.`);
}

// Databases seeded before French existed get the translations filled in (never overwriting edits).
function backfillFrench(db) {
  const series = db.prepare(`UPDATE series SET tagline_fr = ?, synopsis_fr = ? WHERE slug = ? AND tagline_fr = '' AND synopsis_fr = ''`);
  const episode = db.prepare(`
    UPDATE episodes SET title_fr = ?, synopsis_fr = ?
    WHERE series_id = (SELECT id FROM series WHERE slug = ?) AND season_number = ? AND episode_number = ?
      AND title_fr = '' AND synopsis_fr = ''`);
  tx(db, () => {
    for (const s of CATALOG) {
      const slug = slugify(s.title);
      series.run(s.tagline_fr, s.synopsis_fr, slug);
      s.seasons.forEach((eps, si) => eps.forEach(([, , titleFr, synopsisFr], ei) => episode.run(titleFr, synopsisFr, slug, si + 1, ei + 1)));
    }
  });
}
