'use client';
import { useEffect, useRef, useState } from 'react';
import { WaText, timeOf } from './format';
import type { Choice, Entry, In, Out } from './types';

const API = '/api/dev';

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

function mediaSrc(e: Entry): string | null {
  const m = e.message;
  if (!m || m.kind !== 'media') return null;
  return e.mediaUrl ?? ('url' in m.source ? m.source.url : `/media/${m.source.key}`);
}

/**
 * One simulated phone. Messages are rendered as WhatsApp would: text with *bold*, reply buttons under the bubble,
 * list messages that open a bottom sheet, template messages with quick replies, images and voice notes.
 */
export function Phone({ phone, name, role, fixtures, onActivity }: { phone: string; name: string; role: string; fixtures: { photos: string[]; audio: string[] }; onActivity?: () => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [text, setText] = useState('');
  const [sheet, setSheet] = useState<{ title: string; sections: { title?: string; rows: Choice[] }[] } | null>(null);
  const [attach, setAttach] = useState(false);
  const [typing, setTyping] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const count = useRef(0);

  useEffect(() => {
    count.current = 0;
    setEntries([]);
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`${API}/mock/chat/${encodeURIComponent(phone)}?since=${count.current}`);
        if (r.ok) {
          const data = (await r.json()) as { entries: Entry[]; unreachable: boolean };
          setUnreachable(data.unreachable);
          if (data.entries.length) {
            count.current += data.entries.length;
            setEntries((x) => [...x, ...data.entries]);
            if (data.entries.some((e) => e.direction === 'out')) {
              setTyping(false);
              onActivity?.();
            }
          }
        }
      } catch {
        /* api restarting */
      }
      if (!stop) setTimeout(tick, 700);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [phone, onActivity]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [entries.length, typing]);

  async function send(content: In, preview?: string) {
    setTyping(true);
    const r = await post<{ id: string }>('/mock/inbound', { from: phone, content });
    if (preview) setPreviews((p) => ({ ...p, [r.id]: preview }));
    setTimeout(() => setTyping(false), 8000);
  }

  async function sendFixture(path: string) {
    setAttach(false);
    const f = await post<{ providerMediaId: string; mimeType: string; previewUrl: string; durationSec?: number }>('/mock/fixture', { path });
    await send({ kind: 'media', mediaType: path.startsWith('photos') ? 'image' : 'audio', providerMediaId: f.providerMediaId, mimeType: f.mimeType, ...(f.durationSec ? { durationSec: f.durationSec } : {}) }, f.previewUrl);
  }

  async function sendFile(file: File) {
    setAttach(false);
    const r = await fetch(`${API}/mock/media`, { method: 'POST', headers: { 'content-type': file.type || 'application/octet-stream' }, body: file });
    const f = (await r.json()) as { providerMediaId: string; mimeType: string; previewUrl: string };
    const mediaType = file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : 'audio';
    await send({ kind: 'media', mediaType, providerMediaId: f.providerMediaId, mimeType: f.mimeType }, f.previewUrl);
  }

  return (
    <div className="flex w-[340px] shrink-0 flex-col gap-2">
      <div className="flex items-baseline justify-between px-1">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-text">{role}</span>
          <span className="font-mono text-xs tabular text-muted">{phone}</span>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={unreachable}
            onChange={async (e) => {
              setUnreachable(e.target.checked);
              await post('/mock/unreachable', { phone, unreachable: e.target.checked });
            }}
            className="accent-ink-900"
          />
          Not on WhatsApp
        </label>
      </div>
      <div className="relative flex h-[680px] flex-col overflow-hidden rounded-[30px] border-[7px] border-[#1d1f1e] bg-[#efeae2] shadow-overlay">
        {/* header */}
        <div className="flex items-center gap-3 bg-[#0e4334] px-3 pb-2.5 pt-3 text-white">
          <img src="/icon.svg" alt="" className="size-9 rounded-full bg-white/10 p-1" />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="flex items-center gap-1 text-[15px] font-semibold">
              Skills Passport
              <svg viewBox="0 0 16 16" className="size-3.5 text-[#25d366]" aria-label="Verified business">
                <circle cx="8" cy="8" r="7" fill="currentColor" />
                <path d="M5 8.2l2 2 4-4.2" stroke="#fff" strokeWidth="1.6" fill="none" />
              </svg>
            </span>
            <span className="text-xs text-white/70">{typing ? 'typing…' : `${name} · business account`}</span>
          </div>
        </div>
        {/* chat */}
        <div ref={scroller} className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-2.5 py-3 [background-image:radial-gradient(rgba(0,0,0,0.035)_1px,transparent_1px)] [background-size:14px_14px]">
          <div className="mx-auto mb-2 max-w-[85%] rounded-md bg-[#fff6c8] px-3 py-1.5 text-center text-[11px] leading-4 text-[#54656f]">
            Simulated chat. Messages go through the real webhook pipeline.
          </div>
          {entries.map((e) => (
            <Bubble key={e.id} entry={e} preview={previews[e.id]} src={mediaSrc(e)} onChoice={(c) => send({ kind: 'choice', id: c.id, title: c.title })} onList={(m) => setSheet({ title: m.buttonLabel, sections: m.sections })} />
          ))}
          {typing ? (
            <div className="self-start rounded-lg rounded-tl-none bg-white px-3 py-2 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-1.5 animate-pulse rounded-full bg-[#8696a0]" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </span>
            </div>
          ) : null}
        </div>
        {/* composer */}
        <form
          className="flex items-center gap-1.5 bg-[#f0f2f5] px-2 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            void send({ kind: 'text', text: text.trim() });
            setText('');
          }}
        >
          <button type="button" onClick={() => setAttach((a) => !a)} className="flex size-10 shrink-0 items-center justify-center rounded-full text-[#54656f] hover:bg-black/5" aria-label="Attach">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 11.5l-8.6 8.6a5 5 0 01-7.1-7.1l8.6-8.6a3.3 3.3 0 014.7 4.7l-8.6 8.6a1.7 1.7 0 01-2.4-2.4l7.9-7.9" />
            </svg>
          </button>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message" className="min-h-10 flex-1 rounded-full bg-white px-4 text-[15px] outline-none" />
          <button type="submit" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0e4334] text-white" aria-label="Send">
            <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
              <path d="M3 20.5l18-8.5L3 3.5v6.6l12 1.9-12 1.9z" />
            </svg>
          </button>
        </form>
        {/* attach sheet */}
        {attach ? (
          <div className="absolute inset-x-2 bottom-16 z-10 max-h-[60%] overflow-y-auto rounded-xl bg-white p-3 shadow-overlay animate-rise">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#54656f]">Sample photos</p>
            <div className="grid grid-cols-4 gap-1.5">
              {fixtures.photos.map((p) => (
                <button key={p} type="button" onClick={() => void sendFixture(p)} title={p} className="overflow-hidden rounded-md border border-black/10">
                  <img src={`/api/dev/fixture-file?path=${encodeURIComponent(p)}`} alt={p} className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
            <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wider text-[#54656f]">Voice notes</p>
            <div className="flex flex-wrap gap-1.5">
              {fixtures.audio.map((a) => (
                <button key={a} type="button" onClick={() => void sendFixture(a)} className="rounded-full border border-black/10 px-3 py-1.5 text-xs">
                  Voice note · {a.replace('audio/', '').replace('.wav', '')}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-black/5 pt-3">
              <label className="cursor-pointer rounded-full border border-black/10 px-3 py-1.5 text-xs">
                Upload a file
                <input type="file" accept="image/*,audio/*,video/*" className="hidden" onChange={(e) => e.target.files?.[0] && void sendFile(e.target.files[0])} />
              </label>
              <button
                type="button"
                className="rounded-full border border-black/10 px-3 py-1.5 text-xs"
                onClick={() => {
                  setAttach(false);
                  void send({ kind: 'location', lat: -17.9069, lng: 30.9691 });
                }}
              >
                Share location
              </button>
              <button
                type="button"
                className="rounded-full border border-black/10 px-3 py-1.5 text-xs"
                onClick={() => {
                  const num = window.prompt('Contact phone number', '077 000 0301');
                  setAttach(false);
                  if (num) void send({ kind: 'contact', phone: num, name: 'Client' });
                }}
              >
                Share contact
              </button>
            </div>
          </div>
        ) : null}
        {/* list sheet */}
        {sheet ? (
          <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/30 animate-fade" onClick={() => setSheet(null)}>
            <div className="max-h-[75%] overflow-y-auto rounded-t-2xl bg-white pb-3 animate-rise" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
                <button type="button" onClick={() => setSheet(null)} className="text-[#54656f]" aria-label="Close">
                  ✕
                </button>
                <span className="font-semibold">{sheet.title}</span>
                <span className="w-4" />
              </div>
              {sheet.sections.map((s, i) => (
                <div key={i}>
                  {s.title ? <p className="px-4 pt-3 text-xs font-semibold uppercase text-[#008069]">{s.title}</p> : null}
                  {s.rows.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setSheet(null);
                        void send({ kind: 'choice', id: r.id, title: r.title });
                      }}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#f5f6f6]"
                    >
                      <span className="flex flex-col">
                        <span className="text-[15px] text-[#111b21]">{r.title}</span>
                        {r.description ? <span className="text-[13px] text-[#667781]">{r.description}</span> : null}
                      </span>
                      <span className="size-4 shrink-0 rounded-full border-2 border-[#8696a0]" />
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Bubble({ entry, preview, src, onChoice, onList }: { entry: Entry; preview?: string; src: string | null; onChoice: (c: Choice) => void; onList: (m: Extract<Out, { kind: 'list' }>) => void }) {
  const mine = entry.direction === 'in';
  const time = timeOf(entry.at);
  const base = 'max-w-[84%] rounded-lg px-2.5 py-1.5 text-[14.2px] leading-[19px] text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]';
  if (mine) {
    const c = entry.inbound!;
    let body: React.ReactNode = null;
    if (c.kind === 'text') body = <WaText text={c.text} />;
    else if (c.kind === 'choice') body = <span className="italic text-[#3b4a54]">{c.title ?? c.id}</span>;
    else if (c.kind === 'media' && c.mediaType === 'image') body = preview ? <img src={preview} alt="" className="-mx-1 -mt-0.5 mb-1 max-h-56 rounded-md object-cover" /> : <span>Photo</span>;
    else if (c.kind === 'media') body = <VoiceNote seconds={c.durationSec} />;
    else if (c.kind === 'contact') body = <span>Contact: {c.name ?? 'Contact'} · {c.phone}</span>;
    else if (c.kind === 'location') body = <span>Location shared</span>;
    return (
      <div className={`${base} self-end rounded-tr-none bg-[#d9fdd3] animate-rise`}>
        {body}
        <span className="float-right ml-2 mt-1 text-[11px] text-[#667781]">
          {time} <span className="text-[#53bdeb]">✓✓</span>
        </span>
      </div>
    );
  }
  const m = entry.message!;
  const meta = <span className="float-right ml-2 mt-1 text-[11px] text-[#667781]">{time}</span>;
  const choiceBtns = (choices: Choice[]) => (
    <div className="mt-0.5 flex flex-col gap-0.5">
      {choices.map((c) => (
        <button key={c.id} type="button" onClick={() => onChoice(c)} className="min-h-10 rounded-lg bg-white text-[14px] font-medium text-[#027eb5] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] hover:bg-[#f5f6f6]">
          {c.title}
        </button>
      ))}
    </div>
  );
  return (
    <div className="flex max-w-[84%] flex-col self-start animate-rise">
      <div className={`${base} max-w-full rounded-tl-none bg-white`}>
        {m.kind === 'text' ? <WaText text={m.text} /> : null}
        {m.kind === 'buttons' || m.kind === 'list' ? <WaText text={m.body} /> : null}
        {m.kind === 'template' ? (
          <>
            <WaText text={m.preview} />
            <span className="mt-1 block text-[11px] text-[#667781]">Template · {m.template}</span>
          </>
        ) : null}
        {m.kind === 'media' ? (
          m.mediaType === 'image' && src ? (
            <>
              <img src={src} alt={m.caption ?? ''} className="-mx-1 -mt-0.5 mb-1 max-h-72 w-[calc(100%+0.5rem)] rounded-md bg-[#f7f4ee] object-contain" />
              {m.caption ? <WaText text={m.caption} /> : null}
            </>
          ) : (
            <>
              <VoiceNote src={src} />
              {m.caption ? <span className="block text-[12px] text-[#667781]">{m.caption}</span> : null}
            </>
          )
        ) : null}
        {meta}
        {m.kind === 'list' ? (
          <button type="button" onClick={() => onList(m)} className="mt-1.5 flex w-full items-center justify-center gap-1.5 border-t border-black/5 pt-2 text-[14px] font-medium text-[#027eb5]">
            ☰ {m.buttonLabel}
          </button>
        ) : null}
      </div>
      {m.kind === 'buttons' || m.kind === 'template' ? choiceBtns(m.buttons) : null}
    </div>
  );
}

function VoiceNote({ src, seconds }: { src?: string | null; seconds?: number }) {
  const bars = [4, 9, 6, 12, 8, 14, 10, 6, 11, 7, 13, 9, 5, 10, 8, 12, 6, 9, 4, 7];
  return (
    <span className="flex items-center gap-2 py-1">
      {src ? <audio src={src} controls className="h-8 w-56" /> : null}
      {!src ? (
        <>
          <span className="flex size-8 items-center justify-center rounded-full bg-[#0e4334] text-white">▶</span>
          <span className="flex items-center gap-[2px]">
            {bars.map((h, i) => (
              <span key={i} className="w-[3px] rounded-full bg-[#8696a0]" style={{ height: h * 1.4 }} />
            ))}
          </span>
          <span className="text-[12px] text-[#667781]">0:{String(seconds ?? 14).padStart(2, '0')}</span>
        </>
      ) : null}
    </span>
  );
}
