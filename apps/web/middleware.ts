import { NextResponse, type NextRequest } from 'next/server';
import { devToolsEnabled } from './lib/devtools';

/** /dev/* (simulator, design page) exists only in development or a public demo build (PROMPTS M3, M9). */
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/dev') && !devToolsEnabled()) {
    return new NextResponse('Not found', { status: 404 });
  }
  return NextResponse.next();
}

export const config = { matcher: ['/dev/:path*'] };
