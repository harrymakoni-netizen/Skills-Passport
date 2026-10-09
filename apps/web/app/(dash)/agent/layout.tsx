import { Shell } from '@/components/shell/Shell';
import { requireRole } from '@/lib/guard';

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('agent', '/agent');
  return (
    <Shell user={user} nav={[{ href: '/agent', label: 'Follow-ups' }, { href: '/agent/log', label: 'Log a job' }, { href: '/agent/enrol', label: 'Enrol an artisan' }]}>
      {children}
    </Shell>
  );
}
