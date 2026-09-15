"use client";

import { useEffect, useRef, useState } from "react";

const COLORS = ["#293129", "#71836B", "#D7AD8D", "#758DA6", "#B07B6E", "#F0D6D2", "#FFFFFF"];
const STICKERS = ["🌸", "🌿", "🌙", "⭐", "☁️", "🍀", "☕", "✨", "❤️", "😊", "🐾", "🌈"];
const MAX_HISTORY = 20;
const MAX_ZOOM = 4;

// Exported so the diary composer can clear the autosaved draft once the
// drawing has actually been uploaded and saved as a diary entry.
export const DRAWING_DRAFT_KEY = "morii-drawing-draft-v1";

type Tool = "brush" | "eraser" | "line" | "rect" | "circle" | "text" | "sticker" | "pan";

const TOOLS: { id: Tool; label: string }[] = [
  { id: "brush", label: "🖌️ 브러시" },
  { id: "eraser", label: "🧼 지우개" },
  { id: "line", label: "📏 직선" },
  { id: "rect", label: "▭ 사각형" },
  { id: "circle", label: "⚪ 원" },
  { id: "text", label: "🔤 텍스트" },
  { id: "sticker", label: "🏷️ 스티커" },
  { id: "pan", label: "✋ 이동" },
];

export default function DrawingCanvas({
  canvasRef,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(6);
  const [opacity, setOpacity] = useState(1);
  const [tool, setTool] = useState<Tool>("brush");
  const [stickerEmoji, setStickerEmoji] = useState(STICKERS[0]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });
  const [textInput, setTextInput] = useState<{ x: number; y: number; value: string } | null>(null);

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
  const undoStack = useRef<ImageData[]>([]);
  const redoStack = useRef<ImageData[]>([]);
  const restoredDraft = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function saveDraft() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      localStorage.setItem(DRAWING_DRAFT_KEY, canvas.toDataURL("image/png"));
    } catch {
      // Private browsing / full storage - the draft is just a convenience, drop it silently.
    }
  }

  // Backs the canvas at devicePixelRatio resolution so strokes stay crisp on
  // retina/phone screens, and re-does this on layout/orientation changes
  // without losing the drawing (redrawn onto the freshly sized backing
  // store). The canvas's CSS size always matches the (fixed, clipped)
  // viewport 1:1 - zoom/pan are applied as a separate visual transform on
  // top, never touching the backing store or drawing coordinates.
  useEffect(() => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) return;

    const resize = () => {
      const rect = viewport.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const nextWidth = Math.max(1, Math.round(rect.width * dpr));
      const nextHeight = Math.max(1, Math.round(rect.height * dpr));
      if (nextWidth === canvas.width && nextHeight === canvas.height) return;

      const prevHadContent = canvas.width > 0 && canvas.height > 0;
      const snapshot = document.createElement("canvas");
      if (prevHadContent) {
        snapshot.width = canvas.width;
        snapshot.height = canvas.height;
        snapshot.getContext("2d")?.drawImage(canvas, 0, 0);
      }

      canvas.width = nextWidth;
      canvas.height = nextHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);

      if (prevHadContent) {
        ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, rect.width, rect.height);
      } else if (!restoredDraft.current) {
        restoredDraft.current = true;
        try {
          const draft = localStorage.getItem(DRAWING_DRAFT_KEY);
          if (draft) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
            img.src = draft;
          }
        } catch {
          // ignore
        }
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [canvasRef]);

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

  function pushUndoSnapshot() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    undoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }

  // Mouse reports a flat 0.5 pressure while a button is held (0 otherwise);
  // real pen/touch pressure comes through as-is. Either way, scale the
  // stroke width by it so pen input actually feels pressure-sensitive.
  function widthFor(e: React.PointerEvent<HTMLDivElement>) {
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    return Math.max(1, size * (0.4 + 0.6 * pressure));
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
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        pushUndoSnapshot();
        const stampSize = Math.max(24, size * 5);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = opacity;
        ctx.font = `${stampSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(stickerEmoji, pos.x, pos.y);
        ctx.textAlign = "left";
        saveDraft();
      }
      return;
    }

    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);

    if (tool === "pan") {
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      return;
    }

    pushUndoSnapshot();
    lastPoint.current = pos;
    lastMid.current = pos;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    if (tool === "line" || tool === "rect" || tool === "circle") {
      previewBase.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
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

    const ctx = canvasRef.current?.getContext("2d");
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
      return;
    }

    if (!lastPoint.current || !lastMid.current) return;
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
  }

  function handlePointerUp() {
    const wasDrawing = drawing.current;
    const wasTool = tool;
    drawing.current = false;
    lastPoint.current = null;
    lastMid.current = null;
    previewBase.current = null;
    panStart.current = null;
    if (wasDrawing && wasTool !== "pan") saveDraft();
  }

  function commitText() {
    const pending = textInput;
    setTextInput(null);
    if (!pending || !pending.value.trim()) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    pushUndoSnapshot();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.font = `${Math.max(14, size * 3)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(pending.value, pending.x, pending.y);
    saveDraft();
  }

  function handleBackgroundFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const rect = canvas.getBoundingClientRect();
        pushUndoSnapshot();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        saveDraft();
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    pushUndoSnapshot();
    const dpr = window.devicePixelRatio || 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    saveDraft();
  }

  function undo() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const snapshot = undoStack.current.pop();
    if (!snapshot) return;
    redoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.putImageData(snapshot, 0, 0);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
    saveDraft();
  }

  function redo() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const snapshot = redoStack.current.pop();
    if (!snapshot) return;
    undoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.putImageData(snapshot, 0, 0);
    setCanRedo(redoStack.current.length > 0);
    setCanUndo(true);
    saveDraft();
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

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          handlePointerUp();
          setCursor((c) => ({ ...c, visible: false }));
        }}
        className="relative aspect-square w-full touch-none overflow-hidden rounded-xl border border-line bg-white"
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

      <div className="flex flex-wrap items-center gap-1.5">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTool(t.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              tool === t.id ? "bg-sage text-white" : "bg-button-bg text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tool === "sticker" && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-mood-bg p-2">
          {STICKERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStickerEmoji(s)}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-lg ${
                stickerEmoji === s ? "bg-mood-selected" : "bg-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-full bg-button-bg px-3 py-1 text-xs font-semibold"
        >
          🖼️ 사진 배경
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleBackgroundFile}
          className="hidden"
        />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoom <= 1}
            className="rounded-full bg-button-bg px-2.5 py-1 text-xs font-semibold disabled:opacity-40"
          >
            ➖
          </button>
          <span className="w-9 text-center text-[10px] text-muted">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="rounded-full bg-button-bg px-2.5 py-1 text-xs font-semibold disabled:opacity-40"
          >
            ➕
          </button>
          {zoom > 1 && (
            <button
              type="button"
              onClick={resetZoom}
              className="rounded-full bg-button-bg px-2.5 py-1 text-xs font-semibold"
            >
              리셋
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="rounded-full bg-button-bg px-3 py-1 text-xs font-semibold disabled:opacity-40"
          >
            ↩️ 실행취소
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            className="rounded-full bg-button-bg px-3 py-1 text-xs font-semibold disabled:opacity-40"
          >
            ↪️ 다시실행
          </button>
          <button
            type="button"
            onClick={clearCanvas}
            className="rounded-full bg-button-bg px-3 py-1 text-xs font-semibold"
          >
            전체 지우기
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-center text-[10px] text-muted">굵기</span>
        <input
          type="range"
          min={1}
          max={36}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="flex-1 accent-[color:var(--color-sage)]"
          aria-label="brush size"
        />
        <span className="w-6 shrink-0 text-right text-[10px] text-muted">{size}</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-center text-[10px] text-muted">투명도</span>
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
        <span className="w-6 shrink-0 text-right text-[10px] text-muted">
          {Math.round(opacity * 100)}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              switchToBrushIfToolless();
              setColor(c);
            }}
            className={`h-6 w-6 shrink-0 rounded-full border-2 ${
              color === c ? "border-sage" : "border-line"
            }`}
            style={{ background: c }}
            aria-label={c}
          />
        ))}
        <label className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full border-2 border-line">
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
        </label>
      </div>
    </div>
  );
}
