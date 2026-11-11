"use client";

import { useEffect, useState } from "react";
import { HAIR_COLORS, PANTS_COLORS, SHIRT_COLORS, SKIN_TONES, parseLook } from "@/lib/avatarLook";

// 16x22 pixel-art character painted from the user's avatar look (see
// lib/avatarLook.ts), styled to sit on the pixel home map.
//
// Legend: . clear  O outline  H hair  S skin  E eye  W eye highlight
//         K blush  m mouth  C shirt  c shirt shade  P pants  B shoes
//         R cap  F flower  Y flower center

// Face rows shared by most hair styles (rows 6-11).
const FACE = [
  ".OHSSSSSSSSSSHO.",
  ".OSSEWSSSSEWSSO.",
  ".OSSEESSSSEESSO.",
  ".OSKKSSSSSSKKSO.",
  "..OSSSSmmSSSSO..",
  "...OOSSSSSSOO...",
];

// Rows 0-11 per hair style (index matches HAIR_STYLES).
const HEADS: string[][] = [
  // 짧은 머리
  [
    "....OOOOOOOO....",
    "...OHHHHHHHHO...",
    "..OHHHHHHHHHHO..",
    ".OHHHHHHHHHHHHO.",
    ".OHHHHHHHHHHHHO.",
    ".OHHSSSSSSSSHHO.",
    ...FACE,
  ],
  // 긴 머리
  [
    "....OOOOOOOO....",
    "...OHHHHHHHHO...",
    "..OHHHHHHHHHHO..",
    ".OHHHHHHHHHHHHO.",
    ".OHHHHHHHHHHHHO.",
    ".OHHSSSSSSSSHHO.",
    ".OHSSSSSSSSSSHO.",
    ".OHSEWSSSSEWSHO.",
    ".OHSEESSSSEESHO.",
    ".OHKKSSSSSSKKHO.",
    ".OHHSSSmmSSSHHO.",
    ".OHHOOSSSSOOHHO.",
  ],
  // 단발 (full bangs, chin length)
  [
    "....OOOOOOOO....",
    "...OHHHHHHHHO...",
    "..OHHHHHHHHHHO..",
    ".OHHHHHHHHHHHHO.",
    ".OHHHHHHHHHHHHO.",
    ".OHHHHHHHHHHHHO.",
    ".OHSSSSSSSSSSHO.",
    ".OHSEWSSSSEWSHO.",
    ".OHSEESSSSEESHO.",
    ".OHKKSSSSSSKKHO.",
    ".OHOSSSmmSSSOHO.",
    "..OOOSSSSSSOOO..",
  ],
  // 삐죽 머리
  [
    "...O..O..O..O...",
    "..OHOOHOOHOOHO..",
    "..OHHHHHHHHHHO..",
    ".OHHHHHHHHHHHHO.",
    ".OHHHHHHHHHHHHO.",
    ".OHSSHSSSSHSSHO.",
    ...FACE,
  ],
  // 똥머리 (top bun)
  [
    "......OOOO......",
    ".....OHHHHO.....",
    "..OOOOHHHHOOOO..",
    ".OHHHHHHHHHHHHO.",
    ".OHHHHHHHHHHHHO.",
    ".OHHSSSSSSSSHHO.",
    ...FACE,
  ],
];

// Rows 12-17: shirt, arms, belt line.
const TORSO = [
  "...OCCCCCCCCO...",
  "..OCCCCCCCCCCO..",
  ".OCCOCCCCCCOCCO.",
  ".OCCOCCCCCCOCCO.",
  ".OSSOccccccOSSO.",
  "..OOOPPPPPPOOO..",
];

// Long hair drapes over the shoulders (replaces torso rows 12-14).
const LONG_HAIR_SHOULDERS = [".OHHOCCCCCCOHHO.", ".OHHCCCCCCCCHHO.", ".OOOOCCCCCCOOOO."];

// Leg rows per frame: idle, left foot up, right foot up.
const LEGS = [
  ["...OPPPOOPPPO...", "...OPPPOOPPPO...", "...OBBBOOBBBO...", "...OOOOOOOOOO..."],
  ["...OPPPOOPPPO...", "...OBBBOOPPPO...", "...OOOOOOBBBO...", "........OOOOO..."],
  ["...OPPPOOPPPO...", "...OPPPOOBBBO...", "...OBBBOOOOOO...", "...OOOOO........"],
];

const CAP_ROWS = [
  "....OOOOOOOO....",
  "...ORRRRRRRRO...",
  "..ORRRRRRRRRRO..",
  ".ORRRRRRRRRRRRO.",
  ".OOOOOOOOOOOOOOO",
];

// [x, y, key] pixels painted on top for the small accessories.
const GLASSES: [number, number, string][] = [
  ...[3, 4, 5, 6, 9, 10, 11, 12].flatMap((x) => [
    [x, 6, "O"] as [number, number, string],
    [x, 9, "O"] as [number, number, string],
  ]),
  [3, 7, "O"], [3, 8, "O"], [6, 7, "O"], [6, 8, "O"],
  [9, 7, "O"], [9, 8, "O"], [12, 7, "O"], [12, 8, "O"],
  [7, 7, "O"], [8, 7, "O"],
];
const FLOWER: [number, number, string][] = [
  [12, 2, "F"], [11, 3, "F"], [12, 3, "Y"], [13, 3, "F"], [12, 4, "F"],
];

const W = 16;
const H = 22;

function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amount))));
  const r = ch(n >> 16), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function spriteRows(hair: number, acc: number, frame: number) {
  const rows = [...HEADS[hair], ...TORSO, ...LEGS[frame]];
  if (hair === 1) LONG_HAIR_SHOULDERS.forEach((r, i) => (rows[12 + i] = r));
  if (acc === 3) CAP_ROWS.forEach((r, i) => (rows[i] = r));
  const overlay = acc === 1 ? GLASSES : acc === 2 ? FLOWER : [];
  for (const [x, y, k] of overlay) rows[y] = rows[y].slice(0, x) + k + rows[y].slice(x + 1);
  return rows;
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
  const look = parseLook(avatarId);
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

  const skin = SKIN_TONES[look.skin];
  const shirt = SHIRT_COLORS[look.shirt];
  const colors: Record<string, string> = {
    O: "#2b1d14",
    H: HAIR_COLORS[look.hairColor],
    S: skin,
    E: "#2b1d14",
    W: "#ffffff",
    K: "#f2a0a0",
    m: shade(skin, 0.35),
    C: shirt,
    c: shade(shirt, 0.18),
    P: PANTS_COLORS[look.pants],
    B: "#5a3e2b",
    R: "#c8553d",
    F: "#f48fb1",
    Y: "#ffd54f",
  };
  const rects = runs(spriteRows(look.hair, look.acc, walking ? frame : 0), colors);

  return (
    <svg viewBox={`0 0 ${W} ${H + 1}`} className={className} shapeRendering="crispEdges" aria-hidden="true">
      {/* ground shadow, one row below the feet */}
      <rect x="3" y={H} width="10" height="1" fill="rgba(0,0,0,0.22)" />
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height="1" fill={r.fill} />
      ))}
    </svg>
  );
}
