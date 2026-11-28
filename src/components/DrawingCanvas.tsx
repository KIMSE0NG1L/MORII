"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BoxSelect,
  Camera,
  ChevronDown,
  ChevronUp,
  Circle,
  Combine,
  Copy,
  Droplets,
  Eraser,
  Eye,
  EyeOff,
  GripVertical,
  History,
  ImagePlus,
  Layers,
  Minus,
  Move,
  MoreHorizontal,
  PaintBucket,
  Paintbrush,
  Pencil,
  PenTool,
  Plus,
  Redo2,
  Scissors,
  SlidersHorizontal,
  Square,
  SprayCan,
  Sticker,
  Trash2,
  Type,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  airbrushDab,
  clamp255,
  fillFreehandOutline,
  freehandOutline,
  hexToRgb,
  makeRng,
  pencilDab,
  pressureFactor as pressureFactorOf,
  stampAlongSegment,
  stampFlowAlpha,
  stampRadius,
  stampSpacing as stampSpacingFor,
  trailingSmoothedPoint,
  watercolorDab,
  type Pt,
  type StrokeEvent,
  type StrokeLog,
  type StrokePoint,
} from "@/lib/strokeRenderer";

// Wrapped at module scope (not inline in a handler) so the time-of-call
// isn't tangled up with the component's own render/effect purity tracking -
// this is plain wall-clock time for a gesture-timing check, not state.
function nowMs() {
  return Date.now();
}

const DEFAULT_COLOR = "#000000";
const STICKERS = ["🌸", "🌿", "🌙", "⭐", "☁️", "🍀", "☕", "✨", "❤️", "😊", "🐾", "🌈"];
const MAX_HISTORY = 20;
const MAX_ZOOM = 4;
// Two-finger distance has to change by more than this fraction of its
// gesture-start value before it counts as a deliberate pinch - below it, a
// two-finger drag pans without zooming at all (natural finger tremor/drift
// during a plain two-finger pan otherwise reads as a small, jittery pinch).
const PINCH_ZOOM_DEADZONE = 0.08;
// A two-finger touch that lands and lifts again within this time, without
// either finger's distance-from-start or the pinch midpoint drifting more
// than this many px, counts as a tap (quick undo) rather than a pinch/pan.
const TWO_FINGER_TAP_MAX_MS = 300;
const TWO_FINGER_TAP_MAX_DRIFT = 12;
const MAX_LAYERS = 6;
const BASE_LAYER_ID = "base";

// Exported so the diary composer can clear the autosaved draft once the
// drawing has actually been uploaded and saved as a diary entry.
// Bumped to v2 to orphan everyone's existing entry: old ones can have a
// template (mandala etc.) baked in from before saveDraft() was guarded to
// skip templated sessions, and there's no way to tell a legacy entry apart
// from a legitimate blank draft after the fact - a fresh key sidesteps that
// entirely instead of trying to sniff out which old entries are "clean."
export const DRAWING_DRAFT_KEY = "morii-drawing-draft-v2";

type Tool = "brush" | "eraser" | "fill" | "line" | "rect" | "circle" | "text" | "sticker" | "pan" | "select";

const MORE_TOOLS: { id: Tool; label: string; Icon: typeof Paintbrush }[] = [
  { id: "fill", label: "채우기", Icon: PaintBucket },
  { id: "line", label: "직선", Icon: Minus },
  { id: "rect", label: "사각형", Icon: Square },
  { id: "circle", label: "원", Icon: Circle },
  { id: "text", label: "텍스트", Icon: Type },
  { id: "sticker", label: "스티커", Icon: Sticker },
  { id: "select", label: "선택", Icon: BoxSelect },
  { id: "pan", label: "이동", Icon: Move },
];

type Rect = { x: number; y: number; w: number; h: number };

type BrushStyle = "ink" | "pencil" | "watercolor" | "airbrush";

// "ink" reuses the plain continuous stroke (existing quadratic-curve path);
// the other three are stamp-based - see stampAlongSegment + the *Dab
// functions below.
const BRUSH_STYLES: { id: BrushStyle; label: string; Icon: typeof Paintbrush }[] = [
  { id: "ink", label: "잉크펜", Icon: PenTool },
  { id: "pencil", label: "연필", Icon: Pencil },
  { id: "watercolor", label: "수채화", Icon: Droplets },
  { id: "airbrush", label: "에어브러시", Icon: SprayCan },
];

type EraserMode = "pixel" | "stroke";
// "pixel" erases exactly what the eraser shape passes over (today's
// behavior). "stroke" erases the whole connected blob of ink you tap -
// reuses floodFill (same algorithm as the fill tool) with a transparent
// target instead of a color, so one tap removes an entire line/stamp
// instead of just the touched sliver of it.
const ERASER_MODES: { id: EraserMode; label: string; Icon: typeof Eraser }[] = [
  { id: "pixel", label: "일반", Icon: Eraser },
  { id: "stroke", label: "선 전체", Icon: Scissors },
];

// Canvas2D natively supports these as globalCompositeOperation values - the
// watercolor brush already uses "multiply" internally (see
// strokeRenderer.ts's watercolorDab), this just exposes the same mechanism
// per-layer. Undefined/"source-over" is "normal" (no blending).
type BlendMode = "source-over" | "multiply" | "screen" | "overlay" | "darken" | "lighten";
const BLEND_MODES: { id: BlendMode; label: string }[] = [
  { id: "source-over", label: "표준" },
  { id: "multiply", label: "곱하기" },
  { id: "screen", label: "스크린" },
  { id: "overlay", label: "오버레이" },
  { id: "darken", label: "어둡게" },
  { id: "lighten", label: "밝게" },
];

type LayerMeta = { id: string; name: string; visible: boolean; opacity: number; blendMode: BlendMode };
type HistoryEntry = { label: string; layers: LayerMeta[]; bitmaps: Map<string, ImageData> };

function labelForTool(tool: Tool, brushStyle: BrushStyle) {
  if (tool === "brush") return BRUSH_STYLES.find((s) => s.id === brushStyle)?.label ?? "브러시";
  if (tool === "eraser") return "지우개";
  if (tool === "fill") return "채우기";
  if (tool === "line") return "직선";
  if (tool === "rect") return "사각형";
  if (tool === "circle") return "원";
  return "그리기";
}

