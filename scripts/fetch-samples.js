// Downloads short, openly licensed demo clips (Blender Foundation / test-videos.co.uk)
// into storage/videos so the seeded catalogue has something to play.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(import.meta.dirname, '..', process.env.VIDEO_DIR || 'storage/videos');
const BASE = 'https://test-videos.co.uk/vids';
const CLIPS = {
  'sample-bunny.mp4': `${BASE}/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4`,
  'sample-jellyfish.mp4': `${BASE}/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4`,
  'sample-sintel.mp4': `${BASE}/sintel/mp4/h264/720/Sintel_720_10s_1MB.mp4`,
};

fs.mkdirSync(dir, { recursive: true });
for (const [name, url] of Object.entries(CLIPS)) {
  const dest = path.join(dir, name);
  if (fs.existsSync(dest)) { console.log(`✓ ${name} (already present)`); continue; }
  const res = await fetch(url);
  if (!res.ok) { console.error(`✗ ${name}: HTTP ${res.status}`); process.exitCode = 1; continue; }
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`✓ ${name}`);
}
