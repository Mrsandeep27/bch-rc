import Link from "next/link";
import { BarChart3, Boxes, LayoutDashboard, Package, Settings, Users } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { THEME } from "@/lib/theme";
import { AdminSignOut } from "./AdminSignOut";

/**
 * Auth-gated layout. Applies to everything inside src/app/admin/(authed)/.
 * The /admin/login route lives outside this group, so it doesn't inherit
 * the gate — no redirect loop.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireAdmin();

  return (
    <div className="min-h-screen bg-brand-cream">
      <header className="bg-brand-ink text-white border-b border-brand-ink-soft sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/admin"
              className="font-display font-bold text-lg tracking-tight"
            >
              {THEME.brandName} <span className="text-brand-red">Admin</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1 text-sm">
              <NavLink href="/admin" icon={LayoutDashboard}>
                Overview
              </NavLink>
              <NavLink href="/admin/orders" icon={Package}>
                Orders
              </NavLink>
              <NavLink href="/admin/inventory" icon={Boxes}>
                Inventory
              </NavLink>
              <NavLink href="/admin/customers" icon={Users}>
                Customers
              </NavLink>
              <NavLink href="/admin/analytics" icon={BarChart3}>
                Analytics
              </NavLink>
              <NavLink href="/admin/settings" icon={Settings}>
                Settings
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-white/90">{ctx.email}</span>
              <span className="text-white/50 font-mono uppercase tracking-widest">
                {ctx.role}
              </span>
            </div>
            <AdminSignOut />
          </div>
        </div>
        {/* Mobile nav */}
        <div className="md:hidden border-t border-brand-ink-soft">
          <div className="max-w-7xl mx-auto px-2 flex items-center gap-1 text-sm overflow-x-auto no-scrollbar">
            <NavLink href="/admin" icon={LayoutDashboard}>
              Overview
            </NavLink>
            <NavLink href="/admin/orders" icon={Package}>
              Orders
            </NavLink>
            <NavLink href="/admin/inventory" icon={Boxes}>
              Inventory
            </NavLink>
            <NavLink href="/admin/customers" icon={Users}>
              Customers
            </NavLink>
            <NavLink href="/admin/analytics" icon={BarChart3}>
              Analytics
            </NavLink>
            <NavLink href="/admin/settings" icon={Settings}>
              Settings
            </NavLink>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}

function NavLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
    >
      <Icon size={14} />
      {children}
    </Link>
  );
}
