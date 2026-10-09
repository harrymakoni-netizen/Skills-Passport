'use client';
import { useState } from 'react';
import { Button } from '@sp/ui';
import { Dialog, Tabs, ToastProvider, useToast } from '@sp/ui/client';

function Inner() {
  const [tab, setTab] = useState('open');
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return (
    <div className="flex flex-col gap-4">
      <Tabs label="Example" value={tab} onChange={setTab} tabs={[{ id: 'open', label: 'Open', count: 3 }, { id: 'upheld', label: 'Upheld' }, { id: 'cleared', label: 'Cleared' }]} />
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setOpen(true)}>Open dialog</Button>
        <Button variant="secondary" onClick={() => toast('Review saved — the artisan has been told', 'success')}>Show toast</Button>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Request a practical demonstration" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => setOpen(false)}>Send request</Button></>}>
        <p className="text-sm text-muted">Dialogs use the native dialog element: focus is trapped and Escape closes.</p>
      </Dialog>
    </div>
  );
}

export function DesignInteractive() {
  return (
    <ToastProvider>
      <Inner />
    </ToastProvider>
  );
}
