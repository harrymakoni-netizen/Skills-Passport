import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/site/SiteHeader';
import { site } from '@/lib/copy';

export const metadata: Metadata = { title: 'Privacy policy', description: 'What Skills Passport collects, why, who can see it and how to have it removed.' };

const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_m, k: string) => values[k] ?? '');

/** Privacy policy (SPEC 14). Required by Meta before a WhatsApp app can go live. Operator and contact come from env. */
export default function PrivacyPage() {
  const p = site.privacy;
  const operator = process.env.OPERATOR_NAME;
  const email = process.env.PRIVACY_CONTACT_EMAIL;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-12 md:px-6 md:py-16">
        <header className="flex flex-col gap-3">
          <p className="smallcaps text-accent">{p.updated}</p>
          <h1 className="font-display text-display font-semibold tracking-[-0.02em] text-ink-950">{p.title}</h1>
          <p className="text-base leading-7 text-muted">{p.intro}</p>
        </header>
        {p.sections.map((s) => (
          <section key={s.title} className="flex flex-col gap-3 border-t border-rule pt-6">
            <h2 className="font-display text-xl font-semibold text-ink-950">{s.title}</h2>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-base leading-7 text-text marker:text-faint">
              {s.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
        <section className="flex flex-col gap-3 border-t border-rule pt-6">
          <h2 className="font-display text-xl font-semibold text-ink-950">{p.contactTitle}</h2>
          <p className="text-base leading-7">
            {p.contactWhatsApp} {email ? fill(p.contactEmail, { email }) : null}
          </p>
          {operator ? <p className="text-base leading-7 text-muted">{fill(p.operator, { name: operator })}</p> : null}
          <p className="text-sm text-muted">{p.notOfficial}</p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
