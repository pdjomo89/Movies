// Generative key art: every series gets its own poster, derived deterministically from
// its slug — sunsets, film reels, arches and Ndop-cloth geometry in black and orange.

const TONES = [
  ['#ffc46b', '#ff6b1a', '#b8330a'],
  ['#ff9a3c', '#ff5a0a', '#7a1f05'],
  ['#ffd79a', '#ff8a2a', '#d4480c'],
  ['#ffb547', '#ef4f12', '#5c1604'],
];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (r, a, b) => a + r() * (b - a);
const f = (n) => Math.round(n * 10) / 10;

const MOTIFS = {
  sun(r, w, h, id, [a, b, c]) {
    const cx = w * between(r, 0.35, 0.65);
    const rad = Math.min(w, h) * between(r, 0.28, 0.38);
    const cy = h * between(r, 0.36, 0.48);
    let bars = '';
    for (let i = 0, y = cy + rad * 0.15, gap = 3; y < cy + rad; i++) {
      bars += `<rect x="0" y="${f(y)}" width="${w}" height="${f(gap)}" fill="#0a0908"/>`;
      y += gap + rad * 0.11;
      gap *= 1.45;
    }
    return `
      <defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/>
      </linearGradient>
      <radialGradient id="${id}g"><stop offset="0" stop-color="${b}" stop-opacity=".35"/><stop offset="1" stop-color="${b}" stop-opacity="0"/></radialGradient></defs>
      <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rad * 2.2)}" fill="url(#${id}g)"/>
      <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rad)}" fill="url(#${id}s)"/>
      ${bars}
      <rect x="0" y="${f(cy + rad)}" width="${w}" height="${h}" fill="#0a0908"/>
      <line x1="0" x2="${w}" y1="${f(cy + rad)}" y2="${f(cy + rad)}" stroke="${b}" stroke-opacity=".5" stroke-width="1"/>`;
  },

  reel(r, w, h, id, [a, b]) {
    const cx = w * between(r, 0.55, 0.85);
    const cy = h * between(r, 0.2, 0.4);
    const base = Math.max(w, h) * 0.08;
    let rings = '';
    for (let i = 0; i < 9; i++) {
      rings += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(base * (i + 1) * 1.15)}" fill="none" stroke="${i % 3 === 0 ? a : b}"
        stroke-opacity="${f(0.9 - i * 0.09)}" stroke-width="${i === 2 ? 10 : 1.4}"/>`;
    }
    let holes = '';
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2 + r();
      holes += `<circle cx="${f(cx + Math.cos(ang) * base * 1.3)}" cy="${f(cy + Math.sin(ang) * base * 1.3)}" r="${f(base * 0.38)}" fill="#0a0908"/>`;
    }
    return `${rings}<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(base * 2)}" fill="${b}"/>${holes}
      <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(base * 0.25)}" fill="#0a0908"/>`;
  },

  ndop(r, w, h, id, [a, b, c]) {
    const cols = w > h ? 12 : 6;
    const s = w / cols;
    const rows = Math.ceil(h / s);
    let cells = '';
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = x * s, py = y * s, m = s / 2, k = r();
        const color = [a, b, c][(x + y) % 3];
        if (k < 0.3) cells += `<path d="M${f(px + m)} ${f(py + 3)} L${f(px + s - 3)} ${f(py + m)} L${f(px + m)} ${f(py + s - 3)} L${f(px + 3)} ${f(py + m)}Z" fill="${color}"/>`;
        else if (k < 0.55) cells += `<path d="M${f(px)} ${f(py + s)} L${f(px + m)} ${f(py + 4)} L${f(px + s)} ${f(py + s)}" fill="none" stroke="${color}" stroke-width="2.5"/>`;
        else if (k < 0.72) cells += `<circle cx="${f(px + m)}" cy="${f(py + m)}" r="${f(s * 0.16)}" fill="${color}"/>`;
        else if (k < 0.85) cells += `<rect x="${f(px + s * 0.2)}" y="${f(py + s * 0.2)}" width="${f(s * 0.6)}" height="${f(s * 0.6)}" fill="none" stroke="${color}" stroke-width="2"/>`;
      }
    }
    return `<g opacity=".92">${cells}</g>`;
  },

  arches(r, w, h, id, [a, b, c]) {
    const count = w > h ? 5 : 3;
    const aw = w / count;
    let out = `<defs><linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>`;
    for (let i = 0; i < count; i++) {
      const top = h * between(r, 0.12, 0.45);
      for (let j = 0; j < 4; j++) {
        const inset = j * aw * 0.11;
        const x = i * aw + inset + aw * 0.06;
        const width = aw - inset * 2 - aw * 0.12;
        const rr = width / 2;
        const y = top + j * aw * 0.11;
        out += `<path d="M${f(x)} ${h} L${f(x)} ${f(y + rr)} A${f(rr)} ${f(rr)} 0 0 1 ${f(x + width)} ${f(y + rr)} L${f(x + width)} ${h}Z"
          fill="${j === 0 ? `url(#${id}a)` : j % 2 ? '#0a0908' : b}" ${j === 0 ? '' : `opacity="${1 - j * 0.12}"`}/>`;
      }
    }
    return out;
  },

  bands(r, w, h, id, [a, b, c]) {
    const angle = between(r, -35, -20);
    let out = '';
    let y = -h * 0.2;
    const colors = [a, '#0a0908', b, c, '#0a0908', b];
    for (let i = 0; y < h * 1.5; i++) {
      const bh = between(r, 0.04, 0.16) * h;
      out += `<rect x="${-w}" y="${f(y)}" width="${w * 3}" height="${f(bh)}" fill="${colors[i % colors.length]}" opacity="${f(between(r, 0.7, 1))}"/>`;
      y += bh;
    }
    return `<g transform="rotate(${f(angle)} ${w / 2} ${h / 2})">${out}</g>`;
  },
};

const GENRE_MOTIF = { Thriller: 'sun', Drama: 'arches', Comedy: 'bands', Romance: 'sun', Fantasy: 'ndop', Action: 'reel' };
let uid = 0;

/** @param {{slug:string, genre?:string}} series */
export function posterArt(series, { wide = false } = {}) {
  const [w, h] = wide ? [1600, 900] : [400, 600];
  const seed = hash(series.slug || series.title || 'mboa');
  const r = rng(seed);
  const names = Object.keys(MOTIFS);
  const motif = GENRE_MOTIF[series.genre] ?? names[seed % names.length];
  const tones = TONES[seed % TONES.length];
  const id = `art${seed.toString(36)}${uid++}`;
  return `<svg class="art" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="#0d0b0a"/>
    ${MOTIFS[motif](r, w, h, id, tones)}
  </svg>`;
}
