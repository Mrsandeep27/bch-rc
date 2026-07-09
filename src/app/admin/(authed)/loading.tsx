/**
 * Route-level loading skeleton for every admin page. Next renders this instantly
 * on navigation while the force-dynamic server components run their queries, so
 * the shell never shows a blank content area. Neutral enough to stand in for a
 * dashboard, a table, or a detail page.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading">
      {/* Title */}
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-lg bg-brand-cream" />
        <div className="h-4 w-72 rounded bg-brand-cream" />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-brand-line bg-white p-4">
            <div className="h-3 w-16 rounded bg-brand-cream" />
            <div className="mt-3 h-6 w-24 rounded-lg bg-brand-cream" />
            <div className="mt-2 h-3 w-20 rounded bg-brand-cream" />
          </div>
        ))}
      </div>

      {/* Content block */}
      <div className="rounded-2xl border border-brand-line bg-white overflow-hidden">
        <div className="border-b border-brand-line px-5 py-4">
          <div className="h-4 w-40 rounded bg-brand-cream" />
        </div>
        <div className="divide-y divide-brand-line">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <div className="h-9 w-9 shrink-0 rounded-lg bg-brand-cream" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-1/3 rounded bg-brand-cream" />
                <div className="h-3 w-1/4 rounded bg-brand-cream" />
              </div>
              <div className="h-4 w-16 rounded bg-brand-cream" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
