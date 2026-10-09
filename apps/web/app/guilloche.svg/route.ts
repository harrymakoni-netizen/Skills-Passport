import { guillocheSvg } from '@sp/ui/guilloche';

const svg = guillocheSvg();

export const dynamic = 'force-static';

export function GET() {
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=31536000, immutable' } });
}
