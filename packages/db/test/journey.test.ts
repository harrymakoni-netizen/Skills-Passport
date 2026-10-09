import { beforeEach, describe, expect, it } from 'vitest';
import { hashToken } from '@sp/adapters';
import { getConfirmationPage, submitConfirmationPage } from '../src/services/confirmations';
import { getPublicPassport } from '../src/services/passport';
import { body, createHarness, ids, resetDb } from './harness';

const ARTISAN = '+263770000201';
const CLIENT = '+263770000301';

async function onboard(h: ReturnType<typeof createHarness>, phone = ARTISAN, name = 'Nyasha Chirwa') {
  await h.send(phone, 'Hi');
  await h.tap(phone, 'lang:en');
  await h.send(phone, '1999');
  await h.tap(phone, 'res:yes');
  await h.tap(phone, 'consent:yes');
  const trades = await h.send(phone, name);
  expect(ids(trades[0]).length).toBe(5);
  const solar = await h.prisma.trade.findUniqueOrThrow({ where: { code: 'SOL' } });
  await h.tap(phone, `trade:${solar.id}`);
  await h.tap(phone, 'trade:done');
  const areas = await h.tap(phone, 'city:HRE');
  await h.tap(phone, ids(areas[0])[0]!);
  await h.tap(phone, 'exp:3');
  await h.tap(phone, 'learned:apprenticeship');
  await h.tap(phone, 'demo:skip');
  return h.tap(phone, 'photo:skip');
}

async function logJob(h: ReturnType<typeof createHarness>, clientPhone = CLIENT, photo = 'photos/solar-inverter-after.jpg', before = 'photos/solar-inverter-before.jpg') {
  const types = await h.tap(ARTISAN, 'menu:log');
  const jt = await h.prisma.jobType.findUniqueOrThrow({ where: { key: 'solar_battery_inverter_install' } });
  expect(ids(types[0])).toContain(`jt:${jt.id}`);
  await h.tap(ARTISAN, `jt:${jt.id}`);
  await h.media(ARTISAN, before, 'image');
  await h.tap(ARTISAN, 'media:done');
  await h.media(ARTISAN, photo, 'image');
  await h.tap(ARTISAN, 'media:done');
  await h.media(ARTISAN, 'audio/voice-note-solar.wav', 'audio');
  await h.send(ARTISAN, 'Mai Rufaro');
  await h.send(ARTISAN, clientPhone);
  await h.tap(ARTISAN, 'date:today');
  await h.tap(ARTISAN, 'area:same');
  await h.tap(ARTISAN, 'loc:skip');
  await h.tap(ARTISAN, 'amount:skip');
  return h.tap(ARTISAN, 'job:submit');
}

