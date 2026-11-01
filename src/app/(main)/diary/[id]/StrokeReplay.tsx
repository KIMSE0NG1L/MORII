"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import {
  makeRng,
  renderShapeEvent,
  renderStickerEvent,
  renderStrokePoint,
  renderTextEvent,
  type StrokeDrawState,
  type StrokeEvent,
  type StrokeLog,
} from "@/lib/strokeRenderer";

// Pacing constants for the replay - the recorded log has no timestamps (see
// the plan: only points + a seed are stored), so these just pick a pleasant
// watch speed rather than reproducing the original drawing's real-time pace.
const STROKE_STEP_MS = 24;
const SHAPE_DRAW_MS = 400;
const TEXT_PAUSE_MS = 180;
const BITMAP_JUMP_MS = 350;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

export default function StrokeReplay({ logUrl }: { logUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [log, setLog] = useState<StrokeLog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Playback cursor lives in refs, not state, so the async playback loop
  // below always reads the latest value without needing to restart on every
  // render. `generationRef` lets restart() invalidate a loop that's
  // mid-await without any extra cancellation plumbing: every await point
  // re-checks it and bails out if a newer generation has started.
  const generationRef = useRef(0);
  const pausedRef = useRef(false);
  const eventIndexRef = useRef(0);
  const runningRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch(logUrl)
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((data: StrokeLog) => {
        if (!cancelled) setLog(data);
      })
      .catch(() => {
        if (!cancelled) setError("녹화를 불러오지 못했어요.");
      });
    return () => {
      cancelled = true;
    };
  }, [logUrl]);

  useEffect(() => {
    if (!log) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = Math.max(1, Math.round(log.width));
    canvas.height = Math.max(1, Math.round(log.height));
    drawBaseline(canvas, log.initialImage).catch(() => {});
  }, [log]);

  async function drawBaseline(canvas: HTMLCanvasElement, src: string) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!src) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const img = await loadImage(src);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  async function waitWhilePaused(gen: number) {
    while (pausedRef.current && gen === generationRef.current) {
      await sleep(60);
    }
  }

  async function crossfadeTo(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, src: string, gen: number) {
    if (!src) return;
    const from = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let img: HTMLImageElement;
    try {
      img = await loadImage(src);
    } catch {
      return;
    }
    if (gen !== generationRef.current) return;
    const steps = 10;
    for (let s = 1; s <= steps; s++) {
      ctx.putImageData(from, 0, 0);
      ctx.globalAlpha = s / steps;
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
      await sleep(BITMAP_JUMP_MS / steps / speedRef.current);
      if (gen !== generationRef.current) return;
    }
  }

  async function playEvent(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, event: StrokeEvent, gen: number) {
    if (event.kind === "stroke") {
      if (event.points.length === 0) return;
      const rng = makeRng(event.seed);
      let state: StrokeDrawState = { lastPoint: event.points[0], lastMid: event.points[0], carry: 0 };
      const batch = Math.max(1, Math.round(event.points.length / 40));
      for (let p = 0; p < event.points.length; p++) {
        state = renderStrokePoint(ctx, event, p, state, rng);
        if ((p + 1) % batch === 0 || p === event.points.length - 1) {
          await sleep(STROKE_STEP_MS / speedRef.current);
          if (gen !== generationRef.current) return;
          await waitWhilePaused(gen);
          if (gen !== generationRef.current) return;
        }
      }
      return;
    }
    if (event.kind === "shape") {
      const steps = 16;
      for (let s = 1; s <= steps; s++) {
        renderShapeEvent(ctx, event, s / steps);
        await sleep(SHAPE_DRAW_MS / steps / speedRef.current);
        if (gen !== generationRef.current) return;
        await waitWhilePaused(gen);
        if (gen !== generationRef.current) return;
      }
      return;
    }
    if (event.kind === "text") {
      renderTextEvent(ctx, event);
      await sleep(TEXT_PAUSE_MS / speedRef.current);
      return;
    }
    if (event.kind === "sticker") {
      renderStickerEvent(ctx, event);
      await sleep(TEXT_PAUSE_MS / speedRef.current);
      return;
    }
    await crossfadeTo(ctx, canvas, event.image, gen);
  }

  async function runPlayback(gen: number) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !log) return;
    for (let i = eventIndexRef.current; i < log.events.length; i++) {
      if (gen !== generationRef.current) return;
      await waitWhilePaused(gen);
      if (gen !== generationRef.current) return;
      eventIndexRef.current = i;
      await playEvent(ctx, canvas, log.events[i], gen);
      if (gen !== generationRef.current) return;
    }
    eventIndexRef.current = log.events.length;
    setDone(true);
    setPlaying(false);
  }

  function handlePlay() {
    if (!log || done) return;
    setPlaying(true);
    pausedRef.current = false;
    if (!runningRef.current) {
      runningRef.current = true;
      const gen = generationRef.current;
      runPlayback(gen).finally(() => {
        runningRef.current = false;
      });
    }
  }

  function handlePause() {
    setPlaying(false);
    pausedRef.current = true;
  }

  async function handleRestart() {
    generationRef.current += 1;
    const gen = generationRef.current;
    pausedRef.current = false;
    eventIndexRef.current = 0;
    setDone(false);
    const canvas = canvasRef.current;
    if (log && canvas) await drawBaseline(canvas, log.initialImage).catch(() => {});
    if (gen !== generationRef.current) return;
    setPlaying(true);
    runningRef.current = true;
    runPlayback(gen).finally(() => {
      runningRef.current = false;
    });
  }

  if (error) return <p className="text-xs text-red-500">{error}</p>;
  if (!log) return <p className="text-xs text-muted">녹화를 불러오는 중...</p>;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="overflow-hidden rounded-xl border border-line bg-white"
        style={{ aspectRatio: `${Math.max(1, log.width)} / ${Math.max(1, log.height)}` }}
      >
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleRestart}
          aria-label="처음부터"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted hover:border-sage"
        >
          <RotateCcw size={16} />
        </button>
        <button
          type="button"
          onClick={playing ? handlePause : handlePlay}
          aria-label={playing ? "일시정지" : "재생"}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-sage text-white"
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          type="button"
          onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
          className="flex h-9 items-center justify-center rounded-full border border-line px-3 text-xs font-semibold text-muted hover:border-sage"
        >
          {speed}x
        </button>
      </div>
    </div>
  );
}
