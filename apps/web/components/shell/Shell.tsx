import type { ReactNode } from 'react';
import { ToastProvider } from '@sp/ui/client';
import { NavLink } from './NavLink';
import { SignOut } from './SignOut';

export type NavItem = { href: string; label: string };

const ROLE_LABEL = { admin: 'Administrator', verifier: 'Verifier', agent: 'Field agent', buyer: 'Buyer' } as const;

/** Dashboard shell: quiet sidebar on desktop, compact top bar with a disclosure menu on phones. */
export function Shell({ user, nav, children }: { user: { name: string; role: keyof typeof ROLE_LABEL }; nav: NavItem[]; children: ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-dvh md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-rule bg-raised md:flex md:min-h-dvh md:flex-col">
          <a href="/" className="flex h-14 items-center gap-2.5 border-b border-rule px-4 font-semibold text-ink-900">
            <img src="/icon.svg" alt="" className="size-6" />
            Skills Passport
          </a>
          <nav className="flex flex-1 flex-col gap-0.5 p-2" aria-label="Main">
            {nav.map((n) => (
              <NavLink key={n.href} href={n.href}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex flex-col gap-2 border-t border-rule p-4">
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{user.name}</span>
              <span className="text-xs text-muted">{ROLE_LABEL[user.role]}</span>
            </div>
            <SignOut />
          </div>
        </aside>
        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-rule bg-paper/95 px-4 backdrop-blur md:hidden">
            <a href="/" className="flex items-center gap-2 font-semibold text-ink-900">
              <img src="/icon.svg" alt="" className="size-6" />
              {ROLE_LABEL[user.role]}
            </a>
            <details className="relative">
              <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-md border border-rule-strong bg-raised px-3 text-sm font-semibold">Menu</summary>
              <nav className="absolute right-0 top-12 z-30 flex w-60 flex-col gap-0.5 rounded-lg border border-rule bg-raised p-2 shadow-overlay" aria-label="Main">
                {nav.map((n) => (
                  <NavLink key={n.href} href={n.href}>
                    {n.label}
                  </NavLink>
                ))}
                <div className="mt-1 border-t border-rule pt-2">
                  <SignOut />
                </div>
              </nav>
            </details>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
