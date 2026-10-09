import { Skeleton } from '@sp/ui';

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 pt-14 md:px-6">
      <Skeleton className="h-64 w-full rounded-lg" />
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="aspect-square" />
        ))}
      </div>
    </div>
  );
}
