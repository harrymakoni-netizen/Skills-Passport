import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cx } from './cx';

// ------------------------------------------------------------------ Button

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 select-none whitespace-nowrap';
const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-ink-900 text-paper hover:bg-ink-800 active:bg-ink-950',
  secondary: 'bg-raised text-text border border-rule-strong hover:border-ink-700 hover:text-ink-900',
  ghost: 'text-ink-900 hover:bg-ink-50',
  danger: 'bg-raised text-danger border border-danger/40 hover:bg-danger-50',
};
const buttonSizes = { md: 'min-h-11 px-4 text-sm', sm: 'min-h-9 px-3 text-sm', lg: 'min-h-12 px-5 text-base' } as const;

export function buttonClass(variant: ButtonVariant = 'primary', size: keyof typeof buttonSizes = 'md', className?: string) {
  return cx(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: keyof typeof buttonSizes; loading?: boolean }) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={loading || rest.disabled} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden /> : null}
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ Form fields

export function Field({ label, hint, error, htmlFor, children, optional }: { label: string; hint?: string; error?: string | null; htmlFor: string; children: ReactNode; optional?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-text">
        {label}
        {optional ? <span className="ml-1.5 font-normal text-muted">{optional}</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const control =
  'w-full rounded-sm border border-rule-strong bg-raised px-3 text-base text-text placeholder:text-faint transition-colors duration-150 hover:border-muted focus:border-ink-700 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ink-700 aria-[invalid=true]:border-danger';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(control, 'min-h-11', className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(control, 'min-h-24 py-2.5 leading-6', className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cx(control, 'min-h-11 appearance-none pr-9', className)} {...rest}>
        {children}
      </select>
      <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted">
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

export function Checkbox({ label, description, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: string }) {
  return (
    <label className={cx('flex min-h-11 cursor-pointer items-start gap-3 py-2', className)}>
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-sm border-rule-strong accent-ink-900" {...rest} />
      <span className="flex flex-col">
        <span className="text-sm font-semibold text-text">{label}</span>
        {description ? <span className="text-sm text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

// ------------------------------------------------------------------ Badges

type Tone = 'neutral' | 'ink' | 'success' | 'warning' | 'danger' | 'accent';
const tones: Record<Tone, string> = {
  neutral: 'bg-sunk text-muted border-rule',
  ink: 'bg-ink-50 text-ink-900 border-ink-100',
  success: 'bg-success-50 text-success border-success/20',
  warning: 'bg-warning-50 text-warning border-warning/25',
  danger: 'bg-danger-50 text-danger border-danger/20',
  accent: 'bg-accent-50 text-accent border-accent/25',
};

export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-xs font-semibold', tones[tone], className)}>
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

export type Level = 'starter' | 'bronze' | 'silver' | 'gold';
const levelStyle: Record<Level, string> = {
  starter: 'text-ink-900 border-ink-900/30 bg-raised',
  bronze: 'text-bronze border-bronze/45 bg-bronze-50',
  silver: 'text-silver border-silver/45 bg-silver-50',
  gold: 'text-gold border-gold/50 bg-gold-50',
};
const levelOnDark: Record<Level, string> = {
  starter: 'text-ink-100 border-ink-300/50',
  bronze: 'text-[#d9a77a] border-[#d9a77a]/60',
  silver: 'text-[#d3d8dc] border-[#d3d8dc]/60',
  gold: 'text-[#dcc07c] border-[#dcc07c]/60',
};

/** Engraved level badge: flat metallic tone, inner hairline rim, small caps — never shiny or yellow. */
export function LevelBadge({ level, label, onDark, size = 'md' }: { level: Level; label: string; onDark?: boolean; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cx(
        'relative inline-flex items-center justify-center rounded-sm border font-semibold uppercase',
        size === 'md' ? 'min-h-8 px-3 text-xs tracking-[0.18em]' : 'min-h-6 px-2 text-xs tracking-[0.14em]',
        onDark ? levelOnDark[level] : levelStyle[level],
      )}
    >
      <span className="pointer-events-none absolute inset-[2px] rounded-[2px] border border-current opacity-25" aria-hidden />
      {label}
    </span>
  );
}

// ------------------------------------------------------------------ Seal

/** A crisp circular seal for endorsements: ring of micro-text around the verifier's initials. */
export function Seal({ initials, label = 'SKILLS PASSPORT · ENDORSED · ', size = 64, title }: { initials: string; label?: string; size?: number; title?: string }) {
  const id = `seal-${initials.replace(/\W/g, '')}-${size}`;
  const ring = label.repeat(Math.max(1, Math.ceil(44 / label.length))).slice(0, 44);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={title ?? `Seal of ${initials}`} className="shrink-0 text-accent">
      <defs>
        <path id={id} d="M50 50 m-37 0 a37 37 0 1 1 74 0 a37 37 0 1 1 -74 0" />
      </defs>
      <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="50" cy="50" r="44.5" fill="none" stroke="currentColor" strokeWidth="0.6" />
      <circle cx="50" cy="50" r="29" fill="none" stroke="currentColor" strokeWidth="0.8" />
      {Array.from({ length: 36 }, (_, i) => {
        const a = (i / 36) * Math.PI * 2;
        return <line key={i} x1={50 + Math.cos(a) * 29} y1={50 + Math.sin(a) * 29} x2={50 + Math.cos(a) * 31} y2={50 + Math.sin(a) * 31} stroke="currentColor" strokeWidth="0.6" />;
      })}
      <text fontSize="7.4" letterSpacing="1.35" fill="currentColor" fontFamily="var(--font-sans)" fontWeight="600">
        <textPath href={`#${id}`}>{ring}</textPath>
      </text>
      <text x="50" y="57" textAnchor="middle" fontSize="20" fill="currentColor" fontFamily="var(--font-display)" fontWeight="600">
        {initials}
      </text>
    </svg>
  );
}

// ------------------------------------------------------------------ Layout pieces

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 border-b border-rule pb-5 md:flex-row md:items-end md:justify-between">
      <div className="flex max-w-2xl flex-col gap-1.5">
        {eyebrow ? <p className="smallcaps text-muted">{eyebrow}</p> : null}
        <h1 className="font-display text-xl font-semibold tracking-[-0.01em] text-text">{title}</h1>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({ children, className, title, actions }: { children: ReactNode; className?: string; title?: string; actions?: ReactNode }) {
  return (
    <section className={cx('rounded-lg border border-rule bg-raised', className)}>
      {title ? (
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-rule px-4">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Stat({ value, label, hint }: { value: ReactNode; label: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-xl font-medium tabular text-text">{value}</span>
      <span className="text-sm text-muted">{label}</span>
      {hint ? <span className="text-xs text-faint">{hint}</span> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cx('block rounded-sm bg-[linear-gradient(90deg,var(--color-sunk)_0%,var(--color-paper)_50%,var(--color-sunk)_100%)] bg-[length:200%_100%] animate-shimmer', className)} />;
}

export function EmptyState({ title, body, action, icon }: { title: string; body?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-rule-strong px-5 py-8">
      {icon ? <span className="text-muted">{icon}</span> : null}
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-text">{title}</p>
        {body ? <p className="max-w-prose text-sm text-muted">{body}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-danger/25 bg-danger-50 px-5 py-6">
      <p className="font-semibold text-danger">{title}</p>
      {body ? <p className="text-sm text-text">{body}</p> : null}
      {action}
    </div>
  );
}

// ------------------------------------------------------------------ Table

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('overflow-x-auto rounded-lg border border-rule bg-raised', className)}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}
export function TH({ children, className, sort, onSort }: { children?: ReactNode; className?: string; sort?: 'asc' | 'desc' | null; onSort?: () => void }) {
  return (
    <th scope="col" aria-sort={sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : undefined} className={cx('h-10 border-b border-rule bg-paper px-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-muted', className)}>
      {onSort ? (
        <button type="button" onClick={onSort} className="inline-flex items-center gap-1 uppercase tracking-[0.08em] hover:text-text">
          {children}
          <span aria-hidden className="text-faint">{sort === 'asc' ? '↑' : sort === 'desc' ? '↓' : '↕'}</span>
        </button>
      ) : (
        children
      )}
    </th>
  );
}
export function TD({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx('border-b border-rule px-3 py-2.5 align-middle', className)}>{children}</td>;
}

// ------------------------------------------------------------------ Passport header

/**
 * The flagship document header: ink panel with the engraved-line band, artisan name in the display serif, level badge,
 * and the passport number set like a document serial along the bottom edge.
 */
export function PassportHeader({
  label,
  name,
  meta,
  level,
  levelLabel,
  levelCaption,
  code,
  codeLabel,
  footer,
  photoUrl,
}: {
  label: string;
  name: string;
  meta: ReactNode;
  level: Level;
  levelLabel: string;
  levelCaption?: string;
  code: string;
  codeLabel: string;
  footer?: ReactNode;
  photoUrl?: string | null;
}) {
  return (
    <section className="relative overflow-hidden rounded-lg bg-ink-900 text-paper">
      <img src="/guilloche.svg" alt="" aria-hidden className="pointer-events-none absolute inset-0 size-full object-cover" />
      <div className="relative flex flex-col gap-8 px-5 pb-5 pt-5 md:px-8 md:pt-7">
        <div className="flex items-start justify-between gap-4">
          <p className="smallcaps text-ink-300">{label}</p>
          <div className="flex flex-col items-end gap-1.5">
            <LevelBadge level={level} label={levelLabel} onDark />
            {levelCaption ? <span className="text-xs text-ink-300">{levelCaption}</span> : null}
          </div>
        </div>
        <div className="flex items-end gap-4">
          {photoUrl ? <img src={photoUrl} alt="" width={72} height={72} className="size-18 shrink-0 rounded-md border border-ink-300/40 object-cover" /> : null}
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="font-display text-display font-semibold tracking-[-0.02em] text-paper">{name}</h1>
            <div className="text-base text-ink-100">{meta}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-t border-ink-300/25 pt-3">
          <div className="flex items-baseline gap-3">
            <span className="smallcaps text-ink-300">{codeLabel}</span>
            <span className="serial text-base text-paper">{code}</span>
          </div>
          {footer ? <div className="text-sm text-ink-300">{footer}</div> : null}
        </div>
      </div>
    </section>
  );
}
