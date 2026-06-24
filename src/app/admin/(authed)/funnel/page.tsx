import { AlertTriangle, TrendingDown, Activity } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { getFunnelReport } from "@/lib/funnel-queries";
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
  await requireAdmin();
  const sp = await searchParams;
  const windowDays = Number(sp.window) || 7;
  const siteId = process.env.DEFAULT_SITE_ID ?? "prc";
  const report = await getFunnelReport(siteId, windowDays);

  const top = report.stages[0]?.visitors ?? 0;
  const paid = report.stages[report.stages.length - 1]?.visitors ?? 0;
  const overallConv = top > 0 ? (paid / top) * 100 : 0;
  const maxBar = Math.max(1, top);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink flex items-center gap-2">
            <Activity size={22} className="text-brand-red" /> Conversion funnel
          </h1>
          <p className="text-sm text-brand-ink-soft mt-1">
            Of everyone who visited, where they dropped off — and why.
          </p>
        </div>
        <FunnelWindowTabs />
      </div>

      {/* Headline conversion */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-brand-line p-4">
          <div className="text-2xl font-bold text-brand-ink">{top.toLocaleString("en-IN")}</div>
          <div className="text-xs text-brand-ink-soft mt-1">Visitors</div>
        </div>
        <div className="rounded-xl border border-brand-line p-4">
          <div className="text-2xl font-bold text-brand-ink">{paid.toLocaleString("en-IN")}</div>
          <div className="text-xs text-brand-ink-soft mt-1">Bought</div>
        </div>
        <div className="rounded-xl border border-brand-line p-4">
          <div className="text-2xl font-bold text-brand-red">{pct(overallConv)}</div>
          <div className="text-xs text-brand-ink-soft mt-1">Conversion</div>
        </div>
      </div>

      {/* Serviceability early-warning — the outage detector */}
      {report.serviceability.total > 0 && report.serviceability.blockedPct >= 40 && (
        <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 flex gap-3">
          <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <b>{pct(report.serviceability.blockedPct)} of pincode checks were rejected</b>{" "}
            ({report.serviceability.blocked} of {report.serviceability.total}). If this is high,
            checkout may be blocking real customers — check the pickup config and the
            blocked-pincodes list below.
          </div>
        </div>
      )}

      {/* Biggest leak callout */}
      {report.biggestLeak && report.biggestLeak.dropped > 0 && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 flex gap-3">
          <TrendingDown size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <b>Biggest drop-off:</b> {report.biggestLeak.dropped.toLocaleString("en-IN")} people
            left between <b>{report.biggestLeak.fromLabel}</b> and{" "}
            <b>{report.biggestLeak.toLabel}</b> (only {pct(report.biggestLeak.stepPct)} continued).
            Fix this step first.
          </div>
        </div>
      )}

      {/* The funnel */}
      <div className="mt-6 space-y-2">
        {report.stages.map((s, i) => {
          const widthPct = (s.visitors / maxBar) * 100;
          return (
            <div key={s.key} className="rounded-xl border border-brand-line overflow-hidden">
              <div className="relative">
                <div
                  className="absolute inset-y-0 left-0 bg-brand-red/10"
                  style={{ width: `${Math.max(widthPct, 2)}%` }}
                />
                <div className="relative flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-brand-ink-soft w-4">{i + 1}</span>
                    <span className="font-medium text-brand-ink">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <span className="font-bold text-brand-ink tabular-nums">
                      {s.visitors.toLocaleString("en-IN")}
                    </span>
                    {i > 0 && (
                      <span
                        className={`text-xs font-mono tabular-nums w-16 ${
                          s.stepPct < 50 ? "text-red-600" : "text-brand-ink-soft"
                        }`}
                        title="continued from previous step"
                      >
                        {pct(s.stepPct)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Why they leak: blocked pincodes + payment failures */}
      <div className="mt-8 grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="font-semibold text-brand-ink mb-2">Pincodes we rejected</h2>
          <p className="text-xs text-brand-ink-soft mb-3">
            Customers told &quot;no courier serves this pincode.&quot; A flood of these = a
            config/courier problem, not real unserviceable areas.
          </p>
          {report.blockedPincodes.length === 0 ? (
            <p className="text-sm text-brand-ink-soft">None — every pincode was serviceable. ✅</p>
          ) : (
            <div className="rounded-xl border border-brand-line divide-y divide-brand-line">
              {report.blockedPincodes.map((p) => (
                <div key={p.pincode} className="flex justify-between px-3 py-2 text-sm">
                  <span className="font-mono text-brand-ink">{p.pincode}</span>
                  <span className="text-brand-ink-soft">
                    {p.visitors} {p.visitors === 1 ? "person" : "people"} · {p.checks} checks
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="font-semibold text-brand-ink mb-2">Payment failures</h2>
          <p className="text-xs text-brand-ink-soft mb-3">
            Reasons Razorpay reported when a payment failed at the modal.
          </p>
          {report.paymentFailures.length === 0 ? (
            <p className="text-sm text-brand-ink-soft">No reported payment failures. ✅</p>
          ) : (
            <div className="rounded-xl border border-brand-line divide-y divide-brand-line">
              {report.paymentFailures.map((f, i) => (
                <div key={i} className="flex justify-between px-3 py-2 text-sm gap-3">
                  <span className="text-brand-ink truncate">{f.reason}</span>
                  <span className="text-brand-ink-soft shrink-0">{f.n}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="mt-8 text-xs text-brand-ink-soft">
        Tracking started when this feature shipped — data builds up from now. Visitor counts are
        de-duplicated and exclude bots. Every step is recorded first-party (no consent needed, no
        personal data stored).
      </p>
    </div>
  );
}
