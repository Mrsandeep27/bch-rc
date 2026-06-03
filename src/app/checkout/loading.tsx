import { Skeleton, SkeletonText } from "@/components/Skeleton";

export default function CheckoutLoading() {
  return (
    <div className="min-h-screen flex flex-col" aria-busy="true" aria-label="Loading checkout">
      <div className="h-16 sm:h-20 border-b border-neutral-200 flex items-center px-4 sm:px-10">
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="max-w-5xl w-full mx-auto px-4 sm:px-10 py-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        {/* Form column */}
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-3">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ))}
          <Skeleton className="h-14 w-full rounded-full" />
        </div>

        {/* Order summary sidebar */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4 h-fit">
          <Skeleton className="h-5 w-1/2" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-16 w-16 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
          <div className="border-t border-neutral-200 pt-3 space-y-2">
            <SkeletonText lines={3} />
          </div>
        </div>
      </div>
    </div>
  );
}
