import { waitUntil } from '@vercel/functions';
import type { IncomingMessage } from 'node:http';
import type { NextApiRequest, NextApiResponse } from 'next';

/*
 * Serverless runtime (RUNTIME=serverless, e.g. Vercel): the NestJS API runs inside this function. Requests to
 * /api/* reach Nest with the /api prefix removed, exactly as the standalone API sees them behind the web rewrites.
 * After each response, due background tasks (inbound messages, media, AI, notifications) run in the same instance.
 * With RUNTIME=server this route is unused: next.config.ts rewrites /api/* to the API process instead.
 */

export const config = {
  api: { bodyParser: false, externalResolver: true, responseLimit: false },
  maxDuration: 60,
};

/** Uploads are capped at 25 MB, as on the standalone API. */
const MAX_BODY = 25 * 1024 * 1024;
const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'content-length']);

async function readBody(req: IncomingMessage): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    size += buf.length;
    if (size > MAX_BODY) return null;
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.RUNTIME !== 'serverless') {
    res.status(404).json({ message: 'Not found' });
    return;
  }
  const { getServerlessApi } = await import('@sp/api/serverless');
  const api = await getServerlessApi();
  // Build the API path from the matched segments: req.url still shows the public URL when a rewrite led here
  // (for example /p/{code}/qr.png → /api/public/passports/{code}/qr.png).
  const segments = ([] as string[]).concat(req.query.path ?? []);
  const raw = req.url ?? '/';
  const search = raw.includes('?') ? raw.slice(raw.indexOf('?')) : '';
  const url = `/${segments.map(encodeURIComponent).join('/')}${search}`;

  // Scheduled maintenance (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`).
  if (url.startsWith('/cron/daily')) {
    if (!api.cronSecret || req.headers.authorization !== `Bearer ${api.cronSecret}`) {
      res.status(401).json({ message: 'Unauthorised' });
      return;
    }
    await api.daily();
    const ran = await api.drain(50_000);
    res.status(200).json({ ok: true, ran });
    return;
  }

  const body = await readBody(req);
  if (!body) {
    res.status(413).json({ message: 'File too large' });
    return;
  }
  const out = await api.request({ method: req.method ?? 'GET', url, headers: req.headers, body, ...(req.socket?.remoteAddress ? { remoteAddress: req.socket.remoteAddress } : {}) });
  res.statusCode = out.status;
  for (const [k, v] of Object.entries(out.headers)) {
    if (v === undefined || HOP_BY_HOP.has(k.toLowerCase())) continue;
    res.setHeader(k, Array.isArray(v) ? v : String(v));
  }
  res.end(out.body);
  // Due background tasks (inbound messages, media, AI, notifications) run after the response is sent.
  waitUntil(api.drain());
}
