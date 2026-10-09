import type { Metadata } from 'next';
import { Tasks } from '@/components/agent/Tasks';

export const metadata: Metadata = { title: 'Follow-ups' };
export default function AgentPage() {
  return <Tasks />;
}
