import type { Lang } from '@sp/core';
import type { ServiceContext } from './context';

export type Localized = Record<Lang, string>;

export function tradeName(t: { nameEn: string; nameSn: string; nameNd: string }): Localized {
  return { en: t.nameEn, sn: t.nameSn, nd: t.nameNd };
}

export function localized(json: unknown, fallback = ''): Localized {
  const o = (json ?? {}) as Partial<Localized>;
  const en = o.en ?? fallback;
  return { en, sn: o.sn || en, nd: o.nd || en };
}

export async function listTrades(ctx: ServiceContext) {
  const rows = await ctx.prisma.trade.findMany({ where: { active: true }, orderBy: { code: 'asc' } });
  return rows.map((t) => ({ id: t.id, code: t.code, name: tradeName(t) }));
}

export async function listCities(ctx: ServiceContext) {
  const rows = await ctx.prisma.area.findMany({ where: { active: true }, distinct: ['cityCode'], orderBy: { cityCode: 'desc' }, select: { cityCode: true, city: true } });
  return rows;
}

export async function listAreas(ctx: ServiceContext, cityCode: string) {
  return ctx.prisma.area.findMany({ where: { active: true, cityCode }, orderBy: { name: 'asc' }, select: { id: true, name: true } });
}

export async function listJobTypes(ctx: ServiceContext, tradeId: string) {
  const rows = await ctx.prisma.jobType.findMany({ where: { tradeId, active: true }, orderBy: { sortOrder: 'asc' } });
  return rows.map((j) => ({ id: j.id, key: j.key, name: localized(j.name), needsBeforePhoto: j.needsBeforePhoto }));
}
