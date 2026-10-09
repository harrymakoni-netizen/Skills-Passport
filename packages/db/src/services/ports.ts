import type { FlowPorts, Lang } from '@sp/core';
import type { ServiceContext } from './context';
import * as artisans from './artisans';
import * as jobs from './jobs';
import * as conf from './confirmations';
import * as ai from './ai';
import * as passport from './passport';
import * as ref from './reference';
import * as safety from './safety';
import * as wr from './workRequests';
import * as agent from './agent';
import { localized } from './reference';

/** FlowPorts implemented against Postgres, Redis and the queue — what the WhatsApp conversation uses. */
export function createFlowPorts(ctx: ServiceContext, rules: { config: Awaited<ReturnType<ServiceContext['config']>>['params'] }): FlowPorts {
  return {
    now: () => ctx.now(),
    config: () => rules.config,
    publicBaseUrl: () => ctx.publicBaseUrl,
    consentAudioKey: (lang: Lang) => `static/consent-${lang}.wav`,
    listTrades: () => ref.listTrades(ctx),
    listCities: () => ref.listCities(ctx),
    listAreas: (cityCode) => ref.listAreas(ctx, cityCode),
    listJobTypes: (tradeId) => ref.listJobTypes(ctx, tradeId),
    findArtisanByPhone: (phone) => artisans.findArtisanByPhone(ctx, phone),
    createArtisan: (input) => artisans.createArtisan(ctx, input),
    updateArtisan: (id, patch) => artisans.updateArtisan(ctx, id, patch),
    deleteArtisan: (id) => artisans.deleteArtisan(ctx, id),
    createDraftJob: async (input) => ({ jobId: (await jobs.createDraftJob(ctx, input)).jobId }),
    attachMedia: async (input) => void (await jobs.attachMedia(ctx, input)),
    checkClientPhone: (input) => jobs.checkClientPhone(ctx, input),
    submitJob: (jobId, input) => jobs.submitJob(ctx, jobId, input),
    discardDraftJob: (jobId) => jobs.discardDraftJob(ctx, jobId),
    getPassportStatus: (artisanId) => passport.getPassportStatus(ctx, artisanId),
    listWaitingJobs: async (artisanId) => {
      const rows = await ctx.prisma.job.findMany({ where: { artisanId, status: 'awaiting_client' }, include: { jobType: true, confirmation: true }, orderBy: { submittedAt: 'desc' } });
      return rows.map((j) => ({
        jobId: j.id,
        ref: j.ref,
        jobType: localized(j.jobType.name),
        clientName: j.clientNameEnc ? ctx.adapters.crypto.decrypt(j.clientNameEnc) : '—',
        sentAt: j.confirmation?.sentAt ?? null,
        remindersSent: j.confirmation?.remindersSent ?? 0,
      }));
    },
    remindClient: (jobId) => conf.remindByJob(ctx, jobId),
    changeClientPhone: (jobId, phone) => conf.changeClientPhone(ctx, jobId, phone),
    confirmSummary: (jobId) => ai.confirmSummary(ctx, jobId),
    correctSummary: (jobId, c) => ai.correctSummary(ctx, jobId, c),
    clientRespond: (input) => conf.clientRespond(ctx, input),
    confirmOwnership: (input) => agent.confirmOwnership(ctx, input),
    getShareAssets: async (artisanId) => {
      const a = await ctx.prisma.artisan.findUniqueOrThrow({ where: { id: artisanId }, include: { trades: { include: { trade: true }, orderBy: { primary: 'desc' } } } });
      const base = `${ctx.publicBaseUrl}/p/${a.passportCode}`;
      return { link: base, qrUrl: `${base}/qr.png`, cardUrl: `${base}/card.png?lang=${a.language}&v=${a.level}`, tradeName: ref.tradeName(a.trades[0]!.trade) };
    },
    listOpenWorkRequests: (artisanId) => wr.listOpenWorkRequests(ctx, artisanId),
    respondWorkRequest: (input) => wr.respondWorkRequest(ctx, input),
    recordHireOutcome: (input) => wr.recordHireOutcome(ctx, input),
    logHireAsJob: (input) => wr.logHireAsJob(ctx, input),
    requestFieldAgent: (artisanId) => safety.requestFieldAgent(ctx, artisanId),
    listRecentClients: (artisanId) => safety.listRecentClients(ctx, artisanId),
    reportClient: (input) => safety.reportClient(ctx, input),
  };
}
