"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AdminSignOut() {
  const router = useRouter();
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
  }
  return (
    <button
      onClick={handleSignOut}
      title="Sign out"
      className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
    >
      <LogOut size={16} />
    </button>
  );
}
