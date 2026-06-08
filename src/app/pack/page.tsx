import Link from "next/link";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { Package, Truck, CheckCircle2 } from "lucide-react";
import { db } from "@/db";
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
 *               These are the daily list — print label, pack the box, click
 *               "Mark dispatched" once handed to the courier.
 *
 * AWB PENDING = status PAID, OR PACKED-without-awb.
 *               Shiprocket is still creating the AWB (~30 sec normally).
 *               Informational — no actions, just a "waiting" badge.
 *
 * DISPATCHED  = status SHIPPED, last 24 hours.
 *               Confirmation list, lets the employee verify they marked
 *               the right ones.
 */
const LIST_LIMIT = 200;
const DISPATCHED_WINDOW_HRS = 24;

async function loadTabData(tab: Tab) {
  const topackFilter = and(
    eq(orders.status, "PACKED"),
    sql`${orders.awbCode} is not null`,
  );
  const awbPendingFilter = sql`(${orders.status} = 'PAID') or (${orders.status} = 'PACKED' and ${orders.awbCode} is null)`;
  const dispatchedFilter = and(
    eq(orders.status, "SHIPPED"),
    gte(
      orders.shippedAt,
      new Date(Date.now() - DISPATCHED_WINDOW_HRS * 60 * 60 * 1000),
    ),
  );

  const countOf = async (filter: Parameters<typeof db.select>[0] extends never ? never : ReturnType<typeof and> | typeof awbPendingFilter) => {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(filter);
    return count;
  };

  const [topackCount, awbCount, dispatchedCount, rows] = await Promise.all([
    countOf(topackFilter),
    countOf(awbPendingFilter),
    countOf(dispatchedFilter),
    tab === "topack"
      ? db
          .select()
          .from(orders)
          .where(topackFilter)
          .orderBy(desc(orders.packedAt))
          .limit(LIST_LIMIT)
      : tab === "awb"
        ? db
            .select()
            .from(orders)
            .where(awbPendingFilter)
            .orderBy(desc(orders.paidAt))
            .limit(LIST_LIMIT)
        : db
            .select()
            .from(orders)
            .where(dispatchedFilter)
            .orderBy(desc(orders.shippedAt))
            .limit(LIST_LIMIT),
  ]);

  return { topackCount, awbCount, dispatchedCount, rows };
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

  const { topackCount, awbCount, dispatchedCount, rows } = await loadTabData(tab);

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
              showActions={tab === "topack"}
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
