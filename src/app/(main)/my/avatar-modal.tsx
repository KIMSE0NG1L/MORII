"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import AvatarEditor from "@/components/AvatarEditor";
import PixelAvatar from "@/components/PixelAvatar";
import { normalizeAvatarId } from "@/lib/avatarLook";
import { playSfx } from "@/lib/sfx";
import { selectAvatar } from "./actions";

// The avatar frame on My page doubles as the "꾸미기" button.
export function AvatarModal({ avatarId }: { avatarId: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => normalizeAvatarId(avatarId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("avatar_id", draft);
      await selectAvatar(form);
      playSfx("success");
      setOpen(false);
    } catch {
      playSfx("error");
      setError("저장하지 못했어요. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        data-sfx="open"
        onClick={() => {
          setDraft(normalizeAvatarId(avatarId));
          setOpen(true);
        }}
        aria-label="캐릭터 꾸미기"
        className="group relative flex h-20 w-20 items-center justify-center rounded-lg border-[3px] border-outline bg-tag-bg transition hover:bg-[#d6e8b8]"
      >
        <PixelAvatar avatarId={avatarId} className="w-10" />
        <span className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-md border-2 border-outline bg-sage text-white shadow-[0_2px_0_var(--color-outline)]">
          <Pencil size={13} />
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="캐릭터 꾸미기"
            className="px-panel fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto p-5"
          >
            <h2 className="mb-4 text-lg font-bold text-ink">🎨 캐릭터 꾸미기</h2>
            <AvatarEditor value={draft} onChange={setDraft} />
            {error && <p className="mt-3 text-sm text-[#b23c26]">{error}</p>}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                data-sfx="close"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="px-btn px-btn-cream flex-1 py-2 text-sm"
              >
                취소
              </button>
              <button
                type="button"
                data-sfx="none"
                onClick={save}
                disabled={saving}
                className="px-btn px-btn-green flex-1 py-2 text-sm"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
