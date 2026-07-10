import { AlertTriangle, TrendingDown, Info, Activity, ArrowDown } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { getFunnelReport } from "@/lib/funnel-queries";
import { clampPct, safePct } from "@/lib/analytics-validation";
import { FunnelWindowTabs } from "./FunnelWindowTabs";

export const dynamic = "force-dynamic";

function pct(x: number): string {
  return `${x.toFixed(x < 10 ? 1 : 0)}%`;
}

export default async function FunnelDashboard({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const ctx = await requireAdmin();
  const sp = await searchParams;
  const windowDays = Number(sp.window) || 7;

  // Single combined store — aggregate across every site this admin manages.
  const report = await getFunnelReport(ctx.siteIds, windowDays);

  const top = report.stages[0]?.visitors ?? 0;
  const paid = report.stages[report.stages.length - 1]?.visitors ?? 0;
  const overallConv = clampPct(safePct(paid, top));
  const maxBar = Math.max(1, top);
  const productStage = report.stages.find((s) => s.key === "product");
  // Coverage is low enough that the raw client-tracked stages materially
  // understate reality — show the adjusted numbers as primary and flag it.
  const lowCoverage = report.visitors > 0 && report.coveragePct < 90;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-ink flex items-center gap-2">
            <Activity size={22} className="text-brand-red" /> Conversion funnel
          </h1>
          <p className="text-sm text-brand-ink-soft mt-1">
            Of everyone who visited, where they dropped off — and why.
          </p>
        </div>
        <FunnelWindowTabs />
      </div>

      {/* Headline KPIs */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Kpi label="Visitors" value={top.toLocaleString("en-IN")} />
        <Kpi label="Bought" value={paid.toLocaleString("en-IN")} />
        <Kpi
          label="Conversion"
          value={pct(overallConv)}
          accent
          sub={top > 0 ? `${paid.toLocaleString("en-IN")} of ${top.toLocaleString("en-IN")}` : undefined}
        />
      </div>

      {/* Callouts */}
      <div className="space-y-3">
        {report.serviceability.total > 0 && report.serviceability.blockedPct >= 40 && (
          <Callout tone="red" icon={<AlertTriangle size={18} className="text-brand-red shrink-0 mt-0.5" />}>
            <b>{pct(report.serviceability.blockedPct)} of pincode checks were rejected</b>{" "}
            ({report.serviceability.blocked} of {report.serviceability.total}). If this is high,
            checkout may be blocking real customers — check the pickup config and the
            blocked-pincodes list below.
          </Callout>
        )}

        {report.anomalies.length > 0 && (
          <Callout tone="blue" icon={<Info size={18} className="text-blue-600 shrink-0 mt-0.5" />}>
            <b className="block">Tracking gap detected</b>
            {report.anomalies.map((a, i) => (
              <p key={i}>{a}</p>
            ))}
          </Callout>
        )}

        {report.visitors > 0 && report.coveragePct < 95 && (
          <Callout tone="blue" icon={<Info size={18} className="text-blue-600 shrink-0 mt-0.5" />}>
            <b className="block">
              Client-side events cover {Math.round(report.coveragePct)}% of visitors
            </b>
            <p>
              Steps 1, 5 and 6 are measured server-side (ad-blocker-proof) and match the
              Dashboard exactly. Steps 2–4 are only seen when the browser reports them, so{" "}
              <b>{(report.visitors - report.trackedVisitors).toLocaleString("en-IN")} visitors</b>{" "}
              are missing from them — part of the &ldquo;Viewed a product&rdquo; drop is
              tracking loss, not customer behaviour.
            </p>
            {productStage && (
              <p className="mt-1">
                Adjusted for that gap, your real{" "}
                <b>&ldquo;Viewed a product&rdquo; rate is ~{pct(productStage.adjustedFromTopPct)}</b>{" "}
                (the raw bar shows {pct(productStage.fromTopPct)}). The bars and %s below
                are coverage-adjusted estimates.
              </p>
            )}
          </Callout>
        )}

        {report.biggestLeak && report.biggestLeak.dropped > 0 && (
          <Callout tone="amber" icon={<TrendingDown size={18} className="text-amber-600 shrink-0 mt-0.5" />}>
            <b>Biggest drop-off:</b> {report.biggestLeak.dropped.toLocaleString("en-IN")} people
            left between <b>{report.biggestLeak.fromLabel}</b> and{" "}
            <b>{report.biggestLeak.toLabel}</b> (only {pct(report.biggestLeak.stepPct)} continued).
            Fix this step first.
          </Callout>
        )}
      </div>

      {/* The funnel */}
      <div className="rounded-2xl border border-brand-line bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-brand-line">
          <h2 className="font-semibold text-brand-ink">Funnel steps</h2>
          <span className="text-xs text-brand-ink-soft">
            Last {windowDays === 1 ? "24 h" : `${windowDays} days`} · distinct people
          </span>
        </div>
        <div className="p-3 sm:p-5 space-y-1.5">
          {report.stages.map((s, i) => {
            // Render the coverage-adjusted estimate as primary; on a
            // full-coverage day it equals the raw count anyway.
            const shown = s.adjustedVisitors;
            const widthPct = (shown / maxBar) * 100;
            const kept = i === 0 ? 100 : s.adjustedStepPct;
            const weak = i > 0 && kept < 50;
            const prevAdj = i > 0 ? report.stages[i - 1].adjustedVisitors : shown;
            const adjDropped = Math.max(0, prevAdj - shown);
            const corrected = s.clientTracked && s.adjustedVisitors !== s.visitors;
            return (
              <div key={s.key}>
                {/* Drop-off connector (people lost since the previous step) */}
                {i > 0 && adjDropped > 0 && (
                  <div className="flex items-center gap-1.5 pl-8 sm:pl-14 py-0.5 text-[11px] font-medium text-brand-red/70">
                    <ArrowDown size={11} />
                    <span className="tabular-nums">{adjDropped.toLocaleString("en-IN")} left</span>
                  </div>
                )}
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="grid place-items-center h-6 w-6 shrink-0 rounded-full bg-brand-cream text-[11px] font-bold tabular-nums text-brand-ink-soft">
                    {i + 1}
                  </span>
                  <span className="w-24 sm:w-44 shrink-0 text-sm font-medium text-brand-ink truncate">
                    {s.label}
                  </span>
                  <div className="relative h-8 sm:h-9 flex-1 rounded-lg bg-brand-cream overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r from-brand-red to-brand-red/65"
                      style={{ width: `${Math.max(widthPct, 2)}%` }}
                    />
                  </div>
                  <span
                    className="w-12 sm:w-20 text-right font-bold tabular-nums text-brand-ink text-sm"
                    title={corrected ? `raw beacon count: ${s.visitors.toLocaleString("en-IN")}` : undefined}
                  >
                    {shown.toLocaleString("en-IN")}
                    {corrected && <span className="text-brand-ink-soft font-normal">*</span>}
                  </span>
                  <span
                    className={`w-11 text-right text-xs font-semibold tabular-nums ${
                      i === 0 ? "text-brand-ink-soft/40" : weak ? "text-brand-red" : "text-success"
                    }`}
                    title="continued from the previous step (coverage-adjusted)"
                  >
                    {i === 0 ? "—" : pct(kept)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {lowCoverage && (
          <div className="px-4 sm:px-5 pb-3 text-[11px] text-brand-ink-soft">
            * Steps 2–4 are grossed up from {Math.round(report.coveragePct)}% beacon coverage to
            estimate real people. Hover a starred count for the raw number.
          </div>
        )}
      </div>

      {/* Why they leak */}
      <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
        <InsightCard
          title="Pincodes we rejected"
          hint="Customers told “no courier serves this pincode.” A flood of these = a config/courier problem, not real unserviceable areas."
        >
          {report.blockedPincodes.length === 0 ? (
            <Empty>None — every pincode was serviceable. ✅</Empty>
          ) : (
            <ul className="divide-y divide-brand-line">
              {report.blockedPincodes.map((p) => (
                <li key={p.pincode} className="flex justify-between px-4 sm:px-5 py-2.5 text-sm">
                  <span className="font-mono text-brand-ink">{p.pincode}</span>
                  <span className="text-brand-ink-soft tabular-nums">
                    {p.visitors} {p.visitors === 1 ? "person" : "people"} · {p.checks} checks
                  </span>
                </li>
              ))}
            </ul>
          )}
        </InsightCard>

        <InsightCard
          title="Payment failures"
          hint="Reasons Razorpay reported when a payment failed at the modal."
        >
          {report.paymentFailures.length === 0 ? (
            <Empty>No reported payment failures. ✅</Empty>
          ) : (
            <ul className="divide-y divide-brand-line">
              {report.paymentFailures.map((f, i) => (
                <li key={i} className="flex justify-between gap-3 px-4 sm:px-5 py-2.5 text-sm">
                  <span className="text-brand-ink truncate">{f.reason}</span>
                  <span className="text-brand-ink-soft shrink-0 tabular-nums">{f.n}</span>
                </li>
              ))}
            </ul>
          )}
        </InsightCard>
      </div>

      <p className="text-xs text-brand-ink-soft leading-relaxed">
        Tracking started when this feature shipped — data builds up from now. Every step counts
        distinct people, de-duplicated and excluding bots: the top steps are unique visitors
        (first-party cookies), and “Placed order”/“Paid” are unique buyers counted exactly from the
        orders ledger — so those two are ad-blocker-proof while the upper steps are not. A
        lower step reading higher than the one above it is flagged as a tracking gap above, not a
        real increase. Recorded first-party (no consent needed, no personal data stored).
      </p>
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-brand-line bg-white p-3 sm:p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-ink-soft">{label}</div>
      <div className={`mt-1 text-xl sm:text-2xl font-bold tabular-nums ${accent ? "text-brand-red" : "text-brand-ink"}`}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-brand-ink-soft mt-0.5 tabular-nums">{sub}</div>}
    </div>
  );
}

const CALLOUT_TONE: Record<"red" | "amber" | "blue", string> = {
  red: "border-brand-red/30 bg-brand-red/5 text-brand-red",
  amber: "border-amber-300 bg-amber-50 text-amber-900",
  blue: "border-blue-300 bg-blue-50 text-blue-900",
};

function Callout({ tone, icon, children }: { tone: "red" | "amber" | "blue"; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border p-3 sm:p-4 flex gap-3 text-sm ${CALLOUT_TONE[tone]}`}>
      {icon}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function InsightCard({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-line bg-white overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 border-b border-brand-line">
        <h2 className="font-semibold text-brand-ink">{title}</h2>
        <p className="text-xs text-brand-ink-soft mt-1">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm text-brand-ink-soft">{children}</p>;
}
