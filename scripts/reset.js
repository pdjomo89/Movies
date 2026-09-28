// Deletes the local database so the next start re-seeds a fresh catalogue.
import fs from 'node:fs';
import { config } from '../server/config.js';

for (const suffix of ['', '-wal', '-shm']) fs.rmSync(config.dbPath + suffix, { force: true });
console.log(`Removed ${config.dbPath}. Run \`npm start\` to re-seed.`);
