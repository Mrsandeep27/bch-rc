import { Skeleton, SkeletonText } from "@/components/Skeleton";

export default function PolicyLoading() {
  return (
    <div className="min-h-screen flex flex-col" aria-busy="true" aria-label="Loading policy">
      <div className="h-16 sm:h-20 border-b border-neutral-200 flex items-center px-4 sm:px-10">
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="max-w-3xl w-full mx-auto px-4 sm:px-10 py-10 space-y-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <div className="space-y-4 pt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonText key={i} lines={4} />
          ))}
        </div>
      </div>
    </div>
  );
}
