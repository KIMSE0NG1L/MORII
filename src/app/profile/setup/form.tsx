"use client";

import { useState } from "react";
import { AVATAR_PRESETS } from "@/lib/constants";
import { createProfile } from "./actions";
import { User } from "lucide-react";

export function ProfileSetupForm({ defaultNickname = "" }: { defaultNickname?: string }) {
  const [selectedAvatar, setSelectedAvatar] = useState("a1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const selectedPreset = AVATAR_PRESETS.find((a) => a.id === selectedAvatar) ?? AVATAR_PRESETS[0];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Avatar Preview */}
      <div className="flex justify-center">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center border-4 border-line shadow-md"
          style={{ background: selectedPreset.shirt }}
        >
          <User size={48} className="text-white/80" />
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
          defaultValue={defaultNickname}
          required
          maxLength={20}
          className="w-full px-4 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage focus:border-transparent"
        />
      </div>

      {/* Avatar Selection */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-ink">아바타 선택</label>
        <div className="grid grid-cols-3 gap-3">
          {AVATAR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setSelectedAvatar(preset.id)}
              className={`p-2 rounded-lg transition ${
                selectedAvatar === preset.id
                  ? "ring-2 ring-sage ring-offset-2 ring-offset-white"
                  : "hover:bg-tag-bg"
              }`}
            >
              <div
                className="w-full aspect-square rounded-lg flex items-center justify-center border-2 border-line"
                style={{ background: preset.shirt }}
              >
                <User size={24} className="text-white/80" />
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
          className="w-full px-4 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage focus:border-transparent resize-none"
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
          className="w-full px-4 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage focus:border-transparent"
        >
          <option value="public">전체 공개</option>
          <option value="friends">친구 공개</option>
          <option value="private">비공개</option>
        </select>
      </div>

      {/* Error Message */}
      {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 rounded-lg bg-sage text-white font-semibold hover:bg-sage/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {isSubmitting ? "설정 중..." : "프로필 설정 완료"}
      </button>
    </form>
  );
}
