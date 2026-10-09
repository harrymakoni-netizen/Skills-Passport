import 'server-only';
import { cookies } from 'next/headers';

const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

/**
 * Calls the API. With RUNTIME=serverless the API runs in this same process, so requests are injected into it
 * directly (no network hop, and no deployment-protection headers to pass on preview URLs).
 */
async function apiFetch(path: string, init: RequestInit): Promise<Response> {
  if (process.env.RUNTIME !== 'serverless') return fetch(`${API}${path}`, init);
  const [lmr, { getServerlessApi }] = await Promise.all([import('light-my-request'), import('@sp/api/serverless')]);
  // CommonJS package: the function is the module itself when loaded as an external.
  const inject = (typeof lmr.inject === 'function' ? lmr.inject : (lmr as unknown as { default: typeof lmr.inject }).default);
  const server = await getServerlessApi();
  const headers = Object.fromEntries(new Headers(init.headers).entries());
  const res = await inject(server.handle, {
    method: (init.method ?? 'GET') as 'GET',
    url: path,
    headers,
    ...(typeof init.body === 'string' ? { payload: init.body } : {}),
  });
  const out = new Headers();
  for (const [k, v] of Object.entries(res.headers)) {
    if (v === undefined) continue;
    for (const one of Array.isArray(v) ? v : [String(v)]) out.append(k, one);
  }
  return new Response(res.statusCode === 204 || res.statusCode === 304 ? null : new Uint8Array(res.rawPayload), { status: res.statusCode, headers: out });
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Server-side API call, forwarding the staff session cookie. */
export async function api<T>(path: string, init: RequestInit & { revalidate?: number } = {}): Promise<T> {
  const jar = await cookies();
  const session = jar.get('sp_session')?.value;
  const res = await apiFetch(path, {
    ...init,
    headers: { ...(init.headers ?? {}), ...(session ? { cookie: `sp_session=${session}` } : {}) },
    cache: init.revalidate ? undefined : 'no-store',
    ...(init.revalidate ? { next: { revalidate: init.revalidate } } : {}),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(res.status, body.message ?? res.statusText);
  }
  return (await res.json()) as T;
}

/** Public data (no cookie), cacheable — for the passport page. */
export async function publicApi<T>(path: string, revalidate = 30): Promise<T | null> {
  const res = await apiFetch(path, { next: { revalidate } }).catch((err: unknown) => {
    console.error('API call failed', path.split('?')[0], err instanceof Error ? err.message : err);
    return null;
  });
  if (!res) throw new ApiError(503, 'API unavailable');
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  return (await res.json()) as T;
}

export type SessionUser = { id: string; role: 'admin' | 'verifier' | 'agent' | 'buyer'; name: string; verifierId?: string; agentId?: string; buyerId?: string };

export async function currentUser(): Promise<SessionUser | null> {
  try {
    return await api<SessionUser>('/auth/me');
  } catch {
    return null;
  }
}
