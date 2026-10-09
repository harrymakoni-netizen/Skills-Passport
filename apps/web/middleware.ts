import { NextResponse, type NextRequest } from 'next/server';

/** /dev/* (simulator, design page) exists only in development (PROMPTS M3, M9). */
export function middleware(req: NextRequest) {
  const devTools = process.env.NODE_ENV !== 'production' && process.env.DEV_TOOLS !== 'false';
  if (req.nextUrl.pathname.startsWith('/dev') && !devTools) {
    return new NextResponse('Not found', { status: 404 });
  }
  return NextResponse.next();
}

export const config = { matcher: ['/dev/:path*'] };
