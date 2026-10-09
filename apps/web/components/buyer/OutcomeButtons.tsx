'use client';
import { useState } from 'react';
import { Badge, Button } from '@sp/ui';
import { call } from '@/lib/client';

export function OutcomeButtons({ id, outcome }: { id: string; outcome: string }) {
  const [value, setValue] = useState(outcome);
  if (value === 'hired') return <Badge tone="success">Hired</Badge>;
  if (value === 'not_hired') return <Badge>Did not happen</Badge>;
  const set = async (hired: boolean) => {
    await call(`/work-requests/${id}/outcome`, { body: { hired } });
    setValue(hired ? 'hired' : 'not_hired');
  };
  return (
    <div className="flex gap-1.5">
      <Button size="sm" variant="secondary" onClick={() => void set(true)}>Job happened</Button>
      <Button size="sm" variant="ghost" onClick={() => void set(false)}>Didn’t happen</Button>
    </div>
  );
}
