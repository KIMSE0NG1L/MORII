// Pure canvas-rendering helpers shared between the live DrawingCanvas and
// the stroke-log replay player (src/app/(main)/diary/[id]/StrokeReplay.tsx).
// None of these touch React state - they only take a 2D context and plain
// values, so the exact same function produces the exact same pixels whether
// it's called live (while drawing) or later (while replaying a saved log).

import { getStroke } from "perfect-freehand";

export type Pt = { x: number; y: number };

export type BrushStyleName =
  | "ink"
  | "pencil"
  | "watercolor"
  | "airbrush"
  | "spray"
  | "grunge"
  | "splatter"
  | "blot";
export type StrokePoint = { x: number; y: number; pressure: number };

// One entry per committed edit, in order - the same granularity as the
// undo-history labels in DrawingCanvas.tsx. "stroke"/"shape"/"text"/
// "sticker" are true vector records replayed point-by-point. Everything
// else (layer ops, adjustments, photo paste, clear, selection move) is a
// "bitmapJump": a small reference frame of the composite at that moment,
// which the replay player cross-fades to instead of re-deriving the exact
// pixels - see the plan file for why (not worth vectorizing the rarer ops).
export type StrokeEvent =
  | {
      kind: "stroke";
      tool: "brush" | "eraser";
      brushStyle: BrushStyleName;
      color: string;
      size: number;
      opacity: number;
      layerId: string;
      seed: number;
      points: StrokePoint[];
      // Rendering recipe for this stroke. Absent on every log saved before
      // this field existed, which is exactly what keeps those old replays
      // pixel-identical to how they looked when drawn - they fall through to
      // the original per-point quadratic-curve / raw-linear-stamp math below
      // instead of picking up a smoothing change retroactively.
      // "freehand-v1": ink/eraser rendered as a perfect-freehand outline fill.
      // "smoothed-stamp-v1": pencil/watercolor/airbrush dabs placed along a
      // trailing-smoothed path instead of the raw linear-interpolated one.
      engine?: "freehand-v1" | "smoothed-stamp-v1";
    }
  | {
      kind: "shape";
      shape: "line" | "rect" | "circle";
      color: string;
      size: number;
      opacity: number;
      layerId: string;
      start: Pt;
      end: Pt;
    }
  | { kind: "text"; text: string; x: number; y: number; color: string; size: number; opacity: number; layerId: string }
  | { kind: "sticker"; emoji: string; x: number; y: number; size: number; opacity: number; layerId: string }
  | { kind: "bitmapJump"; label: string; image: string };

export type StrokeLog = {
  width: number;
  height: number;
  initialImage: string;
  events: StrokeEvent[];
};

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

