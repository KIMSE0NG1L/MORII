"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Palette, BookOpen, Frame, User, LogOut, type LucideIcon } from "lucide-react";
import { NAV_ITEMS } from "@/lib/constants";

const ICON_MAP: Record<string, LucideIcon> = {
  home: Home,
  palette: Palette,
  bookOpen: BookOpen,
  frame: Frame,
  user: User,
};

export default function SideNav() {
  const pathname = usePathname();

  return (
    <aside className="w-64 flex-shrink-0 border-r border-line bg-card flex flex-col py-8 px-6">
      {/* Logo Section */}
      <Link href="/check" className="pb-6 border-b border-line text-center mb-8">
        <span className="text-4xl font-serif font-bold tracking-tight text-ink">MORII</span>
        <p className="text-xs text-muted mt-2">미술 치료 공간</p>
      </Link>

      {/* Navigation */}
      <nav className="flex flex-col gap-3">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const IconComponent = ICON_MAP[item.iconName];

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-sage text-white shadow-md"
                  : "text-ink hover:bg-tag-bg hover:shadow-sm"
              }`}
            >
              {IconComponent && (
                <IconComponent
                  size={22}
                  strokeWidth={1.5}
                  className={`flex-shrink-0 transition-colors ${
                    isActive ? "stroke-white fill-white" : "stroke-muted fill-none"
                  }`}
                />
              )}
              <span className={`text-sm font-medium transition-colors ${isActive ? "text-white" : "text-ink"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Divider */}
      <div className="mb-4 border-t border-line" />

      {/* Logout */}
      <form action="/api/logout" method="POST">
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm text-muted hover:bg-tag-bg hover:text-ink transition-all duration-200"
        >
          <LogOut size={20} className="stroke-current fill-none" />
          <span>로그아웃</span>
        </button>
      </form>
    </aside>
  );
}
