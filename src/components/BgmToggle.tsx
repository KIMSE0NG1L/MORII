"use client";

import { useSyncExternalStore } from "react";
import { Music, Music2 } from "lucide-react";
import { isBgmOn, setBgm, subscribeBgm } from "@/lib/bgm";

// Music-note button that turns the looping background music on/off.
export default function BgmToggle({ className = "", label = false }: { className?: string; label?: boolean }) {
  const on = useSyncExternalStore(subscribeBgm, isBgmOn, () => false);

  return (
    <button
      type="button"
      onClick={() => setBgm(!on)}
      aria-pressed={on}
      aria-label={on ? "배경음악 끄기" : "배경음악 켜기"}
      className={className}
    >
      {on ? <Music2 size={18} /> : <Music size={18} className="opacity-60" />}
      {label && <span>{on ? "배경음악 켜짐" : "배경음악 꺼짐"}</span>}
    </button>
  );
}
