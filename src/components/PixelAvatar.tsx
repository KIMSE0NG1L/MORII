"use client";

import { useEffect, useState } from "react";
import { avatarById } from "@/lib/constants";

// 16x22 pixel-art character painted from the avatar preset's colors, styled
// to sit on the pixel home map (thick dark outline, chibi proportions).
//
// Legend: . clear  O outline  H hair  S skin  E eye  W eye highlight
//         K blush  m mouth  C shirt  c shirt shade  P pants  B shoes
const BODY = [
  "....OOOOOOOO....",
  "...OHHHHHHHHO...",
  "..OHHHHHHHHHHO..",
  ".OHHHHHHHHHHHHO.",
  ".OHHHHHHHHHHHHO.",
  ".OHHSSSSSSSSHHO.",
  ".OHSSSSSSSSSSHO.",
  ".OSSEWSSSSEWSSO.",
  ".OSSEESSSSEESSO.",
  ".OSKKSSSSSSKKSO.",
  "..OSSSSmmSSSSO..",
  "...OOSSSSSSOO...",
  "...OCCCCCCCCO...",
  "..OCCCCCCCCCCO..",
  ".OCCOCCCCCCOCCO.",
  ".OCCOCCCCCCOCCO.",
  ".OSSOccccccOSSO.",
  "..OOOPPPPPPOOO..",
];

// Leg rows per frame: idle, left foot up, right foot up.
const LEGS = [
  ["...OPPPOOPPPO...", "...OPPPOOPPPO...", "...OBBBOOBBBO...", "...OOOOOOOOOO..."],
  ["...OPPPOOPPPO...", "...OBBBOOPPPO...", "...OOOOOOBBBO...", "........OOOOO..."],
  ["...OPPPOOPPPO...", "...OPPPOOBBBO...", "...OBBBOOOOOO...", "...OOOOO........"],
];

const W = 16;
const H = BODY.length + 4;

function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amount))));
  const r = ch(n >> 16), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// One <rect> per horizontal run of the same color keeps the SVG small.
function runs(rows: string[], colors: Record<string, string>) {
  const out: { x: number; y: number; w: number; fill: string }[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < W) {
      const k = row[x];
      let end = x + 1;
      while (end < W && row[end] === k) end++;
      if (k !== "." && colors[k]) out.push({ x, y, w: end - x, fill: colors[k] });
      x = end;
    }
  });
  return out;
}

export default function PixelAvatar({
  avatarId,
  walking = false,
  className = "",
}: {
  avatarId: string;
  walking?: boolean;
  className?: string;
}) {
  const a = avatarById(avatarId);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!walking) return;
    let f = 0;
    const id = window.setInterval(() => {
      f = f === 1 ? 2 : 1;
      setFrame(f);
    }, 140);
    return () => window.clearInterval(id);
  }, [walking]);

  const colors: Record<string, string> = {
    O: "#2b1d14",
    H: a.hair,
    S: a.skin,
    E: "#2b1d14",
    W: "#ffffff",
    K: "#f2a0a0",
    m: shade(a.skin, 0.35),
    C: a.shirt,
    c: shade(a.shirt, 0.18),
    P: a.pants,
    B: "#5a3e2b",
  };
  const rects = runs([...BODY, ...LEGS[walking ? frame : 0]], colors);

  return (
    <svg
      viewBox={`0 0 ${W} ${H + 1}`}
      className={className}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {/* ground shadow, one row below the feet */}
      <rect x="3" y={H} width="10" height="1" fill="rgba(0,0,0,0.22)" />
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height="1" fill={r.fill} />
      ))}
    </svg>
  );
}
