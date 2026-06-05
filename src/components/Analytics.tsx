"use client";

/**
 * Analytics script loader — GA4 (gtag.js) + Meta Pixel (fbq).
 *
 * Both are loaded ONLY when:
 *  1. the relevant NEXT_PUBLIC_ env var is set (so this code is safe to
 *     merge before Syed gives the IDs — scripts simply don't fire)
 *  2. the visitor has accepted the ConsentBanner (prc_consent === "accepted")
 *
 * On a normal first visit the order is:
 *   - Page paints (no scripts).
 *   - ConsentBanner shows after the first client effect.
 *   - User taps "Allow analytics" → dispatch prc:consent CustomEvent.
 *   - This component receives the event, sets `granted=true`, the JSX
 *     gates flip from null to the <Script> tags, and gtag/fbq load.
 *   - We also fire the initial PageView/page_view event ourselves, since
 *     the browser navigation that brought the user in had already
 *     completed before consent was granted.
 *
 * Route changes after consent fire trackPageView() from the usePathname
 * effect below.
 */

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import { trackPageView } from "@/lib/analytics-client";

const CONSENT_KEY = "prc_consent";

export default function Analytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const pathname = usePathname();
  const sp = useSearchParams();

  const [granted, setGranted] = useState(false);

  // Read consent on mount (avoids SSR mismatch by deferring to effect).
  useEffect(() => {
    const stored = window.localStorage?.getItem(CONSENT_KEY);
    if (stored === "accepted") setGranted(true);
    const onConsent = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === "accepted") setGranted(true);
    };
    window.addEventListener("prc:consent", onConsent as EventListener);
    return () => window.removeEventListener("prc:consent", onConsent as EventListener);
  }, []);

  // Fire page_view on route change once consent is granted. Pixel + gtag
  // both auto-fire their own PageView on script load (the initial one), so
  // this only matters for client-side route transitions after that.
  useEffect(() => {
    if (!granted) return;
    // Skip the very first run — script init covers it.
    const t = setTimeout(() => trackPageView(pathname ?? "/"), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, sp?.toString(), granted]);

  if (!granted) return null;

  return (
    <>
      {/* Google Analytics 4 (gtag.js) — Only loads when NEXT_PUBLIC_GA_ID
          is set. The init script is small + idempotent; the network request
          for gtag.js itself defers until after-interactive. */}
      {gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="gtag-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${gaId}', {
                send_page_view: true,
                anonymize_ip: true,
                cookie_flags: 'SameSite=Lax;Secure'
              });
            `}
          </Script>
        </>
      )}

      {/* Meta Pixel — auto-fires PageView on init. */}
      {pixelId && (
        <Script id="fbq-init" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}
