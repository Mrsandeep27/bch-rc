/** Skeleton mirroring the Overview layout: KPI row → chart → two-up breakdown. */
export default function AnalyticsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between gap-3">
        <div className="h-8 w-40 rounded-lg bg-brand-line/60" />
        <div className="h-9 w-56 rounded-full bg-brand-line/60" />
      </div>

      <div className="h-9 w-full max-w-md rounded-lg bg-brand-line/40" />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-brand-line bg-white p-4">
            <div className="h-3 w-16 rounded bg-brand-line/60" />
            <div className="mt-3 h-6 w-24 rounded bg-brand-line/60" />
            <div className="mt-2 h-3 w-14 rounded bg-brand-line/40" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-brand-line bg-white">
        <div className="border-b border-brand-line px-5 py-3.5">
          <div className="h-4 w-36 rounded bg-brand-line/60" />
        </div>
        <div className="h-[240px] m-5 rounded-xl bg-brand-line/30" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-brand-line bg-white">
            <div className="border-b border-brand-line px-5 py-3.5">
              <div className="h-4 w-32 rounded bg-brand-line/60" />
            </div>
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-10 rounded-lg bg-brand-line/30" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
