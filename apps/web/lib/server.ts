import 'server-only';
import { cookies } from 'next/headers';

const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

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
  const res = await fetch(`${API}${path}`, {
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
  const res = await fetch(`${API}${path}`, { next: { revalidate } }).catch(() => null);
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
