import { config } from './config.js';
import { openDb } from './db.js';
import { seed } from './seed.js';
import { createApp } from './app.js';

const db = openDb();
seed(db);

createApp({ db }).listen(config.port, () => {
  console.log(`\n  Mboa Reels is live → http://localhost:${config.port}\n`);
  if (!process.env.APP_SECRET) console.warn('  (APP_SECRET not set — using a random one; stream links reset on restart)\n');
});
