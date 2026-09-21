"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";

export default function SideNav() {
  const pathname = usePathname();

  return (
    <aside className="w-20 flex-shrink-0 border-r border-line bg-card flex flex-col items-center gap-6 py-6">
      {/* Logo */}
      <Link href="/check" className="text-2xl font-bold text-sage">
        M
      </Link>

      {/* Navigation */}
      <nav className="flex flex-col gap-6">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                isActive
                  ? "bg-sage text-white"
                  : "text-muted hover:bg-button-bg"
              }`}
            >
              {item.label.charAt(0)}
            </Link>
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Logout */}
      <form action="/api/logout" method="POST">
        <button
          type="submit"
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-button-bg transition"
          title="로그아웃"
        >
          ↓
        </button>
      </form>
    </aside>
  );
}
