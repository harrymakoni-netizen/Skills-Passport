import { Shell } from '@/components/shell/Shell';
import { requireRole } from '@/lib/guard';

export default async function BuyerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('buyer', '/buyer');
  return (
    <Shell user={user} nav={[{ href: '/buyer', label: 'Find artisans' }, { href: '/buyer/requests', label: 'My work requests' }]}>
      {children}
    </Shell>
  );
}
