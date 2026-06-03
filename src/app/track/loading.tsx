import { Skeleton, SkeletonText } from "@/components/Skeleton";

export default function TrackLoading() {
  return (
    <div className="min-h-screen flex flex-col" aria-busy="true" aria-label="Loading tracker">
      <div className="h-16 sm:h-20 border-b border-neutral-200 flex items-center px-4 sm:px-10">
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="max-w-2xl w-full mx-auto px-4 sm:px-10 py-12 space-y-8">
        <div className="space-y-3 text-center">
          <Skeleton className="h-9 w-2/3 mx-auto" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 space-y-4">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
        <SkeletonText lines={4} />
      </div>
    </div>
  );
}
