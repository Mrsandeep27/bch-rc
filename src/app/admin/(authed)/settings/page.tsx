import { db } from "@/db";
import { sites, admins } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";

export default async function AdminSettings() {
  const ctx = await requireAdmin();
  const allSites = await db.select().from(sites);
  const allAdmins = await db.select().from(admins);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-ink">
        Settings
      </h1>

      <section className="bg-white rounded-2xl border border-brand-line p-5">
        <h2 className="font-semibold text-brand-ink mb-3">Sites</h2>
        <ul className="space-y-3">
          {allSites.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between border border-brand-line rounded-lg px-4 py-3"
            >
              <div>
                <div className="font-semibold text-brand-ink">
                  {s.name}{" "}
                  <span className="text-xs text-brand-ink-soft font-mono">
                    {s.id}
                  </span>
                </div>
                <div className="text-xs text-brand-ink-soft mt-0.5">
                  {s.domain} · {s.scale} · prefix {s.orderIdPrefix}
                </div>
              </div>
              {s.active ? (
                <span className="text-[10px] font-mono uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success">
                  Active
                </span>
              ) : (
                <span className="text-[10px] font-mono uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full bg-brand-line text-brand-ink-soft">
                  Inactive
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs text-brand-ink-soft mt-3">
          Adding new sites: insert directly via Supabase dashboard or seed
          script for now. Admin UI for site creation coming later.
        </p>
      </section>

      <section className="bg-white rounded-2xl border border-brand-line p-5">
        <h2 className="font-semibold text-brand-ink mb-3">Admins</h2>
        <ul className="space-y-2">
          {allAdmins.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between border border-brand-line rounded-lg px-4 py-3 text-sm"
            >
              <div>
                <div className="font-semibold text-brand-ink">{a.email}</div>
                <div className="text-xs text-brand-ink-soft mt-0.5">
                  {a.role} · {a.siteIds.length} sites
                </div>
              </div>
              {a.email === ctx.email && (
                <span className="text-[10px] font-mono uppercase tracking-widest text-brand-ink-soft">
                  You
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs text-brand-ink-soft mt-3">
          Founder emails (ADMIN_FOUNDER_EMAILS in .env) auto-get OWNER on first
          sign-in. Add a new admin: invite an email here (UI TODO) or insert a
          row in `admins` directly.
        </p>
      </section>
    </div>
  );
}