describe('pitch journey: onboarding → job → client confirmation → passport (integration)', () => {
  beforeEach(resetDb);

  it('runs end to end through the webhook pipeline', async () => {
    const h = createHarness();
    const done = await onboard(h);
    expect(body(done[0])).toContain('SP-HRE-00001');
    const artisan = await h.prisma.artisan.findFirstOrThrow({ include: { pii: true, consents: true } });
    expect(artisan.level).toBe('starter');
    // PII is encrypted at rest; lookups use the HMAC.
    expect(Buffer.from(artisan.pii!.phoneEnc).toString('utf8')).not.toContain('263770000201');
    expect(h.ctx.adapters.crypto.decrypt(artisan.pii!.phoneEnc)).toBe(ARTISAN);
    expect(artisan.consents.map((c) => c.kind)).toEqual(['core']);

    const submitted = await logJob(h);
    expect(body(submitted[0])).toMatch(/Job \*J-\w+\* submitted/);

    const job = await h.prisma.job.findFirstOrThrow({ include: { media: true, confirmation: true, competencies: true } });
    expect(job.status).toBe('awaiting_client');
    expect(job.media.filter((m) => m.kind.startsWith('photo')).every((m) => m.publicKey && m.thumbKey && m.phash)).toBe(true);
    expect((job.aiSummary as { model_version: string; prompt_version: string }).prompt_version).toBe('job-structuring/v1');
    expect(job.competencies.every((c) => c.source === 'ai' && c.status === 'suggested')).toBe(true);
    expect(job.confirmation!.tokenHash).toMatch(/^[0-9a-f]{64}$/);

    // Artisan was shown the draft description to check (PLAN Q1).
    const artisanMsgs = await h.outbox(ARTISAN);
    expect(artisanMsgs.some((m) => m.kind === 'buttons' && m.buttons.some((b) => b.id === `sum_ok:${job.id}`))).toBe(true);

    // Client got the utility template with quick replies and a rating link.
    const tpl = (await h.outbox(CLIENT)).find((m) => m.kind === 'template');
    expect(tpl && tpl.kind === 'template' && tpl.template).toBe('sp_client_job_confirmation_v1');
    expect(ids(tpl)).toEqual([`cc_yes:${job.confirmation!.id}`, `cc_no:${job.confirmation!.id}`, `cc_stop:${job.confirmation!.id}`]);
    expect(body(tpl)).toContain('https://sp.test/c/');

    const reply = await h.tap(CLIENT, `cc_yes:${job.confirmation!.id}`);
    expect(body(reply[0])).toContain('The job is confirmed');

    const after = await h.prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.status).toBe('under_review'); // first jobs are always reviewed (SPEC 5)
    expect(after.counted).toBe(true); // …and still count while waiting (PLAN Q25)
    const notes = await h.outbox(ARTISAN);
    expect(notes.map(body).join('\n')).toContain('2 more jobs from new clients to reach Bronze');

    const passport = await getPublicPassport(h.ctx, 'SP-HRE-00001');
    expect(passport!.stats.countedJobs).toBe(1);
    expect(JSON.stringify(passport)).not.toMatch(/2637700002|2637700003|Rufaro|amount/i);

    // Rating page: open → rate once → used.
    const token = new URL(body(reply[0]).match(/https:\/\/\S+/)![0]).pathname.split('/').pop()!;
    expect((await getConfirmationPage(h.ctx, token)).state).toBe('rate');
    expect((await submitConfirmationPage(h.ctx, token, { response: 'confirmed', rating: 5, comment: 'Good work' })).ok).toBe(true);
    expect((await getConfirmationPage(h.ctx, token)).state).toBe('used');
    expect((await submitConfirmationPage(h.ctx, token, { response: 'confirmed', rating: 1 })).ok).toBe(false);
    expect((await getPublicPassport(h.ctx, 'SP-HRE-00001'))!.stats.averageRating).toBe(5);
  });

  it('reaches Bronze after three confirmed jobs from three clients and tells the artisan', async () => {
    const h = createHarness();
    await onboard(h);
    const photos = ['photos/solar-inverter-after.jpg', 'photos/solar-roof-after.jpg', 'photos/weld-gate-after.jpg'];
    const befores = ['photos/solar-inverter-before.jpg', 'photos/solar-roof-before.jpg', 'photos/weld-gate-before.jpg'];
    for (const [i, phone] of ['+263770000301', '+263770000302', '+263770000303'].entries()) {
      await logJob(h, phone, photos[i], befores[i]);
      const conf = await h.prisma.confirmation.findFirstOrThrow({ where: { response: null }, orderBy: { id: 'desc' } });
      await h.tap(phone, `cc_yes:${conf.id}`);
    }
    const a = await h.prisma.artisan.findFirstOrThrow();
    expect(a.level).toBe('bronze');
    expect((await h.outbox(ARTISAN)).map(body).join('\n')).toContain('You are now *Bronze*');
    expect(await h.prisma.levelHistory.count({ where: { toLevel: 'bronze' } })).toBe(1);
  });

  it('blocks the artisan’s own number as client and flags a duplicate photo', async () => {
    const h = createHarness();
    await onboard(h);
    await h.tap(ARTISAN, 'menu:log');
    const jt = await h.prisma.jobType.findUniqueOrThrow({ where: { key: 'solar_panel_mounting' } });
    await h.tap(ARTISAN, `jt:${jt.id}`);
    await h.media(ARTISAN, 'photos/solar-roof-before.jpg', 'image');
    await h.tap(ARTISAN, 'media:done');
    await h.media(ARTISAN, 'photos/solar-roof-after.jpg', 'image');
    await h.media(ARTISAN, 'photos/duplicate-solar-roof-resized.jpg', 'image');
    await h.tap(ARTISAN, 'media:done');
    await h.media(ARTISAN, 'audio/voice-note-short.wav', 'audio');
    await h.send(ARTISAN, 'Mr Banda');
    const own = await h.send(ARTISAN, '0770000201');
    expect(body(own[0])).toContain("can't confirm your own job");
    await h.send(ARTISAN, '0770000304');
    const flags = await h.prisma.fraudFlag.findMany();
    expect(flags.map((f) => f.rule)).toContain('FR04_duplicate_image');
    const dup = await h.prisma.jobMedia.findFirstOrThrow({ where: { duplicateOfId: { not: null } } });
    expect(dup.public).toBe(false);
  });

  it('flags a client who cannot be reached on WhatsApp for field-agent follow-up', async () => {
    const h = createHarness();
    await onboard(h);
    await h.store.setUnreachable(CLIENT, true);
    await logJob(h);
    const conf = await h.prisma.confirmation.findFirstOrThrow();
    expect(conf.deliveryStatus).toBe('undeliverable');
    expect(await h.prisma.agentTask.count({ where: { kind: 'client_followup' } })).toBe(1);
    expect((await h.outbox(ARTISAN)).map(body).join('\n')).toContain('field agent will try to call');
  });

  it('sends reminders at 48 h and 5 days and expires at 7 days', async () => {
    const h = createHarness();
    await onboard(h);
    await logJob(h);
    const conf = await h.prisma.confirmation.findFirstOrThrow();
    const oldHash = conf.tokenHash;
    h.clock.advance(49 * 3600_000);
    await h.queue.drain();
    expect((await h.prisma.confirmation.findFirstOrThrow()).remindersSent).toBe(1);
    expect((await h.outbox(CLIENT)).filter((m) => m.kind === 'template').map((m) => (m.kind === 'template' ? m.template : ''))).toEqual(['sp_client_job_confirmation_v1', 'sp_client_job_reminder_v1']);
    h.clock.advance(3 * 24 * 3600_000);
    await h.queue.drain();
    expect((await h.prisma.confirmation.findFirstOrThrow()).remindersSent).toBe(2);
    h.clock.advance(2 * 24 * 3600_000);
    await h.queue.drain();
    const job = await h.prisma.job.findFirstOrThrow();
    expect(job.status).toBe('client_expired');
    expect(oldHash).not.toBe((await h.prisma.confirmation.findFirstOrThrow()).tokenHash); // reminders rotate tokens
    expect((await getConfirmationPage(h.ctx, 'not-a-real-token-1234')).state).toBe('invalid');
    expect(hashToken('x')).toHaveLength(64);
  });

  it('a disputed job goes to review, never counts, and the client can stop messages', async () => {
    const h = createHarness();
    await onboard(h);
    await logJob(h);
    const conf = await h.prisma.confirmation.findFirstOrThrow();
    const r = await h.tap(CLIENT, `cc_no:${conf.id}`);
    expect(body(r[0])).toContain('We will look into this job');
    const job = await h.prisma.job.findFirstOrThrow();
    expect(job).toMatchObject({ status: 'under_review', disputed: true, counted: false, reviewReason: 'disputed' });
    const stop = await h.tap(CLIENT, `cc_stop:${conf.id}`);
    expect(body(stop[0])).toContain('You will not receive more messages');
    expect((await h.prisma.client.findFirstOrThrow()).optedOut).toBe(true);
  });

  it('resumes an interrupted job after the user goes away', async () => {
    const h = createHarness();
    await onboard(h);
    await h.tap(ARTISAN, 'menu:log');
    const jt = await h.prisma.jobType.findUniqueOrThrow({ where: { key: 'solar_site_assessment' } });
    await h.tap(ARTISAN, `jt:${jt.id}`);
    h.clock.advance(3 * 3600_000);
    const resume = await h.send(ARTISAN, 'Hi');
    expect(body(resume[0])).toContain('Continue where you left off');
    const again = await h.tap(ARTISAN, 'resume:continue');
    expect(body(again[0])).toContain('before');
  });

  it('deduplicates webhook deliveries by provider message id', async () => {
    const h = createHarness();
    const { acceptInbound } = await import('../src/bootstrap');
    const msg = { providerMessageId: 'wamid.same', channel: 'mock' as const, from: ARTISAN, receivedAt: h.clock.now(), content: { kind: 'text' as const, text: 'Hi' } };
    expect(await acceptInbound(h.ctx, [msg])).toBe(1);
    expect(await acceptInbound(h.ctx, [msg])).toBe(0);
  });
});
