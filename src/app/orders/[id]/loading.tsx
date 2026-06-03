import { Skeleton, SkeletonText } from "@/components/Skeleton";

export default function OrderLoading() {
  return (
    <div className="min-h-screen flex flex-col" aria-busy="true" aria-label="Loading order">
      <div className="h-16 sm:h-20 border-b border-neutral-200 flex items-center px-4 sm:px-10">
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="max-w-3xl w-full mx-auto px-4 sm:px-10 py-8 space-y-6">
        <div className="text-center space-y-3">
          <Skeleton className="h-16 w-16 rounded-full mx-auto" />
          <Skeleton className="h-8 w-2/3 mx-auto" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 space-y-4">
          <Skeleton className="h-5 w-1/3" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-20 w-20 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 space-y-3">
          <Skeleton className="h-5 w-1/3" />
          <SkeletonText lines={3} />
        </div>
      </div>
    </div>
  );
}
