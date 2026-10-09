import { waitUntil } from '@vercel/functions';
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

  req.url = url;
  waitUntil(new Promise<void>((resolve) => res.once('close', () => resolve())).then(() => api.drain()));
  api.handle(req, res);
}
