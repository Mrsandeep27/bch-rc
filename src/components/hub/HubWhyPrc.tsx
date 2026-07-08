import { ShieldCheck, Factory, MessageCircle, Banknote } from "lucide-react";

/**
 * Hub — Why buy PRC (section 11). A 4-up differentiator strip. Every claim
 * mirrors a real store policy (7-day replacement, made in India / ships from
 * Bangalore, WhatsApp support, COD pan-India) — no invented guarantees.
 */
const WHY = [
  {
    Icon: ShieldCheck,
    title: "7-day replacement",
    desc: "Turns up damaged? WhatsApp a clip and a fresh one ships out.",
  },
  {
    Icon: Factory,
    title: "Made in India",
    desc: "Designed and shipped from our Bangalore warehouse.",
  },
  {
    Icon: MessageCircle,
    title: "Real support",
    desc: "WhatsApp us — actual humans, quick replies before & after you buy.",
  },
  {
    Icon: Banknote,
    title: "COD pan-India",
    desc: "Pay cash on delivery anywhere, or save ₹100 paying online.",
  },
];

export default function HubWhyPrc() {
  return (
    <section aria-labelledby="hub-why" className="bg-brand-cream py-8 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-4 text-center sm:mb-10">
          <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-brand-red">Why PRC</span>
          <h2 id="hub-why" className="mt-2 font-display text-2xl font-extrabold uppercase tracking-wide text-brand-ink sm:text-4xl">
            Why buy from <span className="text-brand-red">PRC</span>
          </h2>
        </div>

        {/* Mobile: all 4 in ONE compact row (icon + title, no desc). sm+: the
            full 2×2 / 4-up cards with descriptions. */}
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {WHY.map(({ Icon, title, desc }) => (
            <div
              key={title}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-brand-line bg-white p-2 text-center shadow-sm sm:gap-3 sm:rounded-2xl sm:p-6"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-red-soft text-brand-red sm:h-12 sm:w-12">
                <Icon className="h-4 w-4 sm:h-6 sm:w-6" />
              </span>
              <h3 className="font-display text-[10px] font-bold leading-tight text-brand-ink sm:text-lg">{title}</h3>
              <p className="hidden text-[13px] leading-relaxed text-brand-ink-soft sm:block sm:text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
