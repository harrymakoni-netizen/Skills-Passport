import { t } from '@sp/core';
import { LevelBadge, type Level } from '@sp/ui';

export interface DirectoryItem {
  code: string;
  displayName: string;
  level: Level;
  trades: { code: string; name: { en: string } }[];
  area: string;
  city: string;
  countedJobs: number;
  clients: number;
  averageRating: number | null;
  endorsements: number;
  badges: string[];
  lastActive: string;
}

/** Directory rows: ruled list, figures aligned, level badge — calm and scannable. */
export function Results({ items, action }: { items: DirectoryItem[]; action?: (item: DirectoryItem) => React.ReactNode }) {
  return (
    <ul className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-raised">
      {items.map((a) => (
        <li key={a.code} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.4fr)_repeat(3,5.5rem)_auto] md:items-center md:gap-6">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <a href={`/p/${a.code}`} className="font-semibold text-ink-900 hover:underline">
                {a.displayName}
              </a>
              <LevelBadge level={a.level} label={t('en', `level.${a.level}`)} size="sm" />
              {a.badges.includes('women_in_trades') ? <span className="text-xs text-muted">Women in Trades</span> : null}
            </div>
            <p className="text-sm text-muted">
              {a.trades.map((x) => x.name.en).join(' · ')} · {a.area}, {a.city}
            </p>
            <p className="serial text-xs text-faint">{a.code}</p>
          </div>
          <Fig v={a.countedJobs} l="Jobs" />
          <Fig v={a.clients} l="Clients" />
          <Fig v={a.averageRating !== null ? a.averageRating.toFixed(1) : '—'} l="Rating" />
          <div className="flex gap-2 md:justify-end">{action ? action(a) : null}</div>
        </li>
      ))}
    </ul>
  );
}

function Fig({ v, l }: { v: React.ReactNode; l: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 md:flex md:flex-col md:items-start md:gap-0">
      <span className="font-mono tabular">{v}</span>
      <span className="text-xs text-muted">{l}</span>
    </span>
  );
}
