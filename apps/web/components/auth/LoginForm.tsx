'use client';
import { useState } from 'react';
import { Button, Field, Input } from '@sp/ui';

const HOME = { admin: '/admin', verifier: '/verifier', agent: '/agent', buyer: '/buyer' } as const;
type Role = keyof typeof HOME;

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`/api${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-sp-csrf': '1' }, body: JSON.stringify(body) });
  const data = (await r.json().catch(() => ({}))) as T & { message?: string };
  if (!r.ok) throw new Error(data.message ?? 'Sign-in failed');
  return data;
}

export function LoginForm({ next, devAccounts, devCodeHelp = false }: { next: string | null; devAccounts: { role: string; email: string }[] | null; devCodeHelp?: boolean }) {
  const [step, setStep] = useState<'password' | 'totp' | 'enrol'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [enrol, setEnrol] = useState<{ secret: string; uri: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = (role: Role) => window.location.assign(next ?? HOME[role]);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ next: string; challenge?: string; secret?: string; uri?: string; user?: { role: Role } }>('/auth/login', { email, password });
      if (r.next === 'done' && r.user) return finish(r.user.role);
      setChallenge(r.challenge!);
      if (r.next === 'enrol') setEnrol({ secret: r.secret!, uri: r.uri! });
      setStep(r.next === 'enrol' ? 'enrol' : 'totp');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ user: { role: Role } }>('/auth/totp', { challenge, code });
      finish(r.user.role);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function fillDevCode() {
    const r = await fetch(`/api/auth/dev-code?challenge=${encodeURIComponent(challenge)}`);
    if (r.ok) setCode(((await r.json()) as { code: string }).code);
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-xl font-semibold">{step === 'password' ? 'Sign in' : step === 'enrol' ? 'Set up your authenticator' : 'Enter your code'}</h1>
        <p className="text-sm text-muted">
          {step === 'password'
            ? 'Use the email and password from your invitation.'
            : step === 'enrol'
              ? 'Add Skills Passport to an authenticator app (Google Authenticator, Microsoft Authenticator or similar), then enter the 6-digit code it shows.'
              : 'Open your authenticator app and enter the 6-digit code for Skills Passport.'}
        </p>
      </div>

      {step === 'password' ? (
        <form onSubmit={submitPassword} className="flex flex-col gap-4" noValidate>
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!error} />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!error} />
          </Field>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" loading={busy}>
            Continue
          </Button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="flex flex-col gap-4">
          {enrol ? (
            <div className="flex flex-col gap-2 rounded-md border border-rule bg-raised p-3 text-sm">
              <span className="text-muted">Setup key</span>
              <code className="serial break-all text-sm">{enrol.secret}</code>
            </div>
          ) : null}
          <Field label="6-digit code" htmlFor="code">
            <Input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="serial text-lg tracking-[0.3em]" aria-invalid={!!error} />
          </Field>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" loading={busy} disabled={code.length !== 6}>
            Sign in
          </Button>
          {devCodeHelp ? (
            <button type="button" onClick={() => void fillDevCode()} className="self-start text-sm text-ink-900 underline underline-offset-4">
              Development: fill the current code
            </button>
          ) : null}
          <button type="button" onClick={() => { setStep('password'); setCode(''); setError(null); }} className="self-start text-sm text-muted hover:text-text">
            Back
          </button>
        </form>
      )}

      {devAccounts && step === 'password' ? (
        <div className="flex flex-col gap-2 border-t border-rule pt-4">
          <p className="smallcaps text-muted">Demo accounts · development only</p>
          <ul className="flex flex-col">
            {devAccounts.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword('passport-demo-2026');
                  }}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-sm px-2 text-left text-sm hover:bg-ink-50"
                >
                  <span className="font-semibold">{a.role}</span>
                  <span className="truncate font-mono text-xs text-muted">{a.email}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
