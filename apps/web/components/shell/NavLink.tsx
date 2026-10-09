'use client';
import { usePathname } from 'next/navigation';
import { cx } from '@sp/ui';

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = path === href || (href.split('/').length > 2 && path.startsWith(href));
  return (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cx('flex min-h-11 items-center rounded-md px-3 text-sm transition-colors duration-150', active ? 'bg-ink-50 font-semibold text-ink-900' : 'text-muted hover:bg-sunk hover:text-text')}
    >
      {active ? <span className="-ml-1 mr-2 h-4 w-0.5 rounded-full bg-accent" aria-hidden /> : null}
      {children}
    </a>
  );
}
