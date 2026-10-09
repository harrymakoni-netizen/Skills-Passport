import type { Metadata } from 'next';
import { Flags } from '@/components/admin/Flags';
export const metadata: Metadata = { title: 'Fraud review' };
export default function FlagsPage() {
  return <Flags />;
}
