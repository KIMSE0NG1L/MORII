"use client";

import { useEffect } from "react";
import { playSfx, type SfxName } from "@/lib/sfx";
import { resumeBgmIfWanted } from "@/lib/bgm";

// One delegated listener gives every pixel button / chip / link a click
// sound. An element (or ancestor) can pick a different sound with
// data-sfx="open" etc., or opt out with data-sfx="none".
export default function SfxProvider() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      resumeBgmIfWanted();
      const target = e.target as Element | null;
      if (!target?.closest) return;
      const tagged = target.closest<HTMLElement>("[data-sfx]");
      if (tagged) {
        const name = tagged.dataset.sfx;
        if (name && name !== "none") playSfx(name as SfxName);
        return;
      }
      const el = target.closest<HTMLElement>("button, a[href], summary, [role=button]");
      if (!el || (el as HTMLButtonElement).disabled) return;
      playSfx(el.classList.contains("px-chip") ? "select" : "click");
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
