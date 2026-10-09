import type { Metadata } from 'next';
import { ConfigEditor } from '@/components/admin/ConfigEditor';
export const metadata: Metadata = { title: 'Rules configuration' };
export default function Page() {
  return <ConfigEditor />;
}
