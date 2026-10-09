'use client';
import { useState } from 'react';
import { buttonClass } from '@sp/ui';

export function ShareBar({ url, text, labels }: { url: string; text: string; labels: { whatsapp: string; copy: string; copied: string } }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <a className={buttonClass('primary')} href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
        {labels.whatsapp}
      </a>
      <button
        type="button"
        className={buttonClass('secondary')}
        onClick={async () => {
          await navigator.clipboard?.writeText(url).catch(() => undefined);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? labels.copied : labels.copy}
      </button>
    </div>
  );
}
