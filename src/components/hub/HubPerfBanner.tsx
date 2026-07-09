import Image from "next/image";
import Link from "next/link";

/**
 * Hub — Pocket Performance promo banner (sits right after Categories). A
 * full-bleed, pre-designed banner (headline, feature icons and spec bar are
 * baked into the art), so the whole band is one clickable image that funnels
 * into the Mini store.
 *
 * Asset: /public/landing/perf-banner.webp (1672 × 941, 16:9).
 */
export default function HubPerfBanner() {
  return (
    <section aria-label="Pocket Performance Series" className="bg-black">
      <Link
        href="/hub/shop/mini64"
        aria-label="Shop the Pocket Performance Series"
        className="group block overflow-hidden"
      >
        <Image
          src="/landing/perf-banner-v2.webp"
          alt="Pocket Performance Series — built to dominate, made to thrill. All-terrain ready, high-traction tyres, adjustable suspension, durable build. 2.4 GHz remote, long battery life, high-speed performance."
          width={1672}
          height={941}
          sizes="100vw"
          className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.02]"
        />
      </Link>
    </section>
  );
}
