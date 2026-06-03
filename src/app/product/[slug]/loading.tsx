import { Skeleton, SkeletonText } from "@/components/Skeleton";

export default function ProductLoading() {
  return (
    <div className="min-h-screen flex flex-col" aria-busy="true" aria-label="Loading product">
      {/* Header strip */}
      <div className="h-16 sm:h-20 border-b border-neutral-200 flex items-center px-4 sm:px-10">
        <Skeleton className="h-8 w-32" />
      </div>

      {/* PDP layout: gallery + info side-by-side on desktop */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-10 py-6 sm:py-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gallery */}
        <div className="space-y-3">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </div>

        {/* Info column */}
        <div className="space-y-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-4/5" />
          <Skeleton className="h-5 w-1/3" />
          <div className="flex items-baseline gap-3">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-5 w-20" />
          </div>
          <SkeletonText lines={3} />
          {/* Variant chips */}
          <div className="flex gap-2 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-10 rounded-full" />
            ))}
          </div>
          {/* CTAs */}
          <div className="flex gap-3 pt-4">
            <Skeleton className="h-14 flex-1 rounded-full" />
            <Skeleton className="h-14 w-14 rounded-full" />
          </div>
          {/* Trust strip */}
          <div className="grid grid-cols-3 gap-3 pt-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
