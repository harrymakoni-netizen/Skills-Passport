import { createHmac } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPiiCrypto, generateKey, hashToken, newToken, safeEqual } from '../src/crypto';
import { ControllableClock } from '../src/clock';
import { FsStorage } from '../src/storage';
import { MemoryMockStore, MockChannel, UndeliverableError } from '../src/messaging/mock';
import { renderWhatsApp, templateNameAndLocale, WhatsAppCloudChannel } from '../src/messaging/whatsapp';
import { MockLlmProvider, MockSpeechToText } from '../src/ai';
import { normalisePhone } from '../src';

const crypto = createPiiCrypto({ key: generateKey(), pepper: 'p'.repeat(40) });

describe('PII crypto (AES-256-GCM)', () => {
  it('round-trips and uses a fresh IV', () => {
    const a = crypto.encrypt('Tendai Moyo');
    const b = crypto.encrypt('Tendai Moyo');
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
    expect(crypto.decrypt(a)).toBe('Tendai Moyo');
    expect(a[0]).toBe(1);
  });
  it('detects tampering', () => {
    const a = crypto.encrypt('+263770001234');
    a[20] = a[20]! ^ 0xff;
    expect(() => crypto.decrypt(a)).toThrow();
  });
  it('rejects short or unknown-version blobs', () => {
    expect(() => crypto.decrypt(Buffer.alloc(5))).toThrow(/too short/);
    const a = crypto.encrypt('x');
    a[0] = 9;
    expect(() => crypto.decrypt(a)).toThrow(/version/);
  });
  it('fails with the wrong key', () => {
    const other = createPiiCrypto({ key: generateKey(), pepper: 'p'.repeat(40) });
    expect(() => other.decrypt(crypto.encrypt('secret'))).toThrow();
  });
  it('validates configuration', () => {
    expect(() => createPiiCrypto({ key: 'short', pepper: 'p'.repeat(40) })).toThrow(/32 bytes/);
    expect(() => createPiiCrypto({ key: generateKey(), pepper: 'short' })).toThrow(/PEPPER/);
  });
  it('phone hash is HMAC-SHA256, deterministic and pepper-dependent', () => {
    const h = crypto.phoneHash('+263770001234');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(crypto.phoneHash('+263770001234'));
    expect(h).toBe(createHmac('sha256', 'p'.repeat(40)).update('phone:+263770001234').digest('hex'));
    const other = createPiiCrypto({ key: generateKey(), pepper: 'q'.repeat(40) });
    expect(other.phoneHash('+263770001234')).not.toBe(h);
    expect(crypto.lookupHash(' A@B.co ')).toBe(crypto.lookupHash('a@b.co'));
    expect(crypto.pseudonym('x')).toHaveLength(24);
  });
  it('tokens are 128-bit and only their hash is comparable', () => {
    const t = newToken();
    expect(Buffer.from(t, 'base64url')).toHaveLength(16);
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(newToken()).not.toBe(t);
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'ab')).toBe(false);
  });
  it('re-exports phone normalisation for Zimbabwe numbers', () => {
    expect(normalisePhone('077 000 1234')).toBe('+263770001234');
  });
});

describe('clock', () => {
  it('is controllable', () => {
    const c = new ControllableClock(new Date('2026-01-01T00:00:00Z'));
    c.advance(1000);
    expect(c.now().toISOString()).toBe('2026-01-01T00:00:01.000Z');
    c.set(new Date('2027-01-01T00:00:00Z'));
    expect(c.now().getUTCFullYear()).toBe(2027);
  });
});

