/**
 * Supabase browser client — for client components that need to call
 * supabase.auth.signInWithOAuth(), supabase.auth.signInWithOtp(), etc.
 * Anon key only; never the service role.
 */

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
