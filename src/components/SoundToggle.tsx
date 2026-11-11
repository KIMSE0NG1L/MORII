"use client";

import { useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isMuted, playSfx, setMuted, subscribeMuted } from "@/lib/sfx";

// Speaker button that turns the 8-bit sound effects on/off for this device.
export default function SoundToggle({ className = "", label = false }: { className?: string; label?: boolean }) {
  // Server render assumes "on"; the stored choice takes over after hydration.
  const muted = useSyncExternalStore(subscribeMuted, isMuted, () => false);

  return (
    <button
      type="button"
      data-sfx="none"
      onClick={() => {
        setMuted(!muted);
        if (muted) playSfx("select");
      }}
      aria-pressed={!muted}
      aria-label={muted ? "효과음 켜기" : "효과음 끄기"}
      className={className}
    >
      {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      {label && <span>{muted ? "효과음 꺼짐" : "효과음 켜짐"}</span>}
    </button>
  );
}
