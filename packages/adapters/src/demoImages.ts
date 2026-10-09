import sharp from 'sharp';

/**
 * Variations of the drawn demo photos for seed data: crop, zoom, mirror and tone changes so every seeded job has
 * its own photos (and the duplicate-image fraud rule only fires on real duplicates).
 */
export async function photoVariant(input: Buffer, seed: number): Promise<Buffer> {
  let s = (seed * 2654435761) >>> 0 || 1;
  const r = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
  const meta = await sharp(input).metadata();
  const w = meta.width ?? 1200;
  const h = meta.height ?? 900;
  const zoom = 1.12 + r() * 0.4;
  const cw = Math.round(w / zoom);
  const ch = Math.round(h / zoom);
  const left = Math.round(r() * (w - cw));
  const top = Math.round(r() * (h - ch));
  let img = sharp(input).extract({ left, top, width: cw, height: ch }).resize(w, h);
  if (r() > 0.45) img = img.flop();
  img = img.modulate({ brightness: 0.86 + r() * 0.24, saturation: 0.8 + r() * 0.35, hue: Math.round((r() - 0.5) * 24) });
  return img.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}
