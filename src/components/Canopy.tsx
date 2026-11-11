"use client";

import { usePathname } from "next/navigation";

// Leafy pixel tree-line along the top of every inner page, tying them to the
// pixel home map. Skipped where the page is itself a full-bleed scene or
// needs every pixel of height (the home map, the drawing canvas).
const HIDDEN_ON = ["/home", "/diary/new"];

export default function Canopy() {
  const pathname = usePathname();
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;
  return (
    <div
      aria-hidden="true"
      className="pixelated pointer-events-none -mb-3 h-[52px] w-full shrink-0 bg-repeat-x md:-mb-4 md:h-[68px]"
      style={{ backgroundImage: "url('/assets/ui/canopy.png')", backgroundSize: "auto 100%" }}
    />
  );
}
