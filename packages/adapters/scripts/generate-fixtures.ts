/**
 * Generates the sample job photos and voice notes in /fixtures used by the WhatsApp simulator, seed data and tests.
 * They are drawn illustrations with photographic grain — fictional, offline and licence-free. Replace them with real
 * artisans' photos (with consent) before a live pitch. Run: pnpm --filter @sp/adapters fixtures
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const OUT = join(import.meta.dirname, '../../../fixtures');
const W = 1200;
const H = 900;

const svg = (body: string, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}
  <radialGradient id="vig" cx="50%" cy="45%" r="75%"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.38"/></radialGradient>
  </defs>${body}<rect width="${W}" height="${H}" fill="url(#vig)"/></svg>`;

// ---------------------------------------------------------------- scenes
const sky = `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fa9cf"/><stop offset="0.6" stop-color="#bcd3e6"/><stop offset="1" stop-color="#e7eef2"/></linearGradient>
<pattern id="iron" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)"><rect width="26" height="26" fill="#9aa3a6"/><rect width="13" height="26" fill="#b3bbbd"/><rect x="11" width="3" height="26" fill="#7f888b"/></pattern>`;

function roof(withPanels: boolean) {
  const panels: string[] = [];
  if (withPanels) {
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 4; c++) {
        const x0 = 250 + c * 175 - r * 40;
        const y0 = 360 + r * 175;
        const cells: string[] = [];
        for (let i = 1; i < 6; i++) cells.push(`<line x1="${x0 + (i * 160) / 6}" y1="${y0}" x2="${x0 + (i * 160) / 6 - 20}" y2="${y0 + 160}" stroke="#a9bcd6" stroke-opacity="0.35" stroke-width="1.5"/>`);
        for (let j = 1; j < 10; j++) cells.push(`<line x1="${x0 - (j * 20) / 10}" y1="${y0 + (j * 160) / 10}" x2="${x0 + 160 - (j * 20) / 10}" y2="${y0 + (j * 160) / 10}" stroke="#a9bcd6" stroke-opacity="0.3" stroke-width="1.2"/>`);
        panels.push(`<polygon points="${x0},${y0} ${x0 + 160},${y0} ${x0 + 140},${y0 + 160} ${x0 - 20},${y0 + 160}" fill="url(#cell)" stroke="#d6dbe0" stroke-width="5"/>${cells.join('')}`);
      }
    }
    panels.push(`<line x1="180" y1="440" x2="980" y2="440" stroke="#c9cfd4" stroke-width="7"/><line x1="140" y1="615" x2="940" y2="615" stroke="#c9cfd4" stroke-width="7"/>`);
  }
  return svg(
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>
    <ellipse cx="980" cy="120" rx="260" ry="50" fill="#fff" opacity="0.45"/><ellipse cx="300" cy="90" rx="200" ry="35" fill="#fff" opacity="0.35"/>
    <path d="M0 640 Q 200 600 420 630 T 1200 610 L1200 900 L0 900Z" fill="#4f6b3c"/>
    <polygon points="90,300 1110,250 1200,820 0,880" fill="url(#iron)"/>
    <polygon points="90,300 1110,250 1112,262 92,314" fill="#6f777a"/>
    ${panels.join('')}
    <polygon points="0,880 1200,820 1200,900 0,900" fill="#3d3a33"/>`,
    sky + `<linearGradient id="cell" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d2f52"/><stop offset="0.55" stop-color="#22365e"/><stop offset="0.75" stop-color="#4e6a93"/><stop offset="1" stop-color="#1b2b4a"/></linearGradient>`,
  );
}

const wall = `<linearGradient id="wall" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9e2d3"/><stop offset="1" stop-color="#cfc5b1"/></linearGradient>
<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d8170"/><stop offset="1" stop-color="#5f5547"/></linearGradient>`;

function inverterWall(installed: boolean) {
  const kit = installed
    ? `<rect x="430" y="150" width="300" height="400" rx="14" fill="#f4f5f2" stroke="#b9bcb5" stroke-width="3"/>
       <rect x="470" y="200" width="220" height="90" rx="6" fill="#1f2a2a"/><rect x="492" y="232" width="70" height="26" rx="3" fill="#7fe0a8" opacity="0.85"/><rect x="574" y="232" width="40" height="26" rx="3" fill="#7fe0a8" opacity="0.55"/><rect x="626" y="232" width="44" height="26" rx="3" fill="#7fe0a8" opacity="0.35"/>
       <circle cx="500" cy="340" r="9" fill="#3fb36d"/><circle cx="535" cy="340" r="9" fill="#e0a43a"/><rect x="470" y="380" width="220" height="10" rx="5" fill="#d7d9d3"/>
       <rect x="470" y="405" width="160" height="10" rx="5" fill="#d7d9d3"/>
       <rect x="800" y="210" width="150" height="190" rx="8" fill="#ece9e1" stroke="#a9a59a" stroke-width="3"/>
       <rect x="825" y="250" width="40" height="80" rx="4" fill="#2a2a2a"/><rect x="880" y="250" width="40" height="80" rx="4" fill="#2a2a2a"/>
       <rect x="832" y="268" width="26" height="22" fill="#d0342c"/><rect x="887" y="268" width="26" height="22" fill="#d0342c"/>
       <path d="M560 550 L560 640 Q560 660 540 660 L330 660" stroke="#c52b22" stroke-width="12" fill="none"/>
       <path d="M600 550 L600 680 Q600 700 620 700 L860 700" stroke="#1b1b1b" stroke-width="12" fill="none"/>
       <path d="M730 300 L800 300" stroke="#c52b22" stroke-width="10"/><path d="M730 330 L800 330" stroke="#1b1b1b" stroke-width="10"/>
       <rect x="190" y="620" width="230" height="200" rx="10" fill="#3a3f43"/><rect x="200" y="630" width="210" height="40" fill="#4a5056"/>
       <rect x="220" y="600" width="30" height="24" fill="#c52b22"/><rect x="360" y="600" width="30" height="24" fill="#1b1b1b"/>
       <rect x="760" y="640" width="230" height="200" rx="10" fill="#3a3f43"/><rect x="770" y="650" width="210" height="40" fill="#4a5056"/>
       <rect x="790" y="620" width="30" height="24" fill="#c52b22"/><rect x="930" y="620" width="30" height="24" fill="#1b1b1b"/>
       <rect x="215" y="740" width="170" height="16" rx="3" fill="#cfd3d6" opacity="0.6"/><rect x="785" y="760" width="170" height="16" rx="3" fill="#cfd3d6" opacity="0.6"/>`
    : `<rect x="760" y="230" width="190" height="240" rx="6" fill="#d9d4c7" stroke="#9e988a" stroke-width="3"/>
       <rect x="785" y="270" width="140" height="40" fill="#b2ab9c"/><rect x="785" y="330" width="140" height="40" fill="#b2ab9c"/>
       <path d="M855 470 L855 900" stroke="#8a8476" stroke-width="18"/>
       <rect x="240" y="580" width="260" height="140" fill="#a39780" opacity="0.6"/>`;
  return svg(
    `<rect width="${W}" height="${H}" fill="url(#wall)"/><rect y="760" width="${W}" height="140" fill="url(#floor)"/>
     <rect y="752" width="${W}" height="12" fill="#b4a990"/>
     <path d="M0 0 L120 0 L60 900 L0 900Z" fill="#000" opacity="0.06"/>${kit}`,
    wall,
  );
}

function gate(finished: boolean) {
  if (!finished) {
    const tubes = Array.from({ length: 9 }, (_, i) => `<rect x="${120 + i * 18}" y="${420 + i * 34}" width="900" height="26" rx="3" transform="rotate(-6 600 500)" fill="#6c7175" stroke="#4a4e51" stroke-width="2"/>`).join('');
    return svg(
      `<rect width="${W}" height="${H}" fill="#5a554c"/><rect width="${W}" height="380" fill="#7b7468"/>
       <rect x="60" y="80" width="300" height="200" fill="#3d3a35"/><circle cx="1000" cy="160" r="70" fill="#d8cdb2" opacity="0.7"/>
       ${tubes}<rect x="820" y="720" width="260" height="80" rx="8" fill="#2f5d8a"/><rect x="845" y="748" width="150" height="26" rx="4" fill="#e8eef5" opacity="0.7"/>`,
    );
  }
  const bars = Array.from({ length: 18 }, (_, i) => `<rect x="${222 + i * 42}" y="300" width="12" height="430" fill="#141414"/>`).join('');
  const rays = Array.from({ length: 13 }, (_, i) => {
    const a = Math.PI + (i * Math.PI) / 12;
    return `<line x1="600" y1="300" x2="${600 + Math.cos(a) * 170}" y2="${300 + Math.sin(a) * 170}" stroke="#141414" stroke-width="9"/>`;
  }).join('');
  return svg(
    `<rect width="${W}" height="${H}" fill="#d8c8a8"/><rect y="0" width="${W}" height="250" fill="#a9c2d8"/>
     <rect x="0" y="230" width="200" height="520" fill="#e2d7c2"/><rect x="1000" y="230" width="200" height="520" fill="#e2d7c2"/>
     <rect x="0" y="230" width="200" height="22" fill="#c5b79d"/><rect x="1000" y="230" width="200" height="22" fill="#c5b79d"/>
     <rect y="740" width="${W}" height="160" fill="#a99a80"/>
     <path d="M430 300 A170 170 0 0 1 770 300" fill="none" stroke="#141414" stroke-width="12"/>${rays}
     <rect x="200" y="290" width="800" height="16" fill="#141414"/><rect x="200" y="510" width="800" height="14" fill="#141414"/>
     <rect x="200" y="725" width="800" height="16" fill="#141414"/><rect x="200" y="290" width="18" height="450" fill="#141414"/>
     <rect x="982" y="290" width="18" height="450" fill="#141414"/><rect x="592" y="290" width="16" height="450" fill="#141414"/>${bars}
     <rect x="180" y="330" width="22" height="34" fill="#2a2a2a"/><rect x="180" y="650" width="22" height="34" fill="#2a2a2a"/>
     <rect x="560" y="560" width="80" height="30" rx="4" fill="#2a2a2a"/>`,
  );
}

function burglarBars() {
  const bricks: string[] = [];
  for (let y = 0; y < H; y += 46) for (let x = (y / 46) % 2 ? -50 : 0; x < W; x += 100) bricks.push(`<rect x="${x + 2}" y="${y + 2}" width="96" height="42" fill="${(x + y) % 3 ? '#a95a3c' : '#9c5137'}"/>`);
  const v = Array.from({ length: 6 }, (_, i) => `<rect x="${395 + i * 80}" y="200" width="14" height="500" fill="#f2f2ef"/>`).join('');
  return svg(
    `<rect width="${W}" height="${H}" fill="#d8cdbd"/>${bricks.join('')}
     <rect x="340" y="170" width="520" height="560" fill="#e9e4da"/><rect x="370" y="200" width="460" height="500" fill="#5d7488"/>
     <rect x="370" y="200" width="460" height="500" fill="url(#glass)"/><rect x="595" y="200" width="10" height="500" fill="#e9e4da"/>
     ${v}<rect x="370" y="330" width="460" height="14" fill="#f2f2ef"/><rect x="370" y="560" width="460" height="14" fill="#f2f2ef"/>
     <rect x="370" y="200" width="460" height="500" fill="none" stroke="#f2f2ef" stroke-width="14"/>
     <rect x="320" y="728" width="560" height="26" fill="#cfc7b8"/>`,
    `<linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.05"/><stop offset="1" stop-color="#fff" stop-opacity="0.2"/></linearGradient>`,
  );
}

function geyser() {
  return svg(
    `<rect width="${W}" height="${H}" fill="#3b3226"/><polygon points="0,0 1200,0 1200,260 0,420" fill="#4b4031"/>
     <polygon points="0,420 1200,260 1200,300 0,470" fill="#6b5a42"/>
     <rect x="180" y="470" width="820" height="40" fill="#b9b6ae"/><rect x="170" y="500" width="840" height="30" fill="#8f8b82"/>
     <rect x="230" y="300" width="720" height="190" rx="95" fill="url(#cyl)"/>
     <rect x="560" y="330" width="120" height="70" rx="6" fill="#e8e4da"/><rect x="580" y="356" width="80" height="12" rx="3" fill="#9b968a"/>
     <path d="M950 360 L1060 360 L1060 120" stroke="url(#cu)" stroke-width="18" fill="none"/>
     <path d="M950 430 L1110 430 L1110 120" stroke="url(#cu)" stroke-width="18" fill="none"/>
     <rect x="1040" y="230" width="40" height="50" rx="6" fill="#c9a531"/><rect x="1090" y="300" width="40" height="40" rx="6" fill="#c9a531"/>
     <path d="M230 400 L120 400 L120 900" stroke="url(#cu)" stroke-width="14" fill="none"/>
     <rect x="0" y="560" width="${W}" height="340" fill="#2c251c"/><rect x="0" y="600" width="${W}" height="18" fill="#56483a"/>`,
    `<linearGradient id="cyl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f2ec"/><stop offset="0.45" stop-color="#dcd8ce"/><stop offset="1" stop-color="#a7a296"/></linearGradient>
     <linearGradient id="cu" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8693a"/><stop offset="0.5" stop-color="#e09a62"/><stop offset="1" stop-color="#a65c30"/></linearGradient>`,
  );
}

function basin() {
  const tiles: string[] = [];
  for (let y = 0; y < 640; y += 100) for (let x = 0; x < W; x += 100) tiles.push(`<rect x="${x + 2}" y="${y + 2}" width="96" height="96" fill="#eef0ec"/>`);
  return svg(
    `<rect width="${W}" height="${H}" fill="#cfd3cd"/>${tiles.join('')}<rect y="640" width="${W}" height="260" fill="#8a8072"/>
     <rect x="470" y="160" width="260" height="300" rx="8" fill="#c4ccd2" stroke="#9aa3a9" stroke-width="4"/>
     <rect x="490" y="180" width="220" height="260" fill="url(#mirror)"/>
     <path d="M380 470 L820 470 Q820 600 700 610 L500 610 Q380 600 380 470Z" fill="#fbfbf9" stroke="#d6d6d0" stroke-width="3"/>
     <ellipse cx="600" cy="490" rx="190" ry="26" fill="#e7e8e3"/><rect x="585" y="420" width="30" height="60" rx="8" fill="#c7cbcf"/>
     <path d="M600 430 Q640 400 660 450" stroke="#c7cbcf" stroke-width="16" fill="none"/>
     <rect x="560" y="610" width="80" height="110" fill="#f2f2ee"/><path d="M600 720 L600 800 L760 800" stroke="#e8e8e2" stroke-width="22" fill="none"/>
     <path d="M520 640 L520 760" stroke="#c7cbcf" stroke-width="12"/><path d="M680 640 L680 760" stroke="#c7cbcf" stroke-width="12"/>`,
    `<linearGradient id="mirror" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dfe8ee"/><stop offset="0.5" stop-color="#b6c4cd"/><stop offset="1" stop-color="#d4dee4"/></linearGradient>`,
  );
}

function brakes() {
  const holes = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return `<circle cx="${600 + Math.cos(a) * 230}" cy="${450 + Math.sin(a) * 230}" r="9" fill="#55595c"/>`;
  }).join('');
  return svg(
    `<rect width="${W}" height="${H}" fill="#2a2b2c"/><rect y="680" width="${W}" height="220" fill="#1c1d1e"/>
     <circle cx="600" cy="450" r="320" fill="url(#disc)"/><circle cx="600" cy="450" r="320" fill="none" stroke="#5f6366" stroke-width="6"/>${holes}
     <circle cx="600" cy="450" r="130" fill="#46494c"/><circle cx="600" cy="450" r="50" fill="#2f3133"/>
     ${Array.from({ length: 5 }, (_, i) => { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; return `<circle cx="${600 + Math.cos(a) * 90}" cy="${450 + Math.sin(a) * 90}" r="16" fill="#9a9ea1"/>`; }).join('')}
     <path d="M820 170 Q980 260 990 450 Q980 640 820 730 L760 650 Q880 560 880 450 Q880 340 760 250Z" fill="#b22a21"/>
     <rect x="905" y="380" width="14" height="140" rx="7" fill="#8e1f18"/>`,
    `<radialGradient id="disc"><stop offset="0.4" stop-color="#9a9fa3"/><stop offset="0.7" stop-color="#c3c7ca"/><stop offset="0.9" stop-color="#8b8f92"/><stop offset="1" stop-color="#6c7073"/></radialGradient>`,
  );
}

const chitenge = `<pattern id="ch" width="120" height="120" patternUnits="userSpaceOnUse"><rect width="120" height="120" fill="#e3a43a"/>
  <circle cx="60" cy="60" r="38" fill="#1f5c4a"/><circle cx="60" cy="60" r="24" fill="#e3a43a"/><circle cx="60" cy="60" r="12" fill="#b6362a"/>
  <path d="M0 0 L30 0 L0 30Z M120 0 L90 0 L120 30Z M0 120 L30 120 L0 90Z M120 120 L90 120 L120 90Z" fill="#b6362a"/></pattern>`;

function dress() {
  return svg(
    `<rect width="${W}" height="${H}" fill="#e7dfd2"/><rect y="760" width="${W}" height="140" fill="#b49d7f"/>
     <rect x="560" y="80" width="80" height="40" rx="10" fill="#3a3a3a"/>
     <path d="M520 120 Q600 100 680 120 L700 200 Q690 300 650 330 L760 760 L440 760 L550 330 Q510 300 500 200Z" fill="url(#ch)" stroke="#6d4a1f" stroke-width="3"/>
     <path d="M550 330 Q600 350 650 330" stroke="#1f5c4a" stroke-width="14" fill="none"/>
     <rect x="592" y="760" width="16" height="70" fill="#3a3a3a"/><ellipse cx="600" cy="840" rx="120" ry="16" fill="#3a3a3a"/>
     <rect x="900" y="560" width="200" height="200" fill="#6b4f33"/><rect x="920" y="520" width="140" height="50" rx="6" fill="#ece6da"/>`,
    chitenge,
  );
}

function fabric() {
  return svg(
    `<rect width="${W}" height="${H}" fill="#8b6a49"/><rect x="0" y="0" width="${W}" height="${H}" fill="url(#wood)" opacity="0.35"/>
     <polygon points="140,220 860,170 980,600 220,690" fill="url(#ch)"/><polygon points="220,690 980,600 990,640 228,736" fill="#9c6f2a"/>
     <rect x="760" y="560" width="300" height="30" rx="4" fill="#e9d36a" transform="rotate(-18 900 580)"/>
     <path d="M300 720 L520 640 M300 640 L520 720" stroke="#bfc5c9" stroke-width="16" stroke-linecap="round"/>
     <circle cx="300" cy="720" r="34" fill="none" stroke="#1b1b1b" stroke-width="12"/><circle cx="300" cy="640" r="34" fill="none" stroke="#1b1b1b" stroke-width="12"/>`,
    chitenge + `<pattern id="wood" width="400" height="40" patternUnits="userSpaceOnUse"><rect width="400" height="40" fill="#7a5a3c"/><path d="M0 20 Q100 10 200 22 T400 18" stroke="#5e4329" stroke-width="3" fill="none"/></pattern>`,
  );
}

const scenes: Record<string, string> = {
  'solar-roof-before': roof(false),
  'solar-roof-after': roof(true),
  'solar-inverter-before': inverterWall(false),
  'solar-inverter-after': inverterWall(true),
  'weld-gate-before': gate(false),
  'weld-gate-after': gate(true),
  'weld-bars-after': burglarBars(),
  'plumb-geyser-after': geyser(),
  'plumb-basin-after': basin(),
  'mech-brakes-after': brakes(),
  'tailor-fabric-before': fabric(),
  'tailor-dress-after': dress(),
};

// Deterministic film grain so the drawings read as photos in the simulator.
function grain(seed: number): Buffer {
  const buf = Buffer.alloc(W * H * 4);
  let s = seed;
  for (let i = 0; i < W * H; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const v = 128 + ((s >>> 24) - 128) * 0.55;
    buf[i * 4] = v;
    buf[i * 4 + 1] = v;
    buf[i * 4 + 2] = v;
    buf[i * 4 + 3] = 34;
  }
  return buf;
}

async function main() {
  let seed = 7;
  for (const [name, s] of Object.entries(scenes)) {
    const img = await sharp(Buffer.from(s))
      .blur(0.7)
      .composite([{ input: grain(seed++), raw: { width: W, height: H, channels: 4 }, blend: 'overlay' }])
      .modulate({ saturation: 0.92 })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();
    writeFileSync(join(OUT, 'photos', `${name}.jpg`), img);
  }
  // A resized, recompressed copy for duplicate-detection tests.
  const dup = await sharp(join(OUT, 'photos', 'solar-roof-after.jpg')).resize(800).jpeg({ quality: 60 }).toBuffer();
  writeFileSync(join(OUT, 'photos', 'duplicate-solar-roof-resized.jpg'), dup);
  // A dark photo to trigger the retake prompt.
  const dark = await sharp(join(OUT, 'photos', 'solar-inverter-after.jpg')).modulate({ brightness: 0.12 }).jpeg({ quality: 70 }).toBuffer();
  writeFileSync(join(OUT, 'photos', 'too-dark-inverter.jpg'), dark);

  // Voice notes: short mono WAVs with a speech-like amplitude envelope (content comes from fixture transcripts).
  for (const [name, seconds] of [['voice-note-solar', 14], ['voice-note-short', 6]] as const) {
    writeFileSync(join(OUT, 'audio', `${name}.wav`), speechLikeWav(seconds));
  }
  writeFileSync(join(OUT, 'audio', 'consent-en.wav'), speechLikeWav(20));
  console.log('fixtures written to', OUT);
}

function speechLikeWav(seconds: number): Buffer {
  const rate = 8000;
  const n = rate * seconds;
  const data = Buffer.alloc(n * 2);
  let s = 12345;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const syllable = Math.max(0, Math.sin(t * Math.PI * 4.2)) * (0.6 + 0.4 * Math.sin(t * 1.3));
    const pause = (Math.floor(t * 0.8) % 3 === 2 && t % 1.25 > 0.8) ? 0.05 : 1;
    s = (s * 1103515245 + 12345) >>> 0;
    const noise = ((s >>> 16) / 65535 - 0.5) * 0.25;
    const voiced = Math.sin(2 * Math.PI * (140 + 25 * Math.sin(t * 3)) * t) * 0.6 + Math.sin(2 * Math.PI * 280 * t) * 0.25;
    const v = (voiced + noise) * syllable * pause * 9000;
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v))), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

void main();
