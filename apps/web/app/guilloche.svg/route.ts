import { gzipSync } from 'node:zlib';
import { guillocheSvg } from '@sp/ui/guilloche';

const svg = guillocheSvg();
const gz = gzipSync(svg, { level: 9 });

/** Served pre-compressed: it sits on the passport page, which has a 200 KB budget. */
export function GET(req: Request) {
  const gzip = /\bgzip\b/.test(req.headers.get('accept-encoding') ?? '');
  return new Response(gzip ? gz : svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
      Vary: 'Accept-Encoding',
      ...(gzip ? { 'Content-Encoding': 'gzip' } : {}),
    },
  });
}
