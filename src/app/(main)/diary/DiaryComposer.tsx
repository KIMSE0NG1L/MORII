"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DrawingCanvas, { DRAWING_DRAFT_KEY } from "@/components/DrawingCanvas";
import { createClient } from "@/lib/supabase/client";
import { MOODS } from "@/lib/constants";
import { saveDiaryEntry, saveDrawingEntry } from "./actions";

export default function DiaryComposer() {
  const router = useRouter();
  const [mode, setMode] = useState<"text" | "drawing">("text");
  const [mood, setMood] = useState(2);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  async function handleSaveText() {
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    const formData = new FormData();
    formData.set("content", text.trim());
    formData.set("mood", String(mood));
    await saveDiaryEntry(formData);
    setText("");
    setSaving(false);
    router.refresh();
  }

  async function handleSaveDrawing() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    setError(null);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) {
      setSaving(false);
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const path = `${user.id}/${crypto.randomUUID()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("diary-drawings")
      .upload(path, blob, { contentType: "image/png" });

    if (uploadError) {
      setError(uploadError.message);
      setSaving(false);
      return;
    }

    await saveDrawingEntry(path, mood);

    const ctx = canvas.getContext("2d");
    if (ctx) {
      const dpr = window.devicePixelRatio || 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    }
    try {
      localStorage.removeItem(DRAWING_DRAFT_KEY);
    } catch {
      // ignore
    }

    setSaving(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("text")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            mode === "text" ? "bg-sage text-white" : "bg-button-bg text-muted"
          }`}
        >
          글
        </button>
        <button
          type="button"
          onClick={() => setMode("drawing")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            mode === "drawing" ? "bg-sage text-white" : "bg-button-bg text-muted"
          }`}
        >
          그림
        </button>
      </div>

      <div className="flex justify-between">
        {MOODS.map((emoji, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setMood(i)}
            className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${
              mood === i ? "bg-mood-selected" : "bg-mood-bg"
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {mode === "text" ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="오늘은 어떤 하루였나요?"
            className="rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-sage"
          />
          <button
            type="button"
            onClick={handleSaveText}
            disabled={saving || !text.trim()}
            className="self-end rounded-full bg-sage px-5 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장하기 (+5 XP)"}
          </button>
        </>
      ) : (
        <>
          <DrawingCanvas canvasRef={canvasRef} />
          <button
            type="button"
            onClick={handleSaveDrawing}
            disabled={saving}
            className="self-end rounded-full bg-sage px-5 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장하기 (+5 XP)"}
          </button>
        </>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
