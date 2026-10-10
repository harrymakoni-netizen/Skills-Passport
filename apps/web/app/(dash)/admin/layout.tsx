import { Shell } from '@/components/shell/Shell';
import { requireRole } from '@/lib/guard';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('admin', '/admin');
  return (
    <Shell
      user={user}
      nav={[
        { href: '/admin', label: 'Overview' },
        { href: '/admin/flags', label: 'Fraud review' },
        { href: '/admin/artisans', label: 'Artisans' },
        { href: '/admin/frameworks', label: 'Competency frameworks' },
        { href: '/admin/config', label: 'Rules configuration' },
        { href: '/admin/people', label: 'Verifiers and agents' },
        { href: '/admin/report', label: 'Pilot report' },
        { href: '/admin/whatsapp', label: 'WhatsApp' },
        { href: '/admin/audit', label: 'Audit log' },
      ]}
    >
      {children}
    </Shell>
  );
}
