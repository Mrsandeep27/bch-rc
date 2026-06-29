// One-off diagnostic: why isn't a given lead in /admin/recovery?
// Reads DATABASE_URL from .env.local, looks up the order by email/phone,
// prints its real status + evaluates recovery eligibility. Read-only.
import fs from "node:fs";
import postgres from "postgres";

// Usage: node scripts/diag-order.mjs <email-or-phone> [more...]
// e.g.   node scripts/diag-order.mjs someone@gmail.com 8096732469
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/diag-order.mjs <email-or-phone>");
  process.exit(1);
}
const EMAIL = args.find((a) => a.includes("@")) ?? "";
const PHONE = (args.find((a) => /\d{7,}/.test(a)) ?? "").replace(/\D/g, "");

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const line = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
const dsn = line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");

const sql = postgres(dsn, { prepare: false, max: 1, idle_timeout: 5 });

const RECOVERABLE = ["PENDING", "ABANDONED"];

try {
  const rows = await sql`
    SELECT o.id, o.status, o.payment_method, o.payment_status, o.total_inr,
           o.source, o.placed_at, o.customer_id,
           c.email AS cust_email, c.phone AS cust_phone,
           o.shipping_address->>'phone' AS ship_phone,
           o.shipping_address->>'fullName' AS ship_name
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE c.email = ${EMAIL}
       OR c.phone ILIKE ${"%" + PHONE + "%"}
       OR o.shipping_address::text ILIKE ${"%" + PHONE + "%"}
    ORDER BY o.placed_at DESC
  `;

  if (rows.length === 0) {
    console.log("No order rows matched that email/phone.");
  }

  const now = Date.now();
  for (const r of rows) {
    const ageMin = Math.floor((now - new Date(r.placed_at).getTime()) / 60000);
    const ageTxt = ageMin < 60 ? `${ageMin}m` : ageMin < 1440 ? `${Math.floor(ageMin / 60)}h` : `${Math.floor(ageMin / 1440)}d`;
    console.log("─".repeat(60));
    console.log(`id            ${r.id}`);
    console.log(`status        ${r.status}        payment_status ${r.payment_status}`);
    console.log(`method        ${r.payment_method}   total ₹${r.total_inr}   source ${r.source}`);
    console.log(`placed_at     ${r.placed_at}  (${ageTxt} ago)`);
    console.log(`name/phone    ${r.ship_name ?? "—"} / ${r.ship_phone ?? r.cust_phone ?? "—"}`);
    console.log(`email         ${r.cust_email ?? "—"}`);
    // recovery eligibility
    const reasons = [];
    if (!RECOVERABLE.includes(r.status)) reasons.push(`status "${r.status}" not in [PENDING, ABANDONED]`);
    if (ageMin < 30) reasons.push(`younger than 30 min (${ageMin}m)`);
    if (ageMin > 90 * 1440) reasons.push(`older than 90 days`);
    console.log(reasons.length === 0
      ? `recovery       ✅ should appear (unless this customer later PAID)`
      : `recovery       ❌ excluded — ${reasons.join("; ")}`);
  }

  // Did this customer ever pay?
  if (rows.length) {
    const cid = rows[0].customer_id;
    const paid = await sql`
      SELECT id, status, placed_at FROM orders
      WHERE customer_id = ${cid} AND status IN ('PAID','PACKED','SHIPPED','DELIVERED')
    `;
    console.log("─".repeat(60));
    console.log(`this customer's PAID orders: ${paid.length}` +
      (paid.length ? "  → would also exclude their abandoned attempts" : ""));
  }
} finally {
  await sql.end();
}
