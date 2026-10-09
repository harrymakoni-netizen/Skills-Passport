import { formatPassportCode, publicDisplayName, type ArtisanView, type Lang, type NewArtisanInput } from '@sp/core';
import type { Prisma } from '@prisma/client';
import type { ServiceContext } from './context';
import { tradeName } from './reference';

const include = { pii: true, area: true, trades: { include: { trade: true }, orderBy: { primary: 'desc' } } } satisfies Prisma.ArtisanInclude;
type ArtisanRow = Prisma.ArtisanGetPayload<{ include: typeof include }>;

export function toView(a: ArtisanRow): ArtisanView {
  return {
    id: a.id,
    firstName: a.firstName,
    displayName: a.displayName,
    passportCode: a.passportCode,
    lang: a.language,
    level: a.level,
    status: a.status,
    showFullName: a.showFullName,
    trades: a.trades.map((t) => ({ id: t.tradeId, name: tradeName(t.trade) })),
    areaId: a.areaId,
    areaName: a.area.name,
    cityCode: a.area.cityCode,
    phoneHash: a.pii?.phoneHash ?? '',
  };
}

export async function findArtisanByPhone(ctx: ServiceContext, phone: string): Promise<ArtisanView | null> {
  const pii = await ctx.prisma.artisanPii.findUnique({ where: { phoneHash: ctx.adapters.crypto.phoneHash(phone) }, select: { artisanId: true } });
  if (!pii) return null;
  const a = await ctx.prisma.artisan.findUnique({ where: { id: pii.artisanId }, include });
  return a && a.status !== 'deleted' ? toView(a) : null;
}

export async function getArtisanView(ctx: ServiceContext, id: string): Promise<ArtisanView | null> {
  const a = await ctx.prisma.artisan.findUnique({ where: { id }, include });
  return a ? toView(a) : null;
}

/** Next passport number for a city, atomically. */
async function nextPassportCode(tx: Prisma.TransactionClient, cityCode: string): Promise<string> {
  const row = await tx.passportSequence.upsert({
    where: { cityCode },
    create: { cityCode, next: 2 },
    update: { next: { increment: 1 } },
  });
  return formatPassportCode(cityCode, row.next - 1);
}

/** SPEC 4.1 step 8: create the passport at level Starter, with consent records and encrypted PII. */
export async function createArtisan(ctx: ServiceContext, input: NewArtisanInput & { enrolledByAgentId?: string; channel?: 'whatsapp' | 'agent' }): Promise<ArtisanView> {
  const { crypto } = ctx.adapters;
  const phoneHash = crypto.phoneHash(input.phone);
  const existing = await ctx.prisma.artisanPii.findUnique({ where: { phoneHash } });
  if (existing) {
    const a = await ctx.prisma.artisan.findUnique({ where: { id: existing.artisanId }, include });
    if (a && a.status !== 'deleted') return toView(a);
    if (a) await ctx.prisma.artisanPii.delete({ where: { artisanId: a.id } });
  }
  const area = await ctx.prisma.area.findUniqueOrThrow({ where: { id: input.areaId } });
  const now = ctx.now();
  const firstName = input.fullName.split(/\s+/)[0]!;
  const id = await ctx.prisma.$transaction(async (tx) => {
    const passportCode = await nextPassportCode(tx, area.cityCode);
    const a = await tx.artisan.create({
      data: {
        passportCode,
        firstName,
        displayName: publicDisplayName(input.fullName, false),
        areaId: area.id,
        areaPending: input.areaPending,
        language: input.lang,
        birthYear: input.birthYear,
        experienceYears: input.experienceYears,
        howLearned: input.howLearned,
        gender: input.demographicsConsent ? input.gender : null,
        disability: input.demographicsConsent ? input.disability : null,
        publicBadges: input.publicBadges,
        status: 'active',
        joinedAt: now,
        enrolledByAgentId: input.enrolledByAgentId ?? null,
        pseudonym: crypto.pseudonym(`${passportCode}:${now.getTime()}`),
        pii: { create: { fullNameEnc: crypto.encrypt(input.fullName), phoneEnc: crypto.encrypt(input.phone), phoneHash } },
        trades: { create: input.tradeIds.slice(0, 2).map((tradeId, i) => ({ tradeId, primary: i === 0 })) },
      },
    });
    const channel = input.channel ?? 'whatsapp';
    await tx.consent.create({ data: { artisanId: a.id, kind: 'core', textVersion: input.consentTextVersion, language: input.lang, channel, grantedAt: now, details: { residency: 'zimbabwe' } } });
    if (input.demographicsConsent) {
      await tx.consent.create({ data: { artisanId: a.id, kind: 'sensitive_demographics', textVersion: input.consentTextVersion, language: input.lang, channel, grantedAt: now } });
    }
    if (input.publicBadges.length) {
      await tx.consent.create({ data: { artisanId: a.id, kind: 'public_badge', textVersion: input.consentTextVersion, language: input.lang, channel, grantedAt: now, details: { badges: input.publicBadges } } });
    }
    if (input.areaPending) {
      await tx.agentTask.create({ data: { kind: 'area_not_listed', artisanId: a.id, note: 'Artisan’s area is not in the list. Confirm and add it.' } });
    }
    return a.id;
  });
  if (input.profilePhoto) {
    await ctx.kv.set(`profile-photo:${id}`, JSON.stringify(input.profilePhoto), 3600);
    await ctx.queue.enqueue('media.process', { mediaId: `profile:${id}` });
  }
  await event(ctx, 'artisan_joined', id, { channel: input.channel ?? 'whatsapp' });
  return (await getArtisanView(ctx, id))!;
}

