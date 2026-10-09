'use client';

/** Browser-side API call through the same-origin /api rewrite. Mutations carry the CSRF header the API requires. */
export async function call<T>(path: string, init: { method?: string; body?: unknown; raw?: BodyInit; contentType?: string } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? (init.body !== undefined || init.raw !== undefined ? 'POST' : 'GET'),
    credentials: 'same-origin',
    headers: {
      'x-sp-csrf': '1',
      ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(init.contentType ? { 'content-type': init.contentType } : {}),
    },
    body: init.raw ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; issues?: { path: string; message: string }[] };
  if (!res.ok) {
    const msg = data.issues?.length ? data.issues.map((i) => `${i.path}: ${i.message}`).join(', ') : (data.message ?? 'Something went wrong');
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return data;
}
