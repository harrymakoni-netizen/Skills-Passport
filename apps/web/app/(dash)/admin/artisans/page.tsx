import type { Metadata } from 'next';
import { Artisans } from '@/components/admin/Artisans';
export const metadata: Metadata = { title: 'Artisans' };
export default function Page() {
  return <Artisans />;
}
