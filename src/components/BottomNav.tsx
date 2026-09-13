"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/60 bg-nav-bar-bg/80 p-2 shadow-[0_12px_28px_rgba(74,66,56,0.16)] backdrop-blur-xl">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex w-16 flex-col items-center gap-0.5 rounded-full px-2 py-2 text-[11px] font-medium transition ${
                active
                  ? "bg-white text-nav-selected-text font-bold shadow-sm"
                  : "text-nav-idle"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
