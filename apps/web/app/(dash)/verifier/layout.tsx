import { Shell } from '@/components/shell/Shell';
import { requireRole } from '@/lib/guard';

export default async function VerifierLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('verifier', '/verifier');
  return (
    <Shell user={user} nav={[{ href: '/verifier', label: 'Review queue' }, { href: '/verifier/history', label: 'My reviews and endorsements' }]}>
      {children}
    </Shell>
  );
}
