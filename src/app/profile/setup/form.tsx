"use client";

import { useState } from "react";
import { AVATAR_PRESETS } from "@/lib/constants";
import { createProfile } from "./actions";
import PixelAvatar from "@/components/PixelAvatar";

export function ProfileSetupForm({ defaultNickname = "" }: { defaultNickname?: string }) {
  const [selectedAvatar, setSelectedAvatar] = useState("a1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState(defaultNickname);

  console.log("📝 ProfileSetupForm - defaultNickname:", defaultNickname, "nickname:", nickname);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);
      formData.set("avatar_id", selectedAvatar);
      await createProfile(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "프로필 생성에 실패했습니다");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Avatar Preview */}
      <div className="flex justify-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-lg border-[3px] border-outline bg-tag-bg shadow-[0_3px_0_var(--color-outline)]">
          <PixelAvatar avatarId={selectedAvatar} className="w-12" />
        </div>
      </div>

      {/* Nickname Input */}
      <div className="flex flex-col gap-2">
        <label htmlFor="nickname" className="text-xs font-semibold text-ink">
          닉네임 *
        </label>
        <input
          id="nickname"
          name="nickname"
          type="text"
          placeholder="닉네임을 입력하세요"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
          maxLength={20}
          className="w-full px-4 py-2 px-input text-sm"
        />
      </div>

      {/* Avatar Selection */}
      <div className="flex flex-col gap-2">
        <label className="px-label text-xs text-ink">아바타 선택</label>
        <div className="grid grid-cols-3 gap-3">
          {AVATAR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setSelectedAvatar(preset.id)}
              className={`rounded-lg p-1.5 transition ${
                selectedAvatar === preset.id
                  ? "bg-sage shadow-[0_2px_0_var(--color-outline)]"
                  : "hover:bg-tag-bg"
              }`}
            >
              <div className="flex aspect-square w-full items-center justify-center rounded-md border-2 border-outline bg-tag-bg">
                <PixelAvatar avatarId={preset.id} className="w-9" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Bio Input */}
      <div className="flex flex-col gap-2">
        <label htmlFor="bio" className="text-xs font-semibold text-ink">
          소개
        </label>
        <textarea
          id="bio"
          name="bio"
          placeholder="자신을 소개해주세요 (선택사항)"
          maxLength={100}
          rows={3}
          className="w-full px-4 py-2 px-input text-sm resize-none"
        />
        <p className="text-xs text-muted text-right">
          <span id="bio-count">0</span>/100
        </p>
      </div>

      {/* Visibility Selection */}
      <div className="flex flex-col gap-2">
        <label htmlFor="visibility" className="text-xs font-semibold text-ink">
          공개 범위
        </label>
        <select
          id="visibility"
          name="visibility"
          defaultValue="public"
          className="w-full px-4 py-2 px-input text-sm"
        >
          <option value="public">전체 공개</option>
          <option value="friends">친구 공개</option>
          <option value="private">비공개</option>
        </select>
      </div>

      {/* Error Message */}
      {error && <div className="rounded-lg border-2 border-[#c8553d] bg-[#fbe9e4] p-3 text-sm text-[#b23c26]">{error}</div>}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="px-btn px-btn-green w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "설정 중..." : "프로필 설정 완료"}
      </button>
    </form>
  );
}
