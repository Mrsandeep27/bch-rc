# Monitoring & Bottleneck Analysis -- what to watch *during* a run

The k6/Artillery/Locust tools measure the **client-observable** half: response
times, P95/P99, error rates, failed logins. The other half -- DB connections,
slow queries, locks, deadlocks, CPU, memory -- lives on the **server side**
(Supabase + Vercel) and is where the real bottleneck shows up first. Watch both
simultaneously: when client P99 spikes, this is where you find *why*.

---

## 1. Database connection usage & pool exhaustion  (the #1 risk)

Recall from [`src/db/index.ts`](../src/db/index.ts): runtime queries go through the
**Supavisor transaction pooler (port 6543)**, `postgres-js` `max: 3` per Lambda.
Under fan-out the binding constraint is the **Supavisor pool size**, not the app.

### Live, in the Supabase Dashboard
- **Database -> Connection Pooling** -> watch *active* vs *pool size*. When active
  pegs at the ceiling, new Lambdas queue/timeout -> your test sees `503`s
  (`db_unavailable_503` counter in k6 / `order: 503` failures in Locust).
- **Database -> Roles / Reports** -> connection count over time.
- **Reports -> Database** -> CPU, memory, disk I/O of the Postgres instance.

### Live, via SQL (run in Supabase SQL editor, refresh every ~10s during load)

**Active connections by state -- are we near the ceiling?**
```sql
select state, count(*)
from pg_stat_activity
where datname = current_database()
group by state
order by count(*) desc;
```

**Total vs max_connections (the hard Postgres ceiling behind Supavisor):**
```sql
select
  (select count(*) from pg_stat_activity)              as current_connections,
  (select setting::int from pg_settings
     where name = 'max_connections')                   as max_connections,
  round(100.0 * (select count(*) from pg_stat_activity)
        / (select setting::int from pg_settings
             where name = 'max_connections'), 1)        as pct_used;
```

**Pool-exhaustion / "Connection closed" correlation:** every `503` your load
tool reports should line up with a spike here. If `pct_used` plateaus < 100%
but you still get 503s, the limit is the **Supavisor** pool (raise it in the
dashboard), not Postgres `max_connections`.

---

## 2. Retry behaviour & "Connection closed" errors