export default function DrawingCanvas({
  canvasRef,
  templateUrl,
  aspectRatio,
  onBack,
  onSave,
  recordingRef,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  // Coloring sheet (mandala, painting outline...) laid onto a fresh canvas
  // instead of restoring the autosaved draft.
  templateUrl?: string;
  // Width/height chosen on the paper-setup screen. Omitted (e.g. drawing
  // onto a template) falls back to the old fill-the-viewport sizing.
  aspectRatio?: number;
  // Floating top-bar actions. Hidden when the parent doesn't supply them.
  onBack?: () => void;
  onSave?: () => void;
  // Optional "녹화" escape hatch - filled in after mount with a
  // getStrokeLog() the parent can call at save time, mirroring how
  // `canvasRef` itself is a plain object ref the child writes into rather
  // than a forwardRef.
  recordingRef?: React.RefObject<{ getStrokeLog: () => StrokeLog } | null>;
}) {
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [size, setSize] = useState(6);
  const [opacity, setOpacity] = useState(1);
  const [tool, setTool] = useState<Tool>("brush");
  const [stickerEmoji, setStickerEmoji] = useState(STICKERS[0]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [cursor, setCursor] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });
  const [textInput, setTextInput] = useState<{ x: number; y: number; value: string } | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [brushStyle, setBrushStyle] = useState<BrushStyle>("ink");
  const [showBrushPicker, setShowBrushPicker] = useState(false);
  const [eraserMode, setEraserMode] = useState<EraserMode>("pixel");
  const [showEraserPicker, setShowEraserPicker] = useState(false);
  // Explicit pixel box matching `aspectRatio`, computed from the available
  // width so the paper never gets visually squashed by a competing
  // max-height clamp. Null when aspectRatio isn't set - falls back to the
  // plain fill-the-viewport CSS classes below.
  const [boxSize, setBoxSize] = useState<{ width: number; height: number } | null>(null);

  // Layers: metadata lives in React state (drives the panel); the actual
  // pixel content lives in offscreen canvases in layerCanvases (a ref - not
  // reactive, since canvas elements aren't meaningfully comparable/cloneable
  // as React state). The visible <canvas ref={canvasRef}> is purely a
  // composite of all visible layers, never drawn on directly.
  const [layers, setLayers] = useState<LayerMeta[]>([
    { id: BASE_LAYER_ID, name: "배경", visible: true, opacity: 1, blendMode: "source-over" },
  ]);
  const [activeLayerId, setActiveLayerId] = useState(BASE_LAYER_ID);
  const [showLayers, setShowLayers] = useState(false);
  const layersRef = useRef(layers);
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);
  const layerCanvases = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const nextLayerNum = useRef(2);
  const nextLayerId = useRef(1);
  // Small preview PNGs for the layers panel - state (not a ref) because the
  // panel reads it during render, which refs aren't allowed to be.
  const [layerThumbnails, setLayerThumbnails] = useState<Record<string, string>>({});
  const lastThumbRefresh = useRef(0);
  const thumbRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingThumbIds = useRef<Set<string>>(new Set());
  // Pointer-based (not native HTML5 drag-and-drop, which iOS Safari doesn't
  // fire for touch) drag-to-reorder in the layers panel.
  const layerRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const draggingLayerId = useRef<string | null>(null);
  const [draggingLayerIdState, setDraggingLayerIdState] = useState<string | null>(null);

  // Undo/redo/history-panel all share one index-based history: history[i] is
  // a full snapshot (every layer's pixels + metadata) of the state right
  // after the i-th committed edit. Snapshots live in a ref (large ImageData,
  // not meant for React state); historyIndex/labels are state so the top bar
  // buttons and the history panel re-render correctly.
  const historySnapshots = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef(-1);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [historyLabels, setHistoryLabels] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const initialHistoryPushed = useRef(false);

  // Coalesces any number of compositeLayers() requests within one frame
  // (e.g. several coalesced pointermove samples) into a single redraw on
  // the next animation frame, instead of redrawing the whole canvas
  // synchronously on every one of them.
  const compositeRafRef = useRef<number | null>(null);
  // Debounces the localStorage draft's PNG encode so a burst of edits only
  // pays for it once, shortly after things settle.
  const saveDraftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Color/filter adjustment panel - applied to the current selection if one
  // exists, otherwise to the whole active layer. Sliders reset to 0 after
  // each "적용" so re-opening the panel always starts from a neutral state.
  const [showAdjust, setShowAdjust] = useState(false);
  const [brightness, setBrightness] = useState(0);
  const [contrastAmt, setContrastAmt] = useState(0);
  const [saturationAmt, setSaturationAmt] = useState(0);
  const [blurAmt, setBlurAmt] = useState(0);

  const outerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  // Midpoint of the last two points, so each brush segment is a quadratic
  // curve through it rather than a straight line - this is what makes fast
  // strokes look like a smooth line instead of a jagged polyline.
  const lastMid = useRef<{ x: number; y: number } | null>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  // Snapshot taken right when a shape drag starts, so every pointermove can
  // restore it and redraw the shape fresh (a rubber-band preview) instead of
  // smearing every intermediate frame onto the canvas.
  const previewBase = useRef<ImageData | null>(null);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  // Two-finger pinch-to-zoom/pan: every currently-down pointer's last known
  // screen position, keyed by pointerId. Once a second finger lands, this
  // (not the single-pointer draw/pan logic) drives zoom+pan, and any
  // in-progress stroke from the first finger just stops where it was.
  const activePointers = useRef<Map<number, { x: number; y: number; pointerType: string }>>(new Map());
  const pinchStart = useRef<{
    dist: number;
    zoom: number;
    pan: { x: number; y: number };
    mid: { x: number; y: number };
    startedAt: number;
    maxMidDrift: number;
    maxDistDrift: number;
  } | null>(null);
  const restoredDraft = useRef(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);
  // Leftover distance (px) toward the next stamp, for the textured brush
  // styles - keeps dabs evenly spaced across pointermove event boundaries.
  const stampCarry = useRef(0);
  // One seeded RNG per stroke (see stampDab/strokeRenderer.ts) so a
  // textured stroke's randomness is 100% reproducible from its seed alone.
  // The counter just needs to differ stroke to stroke, not be truly random.
  const strokeRng = useRef<(() => number) | null>(null);
  const strokeSeedCounter = useRef(1);

  // Stroke-log capture (optional "녹화" feature, see RecordComposer's
  // checkbox): a vector record of every committed edit, in order, mirroring
  // pushHistoryEntry's call sites one-for-one. Purely additive - nothing
  // here reads from or feeds back into the undo/layer/draw logic above, so
  // it can't affect the existing drawing behavior even if it has bugs.
  const strokesRef = useRef<StrokeEvent[]>([]);
  const initialImageRef = useRef<string>("");
  const strokePointsRef = useRef<StrokePoint[]>([]);
  const shapeEndRef = useRef<Pt | null>(null);

  // Rectangle selection: `selection` is the marquee (canvas-local/CSS-pixel
  // coords, like getPos()). `selectDragStart` tracks an in-progress new
  // marquee drag; `floatingDrag` tracks a pick-up-and-move of whatever was
  // inside the selection when the drag started - `isFloating` mirrors
  // "floatingDrag.current !== null" as state purely so JSX can branch on it
  // (reading a ref's .current during render isn't allowed to react to
  // changes, only state is).
  const [selection, setSelection] = useState<Rect | null>(null);
  const [isFloating, setIsFloating] = useState(false);
  const selectDragStart = useRef<Pt | null>(null);
  const floatingDrag = useRef<{
    previewCanvas: HTMLCanvasElement;
    selX: number;
    selY: number;
    w: number;
    h: number;
    startPointerX: number;
    startPointerY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  // Every tool switch goes through here so leaving "select" always drops
  // any in-progress selection/drag instead of leaving stale state around.
  function changeTool(next: Tool) {
    if (next !== "select") {
      setSelection(null);
      setIsFloating(false);
      selectDragStart.current = null;
      floatingDrag.current = null;
    }
    setTool(next);
  }

  function activeLayerCanvas() {
    return layerCanvases.current.get(activeLayerId) ?? null;
  }

  function activeCtx() {
    return activeLayerCanvas()?.getContext("2d") ?? null;
  }

  // Redraws the single visible <canvas> from every visible layer, bottom to
  // top. A plain white fill underneath guarantees the exported PNG never has
  // see-through gaps even if the bottom layer's visibility gets toggled off.
  function compositeLayers(layersOverride?: LayerMeta[]) {
    const display = canvasRef.current;
    if (!display) return;
    const dctx = display.getContext("2d");
    if (!dctx) return;
    // Layer canvases are copied in as plain device-pixel bitmaps (drawImage
    // ignores the source's own transform), so the display context must be
    // at the identity transform here - it's never drawn to any other way.
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.clearRect(0, 0, display.width, display.height);
    dctx.fillStyle = "#ffffff";
    dctx.fillRect(0, 0, display.width, display.height);
    for (const layer of layersOverride ?? layersRef.current) {
      if (!layer.visible) continue;
      const lc = layerCanvases.current.get(layer.id);
      if (!lc) continue;
      dctx.globalAlpha = layer.opacity;
      dctx.globalCompositeOperation = layer.blendMode ?? "source-over";
      dctx.drawImage(lc, 0, 0);
    }
    dctx.globalAlpha = 1;
    dctx.globalCompositeOperation = "source-over";

    // A piece being dragged by the select tool is purely a visual overlay
    // on top of the composite - it isn't drawn onto any layer until the
    // drag is released (see handlePointerUp's "select" branch).
    const f = floatingDrag.current;
    if (f) {
      const dpr = window.devicePixelRatio || 1;
      dctx.drawImage(
        f.previewCanvas,
        0,
        0,
        f.previewCanvas.width,
        f.previewCanvas.height,
        (f.selX + f.offsetX) * dpr,
        (f.selY + f.offsetY) * dpr,
        f.w * dpr,
        f.h * dpr,
      );
    }
  }

  // For the hot paths (dragging a stroke/shape-preview/floating selection),
  // where many pointermove samples can land within one frame, this coalesces
  // them into a single compositeLayers() call on the next frame instead of
  // redrawing the whole canvas synchronously on every one of them. One-off
  // edits (tool commits, layer ops, undo/redo, ...) keep calling
  // compositeLayers() directly - only the per-move drag loops use this.
  function scheduleComposite() {
    if (compositeRafRef.current !== null) return;
    compositeRafRef.current = requestAnimationFrame(() => {
      compositeRafRef.current = null;
      compositeLayers();
    });
  }

  // Cancels any pending scheduleComposite() frame and composites right now -
  // called when a drag ends (handlePointerUp) so the final frame is visible
  // immediately instead of waiting for whatever's left of the current
  // animation frame, which matters for anything that reads the display
  // canvas right away (e.g. the save flow's canvas.toBlob()).
  function flushComposite() {
    if (compositeRafRef.current !== null) {
      cancelAnimationFrame(compositeRafRef.current);
      compositeRafRef.current = null;
    }
    compositeLayers();
  }

  useEffect(() => {
    return () => {
      if (compositeRafRef.current !== null) cancelAnimationFrame(compositeRafRef.current);
    };
  }, []);

  // Classic 4-directional flood fill, iterative (not recursive, so it can't
  // stack-overflow on a large uniform region) with a color-distance
  // tolerance so filling up to an anti-aliased line doesn't leave a thin
  // unfilled fringe right at the edge.
  function floodFill(data: Uint8ClampedArray, width: number, height: number, startX: number, startY: number, fill: [number, number, number, number], tolerance = 48) {
    const startIdx = (startY * width + startX) * 4;
    const targetR = data[startIdx];
    const targetG = data[startIdx + 1];
    const targetB = data[startIdx + 2];
    const targetA = data[startIdx + 3];
    const [fr, fg, fb, fa] = fill;
    if (targetR === fr && targetG === fg && targetB === fb && targetA === fa) return;

    const toleranceSq = tolerance * tolerance * 4;
    const visited = new Uint8Array(width * height);
    const stack: number[] = [startX, startY];
    while (stack.length > 0) {
      const y = stack.pop()!;
      const x = stack.pop()!;
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      const pixelIndex = y * width + x;
      if (visited[pixelIndex]) continue;
      visited[pixelIndex] = 1;
      const idx = pixelIndex * 4;
      const dr = data[idx] - targetR;
      const dg = data[idx + 1] - targetG;
      const db = data[idx + 2] - targetB;
      const da = data[idx + 3] - targetA;
      if (dr * dr + dg * dg + db * db + da * da > toleranceSq) continue;
      data[idx] = fr;
      data[idx + 1] = fg;
      data[idx + 2] = fb;
      data[idx + 3] = fa;
      stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    }
  }

  // Fills the connected region under the click with the current color -
  // treated as a single bitmapJump for the stroke log (see strokeRenderer.ts)
  // rather than a vector event, since "which pixels got touched" has no
  // compact vector representation worth replaying point-by-point.
  function fillAt(pos: Pt) {
    const lc = activeLayerCanvas();
    const ctx = activeCtx();
    if (!lc || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const px = Math.floor(pos.x * dpr);
    const py = Math.floor(pos.y * dpr);
    if (px < 0 || py < 0 || px >= lc.width || py >= lc.height) return;

    const imageData = ctx.getImageData(0, 0, lc.width, lc.height);
    const { r, g, b } = hexToRgb(color);
    floodFill(imageData.data, lc.width, lc.height, px, py, [r, g, b, Math.round(opacity * 255)]);
    ctx.putImageData(imageData, 0, 0);

    compositeLayers();
    recordBitmapJump("채우기");
    pushHistoryEntry("채우기");
  }

  // "선 전체" eraser mode: erases the whole connected blob of ink under the
  // tap in one go, reusing floodFill (same algorithm the fill tool uses)
  // with a fully transparent target instead of a color - a tap anywhere on
  // a line removes that whole line instead of just the touched pixels.
  function eraseStrokeAt(pos: Pt) {
    const lc = activeLayerCanvas();
    const ctx = activeCtx();
    if (!lc || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const px = Math.floor(pos.x * dpr);
    const py = Math.floor(pos.y * dpr);
    if (px < 0 || py < 0 || px >= lc.width || py >= lc.height) return;

    const imageData = ctx.getImageData(0, 0, lc.width, lc.height);
    floodFill(imageData.data, lc.width, lc.height, px, py, [0, 0, 0, 0]);
    ctx.putImageData(imageData, 0, 0);

    compositeLayers();
    recordBitmapJump("선 지우개");
    pushHistoryEntry("선 지우개");
  }

  // Clears whatever is inside `selection` from the active layer (white on
  // the base/background layer so the paper stays opaque, transparent
  // otherwise).
  function deleteSelection() {
    if (!selection) return;
    const ctx = activeCtx();
    if (!ctx) return;
    if (activeLayerId === BASE_LAYER_ID) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(selection.x, selection.y, selection.w, selection.h);
    } else {
      ctx.clearRect(selection.x, selection.y, selection.w, selection.h);
    }
    compositeLayers();
    recordBitmapJump("선택 영역 삭제");
    pushHistoryEntry("선택 영역 삭제");
    setSelection(null);
  }

  // Applies the brightness/contrast/saturation/blur sliders to the current
  // selection if one exists, otherwise to the whole active layer. Blur goes
  // through a temp canvas first (ctx.filter only affects new drawing, not
  // existing pixels); brightness/contrast/saturation are a straight
  // per-pixel pass over the (possibly blur-updated) region afterward.
  function applyAdjustments() {
    if (brightness === 0 && contrastAmt === 0 && saturationAmt === 0 && blurAmt === 0) return;
    const lc = activeLayerCanvas();
    const ctx = activeCtx();
    if (!lc || !ctx) return;
    const dpr = window.devicePixelRatio || 1;

    const cssX = selection?.x ?? 0;
    const cssY = selection?.y ?? 0;
    const cssW = selection?.w ?? lc.width / dpr;
    const cssH = selection?.h ?? lc.height / dpr;
    const rx = Math.round(cssX * dpr);
    const ry = Math.round(cssY * dpr);
    const rw = Math.max(1, Math.round(cssW * dpr));
    const rh = Math.max(1, Math.round(cssH * dpr));

    if (blurAmt > 0) {
      const temp = document.createElement("canvas");
      temp.width = rw;
      temp.height = rh;
      const tctx = temp.getContext("2d");
      if (tctx) {
        tctx.filter = `blur(${blurAmt}px)`;
        tctx.drawImage(lc, rx, ry, rw, rh, 0, 0, rw, rh);
        ctx.clearRect(cssX, cssY, cssW, cssH);
        ctx.drawImage(temp, cssX, cssY, cssW, cssH);
      }
    }

    if (brightness !== 0 || contrastAmt !== 0 || saturationAmt !== 0) {
      const imageData = ctx.getImageData(rx, ry, rw, rh);
      const data = imageData.data;
      const b = brightness * 255;
      const cFactor = (259 * (contrastAmt * 255 + 255)) / (255 * (259 - contrastAmt * 255));
      const sFactor = 1 + saturationAmt;
      for (let i = 0; i < data.length; i += 4) {
        let r = data[i] + b;
        let g = data[i + 1] + b;
        let bch = data[i + 2] + b;
        r = cFactor * (r - 128) + 128;
        g = cFactor * (g - 128) + 128;
        bch = cFactor * (bch - 128) + 128;
        const gray = 0.299 * r + 0.587 * g + 0.114 * bch;
        r = gray + (r - gray) * sFactor;
        g = gray + (g - gray) * sFactor;
        bch = gray + (bch - gray) * sFactor;
        data[i] = clamp255(r);
        data[i + 1] = clamp255(g);
        data[i + 2] = clamp255(bch);
      }
      ctx.putImageData(imageData, rx, ry);
    }

    compositeLayers();
    recordBitmapJump("보정 적용");
    pushHistoryEntry("보정 적용");
    setBrightness(0);
    setContrastAmt(0);
    setSaturationAmt(0);
    setBlurAmt(0);
  }

  // `changedLayerIds` defaults to just the active layer, since almost every
  // edit (a stroke, fill, text, sticker, adjustment...) only touches it - the
  // untouched layers' bitmaps are carried over by reference from the
  // previous entry instead of being re-copied via getImageData, which is the
  // expensive part of a snapshot. Layer-structural ops (add/delete/
  // reorder/visibility) pass [] explicitly since they don't touch any
  // layer's pixels at all, not even the active one.
  // Small (48px) preview of each layer for the panel - throttled with a
  // trailing edge, since this runs on every committed edit (see
  // pushHistoryEntry) but a thumbnail doesn't need to be any fresher than
  // ~400ms during rapid-fire edits. The trailing timer matters: without it,
  // a quick burst of edits (draw, duplicate, merge, all within 400ms of each
  // other) would have every refresh attempt skipped and leave the panel
  // showing stale/missing thumbnails until the next *unrelated* edit.
  function flushLayerThumbnails() {
    if (thumbRefreshTimer.current !== null) {
      clearTimeout(thumbRefreshTimer.current);
      thumbRefreshTimer.current = null;
    }
    lastThumbRefresh.current = nowMs();
    const ids = [...pendingThumbIds.current];
    pendingThumbIds.current.clear();
    const THUMB = 48;
    const updates: Record<string, string> = {};
    for (const id of ids) {
      const lc = layerCanvases.current.get(id);
      if (!lc || lc.width === 0 || lc.height === 0) continue;
      const scale = THUMB / Math.max(lc.width, lc.height);
      const temp = document.createElement("canvas");
      temp.width = Math.max(1, Math.round(lc.width * scale));
      temp.height = Math.max(1, Math.round(lc.height * scale));
      const tctx = temp.getContext("2d");
      if (!tctx) continue;
      tctx.fillStyle = "#ffffff";
      tctx.fillRect(0, 0, temp.width, temp.height);
      tctx.drawImage(lc, 0, 0, lc.width, lc.height, 0, 0, temp.width, temp.height);
      updates[id] = temp.toDataURL("image/png");
    }
    if (Object.keys(updates).length > 0) setLayerThumbnails((prev) => ({ ...prev, ...updates }));
  }

  function refreshLayerThumbnails(layerIds: string[]) {
    for (const id of layerIds) pendingThumbIds.current.add(id);
    const elapsed = nowMs() - lastThumbRefresh.current;
    if (elapsed >= 400) {
      flushLayerThumbnails();
    } else if (thumbRefreshTimer.current === null) {
      thumbRefreshTimer.current = setTimeout(flushLayerThumbnails, 400 - elapsed);
    }
  }

  useEffect(() => {
    return () => {
      if (thumbRefreshTimer.current !== null) clearTimeout(thumbRefreshTimer.current);
    };
  }, []);

  function pushHistoryEntry(label: string, layersOverride?: LayerMeta[], changedLayerIds?: string[]) {
    const layersNow = layersOverride ?? layersRef.current;
    const prevEntry = historySnapshots.current[historyIndexRef.current];
    const changed = new Set(changedLayerIds ?? [activeLayerId]);
    const bitmaps = new Map<string, ImageData>();
    for (const l of layersNow) {
      const reused = !changed.has(l.id) ? prevEntry?.bitmaps.get(l.id) : undefined;
      if (reused) {
        bitmaps.set(l.id, reused);
        continue;
      }
      const lc = layerCanvases.current.get(l.id);
      const lctx = lc?.getContext("2d");
      if (!lc || !lctx) continue;
      bitmaps.set(l.id, lctx.getImageData(0, 0, lc.width, lc.height));
    }
    const next = historySnapshots.current.slice(0, historyIndexRef.current + 1);
    next.push({ label, layers: layersNow.map((l) => ({ ...l })), bitmaps });
    if (next.length > MAX_HISTORY) next.shift();
    historySnapshots.current = next;
    historyIndexRef.current = next.length - 1;
    setHistoryIndex(historyIndexRef.current);
    setHistoryLabels(next.map((e) => e.label));
    saveDraft();
    refreshLayerThumbnails(layersNow.map((l) => l.id));
  }

  function restoreHistoryEntry(index: number) {
    const entry = historySnapshots.current[index];
    if (!entry) return;
    const idsHere = new Set(entry.layers.map((l) => l.id));
    for (const l of entry.layers) {
      let lc = layerCanvases.current.get(l.id);
      const snap = entry.bitmaps.get(l.id);
      if (!lc && snap) {
        // This layer's canvas was removed by the cleanup pass below during
        // an earlier undo that went past this layer's add - recreate it
        // (pre-existing bug, not from this change: without this, redoing
        // forward past a layer add permanently loses that layer, since
        // nothing ever recreated its canvas) sized to match the snapshot,
        // which is exactly the size it was captured at.
        lc = document.createElement("canvas");
        lc.width = snap.width;
        lc.height = snap.height;
        layerCanvases.current.set(l.id, lc);
      }
      if (!lc || !snap) continue;
      const lctx = lc.getContext("2d");
      if (lctx && lc.width === snap.width && lc.height === snap.height) lctx.putImageData(snap, 0, 0);
    }
    for (const id of [...layerCanvases.current.keys()]) {
      if (!idsHere.has(id)) layerCanvases.current.delete(id);
    }
    const restoredLayers = entry.layers.map((l) => ({ ...l }));
    setLayers(restoredLayers);
    layersRef.current = restoredLayers;
    setActiveLayerId((cur) => (idsHere.has(cur) ? cur : (restoredLayers[0]?.id ?? cur)));
    compositeLayers(restoredLayers);
    saveDraft();
    lastThumbRefresh.current = 0; // undo/redo is a discrete jump, not a rapid stream - don't throttle it away
    refreshLayerThumbnails(restoredLayers.map((l) => l.id));
  }

  function undo() {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    setHistoryIndex(historyIndexRef.current);
    restoreHistoryEntry(historyIndexRef.current);
  }

  function redo() {
    if (historyIndexRef.current >= historySnapshots.current.length - 1) return;
    historyIndexRef.current += 1;
    setHistoryIndex(historyIndexRef.current);
    restoreHistoryEntry(historyIndexRef.current);
  }

  function jumpToHistory(index: number) {
    if (index === historyIndexRef.current) return;
    if (index < 0 || index >= historySnapshots.current.length) return;
    historyIndexRef.current = index;
    setHistoryIndex(index);
    restoreHistoryEntry(index);
  }

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyLabels.length - 1;

  function addLayer() {
    if (layers.length >= MAX_LAYERS) return;
    const display = canvasRef.current;
    if (!display) return;
    const id = `layer-extra-${nextLayerId.current++}`;
    const lc = document.createElement("canvas");
    lc.width = display.width;
    lc.height = display.height;
    const dpr = window.devicePixelRatio || 1;
    lc.getContext("2d")?.scale(dpr, dpr);
    layerCanvases.current.set(id, lc);

    const meta: LayerMeta = {
      id,
      name: `레이어 ${nextLayerNum.current++}`,
      visible: true,
      opacity: 1,
      blendMode: "source-over",
    };
    const next = [...layers, meta];
    setLayers(next);
    layersRef.current = next;
    setActiveLayerId(id);
    compositeLayers(next);
    recordBitmapJump("레이어 추가");
    pushHistoryEntry("레이어 추가", next, []);
  }

  // Copies a layer's pixels into a brand-new layer stacked right above it.
  function duplicateLayer(id: string) {
    if (layers.length >= MAX_LAYERS) return;
    const srcIndex = layers.findIndex((l) => l.id === id);
    const src = layers[srcIndex];
    const srcCanvas = layerCanvases.current.get(id);
    const display = canvasRef.current;
    if (srcIndex < 0 || !src || !srcCanvas || !display) return;

    const newId = `layer-extra-${nextLayerId.current++}`;
    const lc = document.createElement("canvas");
    lc.width = display.width;
    lc.height = display.height;
    const lctx = lc.getContext("2d");
    // Copy device-pixel-for-device-pixel first, while the context is still
    // at the identity transform - drawImage's 2-arg form draws at the
    // source's natural size in whatever units the current transform uses,
    // so scaling first (like a brand-new blank layer does) would blow the
    // copy up by dpr^2.
    lctx?.drawImage(srcCanvas, 0, 0);
    const dpr = window.devicePixelRatio || 1;
    lctx?.scale(dpr, dpr);
    layerCanvases.current.set(newId, lc);

    const meta: LayerMeta = { ...src, id: newId, name: `${src.name} 복사본` };
    const next = [...layers.slice(0, srcIndex + 1), meta, ...layers.slice(srcIndex + 1)];
    setLayers(next);
    layersRef.current = next;
    setActiveLayerId(newId);
    compositeLayers(next);
    recordBitmapJump("레이어 복제");
    pushHistoryEntry("레이어 복제", next, []);
  }

  // Flattens a layer onto the one directly below it (its own opacity/blend
  // mode applied in the process, matching how it already looked composited)
  // and removes it. No-op on the bottom layer - there's nothing below it.
  function mergeDown(id: string) {
    const i = layers.findIndex((l) => l.id === id);
    if (i <= 0) return;
    const src = layers[i];
    const below = layers[i - 1];
    const srcCanvas = layerCanvases.current.get(id);
    const dstCanvas = layerCanvases.current.get(below.id);
    const dctx = dstCanvas?.getContext("2d");
    if (!srcCanvas || !dctx) return;

    dctx.globalAlpha = src.opacity;
    dctx.globalCompositeOperation = src.blendMode ?? "source-over";
    dctx.drawImage(srcCanvas, 0, 0);
    dctx.globalAlpha = 1;
    dctx.globalCompositeOperation = "source-over";

    layerCanvases.current.delete(id);
    const next = layers.filter((l) => l.id !== id);
    setLayers(next);
    layersRef.current = next;
    setActiveLayerId(below.id);
    compositeLayers(next);
    recordBitmapJump("아래로 병합");
    // The merged-into layer's pixels changed, not just metadata - unlike
    // the other layer-structural ops, this one needs a real snapshot of it.
    pushHistoryEntry("아래로 병합", next, [below.id]);
  }

  function setLayerBlendMode(id: string, mode: BlendMode) {
    const next = layers.map((l) => (l.id === id ? { ...l, blendMode: mode } : l));
    setLayers(next);
    layersRef.current = next;
    compositeLayers(next);
    recordBitmapJump("블렌드 모드 변경");
    pushHistoryEntry("블렌드 모드 변경", next, []);
  }

  function deleteLayer(id: string) {
    if (layers.length <= 1) return;
    const next = layers.filter((l) => l.id !== id);
    layerCanvases.current.delete(id);
    setLayers(next);
    layersRef.current = next;
    setActiveLayerId((cur) => (cur === id ? (next[next.length - 1]?.id ?? cur) : cur));
    compositeLayers(next);
    recordBitmapJump("레이어 삭제");
    pushHistoryEntry("레이어 삭제", next, []);
  }

  function moveLayer(id: string, direction: -1 | 1) {
    const i = layers.findIndex((l) => l.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= layers.length) return;
    const next = [...layers];
    [next[i], next[j]] = [next[j], next[i]];
    setLayers(next);
    layersRef.current = next;
    compositeLayers(next);
    recordBitmapJump("레이어 순서 변경");
    pushHistoryEntry("레이어 순서 변경", next, []);
  }

  // Pointer-based drag-to-reorder for the layers panel (not native HTML5
  // drag-and-drop - iOS Safari never fires dragstart for a touch-initiated
  // drag, which would make this silently do nothing for most phones). The
  // panel renders layers top-of-list = topmost layer, i.e. [...layers]
  // reversed - this reorders the reversed (display) order, then un-reverses
  // before writing back to `layers`.
  function startLayerDrag(e: React.PointerEvent, id: string) {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingLayerId.current = id;
    setDraggingLayerIdState(id);
  }

  function onLayerDragMove(e: React.PointerEvent) {
    const dragId = draggingLayerId.current;
    if (!dragId) return;
    const y = e.clientY;
    const display = [...layersRef.current].reverse();
    const from = display.findIndex((l) => l.id === dragId);
    if (from < 0) return;
    for (let i = 0; i < display.length; i++) {
      if (i === from) continue;
      const el = layerRowRefs.current.get(display[i].id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const crossedGoingDown = i > from && y > mid;
      const crossedGoingUp = i < from && y < mid;
      if (crossedGoingDown || crossedGoingUp) {
        const reordered = [...display];
        const [moved] = reordered.splice(from, 1);
        reordered.splice(i, 0, moved);
        const next = [...reordered].reverse();
        setLayers(next);
        layersRef.current = next;
        compositeLayers(next);
        break;
      }
    }
  }

  function endLayerDrag() {
    if (!draggingLayerId.current) return;
    draggingLayerId.current = null;
    setDraggingLayerIdState(null);
    recordBitmapJump("레이어 순서 변경");
    pushHistoryEntry("레이어 순서 변경", layersRef.current, []);
  }

  function toggleLayerVisible(id: string) {
    const next = layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l));
    setLayers(next);
    layersRef.current = next;
    compositeLayers(next);
    recordBitmapJump("레이어 표시 전환");
    pushHistoryEntry("레이어 표시 전환", next, []);
  }

  function setLayerOpacity(id: string, value: number) {
    const next = layers.map((l) => (l.id === id ? { ...l, opacity: value } : l));
    setLayers(next);
    layersRef.current = next;
    compositeLayers(next);
  }

  // This autosave exists purely to resume a genuinely blank drawing after an
  // accidental refresh/back-navigation. A template session (mandala,
  // activity guide, session material) must never write here - otherwise its
  // bitmap becomes "the" draft and silently resurfaces on every future
  // blank/직접 그리기 session that has no template of its own.
  function writeDraftNow() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      localStorage.setItem(DRAWING_DRAFT_KEY, canvas.toDataURL("image/png"));
    } catch {
      // Private browsing / full storage - the draft is just a convenience, drop it silently.
    }
  }

  // Called on every committed edit, but the actual PNG encode is the
  // expensive part - debounced so a burst of strokes only pays for it once,
  // shortly after things settle, instead of on every single one.
  function saveDraft() {
    if (templateUrl) return;
    if (saveDraftTimer.current) clearTimeout(saveDraftTimer.current);
    saveDraftTimer.current = setTimeout(() => {
      saveDraftTimer.current = null;
      writeDraftNow();
    }, 500);
  }

  useEffect(() => {
    return () => {
      // Flush immediately on unmount (navigating away) rather than losing a
      // pending debounced write - this is a best-effort "resume after
      // accidental refresh" convenience, not the real save path (that reads
      // the live canvas directly - see RecordComposer's imageBlob()), so a
      // template session is still excluded the same way saveDraft() is.
      if (saveDraftTimer.current) {
        clearTimeout(saveDraftTimer.current);
        saveDraftTimer.current = null;
        if (!templateUrl) writeDraftNow();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Small (max 480px long edge) JPEG snapshot of the current composite, for
  // the stroke log's initial frame / bitmapJump events - these are replay
  // reference frames, not the final artwork, so low-res + lossy is fine and
  // keeps the log's size reasonable.
  function captureSmallBitmap(maxSize = 480) {
    const display = canvasRef.current;
    if (!display || display.width === 0 || display.height === 0) return "";
    const scale = Math.min(1, maxSize / Math.max(display.width, display.height));
    const w = Math.max(1, Math.round(display.width * scale));
    const h = Math.max(1, Math.round(display.height * scale));
    const temp = document.createElement("canvas");
    temp.width = w;
    temp.height = h;
    const tctx = temp.getContext("2d");
    if (!tctx) return "";
    tctx.drawImage(display, 0, 0, display.width, display.height, 0, 0, w, h);
    return temp.toDataURL("image/jpeg", 0.7);
  }

  function recordBitmapJump(label: string) {
    strokesRef.current.push({ kind: "bitmapJump", label, image: captureSmallBitmap() });
  }

  function getStrokeLog(): StrokeLog {
    const display = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    // Recorded stroke/shape points are in CSS-pixel canvas coordinates (see
    // getPos/ctx.scale(dpr)), not the device-pixel canvas.width/height - the
    // log's width/height need to match that same space so replay can size
    // its canvas 1:1 without needing to know this device's dpr.
    return {
      width: display ? display.width / dpr : 0,
      height: display ? display.height / dpr : 0,
      initialImage: initialImageRef.current,
      events: strokesRef.current,
    };
  }

  // Hands the parent a way to pull the recorded stroke log at save time,
  // without turning this component into a forwardRef.
  useEffect(() => {
    if (recordingRef) recordingRef.current = { getStrokeLog };
    return () => {
      if (recordingRef) recordingRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingRef]);

  // Resizes one layer's offscreen canvas to the new backing-store pixel
  // size, preserving its existing content (scaled) via a snapshot-and-redraw
  // - the same technique the old single-canvas version used. Returns
  // whether it already had content, so the caller knows whether this is a
  // brand-new (never-sized) canvas that still needs its initial fill.
  function resizeLayerCanvas(
    lc: HTMLCanvasElement,
    nextWidth: number,
    nextHeight: number,
    cssWidth: number,
    cssHeight: number,
    dpr: number,
  ) {
    const prevHadContent = lc.width > 0 && lc.height > 0;
    const snapshot = document.createElement("canvas");
    if (prevHadContent) {
      snapshot.width = lc.width;
      snapshot.height = lc.height;
      snapshot.getContext("2d")?.drawImage(lc, 0, 0);
    }
    lc.width = nextWidth;
    lc.height = nextHeight;
    const lctx = lc.getContext("2d");
    if (!lctx) return prevHadContent;
    lctx.scale(dpr, dpr);
    if (prevHadContent) {
      lctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, cssWidth, cssHeight);
    }
    return prevHadContent;
  }

  // Backs every layer at devicePixelRatio resolution so strokes stay crisp
  // on retina/phone screens, and re-does this on layout/orientation changes
  // without losing content. The canvas's CSS size always matches the
  // (fixed, clipped) viewport 1:1 - zoom/pan are applied as a separate
  // visual transform on top, never touching the backing store or drawing
  // coordinates.
  useEffect(() => {
    const display = canvasRef.current;
    const viewport = viewportRef.current;
    if (!display || !viewport) return;
    // canvasRef/layerCanvases are refs the parent hands down unchanged
    // across a remount (e.g. RecordComposer's drawResetKey bump), so if this
    // instance gets torn down while a template/draft image is still
    // decoding, its onload would otherwise fire later and paint straight
    // onto whatever canvas now sits behind that same ref - a fresh, "reset"
    // instance's. Guard every async continuation on this flag.
    let cancelled = false;

    if (!layerCanvases.current.has(BASE_LAYER_ID)) {
      // A fresh <canvas> defaults to 300x150 (per the HTML spec), not 0x0 -
      // zero it out so resizeLayerCanvas's "did this already have content"
      // check (lc.width > 0 && lc.height > 0) isn't fooled into thinking a
      // brand-new canvas already had content, which would skip the
      // template/draft restore and white-fill below on every first mount.
      const lc = document.createElement("canvas");
      lc.width = 0;
      lc.height = 0;
      layerCanvases.current.set(BASE_LAYER_ID, lc);
    }

    const resize = () => {
      const rect = viewport.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      display.style.width = `${rect.width}px`;
      display.style.height = `${rect.height}px`;

      const nextWidth = Math.max(1, Math.round(rect.width * dpr));
      const nextHeight = Math.max(1, Math.round(rect.height * dpr));
      if (nextWidth === display.width && nextHeight === display.height) return;

      for (const [id, lc] of layerCanvases.current) {
        const hadContent = resizeLayerCanvas(lc, nextWidth, nextHeight, rect.width, rect.height, dpr);
        if (hadContent || id !== BASE_LAYER_ID) continue;

        const lctx = lc.getContext("2d");
        if (!lctx) continue;
        lctx.fillStyle = "#ffffff";
        lctx.fillRect(0, 0, rect.width, rect.height);

        const finish = () => {
          compositeLayers();
          if (!initialHistoryPushed.current) {
            initialHistoryPushed.current = true;
            initialImageRef.current = captureSmallBitmap();
            pushHistoryEntry("시작");
          }
        };

        if (!restoredDraft.current && templateUrl) {
          restoredDraft.current = true;
          const img = new Image();
          // Signed storage URLs are cross-origin; without CORS the canvas
          // would be tainted and toBlob() would fail on save.
          img.crossOrigin = "anonymous";
          img.onload = () => {
            if (cancelled) return;
            // The floating top/bottom bars (~52px each, see their JSX further
            // down) sit on top of the canvas rather than pushing it down, so
            // a template scaled to the full rect height can end up with its
            // edges hidden behind them - reserve a safe margin so content
            // placed as a full-bleed circle (the mandala library's tightly
            // cropped designs, for example) never lands under either bar.
            const safeMargin = 64;
            const availHeight = Math.max(1, rect.height - safeMargin * 2);
            const scale = Math.min(rect.width / img.width, availHeight / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            lctx.drawImage(img, (rect.width - w) / 2, safeMargin + (availHeight - h) / 2, w, h);
            finish();
          };
          img.src = templateUrl;
        } else if (!restoredDraft.current) {
          restoredDraft.current = true;
          try {
            const draft = localStorage.getItem(DRAWING_DRAFT_KEY);
            if (draft) {
              const img = new Image();
              img.onload = () => {
                if (cancelled) return;
                lctx.drawImage(img, 0, 0, rect.width, rect.height);
                finish();
              };
              img.src = draft;
            } else {
              finish();
            }
          } catch {
            finish();
          }
        } else {
          finish();
        }
      }

      display.width = nextWidth;
      display.height = nextHeight;
      compositeLayers();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, templateUrl]);

  // Keep the pan offset in bounds whenever zoom changes, so zooming out
  // never leaves the canvas stranded outside the visible viewport.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const maxOffsetX = Math.max(0, rect.width * (zoom - 1));
    const maxOffsetY = Math.max(0, rect.height * (zoom - 1));
    setPan((p) => ({
      x: Math.min(0, Math.max(-maxOffsetX, p.x)),
      y: Math.min(0, Math.max(-maxOffsetY, p.y)),
    }));
  }, [zoom]);

  // Mirrors of the latest zoom/pan, read by the wheel listener below so it
  // can stay attached once (not re-added on every pan tick) while still
  // always seeing the current values.
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);

  // Ctrl/Cmd+wheel to zoom, like Paint/Photoshop - anchored under the cursor
  // so whatever you're pointing at stays put while it scales. A native
  // (non-passive) listener is used instead of React's onWheel because
  // preventDefault has to actually stop the browser's own page-zoom/scroll
  // for this to work, and passive listeners can't do that.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const curZoom = zoomRef.current;
      const curPan = panRef.current;
      const nextZoom = Math.min(MAX_ZOOM, Math.max(1, curZoom * Math.exp(-e.deltaY * 0.0015)));
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const localX = (cx - curPan.x) / curZoom;
      const localY = (cy - curPan.y) / curZoom;
      const maxOffsetX = Math.max(0, rect.width * (nextZoom - 1));
      const maxOffsetY = Math.max(0, rect.height * (nextZoom - 1));
      setZoom(nextZoom);
      setPan({
        x: Math.min(0, Math.max(-maxOffsetX, cx - localX * nextZoom)),
        y: Math.min(0, Math.max(-maxOffsetY, cy - localY * nextZoom)),
      });
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z to redo - skipped while an
  // input/textarea has focus so it doesn't hijack normal text editing.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Delete/Backspace clears the current selection's contents. Separate from
  // the undo/redo listener above since this one genuinely needs a fresh
  // `selection` on every change, not just refs.
  useEffect(() => {
    if (!selection || tool !== "select") return;
    function onKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      e.preventDefault();
      deleteSelection();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, tool]);

  // Size the box in JS from the space actually left on screen below it (not
  // a flat percentage of the window, and not just CSS aspect-ratio +
  // max-height) - otherwise whatever sits above it (mode tabs, headers) can
  // push its bottom edge - and the floating toolbars pinned to it - past the
  // visible viewport. With touch-action: none covering nearly the whole
  // canvas, a phone then has no way to scroll down and reach what fell below
  // the fold, so tools look "unpressable" and the screen looks "stuck."
  // Fitting fully on screen removes the need to scroll at all.
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const compute = () => {
      const availW = el.clientWidth;
      const top = el.getBoundingClientRect().top;
      // Clears the floating bottom-nav pill on mobile (fixed, ~64px tall +
      // margin); desktop has no such overlay, just a small safety margin.
      const isDesktop = window.matchMedia("(min-width: 768px)").matches;
      const bottomMargin = isDesktop ? 16 : 96;
      const maxH = Math.max(320, window.innerHeight - top - bottomMargin);
      if (!aspectRatio) {
        setBoxSize({ width: availW, height: maxH });
        return;
      }
      let h = Math.min(maxH, availW / aspectRatio);
      let w = h * aspectRatio;
      if (w > availW) {
        w = availW;
        h = w / aspectRatio;
      }
      setBoxSize({ width: w, height: h });
    };

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(el);
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
    };
  }, [aspectRatio]);

  // Maps a pointer event (in screen space) to canvas-local drawing
  // coordinates, undoing the current zoom/pan view transform. Every drawing
  // operation below works purely in this local space, so zoom/pan is just a
  // camera over the same underlying picture.
  function getPos(e: { clientX: number; clientY: number }) {
    const viewport = viewportRef.current;
    if (!viewport) return { x: 0, y: 0 };
    const rect = viewport.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    };
  }

  // Per-style radius/spacing/flow tuned so each style roughly tracks the
  // same `size`/`opacity` sliders the plain ink brush uses. `strokeRng` is
  // shared across every dab of one stroke (seeded once at pointerdown, see
  // handlePointerDown) so the whole stroke's randomness is reproducible from
  // that single seed - needed for the stroke-log replay player.
  function stampDabP(ctx: CanvasRenderingContext2D, p: Pt, pressure: number) {
    const pf = pressureFactorOf(pressure > 0 ? pressure : 0.5);
    const rng = strokeRng.current ?? makeRng(1);
    const radius = stampRadius(brushStyle, size, pf);
    const flowAlpha = stampFlowAlpha(brushStyle, opacity, pf);
    if (brushStyle === "pencil") {
      pencilDab(ctx, p, radius, color, flowAlpha, rng);
    } else if (brushStyle === "airbrush") {
      airbrushDab(ctx, p, radius, color, flowAlpha);
    } else if (brushStyle === "watercolor") {
      watercolorDab(ctx, p, radius, color, flowAlpha, rng);
    }
  }

  function stampDab(ctx: CanvasRenderingContext2D, p: Pt, e: React.PointerEvent<HTMLDivElement>) {
    stampDabP(ctx, p, e.pressure);
  }

  function stampSpacing() {
    return stampSpacingFor(brushStyle, size);
  }

  // Ink brush / eraser: perfect-freehand needs the whole point list to
  // compute a stable outline, so unlike the stamp brushes above this
  // redraws from the pre-stroke snapshot (`previewBase`, taken at
  // pointerdown) every time instead of drawing one more piece onto the
  // previous frame.
  function drawLiveFreehand(ctx: CanvasRenderingContext2D) {
    if (!previewBase.current) return;
    ctx.putImageData(previewBase.current, 0, 0);
    const outline = freehandOutline(strokePointsRef.current, size);
    fillFreehandOutline(ctx, outline, color, opacity, tool === "eraser");
  }

  function switchToBrushIfToolless() {
    setTool((t) => (t === "eraser" || t === "text" || t === "sticker" || t === "pan" ? "brush" : t));
  }

  function pickColor(c: string) {
    switchToBrushIfToolless();
    setColor(c);
  }

  function pinchDistanceAndMid() {
    const pts = [...activePointers.current.values()];
    if (pts.length < 2) return null;
    const [a, b] = pts;
    return {
      dist: Math.hypot(b.x - a.x, b.y - a.y),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Basic palm rejection: a stylus drawing a stroke plus an incidental
    // palm touch landing mid-stroke is the single most common "my line got
    // cut off" complaint - ignore a second pointer entirely (don't add it,
    // don't switch to pinch, don't touch the in-progress draw) when it's a
    // touch arriving while a pen is already down. Two pens or two touches
    // (an intentional pinch) are unaffected.
    if (activePointers.current.size === 1 && e.pointerType === "touch") {
      const [existing] = [...activePointers.current.values()];
      if (existing.pointerType === "pen") return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, pointerType: e.pointerType });

    if (activePointers.current.size >= 2) {
      // A second finger just landed - abandon any single-finger draw/pan
      // that was in progress and switch entirely to pinch zoom+pan.
      drawing.current = false;
      lastPoint.current = null;
      lastMid.current = null;
      previewBase.current = null;
      panStart.current = null;
      strokePointsRef.current = [];
      const pd = pinchDistanceAndMid();
      if (pd) {
        pinchStart.current = {
          dist: pd.dist,
          zoom,
          pan,
          mid: pd.mid,
          startedAt: nowMs(),
          maxMidDrift: 0,
          maxDistDrift: 0,
        };
      }
      return;
    }

    const pos = getPos(e);

    if (tool === "text") {
      setTextInput({ x: pos.x, y: pos.y, value: "" });
      return;
    }

    if (tool === "fill") {
      fillAt(pos);
      return;
    }

    if (tool === "eraser" && eraserMode === "stroke") {
      eraseStrokeAt(pos);
      return;
    }

    if (tool === "sticker") {
      const ctx = activeCtx();
      if (ctx) {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = opacity;
        const stampSize = Math.max(24, size * 5);
        ctx.font = `${stampSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(stickerEmoji, pos.x, pos.y);
        ctx.textAlign = "left";
        compositeLayers();
        strokesRef.current.push({
          kind: "sticker",
          emoji: stickerEmoji,
          x: pos.x,
          y: pos.y,
          size,
          opacity,
          layerId: activeLayerId,
        });
        pushHistoryEntry("스티커");
      }
      return;
    }

    drawing.current = true;

    if (tool === "pan") {
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      return;
    }

    if (tool === "select") {
      const inside =
        selection &&
        pos.x >= selection.x &&
        pos.x <= selection.x + selection.w &&
        pos.y >= selection.y &&
        pos.y <= selection.y + selection.h;

      if (inside && selection) {
        const ctx = activeCtx();
        const dpr = window.devicePixelRatio || 1;
        if (ctx) {
          const sx = Math.round(selection.x * dpr);
          const sy = Math.round(selection.y * dpr);
          const sw = Math.max(1, Math.round(selection.w * dpr));
          const sh = Math.max(1, Math.round(selection.h * dpr));
          const imageData = ctx.getImageData(sx, sy, sw, sh);
          const previewCanvas = document.createElement("canvas");
          previewCanvas.width = sw;
          previewCanvas.height = sh;
          previewCanvas.getContext("2d")?.putImageData(imageData, 0, 0);

          if (activeLayerId === BASE_LAYER_ID) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(selection.x, selection.y, selection.w, selection.h);
          } else {
            ctx.clearRect(selection.x, selection.y, selection.w, selection.h);
          }
          compositeLayers();

          floatingDrag.current = {
            previewCanvas,
            selX: selection.x,
            selY: selection.y,
            w: selection.w,
            h: selection.h,
            startPointerX: pos.x,
            startPointerY: pos.y,
            offsetX: 0,
            offsetY: 0,
          };
          setIsFloating(true);
        }
      } else {
        selectDragStart.current = pos;
        setSelection({ x: pos.x, y: pos.y, w: 0, h: 0 });
      }
      return;
    }

    lastPoint.current = pos;
    lastMid.current = pos;
    stampCarry.current = 0;
    strokeRng.current = makeRng(strokeSeedCounter.current++);
    strokePointsRef.current = [{ x: pos.x, y: pos.y, pressure: e.pressure > 0 ? e.pressure : 0.5 }];
    shapeEndRef.current = pos;

    const lc = activeLayerCanvas();
    const ctx = activeCtx();
    if (!lc || !ctx) return;

    if (tool === "line" || tool === "rect" || tool === "circle") {
      previewBase.current = ctx.getImageData(0, 0, lc.width, lc.height);
      return;
    }

    if (tool === "brush" && brushStyle !== "ink") {
      stampDab(ctx, pos, e);
      compositeLayers();
      return;
    }

    // Ink brush / eraser: snapshot now so every subsequent move (and a
    // plain tap, which never reaches pointermove) can restore-and-refill
    // the whole freehand outline from scratch - see drawLiveFreehand.
    previewBase.current = ctx.getImageData(0, 0, lc.width, lc.height);
    drawLiveFreehand(ctx);
    compositeLayers();
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, pointerType: e.pointerType });
    }

    if (pinchStart.current) {
      const pd = pinchDistanceAndMid();
      const viewport = viewportRef.current;
      if (!pd || !viewport || pd.dist < 1) return;
      const rect = viewport.getBoundingClientRect();
      const start = pinchStart.current;
      // Dead-zone the distance ratio around 1 (gesture-start distance) so a
      // plain two-finger pan - where the inter-finger distance naturally
      // drifts a little from tremor, not intent - doesn't read as a small,
      // jittery pinch. Remapped continuously past the dead-zone edge so
      // zoom doesn't jump the moment a real pinch crosses the threshold.
      const rawRatio = pd.dist / start.dist;
      const ratio =
        Math.abs(rawRatio - 1) <= PINCH_ZOOM_DEADZONE
          ? 1
          : rawRatio > 1
            ? rawRatio - PINCH_ZOOM_DEADZONE
            : rawRatio + PINCH_ZOOM_DEADZONE;
      const nextZoom = Math.min(MAX_ZOOM, Math.max(1, start.zoom * ratio));
      // Keep the point under the fingers fixed on screen: solve for the pan
      // that maps that same canvas-local point to the same screen position
      // at the new zoom level (pan is applied as translate(pan) scale(zoom)).
      const midLocalX = (start.mid.x - rect.left - start.pan.x) / start.zoom;
      const midLocalY = (start.mid.y - rect.top - start.pan.y) / start.zoom;
      const curMidX = pd.mid.x - rect.left;
      const curMidY = pd.mid.y - rect.top;
      const maxOffsetX = Math.max(0, rect.width * (nextZoom - 1));
      const maxOffsetY = Math.max(0, rect.height * (nextZoom - 1));
      setZoom(nextZoom);
      setPan({
        x: Math.min(0, Math.max(-maxOffsetX, curMidX - midLocalX * nextZoom)),
        y: Math.min(0, Math.max(-maxOffsetY, curMidY - midLocalY * nextZoom)),
      });
      // Track how far this gesture has actually moved, for the two-finger
      // tap-to-undo check in handlePointerUp - a real pinch/pan racks these
      // up quickly, a tap barely moves at all.
      pinchStart.current = {
        ...start,
        maxMidDrift: Math.max(start.maxMidDrift, Math.hypot(pd.mid.x - start.mid.x, pd.mid.y - start.mid.y)),
        maxDistDrift: Math.max(start.maxDistDrift, Math.abs(pd.dist - start.dist)),
      };
      return;
    }

    const pos = getPos(e);
    setCursor({ x: pos.x, y: pos.y, visible: true });
    if (!drawing.current) return;

    if (tool === "pan") {
      if (!panStart.current) return;
      const viewport = viewportRef.current;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const maxOffsetX = Math.max(0, rect.width * (zoom - 1));
      const maxOffsetY = Math.max(0, rect.height * (zoom - 1));
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPan({
        x: Math.min(0, Math.max(-maxOffsetX, panStart.current.panX + dx)),
        y: Math.min(0, Math.max(-maxOffsetY, panStart.current.panY + dy)),
      });
      return;
    }

    if (tool === "select") {
      if (floatingDrag.current) {
        const f = floatingDrag.current;
        f.offsetX = pos.x - f.startPointerX;
        f.offsetY = pos.y - f.startPointerY;
        scheduleComposite();
        setSelection({ x: f.selX + f.offsetX, y: f.selY + f.offsetY, w: f.w, h: f.h });
        return;
      }
      if (selectDragStart.current) {
        const start = selectDragStart.current;
        setSelection({
          x: Math.min(start.x, pos.x),
          y: Math.min(start.y, pos.y),
          w: Math.abs(pos.x - start.x),
          h: Math.abs(pos.y - start.y),
        });
      }
      return;
    }

    const ctx = activeCtx();
    if (!ctx) return;

    if (tool === "line" || tool === "rect" || tool === "circle") {
      if (!previewBase.current || !lastPoint.current) return;
      const start = lastPoint.current;
      shapeEndRef.current = pos;
      ctx.putImageData(previewBase.current, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      if (tool === "line") {
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(pos.x, pos.y);
      } else if (tool === "rect") {
        ctx.rect(
          Math.min(start.x, pos.x),
          Math.min(start.y, pos.y),
          Math.abs(pos.x - start.x),
          Math.abs(pos.y - start.y),
        );
      } else {
        ctx.ellipse(
          (start.x + pos.x) / 2,
          (start.y + pos.y) / 2,
          Math.abs(pos.x - start.x) / 2,
          Math.abs(pos.y - start.y) / 2,
          0,
          0,
          Math.PI * 2,
        );
      }
      ctx.stroke();
      scheduleComposite();
      return;
    }

    let lp = lastPoint.current;
    let lm = lastMid.current;
    if (!lp || !lm) return;

    // A fast finger swipe can generate real touch samples faster than the
    // browser dispatches pointermove - without reading the coalesced list,
    // only the last sample per dispatched event survives, so quick strokes
    // degenerate into widely-spaced stamps (dots) instead of a line.
    const native = e.nativeEvent as PointerEvent;
    const raw: { clientX: number; clientY: number; pressure: number }[] =
      typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
    if (raw.length === 0) raw.push({ clientX: e.clientX, clientY: e.clientY, pressure: e.pressure });

    const isStampBrush = tool === "brush" && brushStyle !== "ink";
    for (const r of raw) {
      const p = getPos(r);
      const pressure = r.pressure > 0 ? r.pressure : 0.5;
      strokePointsRef.current.push({ x: p.x, y: p.y, pressure });

      if (isStampBrush) {
        // Smoothed over the last couple of raw samples so a shaky hand
        // doesn't show up as a visible kink at every stamp (see
        // trailingSmoothedPoint) - stamped from/to the smoothed point, not
        // the raw one, so the dab trail itself follows the smoothed path.
        const smoothed = trailingSmoothedPoint(strokePointsRef.current, strokePointsRef.current.length - 1);
        stampCarry.current = stampAlongSegment(lp, smoothed, stampSpacing(), stampCarry.current, (sp) =>
          stampDabP(ctx, sp, pressure),
        );
        lm = smoothed;
        lp = smoothed;
      }
    }
    lastPoint.current = lp;
    lastMid.current = lm;
    if (!isStampBrush) drawLiveFreehand(ctx);
    scheduleComposite();
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    // The up/leave/cancel half of the palm-rejection in handlePointerDown:
    // a touch pointer that was never tracked (because it was rejected as a
    // palm while a pen was down) still generates its own pointerup/leave
    // when it lifts - without this check, that untracked event falls
    // through to the logic below and ends the pen's stroke as if it were
    // the pen's own pointerup.
    if (!activePointers.current.has(e.pointerId) && e.pointerType === "touch") {
      const [existing] = [...activePointers.current.values()];
      if (existing?.pointerType === "pen") return;
    }

    const wasPinching = pinchStart.current;
    activePointers.current.delete(e.pointerId);
    if (wasPinching && activePointers.current.size < 2) {
      // Two fingers landing and lifting again almost immediately, without
      // really moving, reads as a tap rather than a pinch/pan - a quick
      // muscle-memory undo gesture (distinct from the pinch/pan drag above,
      // which this gesture barely produced any of).
      const elapsed = nowMs() - wasPinching.startedAt;
      if (
        elapsed < TWO_FINGER_TAP_MAX_MS &&
        wasPinching.maxMidDrift < TWO_FINGER_TAP_MAX_DRIFT &&
        wasPinching.maxDistDrift < TWO_FINGER_TAP_MAX_DRIFT
      ) {
        undo();
      }
    }
    if (activePointers.current.size < 2) pinchStart.current = null;
    // Lifting one finger out of a pinch, with the other still down, should
    // not fall through into single-finger drawing/panning below.
    if (activePointers.current.size >= 1 && !drawing.current) return;

    // Guarantee the final frame is on screen the instant the drag ends,
    // rather than whenever the next animation frame happens to land - see
    // flushComposite.
    flushComposite();

    const wasDrawing = drawing.current;
    const wasTool = tool;
    const wasShapeStart = lastPoint.current;
    const wasShapeEnd = shapeEndRef.current;
    drawing.current = false;
    lastPoint.current = null;
    lastMid.current = null;
    previewBase.current = null;
    panStart.current = null;

    if (wasTool === "select") {
      if (floatingDrag.current) {
        const f = floatingDrag.current;
        const ctx = activeCtx();
        if (ctx) {
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = 1;
          ctx.drawImage(
            f.previewCanvas,
            0,
            0,
            f.previewCanvas.width,
            f.previewCanvas.height,
            f.selX + f.offsetX,
            f.selY + f.offsetY,
            f.w,
            f.h,
          );
        }
        setSelection({ x: f.selX + f.offsetX, y: f.selY + f.offsetY, w: f.w, h: f.h });
        floatingDrag.current = null;
        setIsFloating(false);
        compositeLayers();
        recordBitmapJump("이동");
        pushHistoryEntry("이동");
      } else if (selectDragStart.current) {
        selectDragStart.current = null;
        setSelection((s) => (s && s.w > 4 && s.h > 4 ? s : null));
      }
      return;
    }

    if (!wasDrawing || wasTool === "pan") return;

    if ((wasTool === "brush" || wasTool === "eraser") && strokePointsRef.current.length > 0) {
      const wasStampBrush = wasTool === "brush" && brushStyle !== "ink";
      strokesRef.current.push({
        kind: "stroke",
        tool: wasTool,
        brushStyle,
        color,
        size,
        opacity,
        layerId: activeLayerId,
        seed: strokeSeedCounter.current - 1,
        points: strokePointsRef.current,
        engine: wasStampBrush ? "smoothed-stamp-v1" : "freehand-v1",
      });
    } else if ((wasTool === "line" || wasTool === "rect" || wasTool === "circle") && wasShapeStart && wasShapeEnd) {
      strokesRef.current.push({
        kind: "shape",
        shape: wasTool,
        color,
        size,
        opacity,
        layerId: activeLayerId,
        start: wasShapeStart,
        end: wasShapeEnd,
      });
    }
    strokePointsRef.current = [];
    shapeEndRef.current = null;

    pushHistoryEntry(labelForTool(wasTool, brushStyle));
  }

  function commitText() {
    const pending = textInput;
    setTextInput(null);
    if (!pending || !pending.value.trim()) return;

    const ctx = activeCtx();
    if (!ctx) return;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.font = `${Math.max(14, size * 3)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(pending.value, pending.x, pending.y);
    compositeLayers();
    strokesRef.current.push({
      kind: "text",
      text: pending.value,
      x: pending.x,
      y: pending.y,
      color,
      size,
      opacity,
      layerId: activeLayerId,
    });
    pushHistoryEntry("텍스트");
  }

  function handleBackgroundFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const display = canvasRef.current;
    const ctx = activeCtx();
    if (!display || !ctx) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const rect = display.getBoundingClientRect();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        compositeLayers();
        recordBitmapJump("사진 추가");
        pushHistoryEntry("사진 추가");
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  // Clears every layer's pixels (base goes back to white, the rest back to
  // transparent) but keeps the layers themselves - their names/opacity/
  // blend mode/order are untouched, only the drawing on them disappears.
  function clearCanvas() {
    const dpr = window.devicePixelRatio || 1;
    for (const l of layersRef.current) {
      const lc = layerCanvases.current.get(l.id);
      const ctx = lc?.getContext("2d");
      if (!lc || !ctx) continue;
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      if (l.id === BASE_LAYER_ID) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, lc.width / dpr, lc.height / dpr);
      } else {
        ctx.clearRect(0, 0, lc.width / dpr, lc.height / dpr);
      }
    }
    compositeLayers();
    recordBitmapJump("전체 지우기");
    pushHistoryEntry(
      "전체 지우기",
      layersRef.current,
      layersRef.current.map((l) => l.id),
    );
  }

  function zoomIn() {
    setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + 0.5) * 100) / 100));
  }
  function zoomOut() {
    setZoom((z) => Math.max(1, Math.round((z - 0.5) * 100) / 100));
  }
  function resetZoom() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function closePanels() {
    setShowMore(false);
    setShowBrushPicker(false);
    setShowLayers(false);
    setShowHistory(false);
    setShowAdjust(false);
  }

  return (
    <div ref={outerRef} className="w-full">
      <div
        className={`relative mx-auto overflow-hidden rounded-xl border-[3px] border-outline bg-white shadow-[0_4px_0_var(--color-outline)] ${
          boxSize ? "" : "h-[84dvh] max-h-[1100px] min-h-[420px] w-full md:h-[88dvh]"
        }`}
        style={boxSize ? { width: boxSize.width, height: boxSize.height } : undefined}
      >
      <div
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={(e) => {
          handlePointerUp(e);
          setCursor((c) => ({ ...c, visible: false }));
        }}
        className="absolute inset-0 touch-none select-none [-webkit-touch-callout:none]"
        style={{ cursor: tool === "pan" ? "grab" : "crosshair" }}
      >
        <canvas
          ref={canvasRef}
          className="absolute left-0 top-0"
          style={{
            transformOrigin: "0 0",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        />
        {cursor.visible &&
          tool !== "text" &&
          tool !== "pan" &&
          tool !== "fill" &&
          (tool === "sticker" ? (
            <div
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 opacity-70"
              style={{
                left: pan.x + cursor.x * zoom,
                top: pan.y + cursor.y * zoom,
                fontSize: Math.max(24, size * 5) * zoom,
              }}
            >
              {stickerEmoji}
            </div>
          ) : (
            <div
              className="pointer-events-none absolute rounded-full border border-ink/60"
              style={{
                left: pan.x + cursor.x * zoom - (size * zoom) / 2,
                top: pan.y + cursor.y * zoom - (size * zoom) / 2,
                width: size * zoom,
                height: size * zoom,
                background: tool === "eraser" ? "rgba(255,255,255,0.6)" : color,
                opacity: tool === "eraser" ? 1 : opacity * 0.7,
              }}
            />
          ))}
        {selection && tool === "select" && (
          <>
            <div
              className="pointer-events-none absolute border-2 border-dashed border-sage"
              style={{
                left: pan.x + selection.x * zoom,
                top: pan.y + selection.y * zoom,
                width: selection.w * zoom,
                height: selection.h * zoom,
              }}
            />
            {!isFloating && (
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (e.buttons === 0) return;
                  e.stopPropagation();
                  const p = getPos(e);
                  setSelection((s) =>
                    s ? { ...s, w: Math.max(8, p.x - s.x), h: Math.max(8, p.y - s.y) } : s,
                  );
                }}
                className="absolute z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize rounded-[4px] border-2 border-outline bg-sage"
                style={{
                  left: pan.x + (selection.x + selection.w) * zoom,
                  top: pan.y + (selection.y + selection.h) * zoom,
                }}
                aria-label="선택 영역 크기 조절"
              />
            )}
            {!isFloating && (
              <div
                className="absolute z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border-2 border-outline bg-ink px-2 py-1 shadow-[0_3px_0_var(--color-outline)]"
                style={{
                  left: pan.x + (selection.x + selection.w / 2) * zoom,
                  top: Math.max(0, pan.y + selection.y * zoom - 32),
                }}
              >
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={deleteSelection}
                  aria-label="선택 영역 삭제"
                  className="flex h-6 w-6 items-center justify-center text-white"
                >
                  <Trash2 size={13} />
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setSelection(null)}
                  aria-label="선택 해제"
                  className="flex h-6 w-6 items-center justify-center text-white"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </>
        )}
        {textInput && (
          <input
            autoFocus
            value={textInput.value}
            onChange={(e) => setTextInput((t) => t && { ...t, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitText();
              if (e.key === "Escape") setTextInput(null);
            }}
            onBlur={commitText}
            placeholder="텍스트 입력 후 Enter"
            className="absolute z-10 min-w-[8rem] rounded border border-sage bg-white px-2 py-1 text-sm outline-none"
            style={{
              left: pan.x + textInput.x * zoom,
              top: Math.max(0, pan.y + (textInput.y - 14) * zoom),
            }}
          />
        )}
      </div>

      {/* top floating bar: back / undo / redo / layers / history / more / save */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 border-b-[3px] border-outline bg-card/95 px-3 py-2">
        <div className="flex items-center gap-1">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="뒤로"
              className="px-tool h-9 w-9"
            >
              <ArrowLeft size={19} strokeWidth={1.8} />
            </button>
          )}
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            aria-label="실행취소"
            className="px-tool h-9 w-9"
          >
            <Undo2 size={19} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            aria-label="다시실행"
            className="px-tool h-9 w-9"
          >
            <Redo2 size={19} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !showLayers;
              closePanels();
              setShowLayers(next);
            }}
            aria-label="레이어"
            aria-expanded={showLayers}
            className={`px-tool h-9 w-9 ${
              showLayers ? "px-tool-on" : ""
            }`}
          >
            <Layers size={18} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !showHistory;
              closePanels();
              setShowHistory(next);
            }}
            aria-label="히스토리"
            aria-expanded={showHistory}
            className={`px-tool h-9 w-9 ${
              showHistory ? "px-tool-on" : ""
            }`}
          >
            <History size={18} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !showAdjust;
              closePanels();
              setShowAdjust(next);
            }}
            aria-label="보정"
            aria-expanded={showAdjust}
            className={`px-tool h-9 w-9 ${
              showAdjust ? "px-tool-on" : ""
            }`}
          >
            <SlidersHorizontal size={18} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !showMore;
              closePanels();
              setShowMore(next);
            }}
            aria-label="더보기"
            aria-expanded={showMore}
            className={`px-tool h-9 w-9 ${
              showMore ? "px-tool-on" : ""
            }`}
          >
            <MoreHorizontal size={19} strokeWidth={1.8} />
          </button>
        </div>
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            className="px-btn px-btn-green px-5 py-2 text-sm"
          >
            저장
          </button>
        )}
      </div>

      {/* left rail: brush (tap again for style picker) / eraser + color strip.
          Anchored top AND bottom (not a fixed height) so on a short box - a
          landscape paper ratio on a narrow phone, say - it shrinks instead
          of spilling past the box's own edge and getting clipped invisible;
          overflow-y-auto makes whatever doesn't fit reachable by scrolling
          rather than simply gone. */}
      <div className="px-card absolute left-2 top-16 z-20 flex max-h-[calc(100%-8rem)] flex-col items-center gap-2 overflow-y-auto p-1.5 [scrollbar-width:thin]">
        <button
          type="button"
          onClick={() => {
            if (tool === "brush") {
              setShowBrushPicker((s) => !s);
            } else {
              changeTool("brush");
              setShowBrushPicker(true);
            }
            setShowEraserPicker(false);
            setShowMore(false);
          }}
          aria-label="브러시"
          aria-expanded={showBrushPicker}
          className={`px-tool h-9 w-9 ${
            tool === "brush" ? "px-tool-on" : ""
          }`}
        >
          {(() => {
            const BrushIcon = BRUSH_STYLES.find((s) => s.id === brushStyle)?.Icon ?? Paintbrush;
            return <BrushIcon size={18} strokeWidth={1.8} />;
          })()}
        </button>
        <button
          type="button"
          onClick={() => {
            if (tool === "eraser") {
              setShowEraserPicker((s) => !s);
            } else {
              changeTool("eraser");
              setShowEraserPicker(true);
            }
            setShowBrushPicker(false);
            setShowMore(false);
          }}
          aria-label="지우개"
          aria-expanded={showEraserPicker}
          className={`px-tool h-9 w-9 ${
            tool === "eraser" ? "px-tool-on" : ""
          }`}
        >
          {(() => {
            const EraserIcon = ERASER_MODES.find((m) => m.id === eraserMode)?.Icon ?? Eraser;
            return <EraserIcon size={18} strokeWidth={1.8} />;
          })()}
        </button>

        <div className="my-0.5 h-0.5 w-6 bg-outline/30" />

        <label className="relative h-6 w-6 shrink-0 overflow-hidden rounded-[5px] border-2 border-outline cursor-pointer hover:scale-105 transition">
          <input
            type="color"
            value={color}
            onChange={(e) => pickColor(e.target.value)}
            className="absolute -left-1 -top-1 h-8 w-8 cursor-pointer"
            aria-label="사용자 지정 색상"
          />
          <span className="absolute inset-0 flex items-center justify-center text-[10px]">+</span>
        </label>
      </div>

      {/* brush style picker: ink / pencil / watercolor / airbrush */}
      {showBrushPicker && (
        <div className="absolute left-16 top-16 z-30 flex w-40 max-h-[calc(100%-8rem)] flex-col gap-2 overflow-y-auto px-card p-3">
          <div className="flex items-center justify-between">
            <span className="px-label text-xs text-ink">브러시</span>
            <button
              type="button"
              onClick={() => setShowBrushPicker(false)}
              aria-label="닫기"
              className="text-muted"
            >
              <X size={15} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {BRUSH_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  changeTool("brush");
                  setBrushStyle(s.id);
                }}
                className={`px-chip flex flex-col items-center gap-1 py-2 text-[10px] ${
                  brushStyle === s.id ? "px-chip-on" : ""
                }`}
              >
                <s.Icon size={16} strokeWidth={1.8} />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* eraser mode picker: pixel (passes-over-only) / stroke (whole touched line) */}
      {showEraserPicker && (
        <div className="absolute left-16 top-16 z-30 flex w-40 max-h-[calc(100%-8rem)] flex-col gap-2 overflow-y-auto px-card p-3">
          <div className="flex items-center justify-between">
            <span className="px-label text-xs text-ink">지우개</span>
            <button
              type="button"
              onClick={() => setShowEraserPicker(false)}
              aria-label="닫기"
              className="text-muted"
            >
              <X size={15} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {ERASER_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  changeTool("eraser");
                  setEraserMode(m.id);
                }}
                className={`px-chip flex flex-col items-center gap-1 py-2 text-[10px] ${
                  eraserMode === m.id ? "px-chip-on" : ""
                }`}
              >
                <m.Icon size={16} strokeWidth={1.8} />
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* layers panel: top of list = topmost layer, matching usual convention */}
      {showLayers && (
        <div className="absolute left-16 top-16 z-30 flex w-64 max-h-[calc(100%-8rem)] flex-col gap-2 overflow-y-auto px-card p-3">
          <div className="flex items-center justify-between">
            <span className="px-label text-xs text-ink">레이어</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={addLayer}
                disabled={layers.length >= MAX_LAYERS}
                aria-label="레이어 추가"
                className="px-chip flex h-6 w-6 items-center justify-center disabled:opacity-40"
              >
                <Plus size={13} />
              </button>
              <button type="button" onClick={() => setShowLayers(false)} aria-label="닫기" className="text-muted">
                <X size={15} />
              </button>
            </div>
          </div>
          <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
            {[...layers].reverse().map((l, displayIndex) => (
              <div
                key={l.id}
                ref={(el) => {
                  if (el) layerRowRefs.current.set(l.id, el);
                  else layerRowRefs.current.delete(l.id);
                }}
                className={`flex flex-col gap-1 rounded-lg p-1.5 transition-opacity ${
                  l.id === activeLayerId ? "bg-tag-bg ring-2 ring-sage" : "hover:bg-bg"
                } ${l.id === draggingLayerIdState ? "opacity-60" : ""}`}
              >
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onPointerDown={(e) => startLayerDrag(e, l.id)}
                    onPointerMove={onLayerDragMove}
                    onPointerUp={endLayerDrag}
                    onPointerCancel={endLayerDrag}
                    aria-label="순서 바꾸기(드래그)"
                    className="flex h-6 w-4 shrink-0 touch-none items-center justify-center text-muted/60 cursor-grab"
                  >
                    <GripVertical size={13} />
                  </button>
                  {layerThumbnails[l.id] && (
                    // eslint-disable-next-line @next/next/no-img-element -- a tiny data: URL canvas snapshot, not a real asset to optimize
                    <img
                      src={layerThumbnails[l.id]}
                      alt=""
                      className="h-7 w-7 shrink-0 rounded border border-outline object-cover"
                      style={{ background: "#fff" }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => toggleLayerVisible(l.id)}
                    aria-label={l.visible ? "숨기기" : "보이기"}
                    className="flex h-6 w-6 shrink-0 items-center justify-center text-muted"
                  >
                    {l.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveLayerId(l.id)}
                    className="min-w-0 flex-1 truncate text-left text-xs font-medium text-ink"
                  >
                    {l.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteLayer(l.id)}
                    aria-label="레이어 삭제"
                    disabled={layers.length <= 1}
                    className="flex h-6 w-6 shrink-0 items-center justify-center text-muted disabled:opacity-30"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="flex items-center gap-1 pl-5">
                  <button
                    type="button"
                    onClick={() => duplicateLayer(l.id)}
                    disabled={layers.length >= MAX_LAYERS}
                    aria-label="레이어 복제"
                    className="flex h-6 w-6 shrink-0 items-center justify-center text-muted disabled:opacity-30"
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => mergeDown(l.id)}
                    disabled={displayIndex === layers.length - 1}
                    aria-label="아래 레이어와 병합"
                    className="flex h-6 w-6 shrink-0 items-center justify-center text-muted disabled:opacity-30"
                  >
                    <Combine size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveLayer(l.id, 1)}
                    aria-label="위로"
                    className="flex h-6 w-6 shrink-0 items-center justify-center text-muted disabled:opacity-30"
                    disabled={layers[layers.length - 1]?.id === l.id}
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveLayer(l.id, -1)}
                    aria-label="아래로"
                    className="flex h-6 w-6 shrink-0 items-center justify-center text-muted disabled:opacity-30"
                    disabled={layers[0]?.id === l.id}
                  >
                    <ChevronDown size={14} />
                  </button>
                  <select
                    value={l.blendMode ?? "source-over"}
                    onChange={(e) => setLayerBlendMode(l.id, e.target.value as BlendMode)}
                    aria-label={`${l.name} 블렌드 모드`}
                    className="ml-auto min-w-0 rounded border border-outline bg-transparent px-1 py-0.5 text-[10px] text-ink"
                  >
                    {BLEND_MODES.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={l.opacity}
                  onChange={(e) => setLayerOpacity(l.id, Number(e.target.value))}
                  className="w-full accent-[color:var(--color-sage)]"
                  aria-label={`${l.name} 투명도`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* history panel: click any step to jump straight to it */}
      {showHistory && (
        <div className="absolute left-16 top-16 z-30 flex w-48 max-h-[calc(100%-8rem)] flex-col gap-2 overflow-y-auto px-card p-3">
          <div className="flex items-center justify-between">
            <span className="px-label text-xs text-ink">히스토리</span>
            <button type="button" onClick={() => setShowHistory(false)} aria-label="닫기" className="text-muted">
              <X size={15} />
            </button>
          </div>
          <div className="flex max-h-56 flex-col-reverse gap-0.5 overflow-y-auto">
            {historyLabels.map((label, i) => (
              <button
                key={i}
                type="button"
                onClick={() => jumpToHistory(i)}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${
                  i === historyIndex ? "bg-sage text-white font-semibold ring-2 ring-outline" : "text-ink hover:bg-bg"
                }`}
              >
                <span className="w-5 shrink-0 text-right tabular-nums opacity-70">{i}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* color/filter adjustments: applies to the selection if any, else the whole active layer */}
      {showAdjust && (
        <div className="absolute left-16 top-16 z-30 flex w-52 max-h-[calc(100%-8rem)] flex-col gap-3 overflow-y-auto px-card p-3">
          <div className="flex items-center justify-between">
            <span className="px-label text-xs text-ink">
              보정{selection ? " (선택 영역)" : ""}
            </span>
            <button type="button" onClick={() => setShowAdjust(false)} aria-label="닫기" className="text-muted">
              <X size={15} />
            </button>
          </div>

          {[
            { label: "밝기", value: brightness, set: setBrightness, min: -1, max: 1 },
            { label: "대비", value: contrastAmt, set: setContrastAmt, min: -1, max: 1 },
            { label: "채도", value: saturationAmt, set: setSaturationAmt, min: -1, max: 1 },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="w-8 shrink-0 text-[10px] font-medium text-muted">{s.label}</span>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={0.05}
                value={s.value}
                onChange={(e) => s.set(Number(e.target.value))}
                className="flex-1 accent-[color:var(--color-sage)]"
                aria-label={s.label}
              />
              <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-muted">
                {Math.round(s.value * 100)}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-[10px] font-medium text-muted">흐림</span>
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={blurAmt}
              onChange={(e) => setBlurAmt(Number(e.target.value))}
              className="flex-1 accent-[color:var(--color-sage)]"
              aria-label="흐림"
            />
            <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-muted">{blurAmt}px</span>
          </div>

          <button
            type="button"
            onClick={applyAdjustments}
            className="px-btn px-btn-green py-2 text-xs"
          >
            적용
          </button>
        </div>
      )}

      {/* "more" panel: shapes/text/sticker/pan/select, zoom, opacity, clear */}
      {showMore && (
        <div className="absolute left-16 top-16 z-30 flex w-48 max-h-[calc(100%-8rem)] flex-col gap-3 overflow-y-auto px-card p-3">
          <div className="flex items-center justify-between">
            <span className="px-label text-xs text-ink">더보기</span>
            <button type="button" onClick={() => setShowMore(false)} aria-label="닫기" className="text-muted">
              <X size={15} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {MORE_TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => changeTool(t.id)}
                className={`px-chip flex flex-col items-center gap-1 py-2 text-[10px] ${
                  tool === t.id ? "px-chip-on" : ""
                }`}
              >
                <t.Icon size={16} strokeWidth={1.8} />
                {t.label}
              </button>
            ))}
          </div>

          {tool === "sticker" && (
            <div className="flex flex-wrap items-center justify-center gap-1 rounded-lg border-2 border-outline/30 bg-mood-bg p-2">
              {STICKERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStickerEmoji(s)}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-base transition ${
                    stickerEmoji === s ? "bg-mood-selected scale-110 ring-2 ring-sage" : "bg-white hover:bg-mood-bg"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-[10px] font-medium text-muted">투명</span>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              disabled={tool === "eraser"}
              className="flex-1 accent-[color:var(--color-sage)] disabled:opacity-40"
              aria-label="brush opacity"
            />
            <span className="w-6 shrink-0 text-right text-[10px] tabular-nums text-muted">
              {Math.round(opacity * 100)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-1 rounded-lg border-2 border-outline bg-button-bg px-1 py-1">
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoom <= 1}
              aria-label="축소"
              className="px-tool h-7 w-7"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[10px] tabular-nums text-muted">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={zoomIn}
              disabled={zoom >= MAX_ZOOM}
              aria-label="확대"
              className="px-tool h-7 w-7"
            >
              <ZoomIn size={14} />
            </button>
            {zoom > 1 && (
              <button
                type="button"
                onClick={resetZoom}
                className="px-chip px-2 py-0.5 text-[10px]"
              >
                초기
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (window.confirm("그림을 전체 지울까요? (실행취소로 되돌릴 수 있어요)")) clearCanvas();
            }}
            className="px-btn px-btn-cream gap-1.5 py-2 text-xs"
          >
            <Trash2 size={14} />
            전체 지우기
          </button>
        </div>
      )}

      {/* bottom floating bar: brush size + photo import */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t-[3px] border-outline bg-card/95 px-3 py-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink" aria-hidden />
        <input
          type="range"
          min={1}
          max={120}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="w-20 flex-1 accent-[color:var(--color-sage)] md:flex-none"
          aria-label="brush size"
        />
        <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-ink" aria-hidden />

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="px-btn px-btn-cream h-9 gap-1.5 px-3 text-xs"
          >
            <Camera size={15} strokeWidth={1.8} />
            사진 추가
          </button>
          <button
            type="button"
            onClick={() => albumInputRef.current?.click()}
            className="px-btn px-btn-cream h-9 gap-1.5 px-3 text-xs"
          >
            <ImagePlus size={15} strokeWidth={1.8} />
            앨범
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleBackgroundFile}
            className="hidden"
          />
          <input
            ref={albumInputRef}
            type="file"
            accept="image/*"
            onChange={handleBackgroundFile}
            className="hidden"
          />
        </div>
      </div>
    </div>
    </div>
  );
}