describe('fs storage and mock channel', () => {
  const root = mkdtempSync(join(tmpdir(), 'sp-'));
  const storage = new FsStorage(root, 'http://localhost:3000/media', () => 'sig');
  it('stores and signs', async () => {
    await storage.put('private', 'a/b.txt', Buffer.from('hi'));
    expect((await storage.get('private', 'a/b.txt')).toString()).toBe('hi');
    expect(await storage.exists('private', 'a/b.txt')).toBe(true);
    await storage.delete('private', 'a/b.txt');
    expect(await storage.exists('private', 'a/b.txt')).toBe(false);
    expect(storage.publicUrl('x.jpg')).toBe('http://localhost:3000/media/x.jpg');
    expect(await storage.signedGetUrl('private', 'x.jpg', 60)).toMatch(/\/media\/signed\/private\/x\.jpg\?e=\d+&s=sig$/);
    await expect(storage.put('private', '../../etc/passwd', Buffer.from(''))).rejects.toThrow(/Unsafe/);
  });
  it('mock channel records messages and serves uploaded media', async () => {
    const store = new MemoryMockStore();
    const ch = new MockChannel(store, storage);
    const { providerMessageId } = await ch.send('+263770001234', { kind: 'text', text: 'Hello' });
    expect(providerMessageId).toMatch(/^mock-out-/);
    expect((await store.list('+263770001234'))[0]?.message).toEqual({ kind: 'text', text: 'Hello' });
    const id = await ch.uploadSimulatorMedia(Buffer.from('jpegdata'), 'image/jpeg');
    expect(await ch.downloadMedia(id)).toEqual({ data: Buffer.from('jpegdata'), mimeType: 'image/jpeg' });
    await store.setUnreachable('+263770009999', true);
    await expect(ch.send('+263770009999', { kind: 'text', text: 'x' })).rejects.toBeInstanceOf(UndeliverableError);
    const parsed = ch.parseWebhook({ headers: {}, body: Buffer.from(JSON.stringify({ messages: [{ providerMessageId: 'm1', from: '+263770001234', content: { kind: 'text', text: 'hi' } }] })) });
    expect(parsed.messages[0]).toMatchObject({ channel: 'mock', providerMessageId: 'm1' });
  });
});

