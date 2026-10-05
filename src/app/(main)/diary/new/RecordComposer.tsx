"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import DrawingCanvas, { DRAWING_DRAFT_KEY } from "@/components/DrawingCanvas";
import { createClient } from "@/lib/supabase/client";
import { MOODS } from "@/lib/constants";
import { DIARY_BUCKET, prepareImageUpload } from "@/lib/storage";
import { saveRecord } from "../actions";

type ImageMode = "draw" | "upload" | "none";

const MODE_TABS: { id: ImageMode; label: string }[] = [
  { id: "draw", label: "✏️ 직접 그리기" },
  { id: "upload", label: "🖼️ 이미지 불러오기" },
  { id: "none", label: "📝 글만 쓰기" },
];

export default function RecordComposer({
  userId,
  initialMode,
  templateUrl,
  groups,
}: {
  userId: string;
  initialMode: ImageMode;
  templateUrl?: string;
  groups: { id: string; title: string }[];
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ImageMode>(initialMode);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [mood, setMood] = useState(2);
  const [exhibitGroupId, setExhibitGroupId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Release the last preview's object URL when leaving the page.
  const previewRef = useRef<string | null>(null);
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  function pickFile(next: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next ? URL.createObjectURL(next) : null;
    setFile(next);
    setPreviewUrl(previewRef.current);
  }

  async function imageBlob(): Promise<{ blob: Blob; ext: string; source: "drawn" | "uploaded" } | null> {
    if (mode === "draw") {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      return blob ? { blob, ext: "png", source: "drawn" } : null;
    }
    if (mode === "upload" && file) {
      return { blob: await prepareImageUpload(file), ext: "jpg", source: "uploaded" };
    }
    return null;
  }

  async function handleSave() {
    if (mode === "upload" && !file) {
      setError("불러올 이미지를 선택해주세요.");
      return;
    }
    if (mode === "none" && !body.trim()) {
      setError("오늘의 마음을 적어주세요.");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      let imagePath: string | null = null;
      let imageSource: "drawn" | "uploaded" | null = null;
      const image = await imageBlob();
      if (image) {
        imagePath = `${userId}/${crypto.randomUUID()}.${image.ext}`;
        imageSource = image.source;
        const { error: uploadError } = await createClient()
          .storage.from(DIARY_BUCKET)
          .upload(imagePath, image.blob, { contentType: image.blob.type });
        if (uploadError) throw new Error(uploadError.message);
      }

      const id = await saveRecord({
        imagePath,
        imageSource,
        body,
        mood,
        exhibitGroupId: exhibitGroupId || null,
      });

      if (mode === "draw") {
        try {
          localStorage.removeItem(DRAWING_DRAFT_KEY);
        } catch {
          // ignore
        }
      }
      router.push(`/diary/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했어요.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4 md:p-6">
      <div className="flex flex-wrap justify-center gap-1 rounded-full bg-button-bg p-1 w-fit mx-auto">
        {MODE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMode(tab.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              mode === tab.id ? "bg-sage text-white" : "text-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === "draw" && <DrawingCanvas canvasRef={canvasRef} templateUrl={templateUrl} />}

      {mode === "upload" && (
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-line bg-bg text-sm text-muted hover:border-sage"
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="불러온 이미지" className="h-full w-full object-contain" />
            ) : (
              <span className="flex flex-col items-center gap-2">
                <ImagePlus size={32} strokeWidth={1.5} />
                사진이나 작업한 이미지를 선택하세요
              </span>
            )}
          </button>
          {previewUrl && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="self-center text-xs text-muted underline"
            >
              다른 이미지 선택
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-muted">오늘의 마음</p>
        <div className="flex justify-between">
          {MOODS.map((emoji, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setMood(i)}
              aria-label={`기분 ${i + 1}`}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${
                mood === i ? "bg-mood-selected ring-2 ring-sage" : "bg-mood-bg"
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        placeholder={
          mode === "none"
            ? "오늘은 어떤 하루였나요?"
            : "이 그림에 담긴 마음, 그리며 떠오른 생각을 적어보세요."
        }
        className="rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-sage"
      />

      {groups.length > 0 && mode !== "none" && (
        <label className="flex flex-wrap items-center gap-2 rounded-xl bg-tag-bg px-3 py-2 text-xs text-ink">
          <span>🖼️ 전시회에 걸기</span>
          <select
            value={exhibitGroupId}
            onChange={(e) => setExhibitGroupId(e.target.value)}
            className="rounded border border-line bg-white px-2 py-1"
          >
            <option value="">나만 보기</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
          {exhibitGroupId && (
            <span className="text-muted">같은 집단 사람들에게 그림과 글이 함께 전시돼요.</span>
          )}
        </label>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="self-end rounded-full bg-sage px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "저장 중..." : "기록 저장하기 (+5 XP)"}
      </button>
    </div>
  );
}