The app retries transient drops **exactly once** (`withDbRetry`,
[`src/db/index.ts:210`](../src/db/index.ts#L210)) then throws
`DatabaseUnavailableError` -> HTTP 503. To observe it:

- **Vercel -> your project -> Logs** (filter on the run window). Search for:
  - `db:query` + `transient connection error -- retrying once`  -> retries firing
  - `db:query` + `transient-exhausted`                          -> retry failed -> 503
  - `Connection closed` / `connect_timeout` / `ECONNRESET`      -> raw pool drops
  - `db:config`                                                 -> a misconfigured DSN
- Healthy: a few retries that succeed. **Unhealthy: rising `transient-exhausted`**
  -- that is pool exhaustion surfacing as the spec's "connection closed failures".

> Cross-check: k6 `db_unavailable_503` and `auth-stress.js` `connection_closed_FAILURE`
> counters must both stay at **0** to pass.

---

## 3. Slow queries

**Enable once (if not already):**
```sql
create extension if not exists pg_stat_statements;
```

**Top 20 slowest statements (run AFTER the load run, before resetting):**
```sql
select
  round(mean_exec_time::numeric, 1)  as avg_ms,
  round(max_exec_time::numeric, 1)   as max_ms,
  calls,
  round(total_exec_time::numeric, 0) as total_ms,
  query
from pg_stat_statements
where query not ilike '%pg_stat_statements%'
order by mean_exec_time desc
limit 20;
```
Reset the baseline right before the run: `select pg_stat_statements_reset();`

**Currently-running long queries (during the run):**
```sql
select pid, now() - query_start as runtime, state, left(query, 120) as query
from pg_stat_activity
where state <> 'idle' and now() - query_start > interval '500 ms'
order by runtime desc;
```
Expect the order-create TXN and the inventory-health aggregate to top this list.
If a plain indexed `SELECT` shows up slow, suspect a stale pooled socket (see the
HMR/`max_lifetime` notes in `src/db/index.ts`).

---

## 4. Locks, deadlocks & table locks

The order-create path does an **atomic stock decrement** --
`UPDATE inventory SET stock = stock - qty WHERE ... AND stock >= qty`
([route](../src/app/api/orders/create/route.ts), step 3a). Concurrent orders for
the **same SKU/variant** serialise on that row lock. `db-stress.js` deliberately
concentrates writes on `qa-1rs` to exercise this.

**Live lock waits (who is blocked by whom):**
```sql
select
  blocked.pid           as blocked_pid,
  blocked.query         as blocked_query,
  blocking.pid          as blocking_pid,
  blocking.query        as blocking_query
from pg_stat_activity blocked
join pg_stat_activity blocking
  on blocking.pid = any(pg_blocking_pids(blocked.pid))
where blocked.wait_event_type = 'Lock';
```

**Lock counts by mode/table:**
```sql
select relation::regclass as table, mode, count(*)
from pg_locks l
join pg_stat_activity a on a.pid = l.pid
where relation is not null
group by 1, 2 order by 3 desc;
```

**Deadlocks (cumulative -- compare before/after the run):**
```sql
select datname, deadlocks, xact_commit, xact_rollback
from pg_stat_database
where datname = current_database();
```
A single-row `stock >= qty` UPDATE shouldn't deadlock (consistent lock order),
but a rising `deadlocks` count or `xact_rollback` climbing faster than expected
is a red flag worth a transaction-ordering review. Brief row-lock *contention*
on a hot SKU is normal and shows up as `409` (sold out / serialised reject),
which the tests count as a business outcome, not a failure.

---

## 5. CPU & memory

- **Postgres (Supabase):** Reports -> Database -> CPU % and RAM. Sustained CPU
  > 80% under sustain phase => query/index bottleneck (cross-ref section 3).
- **App (Vercel serverless):** Vercel -> Observability / Logs -> function duration,
  memory used, and **cold-start** rate. Memory near the function limit => raise it
  or trim per-request allocation. A burst of cold starts at the ramp boundary
  explains a transient P99 spike that settles during sustain.
- **Razorpay (prepaid writes):** watch the Razorpay dashboard for API error rate /
  throttling -- the order-create call to `razorpay.orders.create` is an external
  dependency in the critical path and can become *your* bottleneck.

---

## 6. Catalog health probe (before, during, after)

```powershell
curl "$env:BASE_URL/api/health/inventory"
```
- **Before:** must be `200` with `ok:true` (confirms `qa-1rs` and all variants are
  seeded). A `503` here means run `npm run db:seed-inventory` on staging first.
- **During/after:** if it flips to `503` mid-run it's either pool exhaustion
  (the probe itself couldn't query) or `qa-1rs` ran dry (`soldOut`) -- reseed with
  higher stock and rerun the write phase.

---

## 7. Reading the result -- pass/fail decision tree

1. **Client P95 < 2s and P99 < 5s, error rate < 1%?** -> criteria met for that stage.
2. **503s or `transient-exhausted` in logs?** -> pool exhaustion. Raise Supavisor
   pool size / move read-heavy routes to caching; this is the launch-blocker.
3. **High P99 but no 503 / no 5xx?** -> slow queries (section 3) or cold starts (section 5).
4. **Auth: only 401/429, zero 5xx, every response < 10s, no redirect loop?**
   -> auth passes (the 429 wall is the rate limiter, by design).
5. **Deadlocks climbing or lock waits piling on `inventory`?** -> revisit the
   stock-decrement transaction ordering before launch.

Escalate stages 1 -> 2 -> 3 -> 4 only while criteria hold. The first stage that
breaks them is your real-world ceiling.