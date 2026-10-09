'use client';
import { useState } from 'react';
import { Button, Field, Input, Select, Textarea } from '@sp/ui';
import { Dialog, useToast } from '@sp/ui/client';
import { call } from '@/lib/client';

export function RequestButton({ code, name, areas }: { code: string; name: string; areas: { id: string; name: string; city: string }[] }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ description: '', areaId: areas[0]?.id ?? '', preferredDates: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Request work</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Work request to ${name}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              loading={busy}
              disabled={form.description.trim().length < 10 || !form.preferredDates.trim()}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await call('/work-requests', { body: { passportCode: code, ...form } });
                  toast('Request sent on WhatsApp. You’ll see the reply under My work requests.', 'success');
                  setOpen(false);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Send request
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="What do you need done?" htmlFor={`d-${code}`}>
            <Textarea id={`d-${code}`} value={form.description} maxLength={500} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Install a 3 kVA backup system: inverter, two batteries and four panels." />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Area" htmlFor={`a-${code}`}>
              <Select id={`a-${code}`} value={form.areaId} onChange={(e) => setForm({ ...form, areaId: e.target.value })}>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}, {a.city}</option>)}
              </Select>
            </Field>
            <Field label="When" htmlFor={`w-${code}`}>
              <Input id={`w-${code}`} value={form.preferredDates} onChange={(e) => setForm({ ...form, preferredDates: e.target.value })} placeholder="Any weekday next week" />
            </Field>
          </div>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        </div>
      </Dialog>
    </>
  );
}
