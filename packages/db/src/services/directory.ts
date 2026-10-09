import type { Level, Prisma } from '@prisma/client';
import type { ServiceContext } from './context';
import { tradeName } from './reference';

const LEVEL_ORDER: Level[] = ['gold', 'silver', 'bronze', 'starter'];

/**
 * SPEC 4.7 buyer directory: filter by trade, area, level and minimum rating; sorted by level, then rating, then
 * recent activity. Only public, active passports; never phone numbers.
 */
export async function searchDirectory(ctx: ServiceContext, q: { trade?: string; area?: string; level?: Level; minRating?: number; page?: number; pageSize?: number }) {
  const pageSize = Math.min(q.pageSize ?? 12, 24);
  const page = Math.max(1, q.page ?? 1);
  const where: Prisma.ArtisanWhereInput = {
    status: 'active',
    ...(q.trade ? { trades: { some: { trade: { code: q.trade } } } } : {}),
    ...(q.area ? { areaId: q.area } : {}),
    ...(q.level ? { level: { in: LEVEL_ORDER.slice(0, LEVEL_ORDER.indexOf(q.level) + 1) } } : {}),
  };
  const rows = await ctx.prisma.artisan.findMany({
    where,
    include: {
      area: true,
      trades: { include: { trade: true }, orderBy: { primary: 'desc' } },
      jobs: { where: { counted: true }, select: { id: true, statusChangedAt: true, clientId: true, confirmation: { select: { rating: true } } } },
      endorsements: { where: { withdrawnAt: null }, select: { id: true } },
    },
    take: 1000,
  });
  const items = rows
    .map((a) => {
      const ratings = a.jobs.map((j) => j.confirmation?.rating).filter((r): r is number => typeof r === 'number');
      const avg = ratings.length ? Math.round((ratings.reduce((x, y) => x + y, 0) / ratings.length) * 10) / 10 : null;
      return {
        code: a.passportCode,
        displayName: a.displayName,
        level: a.level,
        trades: a.trades.map((t) => ({ code: t.trade.code, name: tradeName(t.trade) })),
        area: a.area.name,
        city: a.area.city,
        countedJobs: a.jobs.length,
        clients: new Set(a.jobs.map((j) => j.clientId)).size,
        averageRating: avg,
        endorsements: a.endorsements.length,
        badges: a.publicBadges,
        lastActive: a.jobs.reduce((m, j) => Math.max(m, j.statusChangedAt.getTime()), a.joinedAt.getTime()),
      };
    })
    .filter((a) => (q.minRating ? (a.averageRating ?? 0) >= q.minRating : true))
    .sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || (b.averageRating ?? 0) - (a.averageRating ?? 0) || b.lastActive - a.lastActive);
  return { total: items.length, page, pageSize, items: items.slice((page - 1) * pageSize, page * pageSize).map(({ lastActive, ...rest }) => ({ ...rest, lastActive: new Date(lastActive).toISOString() })) };
}
