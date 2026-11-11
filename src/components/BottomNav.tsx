"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { ICON_MAP } from "@/components/SideNav";

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex justify-center px-3">
      <div className="px-panel pointer-events-auto flex items-center gap-1 p-1.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = ICON_MAP[item.iconName];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex w-[60px] flex-col items-center gap-0.5 rounded-lg border-2 px-1 py-1.5 font-pixel text-[10px] font-bold transition ${
                active
                  ? "border-outline bg-sage text-white shadow-[0_2px_0_var(--color-outline)]"
                  : "border-transparent text-nav-idle"
              }`}
            >
              {Icon && <Icon size={18} strokeWidth={2} />}
              {item.shortLabel}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
