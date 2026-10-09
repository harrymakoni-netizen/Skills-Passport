import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { currentUser } from '@/lib/server';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

const HOME = { admin: '/admin', verifier: '/verifier', agent: '/agent', buyer: '/buyer' } as const;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await currentUser();
  const { next } = await searchParams;
  if (user) redirect(next?.startsWith('/') ? next : HOME[user.role]);
  const dev = process.env.NODE_ENV !== 'production' && process.env.DEV_TOOLS !== 'false';
  return (
    <div className="grid min-h-dvh md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-ink-900 text-paper md:flex md:flex-col md:justify-between md:p-10">
        <img src="/guilloche.svg" alt="" aria-hidden className="pointer-events-none absolute inset-0 size-full object-cover opacity-80" />
        <a href="/" className="relative flex items-center gap-2.5 font-semibold">
          <img src="/icon.svg" alt="" className="size-7" />
          Skills Passport
        </a>
        <div className="relative flex max-w-md flex-col gap-3">
          <p className="smallcaps text-ink-300">For verifiers, field agents, buyers and administrators</p>
          <p className="font-display text-xl font-semibold leading-snug">Every review and every confirmation becomes part of someone’s working record. Thank you for keeping it honest.</p>
        </div>
        <p className="relative text-xs text-ink-300">Staff accounts use an authenticator app for a second sign-in step.</p>
      </aside>
      <main className="flex items-center justify-center px-4 py-12">
        <LoginForm
          next={next?.startsWith('/') ? next : null}
          devAccounts={
            dev
              ? [
                  { role: 'Administrator', email: 'admin@skillspassport.test' },
                  { role: 'Verifier · solar', email: 'farai.verifier@skillspassport.test' },
                  { role: 'Verifier · welding', email: 'sipho.verifier@skillspassport.test' },
                  { role: 'Field agent', email: 'rumbi.agent@skillspassport.test' },
                  { role: 'Buyer', email: 'buyer@kuyedza.test' },
                ]
              : null
          }
        />
      </main>
    </div>
  );
}
