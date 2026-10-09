import type { Metadata } from 'next';
import { Enrol } from '@/components/agent/Enrol';
import { api } from '@/lib/server';

export const metadata: Metadata = { title: 'Enrol an artisan' };
export default async function EnrolPage() {
  const ref = await api<{ trades: { id: string; name: { en: string } }[]; areas: { id: string; name: string; city: string }[] }>('/public/reference');
  return <Enrol trades={ref.trades} areas={ref.areas} />;
}
