"use client";

import { useSyncExternalStore } from "react";
import type { Point } from "./maps";

type Phase = "day" | "evening" | "night";

function phaseNow(): Phase {
  const h = new Date().getHours();
  if (h >= 19 || h < 6) return "night";
  if (h >= 17) return "evening";
  return "day";
}

function subscribe(cb: () => void) {
  const id = window.setInterval(cb, 60_000);
  return () => window.clearInterval(id);
}

// Tints the home map for the viewer's local time: warm at dusk, dark blue at
// night with the map's windows (if any) glowing. Server render is always "day".
export default function TimeOfDay({ windows }: { windows: Point[] }) {
  const phase = useSyncExternalStore(subscribe, phaseNow, () => "day" as Phase);
  if (phase === "day") return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[110]">
      <div
        className="absolute inset-0 transition-colors duration-1000"
        style={{
          background: phase === "night" ? "rgba(28, 36, 92, 0.5)" : "rgba(255, 128, 64, 0.18)",
          mixBlendMode: "multiply",
        }}
      />
      {phase === "night" &&
        windows.map((w) => (
          <div
            key={`${w.x}-${w.y}`}
            className="absolute aspect-square w-[13%] max-w-[90px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${w.x}%`,
              top: `${w.y}%`,
              background: "radial-gradient(circle, rgba(255,214,120,0.75) 0%, rgba(255,190,90,0.25) 45%, transparent 70%)",
              mixBlendMode: "screen",
            }}
          />
        ))}
    </div>
  );
}
