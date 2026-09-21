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
      {/* Logo */}
      <Link href="/check" className="mb-12 text-center">
        <span className="text-3xl font-serif font-bold tracking-tight text-ink">MORII</span>
        <p className="text-xs text-muted mt-1">미술 치료 공간</p>
      </Link>

      {/* Navigation */}
      <nav className="flex flex-col gap-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const IconComponent = ICON_MAP[item.iconName];

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-center gap-3 rounded-lg px-4 py-3 transition ${
                isActive ? "bg-sage" : "hover:bg-button-bg"
              }`}
            >
              {IconComponent && (
                <IconComponent
                  size={24}
                  className={isActive ? "stroke-white fill-white" : "stroke-muted fill-none"}
                />
              )}
              <span className={`text-sm ${isActive ? "text-white font-semibold" : "text-ink"}`}>
                {item.label}
              </span>
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
          className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm text-muted hover:bg-button-bg transition"
        >
          <LogOut size={20} className="stroke-muted fill-none" />
          <span>로그아웃</span>
        </button>
      </form>
    </aside>
  );
}
