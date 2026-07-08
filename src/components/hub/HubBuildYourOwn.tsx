import { ArrowRight } from "lucide-react";
import { waLink } from "@/lib/theme";
import { WhatsAppIcon } from "@/components/BrandIcons";

/**
 * Hub — Build your own PRC (section 12). Lightweight "coming soon" teaser for
 * the future customiser (body · colour · wheels · decals). Its real job today
 * is lead capture: a WhatsApp "early access" CTA that drops warm leads into the
 * telecaller pipeline. The full live configurator is a later build.
 */
const STEPS = ["Body", "Colour", "Wheels", "Decals"];

export default function HubBuildYourOwn() {
  return (
    <section aria-labelledby="hub-build" className="bg-white py-8 sm:py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-brand-ink px-5 py-8 text-center text-white shadow-lg sm:px-10 sm:py-16">
          {/* soft red glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-brand-red/25 blur-3xl"
          />

          <div className="relative">
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.3em] text-white/80 ring-1 ring-white/15">
              Coming soon
            </span>
            <h2 id="hub-build" className="mt-4 font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
              Build your own PRC
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-white/70 sm:text-base">
              Design a car that&apos;s one of a kind — choose the body, colour, wheels and decals. We&apos;re building the customiser now.
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-2 gap-y-3">
              {STEPS.map((s, i) => (
                <span key={s} className="inline-flex items-center gap-2">
                  <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90">
                    {s}
                  </span>
                  {i < STEPS.length - 1 && <ArrowRight size={14} className="text-white/30" aria-hidden />}
                </span>
              ))}
            </div>

            <a
              href={waLink("Hi! I want early access to Build-Your-Own PRC — please notify me when it launches.")}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-whatsapp-green px-7 py-3.5 text-base font-semibold text-white shadow-lg animate-heartbeat"
            >
              <WhatsAppIcon size={18} />
              Get early access
            </a>
            <p className="mt-3 text-xs text-white/40">We&apos;ll WhatsApp you the moment it&apos;s live.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
