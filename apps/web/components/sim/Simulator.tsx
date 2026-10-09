'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { buttonClass } from '@sp/ui';
import { Phone } from './Phone';

const DEFAULTS = { artisan: '+263770000201', client: '+263770000301' };

/**
 * /dev/chat — the pitch-demo stage: the artisan's phone, the client's phone and the live public passport side by side.
 * Development only (middleware hides /dev in production).
 */
export function Simulator() {
  const [phones, setPhones] = useState(DEFAULTS);
  const [draft, setDraft] = useState(DEFAULTS);
  const [fixtures, setFixtures] = useState<{ photos: string[]; audio: string[] }>({ photos: [], audio: [] });
  const [passport, setPassport] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [ratingUrl, setRatingUrl] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/dev/fixtures').then((r) => r.json()).then(setFixtures).catch(() => undefined);
  }, []);

  const lookup = useCallback(async () => {
    const r = await fetch(`/api/dev/artisan?phone=${encodeURIComponent(phones.artisan)}`).then((x) => x.json()).catch(() => null);
    setPassport(r?.passportCode ?? null);
    const s = await fetch('/api/dev/state').then((x) => x.json()).catch(() => null);
    setRatingUrl(s?.latestJob?.ratingUrl ?? null);
  }, [phones.artisan]);

  useEffect(() => {
    void lookup();
  }, [lookup]);

  // When either phone receives a message, refresh the passport panel shortly after (levels recalculate async).
  const onActivity = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      void lookup();
      setFrameKey((k) => k + 1);
    }, 1200);
  }, [lookup]);

  async function reset() {
    await fetch('/api/dev/mock/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phones: [phones.artisan, phones.client] }) });
    setPhones({ ...phones });
    window.location.reload();
  }

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-30 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="" className="size-8" />
            <div className="flex flex-col leading-tight">
              <span className="font-display text-lg font-semibold">WhatsApp simulator</span>
              <span className="text-xs text-muted">Offline demo · mock channel · same pipeline as the real WhatsApp Cloud API</span>
            </div>
          </div>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPhones(draft);
            }}
          >
            <label className="flex flex-col text-xs text-muted">
              Artisan
              <input value={draft.artisan} onChange={(e) => setDraft({ ...draft, artisan: e.target.value })} className="min-h-9 w-40 rounded-sm border border-rule-strong bg-raised px-2 font-mono text-sm text-text" />
            </label>
            <label className="flex flex-col text-xs text-muted">
              Client
              <input value={draft.client} onChange={(e) => setDraft({ ...draft, client: e.target.value })} className="min-h-9 w-40 rounded-sm border border-rule-strong bg-raised px-2 font-mono text-sm text-text" />
            </label>
            <button type="submit" className={buttonClass('secondary', 'sm')}>
              Switch
            </button>
            <button type="button" onClick={() => void reset()} className={buttonClass('ghost', 'sm')}>
              Clear chats
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex max-w-[1240px] gap-6 overflow-x-auto px-4 py-6">
        <Phone key={`a-${phones.artisan}`} phone={phones.artisan} name="Artisan" role="Artisan’s phone" fixtures={fixtures} onActivity={onActivity} />
        <Phone key={`c-${phones.client}`} phone={phones.client} name="Client" role="Client’s phone" fixtures={fixtures} onActivity={onActivity} />
        <section className="flex min-w-[360px] flex-1 flex-col gap-2">
          <div className="flex items-baseline justify-between px-1">
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Public passport</span>
              <span className="font-mono text-xs text-muted">{passport ?? 'not created yet'}</span>
            </div>
            <div className="flex gap-3 text-xs">
              {ratingUrl ? (
                <a href={ratingUrl} target="_blank" rel="noreferrer" className="font-semibold text-ink-900 underline underline-offset-4">
                  Client rating page
                </a>
              ) : null}
              {passport ? (
                <a href={`/p/${passport}`} target="_blank" rel="noreferrer" className="font-semibold text-ink-900 underline underline-offset-4">
                  Open
                </a>
              ) : null}
            </div>
          </div>
          <div className="h-[680px] overflow-hidden rounded-lg border border-rule bg-raised">
            {passport ? (
              <iframe key={frameKey} src={`/p/${passport}`} title="Public passport" className="size-full" />
            ) : (
              <div className="flex size-full flex-col items-start justify-center gap-3 p-8">
                <p className="font-display text-lg font-semibold">The passport appears here</p>
                <p className="max-w-sm text-sm text-muted">
                  Send <span className="font-mono">Hi</span> from the artisan’s phone to start onboarding. Seeded examples:{' '}
                  <a className="underline" href="/p/SP-HRE-00001" target="_blank" rel="noreferrer">
                    SP-HRE-00001
                  </a>
                  ,{' '}
                  <a className="underline" href="/p/SP-HRE-00002" target="_blank" rel="noreferrer">
                    SP-HRE-00002
                  </a>
                  .
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
