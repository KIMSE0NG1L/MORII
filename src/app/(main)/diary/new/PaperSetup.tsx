"use client";

import { useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";

const PRESETS = [
  { label: "정사각형", ratio: 1 },
  { label: "세로 3:4", ratio: 3 / 4 },
  { label: "세로 9:16", ratio: 9 / 16 },
  { label: "가로 4:3", ratio: 4 / 3 },
  { label: "가로 16:9", ratio: 16 / 9 },
] as const;

const STAGE = 240; // px - the square area the drag handle moves within
const MIN_SIDE = 56;
// How close (in log-ratio space, so 4:3 and 3:4 are equally "close") a drag
// has to get to a preset before it snaps to it.
const SNAP_TOLERANCE = 0.07;

function clamp(v: number) {
  return Math.min(STAGE, Math.max(MIN_SIDE, v));
}

function sizeForRatio(ratio: number) {
  return ratio >= 1 ? { w: STAGE, h: STAGE / ratio } : { w: STAGE * ratio, h: STAGE };
}

function closestPresetLabel(ratio: number) {
  const closest = PRESETS.reduce((best, p) =>
    Math.abs(Math.log(p.ratio / ratio)) < Math.abs(Math.log(best.ratio / ratio)) ? p : best,
  );
  return Math.abs(Math.log(closest.ratio / ratio)) < SNAP_TOLERANCE ? closest.label : "사용자 지정";
}

export default function PaperSetup({
  onConfirm,
  onBack,
}: {
  onConfirm: (ratio: number) => void;
  onBack?: () => void;
}) {
  const [size, setSize] = useState(() => sizeForRatio(3 / 4));
  const dragRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  function handlePointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
  }

  function handlePointerMove(e: React.PointerEvent) {
    const start = dragRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    let w = clamp(start.w + dx);
    let h = clamp(start.h + dy);

    const ratio = w / h;
    const snap = PRESETS.find((p) => Math.abs(Math.log(p.ratio / ratio)) < SNAP_TOLERANCE);
    if (snap) {
      // Re-derive whichever side moved less this drag, so the snap doesn't
      // fight the axis the person is actually dragging along.
      if (Math.abs(dx) >= Math.abs(dy)) h = clamp(w / snap.ratio);
      else w = clamp(h * snap.ratio);
    }
    setSize({ w, h });
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  const ratio = size.w / size.h;

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-10">
      <div className="flex w-full max-w-md items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="뒤로"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink hover:bg-button-bg"
          >
            <ArrowLeft size={19} strokeWidth={1.8} />
          </button>
        )}
        <div>
          <h2 className="text-lg font-serif font-bold text-ink">용지 비율 정하기</h2>
          <p className="text-xs text-muted">모서리를 드래그해서 원하는 비율로 만들어보세요</p>
        </div>
      </div>

      <div
        className="relative flex shrink-0 items-center justify-center rounded-xl border border-dashed border-line"
        style={{ width: STAGE, height: STAGE }}
      >
        <div
          className="relative rounded-md border-2 border-sage bg-sage/10 shadow-sm"
          style={{ width: size.w, height: size.h }}
        >
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={(e) => {
              if (e.buttons === 0) handlePointerUp();
            }}
            className="absolute -bottom-2.5 -right-2.5 h-6 w-6 cursor-nwse-resize touch-none rounded-full border-2 border-white bg-sage shadow"
            aria-label="비율 조절 핸들"
          />
        </div>
      </div>

      <p className="text-sm font-semibold text-ink">
        {closestPresetLabel(ratio)}{" "}
        <span className="font-normal text-muted">({Math.round(ratio * 100) / 100} : 1)</span>
      </p>

      <div className="flex flex-wrap justify-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setSize(sizeForRatio(p.ratio))}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              Math.abs(Math.log(p.ratio / ratio)) < SNAP_TOLERANCE
                ? "bg-sage text-white"
                : "bg-button-bg text-muted hover:bg-button-bg/80"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onConfirm(ratio)}
        className="rounded-full bg-sage px-8 py-3 text-sm font-semibold text-white shadow-sm"
      >
        이 비율로 입장하기
      </button>
    </div>
  );
}
