import localFont from 'next/font/local';

/** Self-hosted, Latin subset, three families (DESIGN.md). */
export const fraunces = localFont({
  src: '../../../packages/ui/fonts/fraunces-latin-600-normal.woff2',
  weight: '600',
  variable: '--font-fraunces',
  display: 'swap',
  preload: false,
  fallback: ['Georgia', 'serif'],
});

export const plexSans = localFont({
  src: [
    { path: '../../../packages/ui/fonts/ibm-plex-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../../packages/ui/fonts/ibm-plex-sans-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-plex-sans',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});

export const plexMono = localFont({
  src: '../../../packages/ui/fonts/ibm-plex-mono-latin-500-normal.woff2',
  weight: '500',
  variable: '--font-plex-mono',
  display: 'swap',
  preload: false,
  fallback: ['ui-monospace', 'monospace'],
});
