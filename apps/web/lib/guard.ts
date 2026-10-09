import 'server-only';
import { redirect } from 'next/navigation';
import { currentUser, type SessionUser } from './server';

/** Server-side role gate for dashboard sections (the API enforces the same roles). */
export async function requireRole(role: SessionUser['role'], path: string): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (user.role !== role) redirect('/login');
  return user;
}
