import { tw } from '@sp/core';
import { buttonClass } from '@sp/ui';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-lg flex-col justify-center gap-4 px-4">
      <p className="smallcaps text-muted">{tw('en', 'brand.name')}</p>
      <h1 className="font-display text-xl font-semibold">{tw('en', 'p.not_found_title')}</h1>
      <p className="text-muted">{tw('en', 'p.not_found_body')}</p>
      <a href="/" className={buttonClass('secondary', 'md', 'self-start')}>
        Skills Passport
      </a>
    </main>
  );
}
