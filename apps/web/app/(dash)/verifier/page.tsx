import type { Metadata } from 'next';
import { ReviewQueue } from '@/components/verifier/ReviewQueue';

export const metadata: Metadata = { title: 'Review queue' };

export default function VerifierPage() {
  return <ReviewQueue />;
}
