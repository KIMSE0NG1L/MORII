"use client";

import { useEffect, useRef, useState } from "react";
import { Palette, Check } from "lucide-react";
import { playSfx } from "@/lib/sfx";
import { THEMES, THEME_IDS, type ThemeId } from "./maps";

// Button + popover for choosing the home map's style.
export default function ThemePicker({ value, onChange }: { value: ThemeId; onChange: (id: ThemeId) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        data-sfx="none"
        onClick={() => {
          playSfx(open ? "close" : "open");
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-label="맵 스타일 바꾸기"
        className="px-btn px-btn-cream h-9 w-9"
      >
        <Palette size={18} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="맵 스타일"
          className="absolute right-0 top-full mt-2 w-[min(300px,80vw)] rounded-xl border-4 border-[#3b2a1a] bg-[#fdf6e3] p-3 shadow-[0_6px_0_#3b2a1a]"
        >
          <p className="mb-2 font-pixel text-sm font-bold text-[#3b2a1a]">🎨 맵 스타일</p>
          <ul className="grid grid-cols-2 gap-2">
            {THEME_IDS.map((id) => {
              const t = THEMES[id];
              const active = id === value;
              return (
                <li key={id}>
                  <button
                    type="button"
                    data-sfx="none"
                    aria-pressed={active}
                    onClick={() => {
                      playSfx("select");
                      onChange(id);
                      setOpen(false);
                    }}
                    className={`relative block w-full overflow-hidden rounded-lg border-2 text-left transition hover:-translate-y-0.5 ${
                      active ? "border-[#7a9b56] ring-2 ring-[#7a9b56]" : "border-[#3b2a1a]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.thumb} alt="" className="block aspect-[4/3] w-full object-cover" draggable={false} />
                    <span className="block bg-white px-1.5 py-1 font-pixel text-[11px] font-bold text-[#3b2a1a]">
                      {t.name}
                    </span>
                    {active && (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#7a9b56] text-white">
                        <Check size={13} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
