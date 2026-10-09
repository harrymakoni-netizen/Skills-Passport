import { levelName, t, tw, type CompetencyStatus, type Lang } from '@sp/core';
import QRCode from 'qrcode';
import sharp from 'sharp';
import type { ServiceContext } from './context';
import { evaluateArtisan } from './levels';
import { localized, tradeName, type Localized } from './reference';

const COUNTING = ['client_confirmed', 'verified', 'needs_improvement', 'under_review'] as const;

export interface PublicPassport {
  code: string;
  displayName: string;
  firstName: string;
  trades: { id: string; code: string; name: Localized }[];
  area: string;
  city: string;
  level: 'starter' | 'bronze' | 'silver' | 'gold';
  memberSince: string;
  experienceYears: number | null;
  badges: string[];
  profilePhotoUrl: string | null;
  stats: { countedJobs: number; distinctClients: number; averageRating: number | null; ratingsCount: number; reviewedJobs: number };
  gallery: { id: string; url: string; thumb: string; width: number | null; height: number | null; jobType: Localized; month: string; reviewed: boolean }[];
  competencies: { tradeId: string; tradeName: Localized; verified: number; total: number; units: { code: string; title: Localized; status: CompetencyStatus }[] }[];
  endorsements: { id: string; verifierName: string; yearsExperience: number; tradeName: Localized; statement: string; date: string }[];
  url: string;
}

/**
 * SPEC 4.6 public passport. Never includes phone numbers, exact locations, amounts, client details or disputes.
 */
export async function getPublicPassport(ctx: ServiceContext, code: string): Promise<PublicPassport | null> {
  const a = await ctx.prisma.artisan.findUnique({
    where: { passportCode: code },
    include: {
      area: true,
      trades: { include: { trade: true }, orderBy: { primary: 'desc' } },
      endorsements: { where: { withdrawnAt: null }, include: { verifier: true, trade: true }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!a || a.status === 'deleted' || a.status === 'onboarding') return null;
  const standing = await evaluateArtisan(ctx, a.id);
  const s = standing.result.stats;

  const jobs = await ctx.prisma.job.findMany({
    where: { artisanId: a.id, status: { in: [...COUNTING] }, public: true, id: { in: [...standing.countedIds] } },
    include: { jobType: true, review: true, media: { where: { public: true, publicKey: { not: null }, kind: { in: ['photo_after', 'photo_before'] }, duplicateOfId: null }, orderBy: [{ kind: 'desc' }, { sortOrder: 'asc' }] } },
    orderBy: { jobDate: 'desc' },
  });
  const gallery: PublicPassport['gallery'] = [];
  for (const j of jobs) {
    for (const m of j.media.filter((x) => x.kind === 'photo_after').slice(0, 2)) {
      gallery.push({
        id: m.id,
        url: ctx.adapters.storage.publicUrl(m.publicKey!),
        thumb: ctx.adapters.storage.publicUrl(m.thumbKey ?? m.publicKey!),
        width: m.width,
        height: m.height,
        jobType: localized(j.jobType.name),
        month: (j.jobDate ?? j.createdAt).toISOString(),
        reviewed: j.review?.quality === 'meets',
      });
    }
  }

  const units = await ctx.prisma.competencyUnit.findMany({ where: { tradeId: { in: a.trades.map((t) => t.tradeId) }, active: true }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] });
  const competencies = a.trades.map((tr) => {
    const list = units.filter((u) => u.tradeId === tr.tradeId).map((u) => ({ code: u.code, title: localized(u.title), status: standing.unitStatus.get(u.id) ?? 'none' }));
    return { tradeId: tr.tradeId, tradeName: tradeName(tr.trade), verified: list.filter((u) => u.status === 'verified').length, total: list.length, units: list };
  });

  return {
    code: a.passportCode,
    displayName: a.displayName,
    firstName: a.firstName,
    trades: a.trades.map((tr) => ({ id: tr.tradeId, code: tr.trade.code, name: tradeName(tr.trade) })),
    area: a.area.name,
    city: a.area.city,
    level: a.level,
    memberSince: a.joinedAt.toISOString(),
    experienceYears: a.experienceYears,
    badges: a.publicBadges,
    profilePhotoUrl: a.profilePhotoKey ? ctx.adapters.storage.publicUrl(a.profilePhotoKey) : null,
    stats: {
      countedJobs: s.countedJobs,
      distinctClients: s.distinctClients,
      averageRating: s.averageRating,
      ratingsCount: s.ratingsCount,
      reviewedJobs: jobs.filter((j) => j.review?.quality === 'meets').length,
    },
    gallery: gallery.slice(0, 12),
    competencies,
    endorsements: a.endorsements.map((e) => ({
      id: e.id,
      verifierName: e.verifier.name,
      yearsExperience: e.verifier.yearsExperience,
      tradeName: tradeName(e.trade),
      statement: e.statement,
      date: e.createdAt.toISOString(),
    })),
    url: `${ctx.publicBaseUrl}/p/${a.passportCode}`,
  };
}

export async function getPassportStatus(ctx: ServiceContext, artisanId: string) {
  const a = await ctx.prisma.artisan.findUniqueOrThrow({ where: { id: artisanId } });
  const { result } = await evaluateArtisan(ctx, artisanId);
  return {
    code: a.passportCode,
    level: result.level,
    frozen: result.frozen,
    countedJobs: result.stats.countedJobs,
    distinctClients: result.stats.distinctClients,
    averageRating: result.stats.averageRating,
    next: result.next ? { level: result.next.level, items: result.next.items } : null,
    link: `${ctx.publicBaseUrl}/p/${a.passportCode}`,
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** QR code PNG with the passport code printed underneath (SPEC 10). */
export async function passportQrPng(ctx: ServiceContext, code: string, size = 720): Promise<Buffer> {
  const url = `${ctx.publicBaseUrl}/p/${code}`;
  const qr = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 0, color: { dark: '#0E4334', light: '#00000000' } });
  const inner = qr.replace(/^[\s\S]*?<svg[^>]*viewBox="([^"]+)"[^>]*>/, '<svg x="60" y="60" width="600" height="600" viewBox="$1">');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="820" viewBox="0 0 720 820">
    <rect width="720" height="820" fill="#F7F4EE"/>${inner}
    <text x="360" y="752" text-anchor="middle" font-family="DejaVu Sans Mono, monospace" font-size="40" letter-spacing="6" fill="#141414">${esc(code)}</text>
    <text x="360" y="796" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="22" letter-spacing="4" fill="#5E6660">SKILLS PASSPORT</text></svg>`;
  return sharp(Buffer.from(svg)).resize({ width: size }).png({ compressionLevel: 9, palette: true }).toBuffer();
}

function guilloche(cx: number, cy: number, r: number, color: string, opacity: number): string {
  const paths: string[] = [];
  for (let k = 0; k < 14; k++) {
    let d = '';
    for (let i = 0; i <= 360; i += 2) {
      const a = (i * Math.PI) / 180;
      const rr = r + 26 * Math.sin(7 * a + k * 0.45) + 12 * Math.cos(11 * a);
      d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a) * 0.62).toFixed(1)} `;
    }
    paths.push(`<path d="${d}Z" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="1.2"/>`);
  }
  return paths.join('');
}

