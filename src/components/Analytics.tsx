"use client";

/**
 * Analytics script loader — GA4 (gtag.js) + Meta Pixel (fbq), with Google
 * Consent Mode v2.
 *
 * Two different privacy postures, on purpose:
 *
 *  - GA4 loads on EVERY page for EVERY visitor. Before it can write cookies
 *    it is put into Consent Mode "denied" by default, which makes gtag send
 *    cookieless, aggregated pings instead of identifying hits. Google uses
 *    those to model traffic + conversions, so GA fills with data immediately
 *    (the dashboard stops saying "No data received") without dropping a
 *    tracking cookie on a non-consenting user. When the visitor taps "Allow
 *    analytics" we upgrade consent to "granted" and the same session becomes
 *    fully measured. This is Google's prescribed DPDP/GDPR-safe pattern.
 *
 *  - Meta Pixel (fbq) still loads ONLY after explicit consent, because Meta
 *    has no equivalent cookieless mode and the Pixel + our CAPI relay share
 *    identifying data with a foreign processor. That stays strictly opt-in.
 *
 * The default consent state is read from localStorage inside the inline init
 * script itself (not via React state) so it is correct on the very first
 * hit for returning consenters AND ordered before gtag('config') in the
 * dataLayer — order matters for Consent Mode.
 */

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import { trackPageView } from "@/lib/analytics-client";
import { trackFunnel } from "@/lib/funnel-client";

const CONSENT_KEY = "prc_consent";

export default function Analytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;
  const pathname = usePathname();
  const sp = useSearchParams();

  // `granted` only gates the Meta Pixel (and the fbq/CAPI calls inside
  // analytics-client). GA itself always loads — Consent Mode handles its
  // cookie posture.
  const [granted, setGranted] = useState(false);

  // Read consent on mount + listen for the banner's accept event. On accept
  // we (a) flip `granted` so the Pixel mounts, and (b) push a Consent Mode
  // "update" so gtag upgrades the current session from cookieless to full.
  useEffect(() => {
    const grant = () => {
      window.gtag?.("consent", "update", {
        ad_storage: "granted",
        analytics_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
      });
      // fbq's typed signature only covers init/track; consent is a valid
      // runtime command, so call through an untyped reference.
      (window.fbq as ((...args: unknown[]) => void) | undefined)?.(
        "consent",
        "grant",
      );
    };
    const stored = window.localStorage?.getItem(CONSENT_KEY);
    if (stored === "accepted") setGranted(true);
    const onConsent = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === "accepted") {
        setGranted(true);
        grant();
      }
    };
    window.addEventListener("prc:consent", onConsent as EventListener);
    return () => window.removeEventListener("prc:consent", onConsent as EventListener);
  }, []);

  // Fire page_view on client-side route changes. gtag's config already sends
  // the first page_view (cookieless or full per consent); this covers SPA
  // navigations. trackPageView fires gtag for everyone and Pixel/CAPI only
  // when consented, so no `granted` guard here.
  useEffect(() => {
    // Skip the very first run — script init covers it.
    const t = setTimeout(() => trackPageView(pathname ?? "/"), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, sp?.toString()]);

  // First-party funnel page_view — fires for EVERY visitor (no consent gate),
  // including the initial load. This is the funnel's top-of-line denominator.
  useEffect(() => {
    trackFunnel("page_view", {}, { path: pathname ?? "/" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {/* Google Analytics 4 (gtag.js) + Consent Mode v2 — loads for everyone
          when NEXT_PUBLIC_GA_ID is set. The consent default is read from
          localStorage so returning consenters start "granted"; everyone else
          starts "denied" (cookieless modeled data). */}
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
              var __g = 'denied';
              try { if (localStorage.getItem('${CONSENT_KEY}') === 'accepted') __g = 'granted'; } catch(e) {}
              gtag('consent', 'default', {
                ad_storage: __g,
                analytics_storage: __g,
                ad_user_data: __g,
                ad_personalization: __g,
                functionality_storage: 'granted',
                security_storage: 'granted',
                wait_for_update: 500
              });
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

      {/* Meta Pixel — opt-in only (loads after consent). Auto-fires PageView
          on init; subsequent events come from analytics-client (Pixel+CAPI,
          both consent-gated). */}
      {granted && pixelId && (
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

      {/* Microsoft Clarity — heatmaps + session recordings + scroll/bounce.
          Records the session, so it's opt-in only (loads after consent), same
          posture as the Meta Pixel. Activates automatically once
          NEXT_PUBLIC_CLARITY_ID is set in the env — no code change needed. */}
      {granted && clarityId && (
        <Script id="clarity-init" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;
              t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${clarityId}");
          `}
        </Script>
      )}
    </>
  );
}
