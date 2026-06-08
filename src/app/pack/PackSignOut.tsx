"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function PackSignOut() {
  const router = useRouter();
  async function onClick() {
    await fetch("/api/pack/logout", { method: "POST" });
    router.push("/pack/login");
    router.refresh();
  }
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-white/70 hover:text-white text-xs"
    >
      <LogOut size={13} />
      Sign out
    </button>
  );
}
