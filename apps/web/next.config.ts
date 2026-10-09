import type { NextConfig } from 'next';

const api = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const config: NextConfig = {
  transpilePackages: ['@sp/ui', '@sp/core'],
  poweredByHeader: false,
  reactStrictMode: true,
  images: { unoptimized: true },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${api}/:path*` },
      { source: '/media/:path*', destination: `${api}/media/:path*` },
      { source: '/p/:code/qr.png', destination: `${api}/public/passports/:code/qr.png` },
      { source: '/p/:code/card.png', destination: `${api}/public/passports/:code/card.png` },
      { source: '/p/:code/og.png', destination: `${api}/public/passports/:code/og.png` },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default config;