export async function updateArtisan(ctx: ServiceContext, id: string, patch: { lang?: Lang; showFullName?: boolean }) {
  const data: Prisma.ArtisanUpdateInput = {};
  if (patch.lang) data.language = patch.lang;
  if (patch.showFullName !== undefined) {
    const pii = await ctx.prisma.artisanPii.findUniqueOrThrow({ where: { artisanId: id } });
    data.showFullName = patch.showFullName;
    data.displayName = publicDisplayName(ctx.adapters.crypto.decrypt(pii.fullNameEnc), patch.showFullName);
  }
  await ctx.prisma.artisan.update({ where: { id }, data });
}

/** SPEC 14: public page offline immediately; personal data deleted after 30 days by the purge task. */
export async function deleteArtisan(ctx: ServiceContext, id: string) {
  const purgeAfter = new Date(ctx.now().getTime() + 30 * 86400000);
  await ctx.prisma.artisan.update({ where: { id }, data: { status: 'deleted', deletedAt: ctx.now(), purgeAfter } });
  await ctx.prisma.auditLog.create({ data: { action: 'artisan.delete_requested', entity: 'artisan', entityId: id, at: ctx.now() } });
}

/** Deletes personal data for accounts past their purge date; keeps anonymised job statistics. */
export async function purgeDeleted(ctx: ServiceContext) {
  const due = await ctx.prisma.artisan.findMany({ where: { status: 'deleted', purgeAfter: { lte: ctx.now() } }, select: { id: true } });
  for (const { id } of due) {
    const media = await ctx.prisma.jobMedia.findMany({ where: { job: { artisanId: id } } });
    for (const m of media) {
      for (const [bucket, key] of [['private', m.originalKey], ['public', m.publicKey], ['public', m.thumbKey]] as const) {
        if (key) await ctx.adapters.storage.delete(bucket, key).catch(() => undefined);
      }
    }
    await ctx.prisma.$transaction([
      ctx.prisma.artisanPii.deleteMany({ where: { artisanId: id } }),
      ctx.prisma.jobMedia.deleteMany({ where: { job: { artisanId: id } } }),
      ctx.prisma.job.updateMany({ where: { artisanId: id }, data: { clientNameEnc: null, notes: [], lat: null, lng: null, aiSummary: undefined, artisanSummary: undefined } }),
      ctx.prisma.artisan.update({ where: { id }, data: { firstName: 'Deleted', displayName: 'Deleted', birthYear: null, gender: null, disability: null, profilePhotoKey: null, purgeAfter: null } }),
    ]);
    await ctx.prisma.auditLog.create({ data: { action: 'artisan.purged', entity: 'artisan', entityId: id, at: ctx.now() } });
  }
  return due.length;
}

/** Product analytics event with a pseudonymous subject id only (SPEC 16). */
export async function event(ctx: ServiceContext, name: string, entityId: string, props?: Record<string, unknown>) {
  await ctx.prisma.productEvent.create({ data: { name, subjectId: ctx.adapters.crypto.pseudonym(entityId), props: (props ?? undefined) as Prisma.InputJsonValue | undefined, at: ctx.now() } });
}
