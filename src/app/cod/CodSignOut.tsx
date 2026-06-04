"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function CodSignOut() {
  const router = useRouter();
  async function onClick() {
    await fetch("/api/cod/logout", { method: "POST" });
    router.push("/cod/login");
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
