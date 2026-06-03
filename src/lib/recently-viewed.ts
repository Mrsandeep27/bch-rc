/**
 * Recently-viewed SKU log. Standalone so the PDP can call `recordView` from
 * useEffect without pulling in the (much heavier) RecentlyViewed component
 * module. The component reads the same key when it lazy-mounts.
 */

export const RECENTLY_VIEWED_KEY = "prc-recently-viewed";
export const RECENTLY_VIEWED_MAX = 6;

export function recordView(skuId: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const next = [skuId, ...list.filter((id) => id !== skuId)].slice(
      0,
      RECENTLY_VIEWED_MAX,
    );
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  } catch {
    // localStorage may be unavailable (private mode / quota); silently no-op
  }
}