describe('WhatsApp Cloud API adapter', () => {
  const secret = 'app-secret';
  const ch = new WhatsAppCloudChannel({ graphUrl: 'https://graph.test/v21.0', phoneNumberId: '123', accessToken: 'tok', appSecret: secret, mediaUrl: (k) => `https://cdn.test/${k}` });

  it('verifies X-Hub-Signature-256', () => {
    const body = Buffer.from('{"entry":[]}');
    const sig = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    expect(ch.verifySignature({ headers: { 'x-hub-signature-256': sig }, body })).toBe(true);
    expect(ch.verifySignature({ headers: { 'x-hub-signature-256': 'sha256=bad' }, body })).toBe(false);
    expect(ch.verifySignature({ headers: {}, body })).toBe(false);
  });

  it('renders buttons, lists, media and templates', () => {
    expect(renderWhatsApp('+263770001234', { kind: 'buttons', body: 'b', buttons: [{ id: 'a', title: 'A' }] }, (k) => k)).toMatchObject({
      to: '263770001234',
      type: 'interactive',
      interactive: { type: 'button', action: { buttons: [{ type: 'reply', reply: { id: 'a', title: 'A' } }] } },
    });
    expect(renderWhatsApp('+1', { kind: 'list', body: 'b', buttonLabel: 'Menu', sections: [{ rows: [{ id: 'r', title: 'R', description: 'd' }] }] }, (k) => k)).toMatchObject({
      interactive: { type: 'list', action: { button: 'Menu', sections: [{ rows: [{ id: 'r', title: 'R', description: 'd' }] }] } },
    });
    expect(renderWhatsApp('+1', { kind: 'media', mediaType: 'image', source: { key: 'q.png' }, caption: 'c' }, (k) => `https://cdn/${k}`)).toMatchObject({ type: 'image', image: { link: 'https://cdn/q.png', caption: 'c' } });
    expect(renderWhatsApp('+1', { kind: 'media', mediaType: 'audio', source: { url: 'https://x/a.ogg' }, caption: 'ignored' }, (k) => k)).toEqual({
      messaging_product: 'whatsapp', recipient_type: 'individual', to: '1', type: 'audio', audio: { link: 'https://x/a.ogg' },
    });
    const tpl = renderWhatsApp('+1', { kind: 'template', template: 'sp_client_job_confirmation_v1', lang: 'sn', params: ['Tendai', 'x', '12 Nov', 'https://l'], buttons: [{ id: 'cc_yes:1', title: 'Yes' }, { id: 'cc_no:1', title: 'No' }], preview: '' }, (k) => k);
    expect(tpl).toMatchObject({
      type: 'template',
      template: {
        name: 'sp_client_job_confirmation_v1_sn',
        language: { code: 'en' },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: 'Tendai' }, {}, {}, {}] },
          { type: 'button', sub_type: 'quick_reply', index: '0', parameters: [{ type: 'payload', payload: 'cc_yes:1' }] },
          { type: 'button', index: '1' },
        ],
      },
    });
    expect(templateNameAndLocale('x', 'en')).toEqual({ name: 'x', code: 'en' });
  });

  it('parses inbound messages and delivery statuses', () => {
    const body = {
      entry: [{ changes: [{ value: {
        messages: [
          { id: 'w1', from: '263770001234', timestamp: '1760000000', type: 'text', text: { body: 'Hi' } },
          { id: 'w2', from: '263770001234', timestamp: '1760000000', type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'menu:log', title: 'Log a job' } } },
          { id: 'w3', from: '263770001234', timestamp: '1760000000', type: 'button', button: { payload: 'cc_yes:abc', text: 'Yes, it was done' } },
          { id: 'w4', from: '263770001234', timestamp: '1760000000', type: 'audio', audio: { id: 'media1', mime_type: 'audio/ogg; codecs=opus', voice: true } },
          { id: 'w5', from: '263770001234', timestamp: '1760000000', type: 'contacts', contacts: [{ phones: [{ phone: '+263 77 000 0123' }], name: { formatted_name: 'Mrs Dube' } }] },
          { id: 'w6', from: '263770001234', timestamp: '1760000000', type: 'location', location: { latitude: -17.8, longitude: 31 } },
          { id: 'w7', from: '263770001234', timestamp: '1760000000', type: 'sticker' },
        ],
        statuses: [
          { id: 's1', status: 'delivered', timestamp: '1760000000' },
          { id: 's2', status: 'failed', timestamp: '1760000000', errors: [{ code: 131026, title: 'Message undeliverable' }] },
        ],
      } }] }],
    };
    const r = ch.parseWebhook({ headers: {}, body: Buffer.from(JSON.stringify(body)) });
    expect(r.messages.map((m) => m.content.kind)).toEqual(['text', 'choice', 'choice', 'media', 'contact', 'location', 'unsupported']);
    expect(r.messages[0]!.from).toBe('+263770001234');
    expect(r.messages[2]!.content).toEqual({ kind: 'choice', id: 'cc_yes:abc', title: 'Yes, it was done' });
    expect(r.deliveries.map((d) => d.status)).toEqual(['delivered', 'undeliverable']);
  });

  it('sends with bearer auth and surfaces errors', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const ok = new WhatsAppCloudChannel({
      graphUrl: 'https://graph.test', phoneNumberId: '123', accessToken: 'tok', appSecret: secret, mediaUrl: (k) => k,
      fetchImpl: (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ messages: [{ id: 'wamid.1' }] }), { status: 200 });
      }) as typeof fetch,
    });
    expect(await ok.send('+263770001234', { kind: 'text', text: 'x' })).toEqual({ providerMessageId: 'wamid.1' });
    expect(calls[0]!.url).toBe('https://graph.test/123/messages');
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    const bad = new WhatsAppCloudChannel({
      graphUrl: 'https://graph.test', phoneNumberId: '123', accessToken: 'tok', appSecret: secret, mediaUrl: (k) => k,
      fetchImpl: (async () => new Response(JSON.stringify({ error: { code: 131026, message: 'undeliverable' } }), { status: 400 })) as unknown as typeof fetch,
    });
    await expect(bad.send('+1', { kind: 'text', text: 'x' })).rejects.toThrow(/undeliverable/);
  });
});

