import type { ServiceContext } from './context';

export async function requestFieldAgent(ctx: ServiceContext, artisanId: string) {
  await ctx.prisma.agentTask.create({ data: { kind: 'artisan_help', artisanId, note: 'Artisan asked to talk to a field agent.', createdAt: ctx.now() } });
}

export async function listRecentClients(ctx: ServiceContext, artisanId: string) {
  const jobs = await ctx.prisma.job.findMany({
    where: { artisanId, clientId: { not: null }, status: { not: 'draft' } },
    orderBy: { createdAt: 'desc' },
    select: { clientId: true, clientNameEnc: true },
    take: 30,
  });
  const seen = new Set<string>();
  const out: { id: string; name: string }[] = [];
  for (const j of jobs) {
    if (!j.clientId || seen.has(j.clientId)) continue;
    seen.add(j.clientId);
    out.push({ id: j.clientId, name: j.clientNameEnc ? ctx.adapters.crypto.decrypt(j.clientNameEnc) : '—' });
  }
  return out.slice(0, 10);
}

/** SPEC 14: report and block. A client reported by N distinct artisans is blocked (PLAN Q14). */
export async function reportClient(ctx: ServiceContext, input: { artisanId: string; clientId: string; reason: string; details?: string }) {
  const { params: config } = await ctx.config();
  await ctx.prisma.clientReport.create({ data: { artisanId: input.artisanId, clientId: input.clientId, reason: input.reason, details: input.details ?? null, createdAt: ctx.now() } });
  const reporters = await ctx.prisma.clientReport.findMany({ where: { clientId: input.clientId, status: { in: ['open', 'upheld'] } }, distinct: ['artisanId'], select: { artisanId: true } });
  await ctx.prisma.client.update({
    where: { id: input.clientId },
    data: { reportsCount: reporters.length, blocked: reporters.length >= config.clients.blockAtReports ? true : undefined },
  });
  // The reporting artisan no longer receives work requests from this client (if they are also a buyer).
  await ctx.prisma.auditLog.create({ data: { action: 'client.reported', entity: 'client', entityId: input.clientId, details: { reason: input.reason }, at: ctx.now() } });
}
