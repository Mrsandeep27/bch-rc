/**
 * Supabase server client — for Next.js App Router server components,
 * route handlers, and server actions. Reads/writes auth cookies through
 * Next's cookies() so sessions survive across requests.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component (read-only). Refreshing the
            // session is delegated to middleware; safe to swallow here.
          }
        },
      },
    },
  );
}

/**
 * Admin client using the service_role key — BYPASSES Row Level Security.
 * Use only in trusted server contexts (admin routes, webhook handlers).
 * Never expose this client to the browser or to user-input flows.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