// Causal (trailing-only) 3-tap smoothing for the dab-stamped brushes, which
// otherwise interpolate linearly between raw samples (stampAlongSegment
// above) and show every hand-tremor angle as a visible kink. Only looks
// backward at points already seen, never ahead, so it produces identical
// output whether called while points are still streaming in live (from
// handlePointerMove) or replayed afterward from a complete stored array
// (StrokeReplay) - both walk the same raw point sequence forward, index by
// index, through this exact function.
export function trailingSmoothedPoint(points: StrokePoint[], index: number): StrokePoint {
  const p = points[index];
  const p1 = points[index - 1];
  if (!p1) return p;
  const p2 = points[index - 2];
  if (!p2) return { x: (p.x + p1.x) / 2, y: (p.y + p1.y) / 2, pressure: p.pressure };
  return { x: (p.x + p1.x + p2.x) / 3, y: (p.y + p1.y + p2.y) / 3, pressure: p.pressure };
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

// Pressure -> stroke-width / dab-intensity scaling shared between live
// drawing and replay (pressure 0.5 is the no-pressure-info fallback used for
// mouse input). Kept here rather than duplicated in the replay player so a
// recorded stroke always renders pixel-identical to how it was drawn live.
export function widthForPressure(size: number, pressure: number) {
  return Math.max(1, size * (0.4 + 0.6 * pressure));
}

export function pressureFactor(pressure: number) {
  return 0.4 + 0.6 * pressure;
}

// The four textured styles (see textureDab below) share one set of
// radius/flow/spacing formulas - what makes each look different is the
// stamp image itself, not these numbers.
const TEXTURE_BRUSH_IDS = new Set<BrushStyleName>(["spray", "grunge", "splatter", "blot"]);

// Per-style dab radius, tuned so each brush style roughly tracks the same
// size slider the plain ink brush uses.
export function stampRadius(brushStyle: BrushStyleName, size: number, pf: number) {
  if (brushStyle === "pencil") return Math.max(2, size * 0.6);
  if (brushStyle === "airbrush") return Math.max(4, size * 1.4) * (0.7 + 0.3 * pf);
  if (TEXTURE_BRUSH_IDS.has(brushStyle)) return Math.max(6, size * 1.3) * (0.8 + 0.2 * pf);
  return Math.max(4, size * 1.0) * (0.75 + 0.25 * pf); // watercolor
}

// Per-style dab flow alpha, tuned so each brush style roughly tracks the
// same opacity slider the plain ink brush uses.
export function stampFlowAlpha(brushStyle: BrushStyleName, opacity: number, pf: number) {
  if (brushStyle === "pencil") return opacity * (0.5 + 0.5 * pf);
  if (brushStyle === "airbrush") return opacity * 0.35 * pf;
  if (TEXTURE_BRUSH_IDS.has(brushStyle)) return opacity * (0.55 + 0.45 * pf);
  return opacity * pf * 0.5; // watercolor - dabs overlap tightly (see stampSpacing), so lighter per-dab
}

// Distance between dabs along a stroke's path.
export function stampSpacing(brushStyle: BrushStyleName, size: number) {
  if (brushStyle === "pencil") return Math.max(1.5, size * 0.25);
  if (brushStyle === "airbrush") return Math.max(2, size * 0.5);
  if (TEXTURE_BRUSH_IDS.has(brushStyle)) return Math.max(3, size * 0.55); // sparser - individual blobs stay visible
  return Math.max(1, size * 0.12); // watercolor - tighter overlap for a smoother wash
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
  // of visible circles. Blur radius and stop count tuned up (twice now) in
  // response to "더 부드럽게" - a harder edge was still showing through at
  // the previous 1px/3-stop settings.
  ctx.filter = "blur(2px)";

  const bleedRadius = radius * 2.1;
  const bleed = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, bleedRadius);
  bleed.addColorStop(0, rgba(flowAlpha * 0.1));
  bleed.addColorStop(0.4, rgba(flowAlpha * 0.06));
  bleed.addColorStop(0.75, rgba(flowAlpha * 0.025));
  bleed.addColorStop(1, rgba(0));
  ctx.fillStyle = bleed;
  ctx.beginPath();
  ctx.arc(p.x, p.y, bleedRadius, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 3; i++) {
    const a = rng() * Math.PI * 2;
    const offset = rng() * radius * 0.12;
    const bx = p.x + Math.cos(a) * offset;
    const by = p.y + Math.sin(a) * offset;
    const br = radius * (0.85 + rng() * 0.25);
    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    grad.addColorStop(0, rgba(flowAlpha * 0.36));
    grad.addColorStop(0.35, rgba(flowAlpha * 0.26));
    grad.addColorStop(0.65, rgba(flowAlpha * 0.15));
    grad.addColorStop(0.88, rgba(flowAlpha * 0.05));
    grad.addColorStop(1, rgba(0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.filter = prevFilter;
  ctx.globalCompositeOperation = "source-over";
}

// --- Freehand (perfect-freehand) ink/eraser rendering -------------------
// Unlike the dab/quadratic machinery above, perfect-freehand needs the
// *whole* point list at once to compute a stable outline - it can't be
// drawn incrementally one segment at a time. So callers (live drawing and
// replay) redraw from a pre-stroke canvas snapshot every frame and fill the
// outline for however many points exist so far, rather than stamping one
// more piece onto the previous frame the way renderStrokePoint does.
export function freehandOutline(points: StrokePoint[], size: number): Pt[] {
  if (points.length === 0) return [];
  // A single point (a tap) has no direction for getStroke to build a
  // shape from - duplicating it gives a zero-length "stroke" that still
  // renders as a round dot via the cap, matching the old tap-dot behavior.
  const pts = points.length === 1 ? [points[0], points[0]] : points;
  const outline = getStroke(
    pts.map((p) => [p.x, p.y, p.pressure]),
    { size, thinning: 0.6, smoothing: 0.5, streamline: 0.5, simulatePressure: false },
  );
  return outline.map(([x, y]) => ({ x, y }));
}

export function fillFreehandOutline(
  ctx: CanvasRenderingContext2D,
  outline: Pt[],
  color: string,
  opacity: number,
  isEraser: boolean,
) {
  if (outline.length < 3) return;
  ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over";
  ctx.globalAlpha = isEraser ? 1 : opacity;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(outline[0].x, outline[0].y);
  for (let i = 1; i < outline.length; i++) ctx.lineTo(outline[i].x, outline[i].y);
  ctx.closePath();
  ctx.fill();
}

// Replay-side equivalent of the live drawLiveFreehand helper in
// DrawingCanvas.tsx: fills the outline for the first `upTo` points of a
// "freehand-v1" stroke event. The caller is responsible for restoring the
// pre-stroke snapshot first (see StrokeReplay.tsx's playEvent).
export function renderFreehandStroke(
  ctx: CanvasRenderingContext2D,
  event: Extract<StrokeEvent, { kind: "stroke" }>,
  upTo: number,
) {
  const outline = freehandOutline(event.points.slice(0, upTo), event.size);
  fillFreehandOutline(ctx, outline, event.color, event.opacity, event.tool === "eraser");
}

// --- Textured stamp brushes (spray/grunge/splatter/blot) -----------------
// These four styles stamp a real scanned-texture image instead of a
// procedural shape, for a more "real brush" grunge/splatter feel. The source
// art is OpenGameArt's CC0 "~100 grunge brushstrokes and splatters set" by
// Dino0040 (https://opengameart.org/content/100-grunge-brushstrokes-and-splatters-set),
// cropped down to 4 picks and resized; see public/assets/brush-textures/.
// Each file is a white shape carried entirely in its alpha channel (the RGB
// is flat white), meant to be tinted with the current color via a
// source-in composite - see getTintedTextureStamp.
const TEXTURE_BRUSH_SRC: Partial<Record<BrushStyleName, string>> = {
  spray: "/assets/brush-textures/spray.png",
  grunge: "/assets/brush-textures/grunge.png",
  splatter: "/assets/brush-textures/splatter.png",
  blot: "/assets/brush-textures/blot.png",
};

// Module-level (not per-component) caches: the images only need loading
// once per page, shared by every DrawingCanvas/StrokeReplay instance.
const textureImages = new Map<string, HTMLImageElement>();
const textureLoadPromises = new Map<string, Promise<HTMLImageElement | null>>();
const tintedStampCache = new Map<string, HTMLCanvasElement>();

function loadTextureImage(name: string, src: string): Promise<HTMLImageElement | null> {
  const existing = textureLoadPromises.get(name);
  if (existing) return existing;
  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      textureImages.set(name, img);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
  textureLoadPromises.set(name, promise);
  return promise;
}

// Kicks off loading every texture-brush image - call once on mount, both in
// the live editor and before replay starts, so a dab never silently no-ops
// just because the browser hadn't finished fetching a ~50KB PNG yet.
export function preloadTextureBrushes(): Promise<void> {
  return Promise.all(
    Object.entries(TEXTURE_BRUSH_SRC).map(([name, src]) => loadTextureImage(name, src)),
  ).then(() => undefined);
}

// Recolors the (white-alpha-mask) source image with `color`, once per
// (style, color) pair - every dab of every stroke in that color reuses the
// same small canvas instead of repeating the recolor composite per dab.
function getTintedTextureStamp(brushStyle: string, color: string): HTMLCanvasElement | null {
  const key = `${brushStyle}:${color}`;
  const cached = tintedStampCache.get(key);
  if (cached) return cached;
  const img = textureImages.get(brushStyle);
  if (!img) return null;
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  // "source-in" keeps only the destination's existing alpha shape, filled
  // with the new color - the standard recipe for tinting an alpha mask.
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  tintedStampCache.set(key, canvas);
  return canvas;
}

export function textureDab(
  ctx: CanvasRenderingContext2D,
  p: Pt,
  radius: number,
  color: string,
  flowAlpha: number,
  rotation: number,
  brushStyle: BrushStyleName,
) {
  const stamp = getTintedTextureStamp(brushStyle, color);
  if (!stamp) return; // image not loaded yet - skip this dab rather than throw
  const w = radius * 2;
  const h = (stamp.height / stamp.width) * w;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = flowAlpha;
  ctx.translate(p.x, p.y);
  ctx.rotate(rotation);
  ctx.drawImage(stamp, -w / 2, -h / 2, w, h);
  ctx.restore();
}

// --- Replay-only rendering --------------------------------------------
// The functions below render a recorded StrokeEvent for the replay player
// (src/app/(main)/diary/[id]/StrokeReplay.tsx). They mirror the drawing
// logic in DrawingCanvas.tsx's handlePointerDown/handlePointerMove exactly
// (same dab helpers/formulas above, same lastPoint/lastMid/carry state
// machine) so a replayed stroke lands on the same pixels it did live - but
// are kept separate from the live handlers, which stay tied to React
// pointer events and shouldn't be reshaped just to share this code.

function stampAt(
  ctx: CanvasRenderingContext2D,
  event: Extract<StrokeEvent, { kind: "stroke" }>,
  p: Pt,
  pf: number,
  rng: () => number,
) {
  const radius = stampRadius(event.brushStyle, event.size, pf);
  const flowAlpha = stampFlowAlpha(event.brushStyle, event.opacity, pf);
  if (event.brushStyle === "pencil") pencilDab(ctx, p, radius, event.color, flowAlpha, rng);
  else if (event.brushStyle === "airbrush") airbrushDab(ctx, p, radius, event.color, flowAlpha);
  else if (event.brushStyle === "watercolor") watercolorDab(ctx, p, radius, event.color, flowAlpha, rng);
  else textureDab(ctx, p, radius, event.color, flowAlpha, rng() * Math.PI * 2, event.brushStyle);
}

export type StrokeDrawState = { lastPoint: Pt; lastMid: Pt; carry: number };

// Draws just the Nth point of a "stroke" event onto `ctx`, given the state
// left over from drawing point N-1 (pass `{ lastPoint: points[0], lastMid:
// points[0], carry: 0 }` and index 0 to start a stroke). Returns the state
// to pass in for the next point - lets the replay player step through a
// stroke one point per animation frame.
export function renderStrokePoint(
  ctx: CanvasRenderingContext2D,
  event: Extract<StrokeEvent, { kind: "stroke" }>,
  index: number,
  state: StrokeDrawState,
  rng: () => number,
): StrokeDrawState {
  const isStampBrush = event.tool === "brush" && event.brushStyle !== "ink";
  // Only strokes saved by the smoothed code path get smoothed on replay -
  // older logs (no `engine`) keep rendering off the exact raw points they
  // were recorded with, so they replay pixel-identical to before.
  const p =
    isStampBrush && event.engine === "smoothed-stamp-v1"
      ? trailingSmoothedPoint(event.points, index)
      : event.points[index];
  const pf = pressureFactor(p.pressure);

  if (index === 0) {
    if (isStampBrush) stampAt(ctx, event, p, pf, rng);
    else {
      ctx.globalCompositeOperation = event.tool === "eraser" ? "destination-out" : "source-over";
      ctx.globalAlpha = event.tool === "eraser" ? 1 : event.opacity;
      ctx.fillStyle = event.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, widthForPressure(event.size, p.pressure) / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    return { lastPoint: p, lastMid: p, carry: 0 };
  }

  if (isStampBrush) {
    const spacing = stampSpacing(event.brushStyle, event.size);
    const carry = stampAlongSegment(state.lastPoint, p, spacing, state.carry, (sp) => stampAt(ctx, event, sp, pf, rng));
    return { lastPoint: p, lastMid: p, carry };
  }

  const newMid = { x: (state.lastPoint.x + p.x) / 2, y: (state.lastPoint.y + p.y) / 2 };
  ctx.globalCompositeOperation = event.tool === "eraser" ? "destination-out" : "source-over";
  ctx.globalAlpha = event.tool === "eraser" ? 1 : event.opacity;
  ctx.strokeStyle = event.color;
  ctx.lineWidth = widthForPressure(event.size, p.pressure);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(state.lastMid.x, state.lastMid.y);
  ctx.quadraticCurveTo(state.lastPoint.x, state.lastPoint.y, newMid.x, newMid.y);
  ctx.stroke();
  return { lastPoint: p, lastMid: newMid, carry: 0 };
}

// Draws a "shape" event at progress `t` (0..1) - the end point is
// interpolated from start toward its final position, so the replay player
// can animate the shape being drawn rather than popping it in instantly.
export function renderShapeEvent(ctx: CanvasRenderingContext2D, event: Extract<StrokeEvent, { kind: "shape" }>, t = 1) {
  const end = {
    x: event.start.x + (event.end.x - event.start.x) * t,
    y: event.start.y + (event.end.y - event.start.y) * t,
  };
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = event.opacity;
  ctx.strokeStyle = event.color;
  ctx.lineWidth = event.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (event.shape === "line") {
    ctx.moveTo(event.start.x, event.start.y);
    ctx.lineTo(end.x, end.y);
  } else if (event.shape === "rect") {
    ctx.rect(
      Math.min(event.start.x, end.x),
      Math.min(event.start.y, end.y),
      Math.abs(end.x - event.start.x),
      Math.abs(end.y - event.start.y),
    );
  } else {
    ctx.ellipse(
      (event.start.x + end.x) / 2,
      (event.start.y + end.y) / 2,
      Math.abs(end.x - event.start.x) / 2,
      Math.abs(end.y - event.start.y) / 2,
      0,
      0,
      Math.PI * 2,
    );
  }
  ctx.stroke();
}

export function renderTextEvent(ctx: CanvasRenderingContext2D, event: Extract<StrokeEvent, { kind: "text" }>) {
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = event.opacity;
  ctx.fillStyle = event.color;
  ctx.font = `${Math.max(14, event.size * 3)}px sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(event.text, event.x, event.y);
}

export function renderStickerEvent(ctx: CanvasRenderingContext2D, event: Extract<StrokeEvent, { kind: "sticker" }>) {
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = event.opacity;
  const stampSize = Math.max(24, event.size * 5);
  ctx.font = `${stampSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(event.emoji, event.x, event.y);
  ctx.textAlign = "left";
}
