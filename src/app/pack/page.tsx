import Link from "next/link";
import {
  and,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { Package, Truck, CheckCircle2, AlertCircle } from "lucide-react";
import { db, withDbRetry, DatabaseUnavailableError } from "@/db";
import { orders } from "@/db/schema";
import { isPackAuthenticated } from "@/lib/pack-auth";
import { PackLoginForm } from "./PackLoginForm";
import { PackSignOut } from "./PackSignOut";
import { PackOrderRow } from "./PackOrderRow";
import { PackManifestActions } from "./PackManifestActions";

export const dynamic = "force-dynamic";

type Tab = "topack" | "awb" | "dispatched";

/**
 * /pack — three-section console for the packing employee.
 *
 * TO PACK     = status PACKED AND awb_code IS NOT NULL.
 * AWB PENDING = status PAID, OR PACKED-without-awb.
 *               (Shiprocket is still creating the AWB, ~30 sec normally.)
 * DISPATCHED  = status SHIPPED, last 24 hours.
 *
 * Why two batches instead of one Promise.all:
 *   The db pool is capped at max=3 per Lambda instance (see src/db/index.ts).
 *   A single Promise.all of 4 queries forces one to wait for a connection,
 *   which under cold-start serialises into 4-5s timeouts when the function
 *   is also negotiating the Supavisor pool. Splitting into [counts] + [rows]
 *   keeps every batch within the pool limit so all queries truly parallelise.
 *
 * Each call goes through withDbRetry so a transient Supavisor connection drop
 * (the "Connection closed" failure mode the db comment documents) becomes
 * one silent retry instead of a hung page.
 */
const LIST_LIMIT = 200;
const DISPATCHED_WINDOW_HRS = 24;

// Filters — typed drizzle helpers so enum comparisons auto-cast.
const topackFilter = and(
  eq(orders.status, "PACKED"),
  isNotNull(orders.awbCode),
);
const awbPendingFilter = or(
  eq(orders.status, "PAID"),
  and(eq(orders.status, "PACKED"), isNull(orders.awbCode)),
);
// dispatchedFilter is built per-request because it uses Date.now().

type LoadResult =
  | {
      ok: true;
      topackCount: number;
      awbCount: number;
      dispatchedCount: number;
      rows: Array<typeof orders.$inferSelect>;
    }
  | { ok: false; error: string };

async function loadTabData(tab: Tab): Promise<LoadResult> {
  const dispatchedFilter = and(
    eq(orders.status, "SHIPPED"),
    gte(
      orders.shippedAt,
      new Date(Date.now() - DISPATCHED_WINDOW_HRS * 60 * 60 * 1000),
    ),
  );

  const countOf = (filter: ReturnType<typeof and> | ReturnType<typeof or>) =>
    withDbRetry(
      () =>
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(orders)
          .where(filter)
          .then((r) => r[0]?.count ?? 0),
      "pack:countOf",
    );

  const rowsFor = (tab: Tab) => {
    if (tab === "topack") {
      return withDbRetry(
        () =>
          db
            .select()
            .from(orders)
            .where(topackFilter)
            .orderBy(desc(orders.packedAt))
            .limit(LIST_LIMIT),
        "pack:rows:topack",
      );
    }
    if (tab === "awb") {
      return withDbRetry(
        () =>
          db
            .select()
            .from(orders)
            .where(awbPendingFilter)
            .orderBy(desc(orders.paidAt))
            .limit(LIST_LIMIT),
        "pack:rows:awb",
      );
    }
    return withDbRetry(
      () =>
        db
          .select()
          .from(orders)
          .where(dispatchedFilter)
          .orderBy(desc(orders.shippedAt))
          .limit(LIST_LIMIT),
      "pack:rows:dispatched",
    );
  };

  try {
    // BATCH 1 — the active tab's full row list. Run first because it's the
    // page's content; if it succeeds we can render before the counts arrive.
    const rows = await rowsFor(tab);

    // BATCH 2 — three count(*) queries. The pool is max=3 so all three fit
    // in one parallel batch.
    const [topackCount, awbCount, dispatchedCount] = await Promise.all([
      countOf(topackFilter),
      countOf(awbPendingFilter),
      countOf(dispatchedFilter),
    ]);

    return { ok: true, topackCount, awbCount, dispatchedCount, rows };
  } catch (err) {
    const msg =
      err instanceof DatabaseUnavailableError
        ? "Database is temporarily unavailable. Refresh in a moment."
        : err instanceof Error
          ? err.message
          : "Failed to load.";
    return { ok: false, error: msg };
  }
}

export default async function PackPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  if (!(await isPackAuthenticated())) return <PackLoginForm />;

  const sp = await searchParams;
  const tab: Tab =
    sp.tab === "awb" ? "awb" : sp.tab === "dispatched" ? "dispatched" : "topack";

  const result = await loadTabData(tab);

  // Error state — render a clear failure UI instead of hanging in loading.tsx
  if (!result.ok) {
    return (
      <div className="min-h-screen bg-[#0b0b0c] text-white flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-red/15 text-brand-red mb-4">
            <AlertCircle size={24} />
          </div>
          <h1 className="font-display text-2xl font-bold">
            Can&rsquo;t load orders right now.
          </h1>
          <p className="text-sm text-white/60 mt-2">{result.error}</p>
          <Link
            href="/pack"
            className="mt-5 inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            Try again
          </Link>
        </div>
      </div>
    );
  }

  const { topackCount, awbCount, dispatchedCount, rows } = result;

  return (
    <div className="min-h-screen bg-[#0b0b0c] text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#0b0b0c]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package size={20} className="text-brand-red" />
            <div>
              <h1 className="font-display text-base font-bold leading-tight">
                Packing Console
              </h1>
              <p className="text-[10px] font-mono uppercase tracking-widest text-white/40 leading-tight">
                pocketrccars · pack & ship
              </p>
            </div>
          </div>
          <PackSignOut />
        </div>

        {/* Tabs */}
        <nav className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto">
          <TabLink href="/pack?tab=topack" active={tab === "topack"}>
            <Package size={13} /> To pack
            <Count n={topackCount} />
          </TabLink>
          <TabLink href="/pack?tab=awb" active={tab === "awb"}>
            <Truck size={13} /> AWB pending
            <Count n={awbCount} />
          </TabLink>
          <TabLink href="/pack?tab=dispatched" active={tab === "dispatched"}>
            <CheckCircle2 size={13} /> Dispatched
            <Count n={dispatchedCount} />
          </TabLink>
        </nav>
      </header>

      {/* Body */}
      <main className="max-w-5xl mx-auto px-4 py-5 space-y-3">
        {rows.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          rows.map((order) => (
            <PackOrderRow
              key={order.id}
              orderId={order.id}
              status={order.status}
              awbCode={order.awbCode}
              courierName={order.courierName}
              shippingAddress={
                order.shippingAddress as {
                  fullName: string;
                  phone: string;
                  city: string;
                  state: string;
                  pincode: string;
                }
              }
              items={
                order.items as Array<{
                  name: string;
                  qty: number;
                  image?: string | null;
                }>
              }
              paymentMethod={order.paymentMethod}
              totalInr={order.totalInr}
              packedAt={order.packedAt}
              shippedAt={order.shippedAt}
              showActions={tab !== "dispatched"}
            />
          ))
        )}
      </main>

      {/* Sticky footer — manifest + pickup actions when on the TO PACK tab */}
      {tab === "topack" && topackCount > 0 && (
        <PackManifestActions topackCount={topackCount} />
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors " +
        (active
          ? "text-white border-brand-red"
          : "text-white/60 hover:text-white border-transparent")
      }
    >
      {children}
    </Link>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-white/10 text-[10px] font-mono tabular-nums">
      {n}
    </span>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const messages: Record<Tab, { title: string; sub: string }> = {
    topack: {
      title: "All caught up.",
      sub: "No orders waiting to be packed. New orders appear here within ~30 seconds of payment.",
    },
    awb: {
      title: "No orders waiting for an AWB.",
      sub: "Shiprocket usually assigns within 30 sec. If something is stuck here for >5 min, check the orders log.",
    },
    dispatched: {
      title: "Nothing dispatched in the last 24 hours.",
      sub: "Switch to the To pack tab to start.",
    },
  };
  const m = messages[tab];
  return (
    <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
      <CheckCircle2 size={28} className="mx-auto text-white/40 mb-3" />
      <p className="font-semibold text-white">{m.title}</p>
      <p className="text-sm text-white/50 mt-1 max-w-md mx-auto">{m.sub}</p>
    </div>
  );
}
