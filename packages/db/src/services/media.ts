import { checkDuplicateImage, t } from '@sp/core';
import { processImage, wavDurationSec } from '@sp/adapters';
import type { ServiceContext } from './context';
import { raiseFlag } from './fraud';
import { notify } from './outbound';

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
};
const ext = (mime: string) => EXT[mime.split(';')[0]!.trim()] ?? 'bin';

/** SPEC 9 media pipeline for one item. Idempotent: re-running skips finished steps. */
export async function processMedia(ctx: ServiceContext, mediaId: string) {
  if (mediaId.startsWith('profile:')) return processProfilePhoto(ctx, mediaId.slice(8));
  const m = await ctx.prisma.jobMedia.findUnique({ where: { id: mediaId }, include: { job: true } });
  if (!m || m.status === 'done') return;
  const { storage, channel } = ctx.adapters;

  let original: Buffer;
  let mime = m.mimeType;
  if (m.originalKey) {
    original = await storage.get('private', m.originalKey);
  } else {
    if (!m.providerMediaId) throw new Error(`Media ${m.id} has no source`);
    const dl = await channel.downloadMedia(m.providerMediaId);
    original = dl.data;
    mime = dl.mimeType || mime;
    const key = `originals/${m.jobId}/${m.id}.${ext(mime)}`;
    await storage.put('private', key, original, { contentType: mime });
    await ctx.prisma.jobMedia.update({ where: { id: m.id }, data: { originalKey: key, mimeType: mime, bytes: original.length } });
  }

  if (m.kind === 'photo_before' || m.kind === 'photo_after') {
    const img = await processImage(original);
    const publicKey = `jobs/${m.jobId}/${m.id}.jpg`;
    const thumbKey = `jobs/${m.jobId}/${m.id}-thumb.jpg`;
    await storage.put('public', publicKey, img.publicJpeg, { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' });
    await storage.put('public', thumbKey, img.thumbJpeg, { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' });
    const { params: config } = await ctx.config();

    const candidates = await ctx.prisma.jobMedia.findMany({
      where: { id: { not: m.id }, phash: { not: null }, duplicateOfId: null },
      select: { id: true, jobId: true, phash: true },
    });
    const dup = checkDuplicateImage({ phash: img.phash, candidates: candidates.map((c) => ({ mediaId: c.id, jobId: c.jobId, phash: c.phash! })) }, config);
    const firstMatch = (dup?.evidence?.matches as { mediaId: string }[] | undefined)?.[0]?.mediaId ?? null;

    await ctx.prisma.jobMedia.update({
      where: { id: m.id },
      data: {
        publicKey,
        thumbKey,
        width: img.width,
        height: img.height,
        phash: img.phash,
        capturedAt: img.capturedAt,
        exifLat: img.gps?.lat ?? null,
        exifLng: img.gps?.lng ?? null,
        qualityScore: img.quality.score,
        qualityProblem: img.quality.problem,
        duplicateOfId: firstMatch,
        public: dup ? false : m.public,
        status: 'done',
      },
    });
    if (dup) await raiseFlag(ctx, dup, m.jobId);

    if (img.quality.problem && img.quality.score < config.media.minQuality && m.job.status === 'draft') {
      const n = (await ctx.prisma.jobMedia.count({ where: { jobId: m.jobId, kind: m.kind, sortOrder: { lte: m.sortOrder } } })) || 1;
      await notify(
        ctx,
        { kind: 'artisan', id: m.job.artisanId },
        (l) => [{ kind: 'text', text: t(l, 'job.retake', { n, problem: t(l, img.quality.problem === 'dark' ? 'job.problem.dark' : 'job.problem.blurry') }) }],
        { purpose: 'photo_retake', relatedEntity: 'job_media', relatedId: m.id, ref: m.job.ref },
      );
    }
    return;
  }

  if (m.kind === 'video') {
    const publicKey = `jobs/${m.jobId}/${m.id}.${ext(mime)}`;
    await storage.put('public', publicKey, original, { contentType: mime, cacheControl: 'public, max-age=31536000, immutable' });
    await ctx.prisma.jobMedia.update({ where: { id: m.id }, data: { publicKey, status: 'done' } });
    return;
  }

  // Voice notes stay private (they may contain the client's name); transcription happens in the AI task.
  await ctx.prisma.jobMedia.update({ where: { id: m.id }, data: { status: 'done', public: false, durationSec: m.durationSec ?? wavDurationSec(original) } });
}

async function processProfilePhoto(ctx: ServiceContext, artisanId: string) {
  const raw = await ctx.kv.get(`profile-photo:${artisanId}`);
  if (!raw) return;
  const ref = JSON.parse(raw) as { providerMediaId: string };
  const { data } = await ctx.adapters.channel.downloadMedia(ref.providerMediaId);
  const img = await processImage(data);
  const key = `profiles/${artisanId}.jpg`;
  await ctx.adapters.storage.put('public', key, img.thumbJpeg, { contentType: 'image/jpeg' });
  await ctx.prisma.artisan.update({ where: { id: artisanId }, data: { profilePhotoKey: key } });
  await ctx.kv.del(`profile-photo:${artisanId}`);
}
