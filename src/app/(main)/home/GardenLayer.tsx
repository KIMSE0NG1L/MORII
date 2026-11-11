"use client";

import { useEffect, useState } from "react";
import { unlockedGarden } from "@/lib/garden";
import { playSfx } from "@/lib/sfx";

const SEEN_KEY = "meseum-garden-seen";

// Garden decorations on the home map. Items unlocked since the last visit
// (tracked per device) pop in with a little fanfare and a toast.
export default function GardenLayer({ xp }: { xp: number }) {
  const items = unlockedGarden(xp);
  const [fresh, setFresh] = useState<string[]>([]);

  useEffect(() => {
    let seen = 0;
    try {
      seen = Number(localStorage.getItem(SEEN_KEY) ?? "-1");
    } catch {
      return;
    }
    // First visit on this device: treat what's already grown as seen.
    if (seen < 0 || Number.isNaN(seen)) seen = items.length;
    const newOnes = items.slice(seen).map((i) => i.key);
    try {
      localStorage.setItem(SEEN_KEY, String(items.length));
    } catch {
      // ignore
    }
    if (newOnes.length === 0) return;
    const t = window.setTimeout(() => {
      setFresh(newOnes);
      playSfx("success");
    }, 500);
    const clear = window.setTimeout(() => setFresh([]), 4500);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(clear);
    };
    // Runs once per mount with the server-provided xp.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const newest = items.filter((i) => fresh.includes(i.key)).at(-1);

  return (
    <>
      {items.map((item) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={item.key}
          src={`/assets/garden/${item.key}.png`}
          alt={item.name}
          draggable={false}
          className={`pixelated pointer-events-none absolute origin-bottom -translate-x-1/2 -translate-y-full select-none ${
            fresh.includes(item.key) ? "motion-safe:animate-[garden-pop_0.7s_ease-out_both]" : ""
          }`}
          style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.w}%`, zIndex: Math.round(item.y) }}
        />
      ))}
      {newest && (
        <div
          role="status"
          className="px-card absolute left-1/2 top-[13%] z-[120] -translate-x-1/2 whitespace-nowrap px-3 py-2 font-pixel text-xs font-bold text-ink motion-safe:animate-[bubble-float_2.4s_ease-in-out_infinite]"
        >
          🌱 정원에 새 친구가 생겼어요: {newest.name}
        </div>
      )}
    </>
  );
}
