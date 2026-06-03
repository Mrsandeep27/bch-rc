import type { HeroVariant } from "@/lib/copy";

/**
 * Map a utm_source value to a hero copy variant. Server-callable (no client
 * hooks) so the page can SSR the right copy from the start.
 */
export function getVariantFromSource(source: string | null): HeroVariant {
  switch (source) {
    case "ig_gift":
      return "gift";
    case "ig_couple":
      return "couple";
    case "ig_parent":
      return "parent";
    case "ig_carride":
      return "carride";
    case "ig_drift":
    case "yt_drift":
      return "enthusiast";
    default:
      return "default";
  }
}
