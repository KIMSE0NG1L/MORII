"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { ICON_MAP } from "@/components/SideNav";

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex justify-center px-3">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-white/60 bg-nav-bar-bg/90 p-1.5 shadow-[0_12px_28px_rgba(74,66,56,0.16)] backdrop-blur-xl">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = ICON_MAP[item.iconName];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex w-[62px] flex-col items-center gap-0.5 rounded-full px-1 py-1.5 text-[10px] font-medium transition ${
                active ? "bg-white text-nav-selected-text font-bold shadow-sm" : "text-nav-idle"
              }`}
            >
              {Icon && <Icon size={18} strokeWidth={1.6} />}
              {item.shortLabel}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
