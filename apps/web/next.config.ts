import { join } from 'node:path';
import type { NextConfig } from 'next';

const serverless = process.env.RUNTIME === 'serverless';
const api = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
// With RUNTIME=serverless the API lives at /api inside this app (pages/api/[...path].ts).
const target = serverless ? '/api' : api;

const config: NextConfig = {
  transpilePackages: ['@sp/ui', '@sp/core', '@sp/config', '@sp/adapters', '@sp/db', '@sp/api'],
  // Native modules and frameworks loaded from node_modules at runtime instead of being bundled.
  serverExternalPackages: [
    '@nestjs/core',
    '@nestjs/common',
    '@nestjs/platform-express',
    'helmet',
    'cookie-parser',
    'reflect-metadata',
    '@prisma/client',
    '.prisma/client',
    'sharp',
    'argon2',
    'ioredis',
    'bullmq',
    'pino',
    '@aws-sdk/client-s3',
    '@aws-sdk/s3-request-presigner',
    '@anthropic-ai/sdk',
    'exif-reader',
    'qrcode',
    'otplib',
  ],
  outputFileTracingRoot: join(import.meta.dirname, '../..'),
  outputFileTracingIncludes: {
    // Demo fixtures (simulator photos and voice notes) and the Prisma query engine.
    '/api/**': ['../../fixtures/photos/**', '../../fixtures/audio/**', '../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/**'],
    '/**': ['../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/**'],
  },
  poweredByHeader: false,
  reactStrictMode: true,
  images: { unoptimized: true },
  async rewrites() {
    // Server runtime: /api goes to the API process, ahead of the in-app API route (beforeFiles).
    const beforeFiles = serverless ? [] : [{ source: '/api/:path*', destination: `${api}/:path*` }];
    const afterFiles = [
      { source: '/media/:path*', destination: `${target}/media/:path*` },
      { source: '/p/:code/qr.png', destination: `${target}/public/passports/:code/qr.png` },
      { source: '/p/:code/qr.svg', destination: `${target}/public/passports/:code/qr.svg` },
      { source: '/p/:code/card.png', destination: `${target}/public/passports/:code/card.png` },
      { source: '/p/:code/og.png', destination: `${target}/public/passports/:code/og.png` },
    ];
    return { beforeFiles, afterFiles, fallback: [] };
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