describe('mock AI', () => {
  it('returns trade fixtures restricted to allowed units', async () => {
    const llm = new MockLlmProvider();
    const r = await llm.generateJson({ promptId: 'job_structuring', promptVersion: 'v1', system: '', user: '', jsonSchema: {}, fixtureKey: 'solar_battery_inverter_install', allowedUnits: ['SOL-04', 'SOL-05'] });
    expect((r.json as { suggested_units: { code: string }[] }).suggested_units.map((u) => u.code)).toEqual(['SOL-04', 'SOL-05']);
    const stt = new MockSpeechToText();
    expect((await stt.transcribe({ audio: Buffer.alloc(0), mimeType: 'audio/ogg', fixtureKey: 'wld_gate' })).text).toContain('gate');
    expect((await stt.transcribe({ audio: Buffer.alloc(0), mimeType: 'audio/ogg' })).text).toContain('client');
  });
});

describe('HybridChannel (MESSAGING_DRIVER=hybrid)', async () => {
  const { HybridChannel } = await import('../src/messaging/hybrid');
  const { templateSubmissions } = await import('@sp/core');
  const storage = new FsStorage(mkdtempSync(join(tmpdir(), 'sp-hybrid-')), 'https://cdn.test/media', () => 'sig');
  const store = new MemoryMockStore();
  const mock = new MockChannel(store, storage);
  const sent: string[] = [];
  const wa = new WhatsAppCloudChannel({
    graphUrl: 'https://graph.test', phoneNumberId: '123', accessToken: 'tok', appSecret: 's', businessAccountId: 'waba1', mediaUrl: (k) => k,
    fetchImpl: (async (url: string, init?: RequestInit) => {
      sent.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.includes('/message_templates') && init?.method === 'POST') return new Response(JSON.stringify({ id: 't1', status: 'PENDING' }), { status: 200 });
      if (url.includes('/message_templates')) return new Response(JSON.stringify({ data: [{ name: 'sp_x', language: 'en', status: 'APPROVED' }] }), { status: 200 });
      if (url.includes('/media-')) return new Response(JSON.stringify({ url: 'https://lookaside.test/f', mime_type: 'image/jpeg' }), { status: 200 });
      if (url.startsWith('https://lookaside.test')) return new Response(new Uint8Array([1, 2]), { status: 200 });
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.9' }] }), { status: 200 });
    }) as typeof fetch,
  });
  const ch = new HybridChannel(wa, mock);

  it('sends fictional demo phones to the simulator and real numbers to WhatsApp', async () => {
    const demo = await ch.send('+263770000201', { kind: 'text', text: 'hi' });
    expect(demo.providerMessageId).toMatch(/^mock-out-/);
    expect((await store.list('+263770000201'))[0]!.message).toEqual({ kind: 'text', text: 'hi' });
    const real = await ch.send('+263771234567', { kind: 'text', text: 'hi' });
    expect(real.providerMessageId).toBe('wamid.9');
    expect(sent).toContain('POST https://graph.test/123/messages');
    expect(await store.list('+263771234567')).toEqual([]);
  });

  it('downloads simulator media from storage and WhatsApp media from Meta', async () => {
    const id = await mock.uploadSimulatorMedia(Buffer.from('img'), 'image/png');
    expect((await ch.downloadMedia(id)).mimeType).toBe('image/png');
    expect((await ch.downloadMedia('media-123')).mimeType).toBe('image/jpeg');
  });

  it('reports as WhatsApp and uses WhatsApp webhook signatures', () => {
    expect(ch.id).toBe('whatsapp');
    expect(ch.verifySignature({ headers: {}, body: Buffer.from('{}') })).toBe(false);
  });

  it('lists and submits templates on the business account', async () => {
    expect(await wa.listTemplates()).toEqual([{ name: 'sp_x', language: 'en', status: 'APPROVED' }]);
    const first = templateSubmissions()[0]!;
    expect(await wa.createTemplate(first)).toEqual({ id: 't1', status: 'PENDING' });
    expect(sent).toContain('POST https://graph.test/waba1/message_templates');
  });
});
