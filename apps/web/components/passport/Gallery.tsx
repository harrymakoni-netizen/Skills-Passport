'use client';
import { useEffect, useState } from 'react';

export interface GalleryItem {
  id: string;
  url: string;
  thumb: string;
  width: number | null;
  height: number | null;
  caption: string;
  badge?: string;
}

/** Work gallery with a quiet full-screen viewer (keyboard and swipe friendly). */
export function Gallery({ items, labels }: { items: GalleryItem[]; labels: { close: string; prev: string; next: string } }) {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') setOpen((i) => (i === null ? i : (i + 1) % items.length));
      if (e.key === 'ArrowLeft') setOpen((i) => (i === null ? i : (i - 1 + items.length) % items.length));
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, items.length]);
  const cur = open === null ? null : items[open];
  return (
    <>
      <ul className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
        {items.map((it, i) => (
          <li key={it.id} className={i === 0 && items.length > 4 ? 'col-span-2 row-span-2' : ''}>
            <button type="button" onClick={() => setOpen(i)} className="group relative block w-full overflow-hidden rounded-md border border-rule bg-sunk text-left">
              <img src={it.thumb} alt={it.caption} width={480} height={480} loading={i < 2 ? 'eager' : 'lazy'} decoding="async" className="aspect-square w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.015]" />
              <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/55 to-transparent px-2.5 pb-2 pt-8 text-xs text-white">
                <span className="line-clamp-1">{it.caption}</span>
                {it.badge ? <span className="shrink-0 rounded-sm bg-white/90 px-1.5 py-0.5 font-semibold text-ink-900">{it.badge}</span> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {cur ? (
        <div role="dialog" aria-modal="true" aria-label={cur.caption} className="fixed inset-0 z-50 flex flex-col bg-[#0b0f0d]/95 animate-fade" onClick={() => setOpen(null)}>
          <div className="flex items-center justify-between px-4 py-3 text-sm text-white/80">
            <span className="tabular">
              {open! + 1} / {items.length}
            </span>
            <button type="button" className="inline-flex min-h-11 items-center px-3 text-white" onClick={() => setOpen(null)}>
              {labels.close}
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center px-2" onClick={(e) => e.stopPropagation()}>
            <img src={cur.url} alt={cur.caption} className="max-h-[78dvh] max-w-full rounded-sm object-contain" />
            {items.length > 1 ? (
              <>
                <button type="button" aria-label={labels.prev} onClick={() => setOpen((open! - 1 + items.length) % items.length)} className="absolute left-2 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
                  ‹
                </button>
                <button type="button" aria-label={labels.next} onClick={() => setOpen((open! + 1) % items.length)} className="absolute right-2 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
                  ›
                </button>
              </>
            ) : null}
          </div>
          <p className="px-4 pb-5 pt-3 text-center text-sm text-white/85">{cur.caption}</p>
        </div>
      ) : null}
    </>
  );
}
