"use client";

import { useState } from "react";
import { AVATAR_PRESETS, stageLabelForXp } from "@/lib/constants";
import { updateProfile, selectAvatar, signOut } from "./actions";

export default function MyPage() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="flex h-full w-full flex-col items-start justify-between px-8 py-12 relative"
      style={{
        backgroundImage: "url('/assets/profile/profile-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Top Left Content */}
      <div className="flex flex-col items-start text-left pt-8 max-w-md">
        <h1 className="text-4xl font-serif font-bold text-ink mb-4 leading-relaxed">
          당신의 이야기,<br />
          나누어보세요.
        </h1>
        <p className="text-base font-serif text-ink/80 font-light">
          당신의 마음이 머무는 작은 전시공간, <span className="font-bold">Me:seum</span>
        </p>
      </div>

      {/* Profile Edit Button - Subtle */}
      <button
        onClick={() => setIsOpen(true)}
        className="mb-20 text-sm text-ink/60 hover:text-ink/80 transition underline"
      >
        프로필 편집
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center"
          onClick={() => setIsOpen(false)}
        >
          {/* Modal Content */}
          <div
            className="bg-card rounded-3xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">프로필</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-xl text-muted hover:text-ink"
              >
                ✕
              </button>
            </div>

            {/* Avatar Selection */}
            <section className="flex flex-col gap-4 mb-6">
              <h3 className="text-sm font-bold">아바타</h3>
              <div className="flex flex-wrap gap-2 justify-center">
                {AVATAR_PRESETS.map((a) => (
                  <form key={a.id} action={selectAvatar}>
                    <input type="hidden" name="avatar_id" value={a.id} />
                    <button
                      type="submit"
                      className="flex items-center justify-center rounded-full border-2 text-lg w-12 h-12 hover:border-sage transition"
                      style={{ background: a.shirt }}
                      aria-label={a.label}
                    >
                      🧑
                    </button>
                  </form>
                ))}
              </div>
            </section>

            {/* Profile Edit Form */}
            <form action={updateProfile} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-muted">닉네임</label>
                <input
                  name="nickname"
                  required
                  className="rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-sage"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-muted">소개</label>
                <textarea
                  name="bio"
                  rows={3}
                  className="rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-sage"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-muted">공개 범위</label>
                <select
                  name="visibility"
                  className="rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-sage"
                >
                  <option value="public">전체 공개</option>
                  <option value="friends">친구 공개</option>
                  <option value="private">비공개</option>
                </select>
              </div>

              <button
                type="submit"
                className="self-end rounded-full bg-sage px-6 py-2 text-sm font-semibold text-white hover:bg-sage/90 transition mt-4"
              >
                저장하기
              </button>
            </form>

            {/* Logout */}
            <form action={signOut} className="mt-6 pt-6 border-t border-line">
              <button
                type="submit"
                className="w-full rounded-xl border border-line px-4 py-2 text-sm text-muted hover:bg-button-bg transition"
              >
                로그아웃
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
