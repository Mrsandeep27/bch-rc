/**
 * One-off: diagnose the Jul 1 "Edge Requests increased" spike.
 * Looks at analytics_sessions to find what drove the pageview burst.
 * Times shown in IST (Asia/Kolkata). Run:
 *   node --env-file=.env.local --import tsx scripts/diag-spike.ts
 */
import { sql } from "drizzle-orm";
import { db } from "../src/db";

function print(title: string, rows: unknown[]) {
  console.log("\n=== " + title + " ===");
  console.table(rows);
}

async function main() {
  // 1) Sessions per IST hour for Jul 1 — locate the spike.
  const byHour = await db.execute(sql`
    select to_char(started_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:00') as ist_hour,
           count(*)                              as sessions,
           count(*) filter (where is_bot)        as bot_sessions,
           sum(pageview_count)                   as pageviews
    from analytics_sessions
    where started_at at time zone 'Asia/Kolkata' >= timestamp '2026-07-01 00:00'
      and started_at at time zone 'Asia/Kolkata' <  timestamp '2026-07-02 00:00'
    group by 1 order by 1
  `);
  print("Sessions per hour (IST) — Jul 1", byHour as unknown as unknown[]);

  // Window under investigation: 3:00pm–5:30pm IST = 09:30–12:00 UTC.
  const winStart = "2026-07-01 15:00"; // IST
  const winEnd = "2026-07-01 17:30"; // IST
  const inWindow = sql`
    started_at at time zone 'Asia/Kolkata' >= timestamp ${sql.raw("'" + winStart + "'")}
    and started_at at time zone 'Asia/Kolkata' <  timestamp ${sql.raw("'" + winEnd + "'")}
  `;

  const total = await db.execute(sql`
    select count(*) as sessions, sum(pageview_count) as pageviews,
           count(*) filter (where is_bot) as bots,
           count(distinct visitor_id) as unique_visitors
    from analytics_sessions where ${inWindow}
  `);
  print(`Window ${winStart}–${winEnd} IST — totals`, total as unknown as unknown[]);

  const bySource = await db.execute(sql`
    select source, count(*) as sessions, sum(pageview_count) as pageviews,
           count(*) filter (where is_bot) as bots
    from analytics_sessions where ${inWindow}
    group by 1 order by 2 desc
  `);
  print("By source", bySource as unknown as unknown[]);

  const byUtm = await db.execute(sql`
    select coalesce(utm_source,'(none)') as utm_source,
           coalesce(utm_campaign,'(none)') as utm_campaign,
           count(*) as sessions
    from analytics_sessions where ${inWindow}
    group by 1,2 order by 3 desc limit 15
  `);
  print("By utm_source / campaign", byUtm as unknown as unknown[]);

  const byRef = await db.execute(sql`
    select coalesce(referrer_host,'(direct/none)') as referrer_host, count(*) as sessions
    from analytics_sessions where ${inWindow}
    group by 1 order by 2 desc limit 15
  `);
  print("By referrer host", byRef as unknown as unknown[]);

  const byCountry = await db.execute(sql`
    select coalesce(country,'(unknown)') as country, count(*) as sessions
    from analytics_sessions where ${inWindow}
    group by 1 order by 2 desc limit 15
  `);
  print("By country", byCountry as unknown as unknown[]);

  const byPath = await db.execute(sql`
    select coalesce(landing_path,'(none)') as landing_path, count(*) as sessions
    from analytics_sessions where ${inWindow}
    group by 1 order by 2 desc limit 15
  `);
  print("By landing path", byPath as unknown as unknown[]);

  const byUa = await db.execute(sql`
    select coalesce(substring(user_agent from 1 for 60),'(none)') as ua, count(*) as sessions,
           bool_or(is_bot) as flagged_bot
    from analytics_sessions where ${inWindow}
    group by 1 order by 2 desc limit 20
  `);
  print("Top user agents (first 60 chars)", byUa as unknown as unknown[]);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
