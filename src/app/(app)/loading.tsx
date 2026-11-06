/** Shown instantly inside the shell while the next page loads, so navigation never feels stuck. */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-3 w-48 rounded bg-hover mb-6" />
      <div className="h-9 w-80 max-w-full rounded bg-hover mb-3" />
      <div className="h-4 w-[28rem] max-w-full rounded bg-hover mb-8" />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card overflow-hidden">
            <div className="aspect-[16/10] bg-hover" />
            <div className="p-5 space-y-2.5">
              <div className="h-5 w-2/3 rounded bg-hover" />
              <div className="h-3 w-1/3 rounded bg-hover" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
