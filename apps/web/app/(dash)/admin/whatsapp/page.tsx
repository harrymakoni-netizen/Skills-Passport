import type { Metadata } from 'next';
import { WhatsAppSetup, type WhatsAppStatus } from '@/components/admin/WhatsAppSetup';
import { api } from '@/lib/server';

export const metadata: Metadata = { title: 'WhatsApp' };

export default async function WhatsAppPage() {
  const status = await api<WhatsAppStatus>('/admin/whatsapp');
  return <WhatsAppSetup initial={status} />;
}
