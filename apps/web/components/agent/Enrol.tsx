'use client';
import { useState } from 'react';
import { Button, Checkbox, Field, Input, PageHeader, Select, buttonClass } from '@sp/ui';
import { call } from '@/lib/client';

export function Enrol({ trades, areas }: { trades: { id: string; name: { en: string } }[]; areas: { id: string; name: string; city: string }[] }) {
  const [form, setForm] = useState({ fullName: '', phone: '', birthYear: '', lang: 'en', trade1: '', trade2: '', areaId: '', experienceYears: '1', howLearned: 'apprenticeship', consent: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ passportCode: string; displayName: string } | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value });

  if (done)
    return (
      <div className="flex max-w-xl flex-col gap-4">
        <PageHeader eyebrow="Field agent" title="Passport created" />
        <p>
          <span className="font-semibold">{done.displayName}</span> now has passport <span className="serial">{done.passportCode}</span>. They received a WhatsApp message with their link and how to log their first job.
        </p>
        <div className="flex gap-2">
          <a className={buttonClass('primary')} href={`/agent/log?code=${done.passportCode}`}>Log a job for them</a>
          <a className={buttonClass('secondary')} href={`/p/${done.passportCode}`} target="_blank" rel="noreferrer">View passport</a>
        </div>
      </div>
    );

  return (
    <form
      className="flex max-w-xl flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const r = await call<{ passportCode: string; displayName: string }>('/agent/artisans', {
            body: {
              fullName: form.fullName,
              phone: form.phone,
              birthYear: Number(form.birthYear),
              lang: form.lang,
              tradeIds: [form.trade1, form.trade2].filter(Boolean),
              areaId: form.areaId,
              experienceYears: Number(form.experienceYears),
              howLearned: form.howLearned,
              consentConfirmed: form.consent,
            },
          });
          setDone(r);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <PageHeader eyebrow="Field agent" title="Enrol an artisan" description="For artisans without a smartphone or data. They must be present, aged 18 to 35, and agree to how their information is used." />
      <Field label="First name and surname" htmlFor="fullName"><Input id="fullName" required value={form.fullName} onChange={set('fullName')} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="WhatsApp number" htmlFor="phone" hint="The number they will use for Skills Passport."><Input id="phone" inputMode="tel" required value={form.phone} onChange={set('phone')} placeholder="077 000 0000" /></Field>
        <Field label="Year of birth" htmlFor="birthYear"><Input id="birthYear" inputMode="numeric" required value={form.birthYear} onChange={set('birthYear')} placeholder="1999" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Trade" htmlFor="trade1"><Select id="trade1" required value={form.trade1} onChange={set('trade1')}><option value="">Choose…</option>{trades.map((t) => <option key={t.id} value={t.id}>{t.name.en}</option>)}</Select></Field>
        <Field label="Second trade" htmlFor="trade2" optional="optional"><Select id="trade2" value={form.trade2} onChange={set('trade2')}><option value="">None</option>{trades.filter((t) => t.id !== form.trade1).map((t) => <option key={t.id} value={t.id}>{t.name.en}</option>)}</Select></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Area" htmlFor="areaId"><Select id="areaId" required value={form.areaId} onChange={set('areaId')}><option value="">Choose…</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}, {a.city}</option>)}</Select></Field>
        <Field label="Years in the trade" htmlFor="exp"><Select id="exp" value={form.experienceYears} onChange={set('experienceYears')}>{[0, 1, 3, 6, 10].map((n) => <option key={n} value={n}>{n === 0 ? 'Less than 1' : n === 10 ? 'More than 10' : `${n}+`}</option>)}</Select></Field>
        <Field label="Language" htmlFor="lang"><Select id="lang" value={form.lang} onChange={set('lang')}><option value="en">English</option><option value="sn">chiShona</option><option value="nd">isiNdebele</option></Select></Field>
      </div>
      <Field label="How they learned" htmlFor="how"><Select id="how" value={form.howLearned} onChange={set('howLearned')}><option value="apprenticeship">Apprenticeship</option><option value="family">From family</option><option value="self_taught">Taught themselves</option><option value="college">College or training centre</option><option value="other">Other</option></Select></Field>
      <Checkbox checked={form.consent} onChange={set('consent')} label="I explained the consent statement and the artisan agreed" description="What is collected, what is public, how clients are contacted, and that they can delete their account at any time." />
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" loading={busy} disabled={!form.consent} className="self-start">Create passport</Button>
    </form>
  );
}
