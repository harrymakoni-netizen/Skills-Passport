import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Application-level PII encryption (CLAUDE.md): AES-256-GCM.
 * Layout: [1 byte key version][12 byte IV][ciphertext][16 byte tag]. The version byte allows key rotation later.
 */
const KEY_VERSION = 1;

export interface PiiCrypto {
  encrypt(plain: string): Uint8Array<ArrayBuffer>;
  decrypt(blob: Uint8Array): string;
  /** HMAC-SHA256(phone, PHONE_HASH_PEPPER), hex. Used for every phone lookup. */
  phoneHash(e164: string): string;
  /** HMAC for other lookups (e.g. lower-cased email). */
  lookupHash(value: string): string;
  /** Stable pseudonym for analytics events. */
  pseudonym(id: string): string;
}

export function createPiiCrypto(opts: { key: string; pepper: string }): PiiCrypto {
  const key = Buffer.from(opts.key, 'base64');
  if (key.length !== 32) throw new Error('PII_ENCRYPTION_KEY must decode to 32 bytes');
  if (opts.pepper.length < 32) throw new Error('PHONE_HASH_PEPPER must be at least 32 characters');
  const hmac = (label: string, v: string) => createHmac('sha256', opts.pepper).update(`${label}:${v}`).digest('hex');
  return {
    encrypt(plain) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
      return new Uint8Array(Buffer.concat([Buffer.from([KEY_VERSION]), iv, ct, cipher.getAuthTag()]));
    },
    decrypt(blob) {
      const buf = Buffer.from(blob);
      if (buf.length < 1 + 12 + 16) throw new Error('Ciphertext too short');
      if (buf[0] !== KEY_VERSION) throw new Error(`Unknown key version ${buf[0]}`);
      const iv = buf.subarray(1, 13);
      const tag = buf.subarray(buf.length - 16);
      const ct = buf.subarray(13, buf.length - 16);
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
    },
    phoneHash: (e164) => hmac('phone', e164),
    lookupHash: (value) => hmac('lookup', value.trim().toLowerCase()),
    pseudonym: (id) => hmac('pseudonym', id).slice(0, 24),
  };
}

/** Random 128-bit token, base64url (22 chars). Only its hash is stored. */
export function newToken(): string {
  return randomBytes(16).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Generates a fresh base64 32-byte key, for `.env` setup scripts. */
export function generateKey(): string {
  return randomBytes(32).toString('base64');
}