/** 1080×1920 card for WhatsApp Status (SPEC 4.6 share options). */
export async function passportCardPng(ctx: ServiceContext, code: string, lang: Lang = 'en'): Promise<Buffer | null> {
  const p = await getPublicPassport(ctx, code);
  if (!p) return null;
  const qr = await QRCode.toString(p.url, { type: 'svg', margin: 0, color: { dark: '#0E4334', light: '#00000000' } });
  const qrInner = qr.replace(/^[\s\S]*?<svg[^>]*viewBox="([^"]+)"[^>]*>/, '<svg x="740" y="1560" width="240" height="240" viewBox="$1">');
  const trade = p.trades.map((x) => x.name[lang]).join(' · ');
  const rating = p.stats.averageRating ? p.stats.averageRating.toFixed(1) : '—';
  const levelColor = { starter: '#E3ECE7', bronze: '#C99464', silver: '#C9CED1', gold: '#D2B36A' }[p.level];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
    <rect width="1080" height="1920" fill="#F7F4EE"/>
    <rect width="1080" height="1180" fill="#0E4334"/>${guilloche(540, 420, 360, '#9CC2B0', 0.18)}${guilloche(540, 420, 250, '#9CC2B0', 0.12)}
    <text x="100" y="160" font-family="DejaVu Sans, sans-serif" font-size="30" letter-spacing="9" fill="#BFD6CB">${esc(tw(lang, 'brand.document_label').toUpperCase())}</text>
    <text x="100" y="830" font-family="DejaVu Serif, serif" font-weight="bold" font-size="104" fill="#F7F4EE">${esc(p.displayName)}</text>
    <text x="100" y="910" font-family="DejaVu Sans, sans-serif" font-size="42" fill="#DCE8E2">${esc(trade)}</text>
    <text x="100" y="970" font-family="DejaVu Sans, sans-serif" font-size="36" fill="#9CC2B0">${esc(`${p.area}, ${p.city}`)}</text>
    <rect x="100" y="1040" width="300" height="72" rx="8" fill="none" stroke="${levelColor}" stroke-width="3"/>
    <text x="250" y="1088" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="34" letter-spacing="8" fill="${levelColor}">${esc(levelName(lang, p.level).toUpperCase())}</text>
    <text x="980" y="1092" text-anchor="end" font-family="DejaVu Sans Mono, monospace" font-size="40" letter-spacing="6" fill="#F7F4EE">${esc(p.code)}</text>
    <g font-family="DejaVu Sans, sans-serif">
      <text x="100" y="1330" font-family="DejaVu Sans Mono, monospace" font-size="96" fill="#141414">${p.stats.countedJobs}</text>
      <text x="100" y="1385" font-size="30" fill="#5E6660">${esc(tw(lang, 'p.verified_jobs'))}</text>
      <text x="440" y="1330" font-family="DejaVu Sans Mono, monospace" font-size="96" fill="#141414">${p.stats.distinctClients}</text>
      <text x="440" y="1385" font-size="30" fill="#5E6660">${esc(tw(lang, 'p.clients_served'))}</text>
      <text x="760" y="1330" font-family="DejaVu Sans Mono, monospace" font-size="96" fill="#141414">${rating}</text>
      <text x="760" y="1385" font-size="30" fill="#5E6660">${esc(tw(lang, 'p.average_rating'))}</text>
    </g>
    <line x1="100" y1="1460" x2="980" y2="1460" stroke="#DDD6C8" stroke-width="2"/>
    <text x="100" y="1620" font-family="DejaVu Sans, sans-serif" font-size="34" fill="#141414">${esc(tw(lang, 'p.scan'))}</text>
    <text x="100" y="1680" font-family="DejaVu Sans, sans-serif" font-size="30" fill="#5E6660">${esc(p.url.replace(/^https?:\/\//, ''))}</text>
    ${qrInner}</svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

/** Text body for "Share my passport". */
export function shareText(lang: Lang, p: PublicPassport) {
  return t(lang, 'share.text', { name: p.displayName, trade: p.trades[0]?.name[lang] ?? '', level: levelName(lang, p.level), link: p.url });
}

/** Compact SVG QR for the passport page (crisp at any size, ~3 KB). */
export async function passportQrSvg(ctx: ServiceContext, code: string): Promise<string> {
  return QRCode.toString(`${ctx.publicBaseUrl}/p/${code}`, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#0E4334', light: '#F7F4EE' } });
}

/** 1200×630 Open Graph image so a shared WhatsApp link previews like a document, not a generic site card. */
export async function passportOgPng(ctx: ServiceContext, code: string): Promise<Buffer | null> {
  const p = await getPublicPassport(ctx, code);
  if (!p) return null;
  const trade = p.trades.map((x) => x.name.en).join(' · ');
  const rating = p.stats.averageRating ? p.stats.averageRating.toFixed(1) : '—';
  const levelColor = { starter: '#E3ECE7', bronze: '#D9A77A', silver: '#D3D8DC', gold: '#DCC07C' }[p.level];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#0E4334"/>${guilloche(930, 420, 300, '#9CC2B0', 0.16)}
    <text x="72" y="96" font-family="DejaVu Sans, sans-serif" font-size="22" letter-spacing="7" fill="#9CC2B0">SKILLS PASSPORT</text>
    <rect x="890" y="64" width="238" height="56" rx="6" fill="none" stroke="${levelColor}" stroke-width="2.5"/>
    <text x="1009" y="101" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="24" letter-spacing="7" fill="${levelColor}">${esc(levelName('en', p.level).toUpperCase())}</text>
    <text x="72" y="300" font-family="DejaVu Serif, serif" font-weight="bold" font-size="84" fill="#F7F4EE">${esc(p.displayName)}</text>
    <text x="72" y="362" font-family="DejaVu Sans, sans-serif" font-size="34" fill="#DCE8E2">${esc(trade)}</text>
    <text x="72" y="408" font-family="DejaVu Sans, sans-serif" font-size="28" fill="#9CC2B0">${esc(`${p.area}, ${p.city}`)}</text>
    <line x1="72" y1="470" x2="1128" y2="470" stroke="#9CC2B0" stroke-opacity="0.35" stroke-width="1.5"/>
    <g font-family="DejaVu Sans, sans-serif" font-size="24" fill="#9CC2B0">
      <text x="72" y="540" font-family="DejaVu Sans Mono, monospace" font-size="48" fill="#F7F4EE">${p.stats.countedJobs}</text><text x="72" y="578">confirmed jobs</text>
      <text x="320" y="540" font-family="DejaVu Sans Mono, monospace" font-size="48" fill="#F7F4EE">${p.stats.distinctClients}</text><text x="320" y="578">clients served</text>
      <text x="560" y="540" font-family="DejaVu Sans Mono, monospace" font-size="48" fill="#F7F4EE">${rating}</text><text x="560" y="578">average rating</text>
    </g>
    <text x="1128" y="578" text-anchor="end" font-family="DejaVu Sans Mono, monospace" font-size="30" letter-spacing="5" fill="#F7F4EE">${esc(p.code)}</text></svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
