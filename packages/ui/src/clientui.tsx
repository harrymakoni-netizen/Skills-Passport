'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from './cx';

// ------------------------------------------------------------------ Tabs

export function Tabs({ tabs, value, onChange, label }: { tabs: { id: string; label: string; count?: number }[]; value: string; onChange: (id: string) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-rule">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={t.id === value}
          onClick={() => onChange(t.id)}
          className={cx(
            '-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors duration-150',
            t.id === value ? 'border-ink-900 text-ink-900' : 'border-transparent text-muted hover:text-text',
          )}
        >
          {t.label}
          {typeof t.count === 'number' ? <span className="rounded-sm bg-sunk px-1.5 font-mono text-xs tabular text-muted">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Dialog

export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx('m-auto w-[calc(100%-2rem)] rounded-lg border border-rule bg-raised p-0 text-text shadow-overlay backdrop:bg-ink-950/40 open:animate-rise', wide ? 'max-w-2xl' : 'max-w-md')}
    >
      <div className="flex items-center justify-between border-b border-rule px-5 py-3">
        <h2 className="font-semibold">{title}</h2>
        <button type="button" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-md text-muted hover:text-text" aria-label="Close">
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer ? <div className="flex justify-end gap-2 border-t border-rule px-5 py-3">{footer}</div> : null}
    </dialog>
  );
}

// ------------------------------------------------------------------ Toast

type ToastItem = { id: number; text: string; tone: 'neutral' | 'success' | 'danger' };
const ToastCtx = createContext<(text: string, tone?: ToastItem['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone: ToastItem['tone'] = 'neutral') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto flex min-h-11 max-w-md items-center gap-2 rounded-md border px-4 text-sm shadow-overlay animate-rise',
              t.tone === 'success' ? 'border-success/25 bg-raised text-success' : t.tone === 'danger' ? 'border-danger/30 bg-raised text-danger' : 'border-rule bg-ink-900 text-paper',
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
