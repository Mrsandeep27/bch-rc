/**
 * Skeleton primitives — replaces blank screens / spinners with structure-aware
 * placeholders. Looks the same as the real layout so the user perceives
 * "page is loading" instead of "page is broken". `aria-hidden` because screen
 * readers should announce the loading state via the parent's `aria-busy`.
 */

import { cn } from "@/lib/utils";

type SkeletonProps = {
  className?: string;
  /** When true, no shimmer — use for very short flashes where animation is noise. */
  static?: boolean;
};

export function Skeleton({ className, static: isStatic }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-md bg-neutral-200/80",
        !isStatic && "animate-pulse",
        className,
      )}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-3",
            i === lines - 1 ? "w-3/5" : "w-full",
          )}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-neutral-200 bg-white p-4 space-y-3",
        className,
      )}
      aria-hidden
    >
      <Skeleton className="aspect-square w-full rounded-xl" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-9 w-full rounded-full" />
    </div>
  );
}

export function SkeletonGrid({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4",
        className,
      )}
      aria-busy="true"
      aria-label="Loading products"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonImage({ className }: { className?: string }) {
  return (
    <Skeleton
      className={cn(
        "aspect-square w-full rounded-2xl",
        className,
      )}
    />
  );
}

export function SkeletonAvatar({ className }: { className?: string }) {
  return (
    <Skeleton className={cn("h-10 w-10 rounded-full", className)} />
  );
}

/**
 * Full-page route skeleton — header strip, hero shape, content grid, footer.
 * Used as the default `loading.tsx` for route segments that don't have a
 * more specific skeleton.
 */
export function RouteSkeleton() {
  return (
    <div className="min-h-screen flex flex-col" aria-busy="true" aria-label="Loading">
      {/* Header */}
      <div className="h-16 sm:h-20 border-b border-neutral-200 flex items-center px-4 sm:px-10 gap-4">
        <Skeleton className="h-8 w-32" />
        <div className="ml-auto flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-10 py-10 space-y-8">
        <Skeleton className="h-10 sm:h-14 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
        <SkeletonGrid count={4} />
      </div>
    </div>
  );
}
