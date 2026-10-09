import type { Metadata, Viewport } from 'next';
import { fraunces, plexMono, plexSans } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Skills Passport', template: '%s · Skills Passport' },
  description: 'A verified record of real work by young artisans in Zimbabwe, confirmed by their clients and reviewed by master artisans.',
  metadataBase: new URL(process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000'),
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = { themeColor: '#0E4334', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
