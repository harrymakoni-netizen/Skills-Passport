import type { Metadata } from 'next';
import { Simulator } from '@/components/sim/Simulator';

export const metadata: Metadata = { title: 'WhatsApp simulator', robots: { index: false } };

export default function ChatPage() {
  return <Simulator />;
}
