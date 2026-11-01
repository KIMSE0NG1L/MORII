// Pure canvas-rendering helpers shared between the live DrawingCanvas and
// the stroke-log replay player (src/app/(main)/diary/[id]/StrokeReplay.tsx).
// None of these touch React state - they only take a 2D context and plain
// values, so the exact same function produces the exact same pixels whether
// it's called live (while drawing) or later (while replaying a saved log).

export type Pt = { x: number; y: number };

export function hexToRgb(hex: string) {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function clamp255(v: number) {
  return Math.max(0, Math.min(255, v));
}

// Walks from `from` to `to`, calling `stamp` at every `spacing` px along the
// way (continuing smoothly across segment/event boundaries via `carry`, the
// leftover distance from the previous call) and returns the new carry.
export function stampAlongSegment(from: Pt, to: Pt, spacing: number, carry: number, stamp: (p: Pt) => void) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const segLen = Math.hypot(dx, dy);
  if (segLen < 1e-6) return carry;
  const ux = dx / segLen;
  const uy = dy / segLen;
  let dist = spacing - carry;
  while (dist <= segLen) {
    stamp({ x: from.x + ux * dist, y: from.y + uy * dist });
    dist += spacing;
  }
  return (carry + segLen) % spacing;
}

// Tiny seeded PRNG (mulberry32). The textured brushes below take one of
// these instead of calling Math.random() directly, so a whole stroke's
// exact pixels are 100% reproducible from just its seed + points - the
// stroke log only needs to store one integer per stroke, not every random
// draw that happened during it.
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Graphite grain: a scatter of tiny specks instead of a solid fill, so the
// stroke reads as textured rather than a perfectly smooth line.
export function pencilDab(
  ctx: CanvasRenderingContext2D,
  p: Pt,
  radius: number,
  color: string,
  flowAlpha: number,
  rng: () => number,
) {
  const count = Math.max(5, Math.round(radius * 1.4));
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const r = rng() * radius;
    const speck = 0.4 + rng() * 0.7;
    ctx.globalAlpha = flowAlpha * (0.35 + rng() * 0.5);
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, speck, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Soft radial spray - built up by overlapping dabs along the path, the way
// a real airbrush deposits more pigment where it lingers. Fully
// deterministic already (a plain gradient fill), so no rng needed.
export function airbrushDab(ctx: CanvasRenderingContext2D, p: Pt, radius: number, color: string, flowAlpha: number) {
  const { r, g, b } = hexToRgb(color);
  const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
  grad.addColorStop(0, `rgba(${r},${g},${b},${flowAlpha})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

// Watercolor: a handful of irregular, randomly-offset soft blobs (for an
// organic, non-circular edge) plus a faint wide halo underneath (for pigment
// "bleed"), composited with multiply so overlapping passes deepen in tone
// the way wet pigment layers do, instead of just overwriting.
export function watercolorDab(
  ctx: CanvasRenderingContext2D,
  p: Pt,
  radius: number,
  color: string,
  flowAlpha: number,
  rng: () => number,
) {
  const { r, g, b } = hexToRgb(color);
  const rgba = (a: number) => `rgba(${r},${g},${b},${a})`;

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "multiply";
  const prevFilter = ctx.filter;
  // Soft-blurred fills + a gentler multi-stop falloff (instead of a hard
  // edge) are what make this read as a smooth wash rather than a cluster
  // of visible circles.
  ctx.filter = "blur(1px)";

  const bleedRadius = radius * 2.1;
  const bleed = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, bleedRadius);
  bleed.addColorStop(0, rgba(flowAlpha * 0.1));
  bleed.addColorStop(0.55, rgba(flowAlpha * 0.05));
  bleed.addColorStop(1, rgba(0));
  ctx.fillStyle = bleed;
  ctx.beginPath();
  ctx.arc(p.x, p.y, bleedRadius, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 3; i++) {
    const a = rng() * Math.PI * 2;
    const offset = rng() * radius * 0.18;
    const bx = p.x + Math.cos(a) * offset;
    const by = p.y + Math.sin(a) * offset;
    const br = radius * (0.85 + rng() * 0.25);
    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    grad.addColorStop(0, rgba(flowAlpha * 0.4));
    grad.addColorStop(0.5, rgba(flowAlpha * 0.28));
    grad.addColorStop(0.85, rgba(flowAlpha * 0.1));
    grad.addColorStop(1, rgba(0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.filter = prevFilter;
  ctx.globalCompositeOperation = "source-over";
}
