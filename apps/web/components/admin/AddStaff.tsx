'use client';
import { useState } from 'react';
import { Button, Field, Input, Select } from '@sp/ui';
import { Dialog, useToast } from '@sp/ui/client';
import { call } from '@/lib/client';

export function AddStaff({ trades, areas }: { trades: { id: string; name: { en: string } }[]; areas: { id: string; name: string; city: string }[] }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ role: 'verifier', name: '', email: '', phone: '', password: '', tradeId: trades[0]?.id ?? '', areaId: areas[0]?.id ?? '', yearsExperience: '10' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Add person</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        wide
        title="Add a verifier or field agent"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await call('/admin/staff', { body: { role: f.role, name: f.name, email: f.email, phone: f.phone, password: f.password, tradeIds: f.role === 'verifier' ? [f.tradeId] : undefined, areaId: f.areaId, yearsExperience: Number(f.yearsExperience) } });
                  toast('Account created. They set up their authenticator at first sign-in.', 'success');
                  setOpen(false);
                  window.location.reload();
                } catch (e) {
                  toast((e as Error).message, 'danger');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Create account
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role" htmlFor="s-role"><Select id="s-role" value={f.role} onChange={set('role')}><option value="verifier">Verifier (master artisan)</option><option value="agent">Field agent</option></Select></Field>
          <Field label="Full name" htmlFor="s-name"><Input id="s-name" value={f.name} onChange={set('name')} /></Field>
          <Field label="Email" htmlFor="s-email"><Input id="s-email" type="email" value={f.email} onChange={set('email')} /></Field>
          <Field label="Phone" htmlFor="s-phone"><Input id="s-phone" inputMode="tel" value={f.phone} onChange={set('phone')} /></Field>
          <Field label="Temporary password" htmlFor="s-pw" hint="At least 10 characters."><Input id="s-pw" type="password" value={f.password} onChange={set('password')} /></Field>
          <Field label="Area" htmlFor="s-area"><Select id="s-area" value={f.areaId} onChange={set('areaId')}>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}, {a.city}</option>)}</Select></Field>
          {f.role === 'verifier' ? (
            <>
              <Field label="Trade" htmlFor="s-trade"><Select id="s-trade" value={f.tradeId} onChange={set('tradeId')}>{trades.map((t) => <option key={t.id} value={t.id}>{t.name.en}</option>)}</Select></Field>
              <Field label="Years in the trade" htmlFor="s-years"><Input id="s-years" inputMode="numeric" value={f.yearsExperience} onChange={set('yearsExperience')} /></Field>
            </>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
