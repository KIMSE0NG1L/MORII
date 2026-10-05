"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MATERIAL_KINDS } from "@/lib/constants";
import { MATERIALS_BUCKET } from "@/lib/storage";
import type { MaterialKind } from "@/lib/types/database";
import { addMaterial } from "../actions";

const MAX_BYTES = 20 * 1024 * 1024;

export default function MaterialUploader({ groupId, sessionId }: { groupId: string; sessionId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<MaterialKind>("mind_card");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("파일을 선택해주세요.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("20MB 이하 파일만 올릴 수 있어요.");
      return;
    }
    setUploading(true);
    setError(null);

    try {
      const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "bin";
      const filePath = `${groupId}/${sessionId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await createClient()
        .storage.from(MATERIALS_BUCKET)
        .upload(filePath, file, { contentType: file.type || undefined });
      if (uploadError) throw new Error(uploadError.message);

      await addMaterial({
        sessionId,
        kind,
        title: String(form.get("title") ?? "") || file.name.replace(/\.[^.]+$/, ""),
        filePath,
        mimeType: file.type,
      });
      formRef.current?.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드하지 못했어요.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {MATERIAL_KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            className={`rounded-full px-3 py-1 text-xs ${
              kind === k.id ? "bg-sage text-white" : "bg-tag-bg text-tag-text"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <input
        name="title"
        placeholder="자료 이름 (비워두면 파일명)"
        className="rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-sage"
      />
      <input
        name="file"
        type="file"
        accept="image/*,application/pdf,.ppt,.pptx,.doc,.docx,.hwp"
        className="text-xs file:mr-3 file:rounded-full file:border-0 file:bg-tag-bg file:px-3 file:py-1.5 file:text-xs"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={uploading}
        className="self-end rounded-full bg-sage px-5 py-2 text-xs font-semibold text-white disabled:opacity-50"
      >
        {uploading ? "올리는 중..." : "자료 올리기"}
      </button>
    </form>
  );
}
