import exifReader from 'exif-reader';
import sharp from 'sharp';

/**
 * Image processing used by the media pipeline (SPEC 9): metadata-stripped public copy, thumbnail, perceptual hash,
 * quality score and capture metadata. Built on sharp.
 */
export interface ProcessedImage {
  publicJpeg: Buffer;
  thumbJpeg: Buffer;
  width: number;
  height: number;
  phash: string;
  quality: { score: number; problem: 'dark' | 'blurry' | null; brightness: number; sharpness: number };
  capturedAt: Date | null;
  gps: { lat: number; lng: number } | null;
}

export const PUBLIC_MAX_PX = 1280;
export const PUBLIC_TARGET_BYTES = 200 * 1024;
export const THUMB_PX = 480;

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const meta = await sharp(input).metadata();
  const { capturedAt, gps } = readExif(meta.exif);

  // .rotate() applies EXIF orientation; output has no metadata (sharp strips it unless withMetadata is used).
  const base = sharp(input).rotate().resize({ width: PUBLIC_MAX_PX, height: PUBLIC_MAX_PX, fit: 'inside', withoutEnlargement: true });
  let q = 78;
  let publicJpeg = await base.clone().jpeg({ quality: q, mozjpeg: true }).toBuffer();
  while (publicJpeg.length > PUBLIC_TARGET_BYTES && q > 45) {
    q -= 8;
    publicJpeg = await base.clone().jpeg({ quality: q, mozjpeg: true }).toBuffer();
  }
  const out = await sharp(publicJpeg).metadata();
  const thumbJpeg = await sharp(publicJpeg).resize({ width: THUMB_PX, height: THUMB_PX, fit: 'cover' }).jpeg({ quality: 68, mozjpeg: true }).toBuffer();

  return {
    publicJpeg,
    thumbJpeg,
    width: out.width ?? 0,
    height: out.height ?? 0,
    phash: await perceptualHash(input),
    quality: await qualityScore(input),
    capturedAt,
    gps,
  };
}

function readExif(exif: Buffer | undefined): { capturedAt: Date | null; gps: { lat: number; lng: number } | null } {
  if (!exif) return { capturedAt: null, gps: null };
  try {
    const data = exifReader(exif) as {
      Photo?: { DateTimeOriginal?: Date };
      Image?: { DateTime?: Date };
      GPSInfo?: { GPSLatitude?: number[]; GPSLatitudeRef?: string; GPSLongitude?: number[]; GPSLongitudeRef?: string };
    };
    const capturedAt = data.Photo?.DateTimeOriginal ?? data.Image?.DateTime ?? null;
    const g = data.GPSInfo;
    let gps: { lat: number; lng: number } | null = null;
    if (g?.GPSLatitude?.length === 3 && g.GPSLongitude?.length === 3) {
      const dms = (v: number[]) => v[0]! + v[1]! / 60 + v[2]! / 3600;
      gps = { lat: dms(g.GPSLatitude) * (g.GPSLatitudeRef === 'S' ? -1 : 1), lng: dms(g.GPSLongitude) * (g.GPSLongitudeRef === 'W' ? -1 : 1) };
    }
    return { capturedAt: capturedAt instanceof Date && !Number.isNaN(capturedAt.getTime()) ? capturedAt : null, gps };
  } catch {
    return { capturedAt: null, gps: null };
  }
}

/**
 * 64-bit DCT perceptual hash (pHash): 32×32 greyscale → 2-D DCT → top-left 8×8 (without the DC term) → compare to
 * the median. Robust to resizing, recompression and small crops; compare with Hamming distance.
 */
export async function perceptualHash(input: Buffer): Promise<string> {
  const N = 32;
  const { data } = await sharp(input).rotate().greyscale().resize(N, N, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const px = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => data[y * N + x]!));
  const cos = Array.from({ length: N }, (_, k) => Array.from({ length: N }, (_, n) => Math.cos(((2 * n + 1) * k * Math.PI) / (2 * N))));
  const coeffs: number[] = [];
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      let sum = 0;
      for (let y = 0; y < N; y++) {
        const row = px[y]!;
        const cy = cos[u]![y]!;
        for (let x = 0; x < N; x++) sum += row[x]! * cy * cos[v]![x]!;
      }
      coeffs.push(sum);
    }
  }
  const ac = coeffs.slice(1);
  const median = [...ac].sort((a, b) => a - b)[Math.floor(ac.length / 2)]!;
  let bits = '';
  for (const c of coeffs) bits += c > median ? '1' : '0';
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/** Brightness (mean luminance 0–255) and sharpness (variance of the Laplacian) on a 512 px greyscale copy. */
export async function qualityScore(input: Buffer): Promise<ProcessedImage['quality']> {
  const { data, info } = await sharp(input).rotate().greyscale().resize(512, 512, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i]!;
  const brightness = sum / data.length;
  let lapSum = 0;
  let lapSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * data[i]! - data[i - 1]! - data[i + 1]! - data[i - w]! - data[i + w]!;
      lapSum += lap;
      lapSq += lap * lap;
      n++;
    }
  }
  const mean = lapSum / n;
  const sharpness = lapSq / n - mean * mean;
  const brightScore = brightness < 40 ? brightness / 40 : brightness > 235 ? (255 - brightness) / 20 : 1;
  const sharpScore = Math.min(1, sharpness / 120);
  const score = Math.round(Math.max(0, Math.min(1, brightScore * 0.5 + sharpScore * 0.5)) * 100) / 100;
  const problem = brightness < 40 ? 'dark' : sharpness < 25 ? 'blurry' : null;
  return { score, problem, brightness: Math.round(brightness), sharpness: Math.round(sharpness) };
}

/** Simple audio duration for WAV fixtures; WhatsApp sends duration-less OGG so this is best effort. */
export function wavDurationSec(buf: Buffer): number | null {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null;
  const byteRate = buf.readUInt32LE(28);
  return byteRate ? Math.round((buf.length - 44) / byteRate) : null;
}
