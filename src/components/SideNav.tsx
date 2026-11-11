"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Palette, BookOpen, Frame, User, LogOut, type LucideIcon } from "lucide-react";
import { NAV_ITEMS } from "@/lib/constants";
import { signOut } from "@/app/(main)/my/actions";

export const ICON_MAP: Record<string, LucideIcon> = {
  home: Home,
  palette: Palette,
  bookOpen: BookOpen,
  frame: Frame,
  user: User,
};

export default function SideNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 flex-shrink-0 flex-col border-r-[3px] border-outline bg-forest px-5 py-8 md:flex">
      {/* Logo */}
      <Link href="/home" className="mb-8 border-b-2 border-dashed border-white/25 pb-6 text-center">
        <span className="font-pixel text-3xl font-bold text-[#fdf6e3] [text-shadow:0_3px_0_#173323]">Me:seum</span>
        <p className="mt-2 font-pixel text-xs text-[#cfe3b0]">🌱 나의 작은 마음 공간</p>
      </Link>

      {/* Navigation */}
      <nav className="flex flex-col gap-2.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const IconComponent = ICON_MAP[item.iconName];

          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                isActive
                  ? "px-btn px-btn-cream justify-start gap-3 px-4 py-3"
                  : "flex items-center gap-3 rounded-[10px] border-2 border-transparent px-4 py-3 font-pixel font-bold text-[#e7f0d8] transition hover:border-white/20 hover:bg-white/10"
              }
            >
              {IconComponent && <IconComponent size={20} strokeWidth={2} className="flex-shrink-0" />}
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <form action={signOut}>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-[10px] border-2 border-white/20 px-4 py-2.5 font-pixel text-sm text-[#cfe3b0] transition hover:bg-white/10"
        >
          <LogOut size={18} />
          <span>로그아웃</span>
        </button>
      </form>
    </aside>
  );
}
