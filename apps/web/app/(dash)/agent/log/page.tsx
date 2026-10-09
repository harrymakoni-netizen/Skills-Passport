import type { Metadata } from 'next';
import { LogJob } from '@/components/agent/LogJob';
import { api } from '@/lib/server';

export const metadata: Metadata = { title: 'Log a job' };
export default async function LogPage() {
  const ref = await api<{ areas: { id: string; name: string; city: string }[] }>('/public/reference');
  return <LogJob areas={ref.areas} />;
}
