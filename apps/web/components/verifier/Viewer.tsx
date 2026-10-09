'use client';
import { useState } from 'react';
import { cx } from '@sp/ui';
import type { Detail } from './types';

/** Fast evidence viewer: large photo with click-to-zoom at the clicked point, filmstrip, video and voice notes. */
export function Viewer({ media }: { media: Detail['media'] }) {
  const photos = media.filter((m) => m.kind === 'photo_before' || m.kind === 'photo_after');
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const cur = photos[Math.min(i, photos.length - 1)];
  const video = media.find((m) => m.kind === 'video');
  return (
    <div className="flex flex-col gap-3">
      {cur ? (
        <div className="relative overflow-hidden rounded-lg border border-rule bg-[#11140f]">
          <img
            src={cur.url ?? cur.thumb ?? ''}
            alt={`${cur.kind === 'photo_before' ? 'Before' : 'After'} photo`}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setZoom(zoom ? null : { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
            }}
            style={zoom ? { transform: 'scale(2.2)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
            className={cx('mx-auto max-h-[52vh] w-full object-contain transition-transform duration-200 ease-out', zoom ? 'cursor-zoom-out' : 'cursor-zoom-in')}
          />
          <div className="pointer-events-none absolute left-3 top-3 flex gap-1.5">
            <span className="rounded-sm bg-black/60 px-1.5 py-0.5 text-xs font-semibold text-white">{cur.kind === 'photo_before' ? 'Before' : 'After'}</span>
            {cur.duplicate ? <span className="rounded-sm bg-danger px-1.5 py-0.5 text-xs font-semibold text-white">Duplicate of an earlier photo</span> : null}
            {cur.quality !== null && cur.quality < 0.4 ? <span className="rounded-sm bg-warning px-1.5 py-0.5 text-xs font-semibold text-white">Low quality</span> : null}
          </div>
          <span className="pointer-events-none absolute bottom-3 right-3 rounded-sm bg-black/60 px-1.5 py-0.5 font-mono text-xs text-white tabular">
            {i + 1}/{photos.length}
          </span>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-rule-strong px-4 py-10 text-center text-sm text-muted">No photos</p>
      )}
      {photos.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, n) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setI(n);
                setZoom(null);
              }}
              aria-label={`Photo ${n + 1}`}
              aria-pressed={n === i}
              className={cx('relative size-16 shrink-0 overflow-hidden rounded-md border-2', n === i ? 'border-ink-900' : 'border-transparent opacity-70 hover:opacity-100')}
            >
              <img src={p.thumb ?? p.url ?? ''} alt="" className="size-full object-cover" />
              <span className="absolute bottom-0 left-0 bg-black/60 px-1 text-[10px] text-white">{p.kind === 'photo_before' ? 'B' : 'A'}</span>
            </button>
          ))}
        </div>
      ) : null}
      {video?.url ? <video src={video.url} controls preload="metadata" className="w-full rounded-lg border border-rule bg-black" /> : null}
    </div>
  );
}
