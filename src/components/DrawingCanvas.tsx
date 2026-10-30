"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BoxSelect,
  Camera,
  ChevronDown,
  ChevronUp,
  Circle,
  Droplets,
  Eraser,
  Eye,
  EyeOff,
  History,
  ImagePlus,
  Layers,
  Minus,
  Move,
  MoreHorizontal,
  Paintbrush,
  Pencil,
  PenTool,
  Plus,
  Redo2,
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

const COLORS = ["#293129", "#71836B", "#D7AD8D", "#758DA6", "#B07B6E", "#F0D6D2", "#FFFFFF"];
const STICKERS = ["🌸", "🌿", "🌙", "⭐", "☁️", "🍀", "☕", "✨", "❤️", "😊", "🐾", "🌈"];
const MAX_HISTORY = 20;
const MAX_ZOOM = 4;
const MAX_LAYERS = 6;
const BASE_LAYER_ID = "base";

// Exported so the diary composer can clear the autosaved draft once the
// drawing has actually been uploaded and saved as a diary entry.
export const DRAWING_DRAFT_KEY = "morii-drawing-draft-v1";

type Tool = "brush" | "eraser" | "line" | "rect" | "circle" | "text" | "sticker" | "pan" | "select";

const MORE_TOOLS: { id: Tool; label: string; Icon: typeof Paintbrush }[] = [
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

type Pt = { x: number; y: number };
type LayerMeta = { id: string; name: string; visible: boolean; opacity: number };
type HistoryEntry = { label: string; layers: LayerMeta[]; bitmaps: Map<string, ImageData> };

function hexToRgb(hex: string) {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Walks from `from` to `to`, calling `stamp` at every `spacing` px along the
// way (continuing smoothly across segment/event boundaries via `carry`, the
// leftover distance from the previous call) and returns the new carry.
function stampAlongSegment(from: Pt, to: Pt, spacing: number, carry: number, stamp: (p: Pt) => void) {
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

// Graphite grain: a scatter of tiny specks instead of a solid fill, so the
// stroke reads as textured rather than a perfectly smooth line.
function pencilDab(ctx: CanvasRenderingContext2D, p: Pt, radius: number, color: string, flowAlpha: number) {
  const count = Math.max(5, Math.round(radius * 1.4));
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * radius;
    const speck = 0.4 + Math.random() * 0.7;
    ctx.globalAlpha = flowAlpha * (0.35 + Math.random() * 0.5);
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, speck, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Soft radial spray - built up by overlapping dabs along the path, the way
// a real airbrush deposits more pigment where it lingers.
function airbrushDab(ctx: CanvasRenderingContext2D, p: Pt, radius: number, color: string, flowAlpha: number) {
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
function watercolorDab(ctx: CanvasRenderingContext2D, p: Pt, radius: number, color: string, flowAlpha: number) {
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
    const a = Math.random() * Math.PI * 2;
    const offset = Math.random() * radius * 0.18;
    const bx = p.x + Math.cos(a) * offset;
    const by = p.y + Math.sin(a) * offset;
    const br = radius * (0.85 + Math.random() * 0.25);
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

function labelForTool(tool: Tool, brushStyle: BrushStyle) {
  if (tool === "brush") return BRUSH_STYLES.find((s) => s.id === brushStyle)?.label ?? "브러시";
  if (tool === "eraser") return "지우개";
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
}) {
  const [color, setColor] = useState(COLORS[0]);
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
    { id: BASE_LAYER_ID, name: "배경", visible: true, opacity: 1 },
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
  const restoredDraft = useRef(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);
  // Leftover distance (px) toward the next stamp, for the textured brush
  // styles - keeps dabs evenly spaced across pointermove event boundaries.
  const stampCarry = useRef(0);

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
      dctx.drawImage(lc, 0, 0);
    }
    dctx.globalAlpha = 1;

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
    pushHistoryEntry("선택 영역 삭제");
    setSelection(null);
  }

  function pushHistoryEntry(label: string, layersOverride?: LayerMeta[]) {
    const layersNow = layersOverride ?? layersRef.current;
    const bitmaps = new Map<string, ImageData>();
    for (const l of layersNow) {
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
  }

  function restoreHistoryEntry(index: number) {
    const entry = historySnapshots.current[index];
    if (!entry) return;
    const idsHere = new Set(entry.layers.map((l) => l.id));
    for (const l of entry.layers) {
      const lc = layerCanvases.current.get(l.id);
      const snap = entry.bitmaps.get(l.id);
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

    const meta: LayerMeta = { id, name: `레이어 ${nextLayerNum.current++}`, visible: true, opacity: 1 };
    const next = [...layers, meta];
    setLayers(next);
    layersRef.current = next;
    setActiveLayerId(id);
    compositeLayers(next);
    pushHistoryEntry("레이어 추가", next);
  }

  function deleteLayer(id: string) {
    if (layers.length <= 1) return;
    const next = layers.filter((l) => l.id !== id);
    layerCanvases.current.delete(id);
    setLayers(next);
    layersRef.current = next;
    setActiveLayerId((cur) => (cur === id ? (next[next.length - 1]?.id ?? cur) : cur));
    compositeLayers(next);
    pushHistoryEntry("레이어 삭제", next);
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
    pushHistoryEntry("레이어 순서 변경", next);
  }

  function toggleLayerVisible(id: string) {
    const next = layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l));
    setLayers(next);
    layersRef.current = next;
    compositeLayers(next);
    pushHistoryEntry("레이어 표시 전환", next);
  }

  function setLayerOpacity(id: string, value: number) {
    const next = layers.map((l) => (l.id === id ? { ...l, opacity: value } : l));
    setLayers(next);
    layersRef.current = next;
    compositeLayers(next);
  }

  function saveDraft() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      localStorage.setItem(DRAWING_DRAFT_KEY, canvas.toDataURL("image/png"));
    } catch {
      // Private browsing / full storage - the draft is just a convenience, drop it silently.
    }
  }

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

    if (!layerCanvases.current.has(BASE_LAYER_ID)) {
      layerCanvases.current.set(BASE_LAYER_ID, document.createElement("canvas"));
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
            const scale = Math.min(rect.width / img.width, rect.height / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            lctx.drawImage(img, (rect.width - w) / 2, (rect.height - h) / 2, w, h);
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
    return () => observer.disconnect();
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

  // When a fixed paper ratio is chosen, size the box in JS from the actually
  // available width (not just CSS aspect-ratio + max-height, which only
  // resizes one axis and would otherwise squash the paper on short screens).
  useEffect(() => {
    if (!aspectRatio) return;
    const el = outerRef.current;
    if (!el) return;

    const compute = () => {
      const availW = el.clientWidth;
      const maxH = window.innerHeight * 0.7;
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
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", compute);
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

  // Mouse reports a flat 0.5 pressure while a button is held (0 otherwise);
  // real pen/touch pressure comes through as-is. Either way, scale the
  // stroke width by it so pen input actually feels pressure-sensitive.
  function widthFor(e: React.PointerEvent<HTMLDivElement>) {
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    return Math.max(1, size * (0.4 + 0.6 * pressure));
  }

  function pressureFactor(e: React.PointerEvent<HTMLDivElement>) {
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    return 0.4 + 0.6 * pressure;
  }

  // Per-style radius/spacing/flow tuned so each style roughly tracks the
  // same `size`/`opacity` sliders the plain ink brush uses.
  function stampDab(ctx: CanvasRenderingContext2D, p: Pt, e: React.PointerEvent<HTMLDivElement>) {
    const pf = pressureFactor(e);
    if (brushStyle === "pencil") {
      pencilDab(ctx, p, Math.max(2, size * 0.6), color, opacity * (0.5 + 0.5 * pf));
    } else if (brushStyle === "airbrush") {
      const radius = Math.max(4, size * 1.4) * (0.7 + 0.3 * pf);
      airbrushDab(ctx, p, radius, color, opacity * 0.35 * pf);
    } else if (brushStyle === "watercolor") {
      const radius = Math.max(4, size * 1.0) * (0.75 + 0.25 * pf);
      // Dabs overlap much more tightly than the other styles (see
      // stampSpacing) to read as one smooth wash, so each dab is lighter to
      // keep the built-up tone close to what the opacity slider implies.
      watercolorDab(ctx, p, radius, color, opacity * pf * 0.7);
    }
  }

  function stampSpacing() {
    if (brushStyle === "pencil") return Math.max(1.5, size * 0.25);
    if (brushStyle === "airbrush") return Math.max(2, size * 0.5);
    return Math.max(1.5, size * 0.2); // watercolor - tight overlap for a smooth wash
  }

  function switchToBrushIfToolless() {
    setTool((t) => (t === "eraser" || t === "text" || t === "sticker" || t === "pan" ? "brush" : t));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const pos = getPos(e);

    if (tool === "text") {
      setTextInput({ x: pos.x, y: pos.y, value: "" });
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
        pushHistoryEntry("스티커");
      }
      return;
    }

    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);

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

    // Brush/eraser: a plain tap should still leave a dot, since a single
    // point never reaches pointermove to draw a segment.
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.globalAlpha = tool === "eraser" ? 1 : opacity;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, widthFor(e) / 2, 0, Math.PI * 2);
    ctx.fill();
    compositeLayers();
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
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
        compositeLayers();
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
      compositeLayers();
      return;
    }

    if (!lastPoint.current || !lastMid.current) return;

    if (tool === "brush" && brushStyle !== "ink") {
      stampCarry.current = stampAlongSegment(lastPoint.current, pos, stampSpacing(), stampCarry.current, (p) =>
        stampDab(ctx, p, e),
      );
      lastMid.current = pos;
      lastPoint.current = pos;
      compositeLayers();
      return;
    }

    const newMid = { x: (lastPoint.current.x + pos.x) / 2, y: (lastPoint.current.y + pos.y) / 2 };
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.globalAlpha = tool === "eraser" ? 1 : opacity;
    ctx.strokeStyle = color;
    ctx.lineWidth = widthFor(e);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastMid.current.x, lastMid.current.y);
    ctx.quadraticCurveTo(lastPoint.current.x, lastPoint.current.y, newMid.x, newMid.y);
    ctx.stroke();
    lastMid.current = newMid;
    lastPoint.current = pos;
    compositeLayers();
  }

  function handlePointerUp() {
    const wasDrawing = drawing.current;
    const wasTool = tool;
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
        pushHistoryEntry("이동");
      } else if (selectDragStart.current) {
        selectDragStart.current = null;
        setSelection((s) => (s && s.w > 4 && s.h > 4 ? s : null));
      }
      return;
    }

    if (wasDrawing && wasTool !== "pan") pushHistoryEntry(labelForTool(wasTool, brushStyle));
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
        pushHistoryEntry("사진 추가");
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  function clearCanvas() {
    const lc = activeLayerCanvas();
    const ctx = activeCtx();
    if (!lc || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    if (activeLayerId === BASE_LAYER_ID) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, lc.width / dpr, lc.height / dpr);
    } else {
      ctx.clearRect(0, 0, lc.width / dpr, lc.height / dpr);
    }
    compositeLayers();
    pushHistoryEntry("레이어 지우기");
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
  }

  return (
    <div ref={outerRef} className="w-full">
      <div
        className={`relative mx-auto overflow-hidden rounded-2xl border border-line bg-white ${
          aspectRatio && boxSize ? "" : "h-[70dvh] max-h-[720px] min-h-[420px] w-full md:h-[75dvh]"
        }`}
        style={aspectRatio && boxSize ? { width: boxSize.width, height: boxSize.height } : undefined}
      >
      <div
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          handlePointerUp();
          setCursor((c) => ({ ...c, visible: false }));
        }}
        className="absolute inset-0 touch-none"
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
                className="absolute z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize rounded-full border-2 border-white bg-sage shadow"
                style={{
                  left: pan.x + (selection.x + selection.w) * zoom,
                  top: pan.y + (selection.y + selection.h) * zoom,
                }}
                aria-label="선택 영역 크기 조절"
              />
            )}
            {!isFloating && (
              <div
                className="absolute z-20 flex -translate-x-1/2 items-center gap-1 rounded-full bg-ink px-2 py-1 shadow-lg"
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
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 bg-white/90 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-1">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="뒤로"
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-button-bg"
            >
              <ArrowLeft size={19} strokeWidth={1.8} />
            </button>
          )}
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            aria-label="실행취소"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-button-bg disabled:opacity-30"
          >
            <Undo2 size={19} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            aria-label="다시실행"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-button-bg disabled:opacity-30"
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
            className={`flex h-9 w-9 items-center justify-center rounded-full ${
              showLayers ? "bg-sage text-white" : "text-ink hover:bg-button-bg"
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
            className={`flex h-9 w-9 items-center justify-center rounded-full ${
              showHistory ? "bg-sage text-white" : "text-ink hover:bg-button-bg"
            }`}
          >
            <History size={18} strokeWidth={1.8} />
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
            className={`flex h-9 w-9 items-center justify-center rounded-full ${
              showMore ? "bg-sage text-white" : "text-ink hover:bg-button-bg"
            }`}
          >
            <MoreHorizontal size={19} strokeWidth={1.8} />
          </button>
        </div>
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            className="rounded-full bg-sage px-5 py-2 text-sm font-semibold text-white"
          >
            저장
          </button>
        )}
      </div>

      {/* left rail: brush (tap again for style picker) / eraser + color strip */}
      <div className="absolute left-2 top-16 z-20 flex flex-col items-center gap-2 rounded-full bg-white/90 p-1.5 backdrop-blur">
        <button
          type="button"
          onClick={() => {
            if (tool === "brush") {
              setShowBrushPicker((s) => !s);
            } else {
              changeTool("brush");
              setShowBrushPicker(true);
            }
            setShowMore(false);
          }}
          aria-label="브러시"
          aria-expanded={showBrushPicker}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
            tool === "brush" ? "bg-sage text-white" : "text-ink hover:bg-button-bg"
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
            changeTool("eraser");
            setShowBrushPicker(false);
            setShowMore(false);
          }}
          aria-label="지우개"
          className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
            tool === "eraser" ? "bg-sage text-white" : "text-ink hover:bg-button-bg"
          }`}
        >
          <Eraser size={18} strokeWidth={1.8} />
        </button>

        <div className="my-0.5 h-px w-6 bg-line" />

        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              switchToBrushIfToolless();
              setColor(c);
            }}
            className={`h-6 w-6 shrink-0 rounded-full border-2 transition ${
              color === c ? "border-sage scale-110" : "border-line hover:scale-105"
            }`}
            style={{ background: c }}
            aria-label={c}
          />
        ))}
        <label className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full border-2 border-line cursor-pointer hover:scale-105 transition">
          <input
            type="color"
            value={color}
            onChange={(e) => {
              switchToBrushIfToolless();
              setColor(e.target.value);
            }}
            className="absolute -left-1 -top-1 h-8 w-8 cursor-pointer"
            aria-label="사용자 지정 색상"
          />
          <span className="absolute inset-0 flex items-center justify-center text-[10px]">+</span>
        </label>
      </div>

      {/* brush style picker: ink / pencil / watercolor / airbrush */}
      {showBrushPicker && (
        <div className="absolute left-16 top-16 z-30 flex w-40 flex-col gap-2 rounded-xl border border-line bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">브러시</span>
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
                className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium transition ${
                  brushStyle === s.id ? "bg-sage text-white" : "bg-button-bg text-muted hover:bg-button-bg/80"
                }`}
              >
                <s.Icon size={16} strokeWidth={1.8} />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* layers panel: top of list = topmost layer, matching usual convention */}
      {showLayers && (
        <div className="absolute left-16 top-16 z-30 flex w-56 flex-col gap-2 rounded-xl border border-line bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">레이어</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={addLayer}
                disabled={layers.length >= MAX_LAYERS}
                aria-label="레이어 추가"
                className="flex h-6 w-6 items-center justify-center rounded-full bg-button-bg text-ink disabled:opacity-40"
              >
                <Plus size={13} />
              </button>
              <button type="button" onClick={() => setShowLayers(false)} aria-label="닫기" className="text-muted">
                <X size={15} />
              </button>
            </div>
          </div>
          <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
            {[...layers].reverse().map((l) => (
              <div
                key={l.id}
                className={`flex flex-col gap-1 rounded-lg p-1.5 ${
                  l.id === activeLayerId ? "bg-sage/15" : "hover:bg-bg"
                }`}
              >
                <div className="flex items-center gap-1.5">
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
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={l.opacity}
                  onChange={(e) => setLayerOpacity(l.id, Number(e.target.value))}
                  className="h-1 w-full accent-[color:var(--color-sage)]"
                  aria-label={`${l.name} 투명도`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* history panel: click any step to jump straight to it */}
      {showHistory && (
        <div className="absolute left-16 top-16 z-30 flex w-48 flex-col gap-2 rounded-xl border border-line bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">히스토리</span>
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
                  i === historyIndex ? "bg-sage text-white font-semibold" : "text-ink hover:bg-bg"
                }`}
              >
                <span className="w-5 shrink-0 text-right tabular-nums opacity-70">{i}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* "more" panel: shapes/text/sticker/pan/select, zoom, opacity, clear */}
      {showMore && (
        <div className="absolute left-16 top-16 z-30 flex w-48 flex-col gap-3 rounded-xl border border-line bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">더보기</span>
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
                className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium transition ${
                  tool === t.id ? "bg-sage text-white" : "bg-button-bg text-muted hover:bg-button-bg/80"
                }`}
              >
                <t.Icon size={16} strokeWidth={1.8} />
                {t.label}
              </button>
            ))}
          </div>

          {tool === "sticker" && (
            <div className="flex flex-wrap items-center justify-center gap-1 rounded-xl bg-mood-bg p-2">
              {STICKERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStickerEmoji(s)}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base transition ${
                    stickerEmoji === s ? "bg-mood-selected scale-110" : "bg-white hover:bg-mood-bg"
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
              className="h-1.5 flex-1 accent-[color:var(--color-sage)] disabled:opacity-40"
              aria-label="brush opacity"
            />
            <span className="w-6 shrink-0 text-right text-[10px] tabular-nums text-muted">
              {Math.round(opacity * 100)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-1 rounded-full bg-button-bg px-1 py-1">
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoom <= 1}
              aria-label="축소"
              className="flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-40"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[10px] tabular-nums text-muted">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={zoomIn}
              disabled={zoom >= MAX_ZOOM}
              aria-label="확대"
              className="flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-40"
            >
              <ZoomIn size={14} />
            </button>
            {zoom > 1 && (
              <button
                type="button"
                onClick={resetZoom}
                className="rounded-full px-2 py-1 text-[10px] font-semibold text-muted"
              >
                초기
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={clearCanvas}
            className="flex items-center justify-center gap-1.5 rounded-full bg-button-bg py-2 text-xs font-semibold text-muted"
          >
            <Trash2 size={14} />
            레이어 지우기
          </button>
        </div>
      )}

      {/* bottom floating bar: brush size + photo import */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-3 bg-white/90 px-3 py-2 backdrop-blur">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink" aria-hidden />
        <input
          type="range"
          min={1}
          max={36}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="h-1.5 w-20 flex-1 accent-[color:var(--color-sage)] md:flex-none"
          aria-label="brush size"
        />
        <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-ink" aria-hidden />

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex h-9 items-center gap-1.5 rounded-full bg-button-bg px-3 text-xs font-semibold text-ink"
          >
            <Camera size={15} strokeWidth={1.8} />
            사진 추가
          </button>
          <button
            type="button"
            onClick={() => albumInputRef.current?.click()}
            className="flex h-9 items-center gap-1.5 rounded-full bg-button-bg px-3 text-xs font-semibold text-ink"
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
