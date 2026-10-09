import { Select, buttonClass } from '@sp/ui';

export function Filters({ action, trades, areas, value }: { action: string; trades: { code: string; name: { en: string } }[]; areas: { id: string; name: string; city: string }[]; value: Record<string, string | undefined> }) {
  return (
    <form action={action} method="get" className="grid gap-3 rounded-lg border border-rule bg-raised p-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Trade
        <Select name="trade" defaultValue={value.trade ?? ''}>
          <option value="">All trades</option>
          {trades.map((t) => (
            <option key={t.code} value={t.code}>
              {t.name.en}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Area
        <Select name="area" defaultValue={value.area ?? ''}>
          <option value="">All areas</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}, {a.city}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Level
        <Select name="level" defaultValue={value.level ?? ''}>
          <option value="">Any level</option>
          <option value="bronze">Bronze and above</option>
          <option value="silver">Silver and above</option>
          <option value="gold">Gold</option>
        </Select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Minimum rating
        <Select name="minRating" defaultValue={value.minRating ?? ''}>
          <option value="">Any rating</option>
          <option value="3.5">3.5 and above</option>
          <option value="4">4.0 and above</option>
          <option value="4.5">4.5 and above</option>
        </Select>
      </label>
      <button type="submit" className={buttonClass('primary')}>
        Search
      </button>
    </form>
  );
}
