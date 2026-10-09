import { buttonClass } from '@sp/ui';
import { site } from '@/lib/copy';

export function SiteHeader() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <a href="/" className="flex min-h-11 items-center gap-2.5 font-semibold text-ink-900">
          <img src="/icon.svg" alt="" width={28} height={28} className="size-7" />
          Skills Passport
        </a>
        <nav className="flex items-center gap-1 text-sm">
          <a href="/#how" className="hidden min-h-11 items-center px-3 text-muted hover:text-text md:inline-flex">
            {site.nav.how}
          </a>
          <a href="/#levels" className="hidden min-h-11 items-center px-3 text-muted hover:text-text md:inline-flex">
            {site.nav.levels}
          </a>
          <a href="/find" className="inline-flex min-h-11 items-center px-3 text-muted hover:text-text">
            {site.nav.find}
          </a>
          <a href="/login" className={buttonClass('secondary', 'sm', 'ml-1')}>
            {site.nav.signIn}
          </a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted md:flex-row md:items-center md:justify-between md:px-6">
        <p className="max-w-xl">{site.footer.disclaimer}</p>
        <div className="flex gap-4">
          <a className="underline-offset-4 hover:underline" href="/find">
            {site.footer.links.find}
          </a>
          <a className="underline-offset-4 hover:underline" href="/login">
            {site.footer.links.signIn}
          </a>
        </div>
      </div>
    </footer>
  );
}
