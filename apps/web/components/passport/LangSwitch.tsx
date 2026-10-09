import type { Lang } from '@sp/core';
import { cx } from '@sp/ui';

const LANGS: { id: Lang; label: string; short: string }[] = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'sn', label: 'chiShona', short: 'SN' },
  { id: 'nd', label: 'isiNdebele', short: 'ND' },
];

/** Plain links (no JavaScript) so the page stays light on 3G. */
export function LangSwitch({ current, base, label }: { current: Lang; base: string; label: string }) {
  return (
    <nav aria-label={label} className="flex items-center gap-1 text-sm">
      {LANGS.map((l) => (
        <a
          key={l.id}
          href={l.id === 'en' ? base : `${base}?lang=${l.id}`}
          hrefLang={l.id}
          aria-current={l.id === current ? 'true' : undefined}
          className={cx('inline-flex min-h-11 items-center rounded-sm px-2', l.id === current ? 'font-semibold text-ink-900 underline decoration-accent decoration-2 underline-offset-[6px]' : 'text-muted hover:text-text')}
        >
          <span className="sm:hidden" aria-hidden>
            {l.short}
          </span>
          <span className="sr-only sm:not-sr-only">{l.label}</span>
        </a>
      ))}
    </nav>
  );
}
