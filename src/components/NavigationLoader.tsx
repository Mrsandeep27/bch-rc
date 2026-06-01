"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Loader from "@/components/Loader";

/**
 * Full-screen truck loader that fires on EVERY route change (forward + back +
 * search-param swap). Mounts once in the root layout. Stays on screen for a
 * minimum 500ms so even instant static-page transitions show the truck — the
 * user explicitly asked for this animation every time.
 */
export default function NavigationLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  // Skip the very first mount (initial page load handled by app/loading.tsx)
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    setVisible(true);
    const id = window.setTimeout(() => setVisible(false), 700);
    return () => window.clearTimeout(id);
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-white/95 backdrop-blur-sm animate-fade-in-up"
      role="status"
      aria-live="polite"
    >
      <Loader label="Drifting in…" />
    </div>
  );
}
