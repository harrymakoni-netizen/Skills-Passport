import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve } from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '@sp/config';

export type Bucket = 'private' | 'public';

export interface ObjectStorage {
  put(bucket: Bucket, key: string, data: Buffer, opts?: { contentType?: string; cacheControl?: string }): Promise<void>;
  get(bucket: Bucket, key: string): Promise<Buffer>;
  exists(bucket: Bucket, key: string): Promise<boolean>;
  delete(bucket: Bucket, key: string): Promise<void>;
  /** Short-lived URL for private objects (verifier evidence viewer, agent uploads). */
  signedGetUrl(bucket: Bucket, key: string, ttlSec: number): Promise<string>;
  signedPutUrl(bucket: Bucket, key: string, opts: { contentType: string; ttlSec: number }): Promise<string>;
  /** Public URL for a key in the public bucket (CDN in production). */
  publicUrl(key: string): string;
}

function safeKey(key: string): string {
  if (key.startsWith('/') || key.split(/[/\\]/).includes('..')) throw new Error(`Unsafe storage key ${key}`);
  return normalize(key);
}

/**
 * Local-disk storage behind the same interface. Used when MinIO/Docker is unavailable (STORAGE_DRIVER=fs) and in tests.
 * Signed URLs point at the API's /media routes, which verify an HMAC signature.
 */
export class FsStorage implements ObjectStorage {
  constructor(
    private readonly root: string,
    private readonly publicBase: string,
    private readonly sign: (path: string, expires: number) => string,
  ) {}
  private path(bucket: Bucket, key: string) {
    return join(resolve(this.root), bucket, safeKey(key));
  }
  async put(bucket: Bucket, key: string, data: Buffer) {
    const p = this.path(bucket, key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data);
  }
  async get(bucket: Bucket, key: string) {
    return readFile(this.path(bucket, key));
  }
  async exists(bucket: Bucket, key: string) {
    try {
      await readFile(this.path(bucket, key));
      return true;
    } catch {
      return false;
    }
  }
  async delete(bucket: Bucket, key: string) {
    await rm(this.path(bucket, key), { force: true });
  }
  async signedGetUrl(bucket: Bucket, key: string, ttlSec: number) {
    const expires = Math.floor(Date.now() / 1000) + ttlSec;
    const path = `${bucket}/${safeKey(key)}`;
    return `${this.publicBase.replace(/\/media$/, '')}/media/signed/${path}?e=${expires}&s=${this.sign(path, expires)}`;
  }
  async signedPutUrl(bucket: Bucket, key: string, opts: { ttlSec: number }) {
    const expires = Math.floor(Date.now() / 1000) + opts.ttlSec;
    const path = `${bucket}/${safeKey(key)}`;
    return `${this.publicBase.replace(/\/media$/, '')}/media/upload/${path}?e=${expires}&s=${this.sign(`put:${path}`, expires)}`;
  }
  publicUrl(key: string) {
    return `${this.publicBase}/${safeKey(key)}`;
  }
}

/** Any S3-compatible service (MinIO locally). */
export class S3Storage implements ObjectStorage {
  private readonly s3: S3Client;
  constructor(
    private readonly env: Pick<Env, 'S3_ENDPOINT' | 'S3_REGION' | 'S3_ACCESS_KEY' | 'S3_SECRET_KEY' | 'S3_BUCKET_PRIVATE' | 'S3_BUCKET_PUBLIC' | 'S3_FORCE_PATH_STYLE' | 'PUBLIC_MEDIA_BASE_URL'>,
  ) {
    this.s3 = new S3Client({
      region: env.S3_REGION,
      ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      ...(env.S3_ACCESS_KEY && env.S3_SECRET_KEY
        ? { credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY } }
        : {}),
    });
  }
  private bucket(b: Bucket) {
    return b === 'private' ? this.env.S3_BUCKET_PRIVATE : this.env.S3_BUCKET_PUBLIC;
  }
  async put(bucket: Bucket, key: string, data: Buffer, opts?: { contentType?: string; cacheControl?: string }) {
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.bucket(bucket), Key: safeKey(key), Body: data, ContentType: opts?.contentType, CacheControl: opts?.cacheControl }),
    );
  }
  async get(bucket: Bucket, key: string) {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket(bucket), Key: safeKey(key) }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }
  async exists(bucket: Bucket, key: string) {
    try {
      await this.s3.send(new GetObjectCommand({ Bucket: this.bucket(bucket), Key: safeKey(key), Range: 'bytes=0-0' }));
      return true;
    } catch {
      return false;
    }
  }
  async delete(bucket: Bucket, key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket(bucket), Key: safeKey(key) }));
  }
  async signedGetUrl(bucket: Bucket, key: string, ttlSec: number) {
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket(bucket), Key: safeKey(key) }), { expiresIn: ttlSec });
  }
  async signedPutUrl(bucket: Bucket, key: string, opts: { contentType: string; ttlSec: number }) {
    return getSignedUrl(this.s3, new PutObjectCommand({ Bucket: this.bucket(bucket), Key: safeKey(key), ContentType: opts.contentType }), {
      expiresIn: opts.ttlSec,
    });
  }
  publicUrl(key: string) {
    return `${this.env.PUBLIC_MEDIA_BASE_URL}/${safeKey(key)}`;
  }
}
