"use client";

import { useState } from "react";
import { updateProfile } from "./actions";

export function EditProfileModal({ nickname, bio, visibility }: { nickname: string; bio: string; visibility: string }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newBio, setNewBio] = useState(bio);
  const [newVisibility, setNewVisibility] = useState(visibility);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("bio", newBio);
      formData.set("visibility", newVisibility);
      formData.set("nickname", nickname);

      await updateProfile(formData);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "프로필 수정에 실패했습니다");
      setIsSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-btn px-btn-green w-full py-2 text-sm"
      >
        프로필 편집
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setOpen(false)} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-panel p-6 w-full max-w-sm z-50 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-ink mb-4">프로필 편집</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Nickname (Read-only) */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-ink">닉네임</label>
            <input
              type="text"
              value={nickname}
              disabled
              className="w-full px-input px-4 py-2 text-sm"
            />
            <p className="text-xs text-muted">소셜 로그인 계정 이름으로 자동 설정됩니다</p>
          </div>

          {/* Bio */}
          <div className="flex flex-col gap-2">
            <label htmlFor="bio" className="text-xs font-semibold text-ink">
              소개
            </label>
            <textarea
              id="bio"
              value={newBio}
              onChange={(e) => setNewBio(e.target.value)}
              placeholder="자신을 소개해주세요"
              maxLength={100}
              rows={3}
              className="w-full px-4 py-2 px-input text-sm resize-none"
            />
            <p className="text-xs text-muted text-right">
              {newBio.length}/100
            </p>
          </div>

          {/* Visibility */}
          <div className="flex flex-col gap-2">
            <label htmlFor="visibility" className="text-xs font-semibold text-ink">
              공개 범위
            </label>
            <select
              id="visibility"
              value={newVisibility}
              onChange={(e) => setNewVisibility(e.target.value)}
              className="w-full px-4 py-2 px-input text-sm"
            >
              <option value="public">전체 공개</option>
              <option value="friends">친구 공개</option>
              <option value="private">비공개</option>
            </select>
          </div>

          {/* Error Message */}
          {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

          {/* Buttons */}
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
              className="px-btn px-btn-cream flex-1 py-2 text-sm"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-btn px-btn-green flex-1 py-2 text-sm disabled:opacity-50"
            >
              {isSubmitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
