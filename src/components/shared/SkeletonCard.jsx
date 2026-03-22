export default function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-border/50 bg-card p-3">
      <div className="mb-3 aspect-square rounded-xl bg-secondary" />
      <div className="space-y-2 px-1">
        <div className="h-3 w-3/4 rounded bg-secondary" />
        <div className="h-3 w-1/2 rounded bg-secondary" />
      </div>
    </div>
  );
}
