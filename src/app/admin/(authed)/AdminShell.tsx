"use client";

/**
 * Shopify-style admin shell — ports the approved Artifact (admin-new-sections)
 * as ONE cohesive LIGHT theme: a white sidebar rail (grouped nav, active red-bar
 * highlight, live badges) on desktop, a slide-in drawer on mobile, and a white
 * topbar with the page title. The whole tree carries `.admin-shell`, which the
 * light theme in globals.css keys off. The server layout stays a server
 * component (auth + counts); icons live here because component refs can't cross
 * the server→client boundary.
 */

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Filter,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  Package,
  Percent,
  RotateCcw,
  Settings,
  ShoppingBag,
  Star,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { AdminSignOut } from "./AdminSignOut";

export type AdminCounts = {
  orders?: number;
  reviews?: number;
};

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  countKey?: keyof AdminCounts;
};

type NavGroup = { label: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    label: "Selling",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Orders", href: "/admin/orders", icon: Package, countKey: "orders" },
      { label: "Products", href: "/admin/products", icon: ShoppingBag },
      { label: "Customers", href: "/admin/customers", icon: Users },
      { label: "Discounts", href: "/admin/discounts", icon: Percent },
      { label: "Reviews", href: "/admin/reviews", icon: Star, countKey: "reviews" },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
      { label: "Funnel", href: "/admin/funnel", icon: Filter },
    ],
  },
  {
    label: "Money & ops",
    items: [
      { label: "Finance", href: "/admin/finance", icon: Wallet },
      { label: "Returns / RTO", href: "/admin/returns", icon: RotateCcw },
      { label: "Recovery", href: "/admin/recovery", icon: LifeBuoy },
      { label: "Activity", href: "/admin/activity", icon: Activity },
      { label: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap((g) => g.items);

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AdminShell({
  email,
  role,
  brandName,
  logo,
  counts,
  children,
}: {
  email: string;
  role: string;
  brandName: string;
  logo: string;
  counts: AdminCounts;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/admin";
  const [drawerOpen, setDrawerOpen] = useState(false);

  const title = ALL_ITEMS.find((i) => isActive(pathname, i.href))?.label ?? "Admin";

  const sidebar = (
    <SidebarContent
      pathname={pathname}
      counts={counts}
      brandName={brandName}
      logo={logo}
      email={email}
      role={role}
      onNavigate={() => setDrawerOpen(false)}
    />
  );

  return (
    <div className="admin-shell backend-ui min-h-screen">
      {/* Desktop sidebar — fixed, sticky, white rail */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-56 flex-col bg-white border-r border-brand-line text-brand-ink z-30">
        {sidebar}
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-white border-b border-brand-line text-brand-ink">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="p-2 -ml-2 rounded-lg text-brand-ink hover:bg-brand-ink/[0.06] transition-colors"
        >
          <Menu size={20} />
        </button>
        <Link href="/admin" className="flex items-center gap-2">
          <Image src={logo} alt={brandName} width={826} height={304} className="h-6 w-auto" priority />
          <span className="text-brand-red font-bold text-[11px] uppercase tracking-widest">Admin</span>
        </Link>
        <span className="w-9" aria-hidden />
      </header>

      {/* Mobile drawer + backdrop */}
      <div
        className={`lg:hidden fixed inset-0 z-40 transition-opacity duration-200 ${
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
        <aside
          className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] flex flex-col bg-white text-brand-ink shadow-2xl transition-transform duration-200 ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="absolute top-3 right-3 p-2 rounded-lg text-brand-ink-soft hover:text-brand-ink hover:bg-brand-ink/[0.06] transition-colors z-10"
          >
            <X size={18} />
          </button>
          {sidebar}
        </aside>
      </div>

      {/* Content */}
      <div className="lg:pl-56">
        {/* Desktop topbar — white, page title */}
        <div className="hidden lg:flex sticky top-0 z-20 items-center gap-3 h-14 px-6 bg-white border-b border-brand-line text-brand-ink">
          <span className="text-sm font-semibold text-brand-ink">{title}</span>
        </div>
        <main className="max-w-6xl mx-auto px-3 py-4 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  counts,
  brandName,
  logo,
  email,
  role,
  onNavigate,
}: {
  pathname: string;
  counts: AdminCounts;
  brandName: string;
  logo: string;
  email: string;
  role: string;
  onNavigate: () => void;
}) {
  return (
    <>
      {/* Brand */}
      <Link
        href="/admin"
        onClick={onNavigate}
        className="flex items-center gap-2.5 h-16 px-4 shrink-0 border-b border-brand-line"
      >
        <Image src={logo} alt={brandName} width={826} height={304} className="h-6 w-auto" priority />
        <div className="leading-tight min-w-0">
          <div className="text-brand-red font-bold text-xs uppercase tracking-widest">Admin</div>
          <div className="text-brand-ink-soft text-[10px] truncate">Pocket RC · Hub</div>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {NAV.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-ink-soft/60">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const count = item.countKey ? counts[item.countKey] ?? 0 : 0;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors ${
                        active
                          ? "bg-brand-ink/[0.06] text-brand-ink font-semibold"
                          : "text-brand-ink-soft hover:text-brand-ink hover:bg-brand-ink/[0.04]"
                      }`}
                    >
                      {active && (
                        <span className="absolute -left-0.5 top-1.5 bottom-1.5 w-[3px] rounded-full bg-brand-red" />
                      )}
                      <Icon
                        size={16}
                        className={active ? "text-brand-red" : "text-brand-ink-soft group-hover:text-brand-ink"}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {count > 0 && (
                        <span className="min-w-5 px-1.5 h-5 grid place-items-center rounded-full bg-brand-red text-white text-[11px] font-bold tabular-nums">
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Profile footer */}
      <div className="shrink-0 border-t border-brand-line p-3">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <div className="grid place-items-center h-9 w-9 shrink-0 rounded-full bg-brand-red text-white text-sm font-bold uppercase">
            {email.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-brand-ink truncate">{email}</p>
            <p className="text-[10px] font-mono uppercase tracking-widest text-brand-ink-soft">{role}</p>
          </div>
          <AdminSignOut />
        </div>
      </div>
    </>
  );
}
