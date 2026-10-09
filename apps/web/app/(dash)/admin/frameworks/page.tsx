import type { Metadata } from 'next';
import { Frameworks } from '@/components/admin/Frameworks';
export const metadata: Metadata = { title: 'Competency frameworks' };
export default function Page() {
  return <Frameworks />;
}
