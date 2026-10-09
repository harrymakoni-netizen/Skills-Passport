/**
 * Whether the /dev tools (WhatsApp simulator, design page) and demo sign-in help are on. Always on in development
 * unless DEV_TOOLS=false; in a production build only for a public demo (PUBLIC_DEMO=true, fictional data only).
 */
export function devToolsEnabled(): boolean {
  if (process.env.DEV_TOOLS === 'false') return false;
  return process.env.NODE_ENV !== 'production' || process.env.PUBLIC_DEMO === 'true';
}
