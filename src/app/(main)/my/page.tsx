import { requireProfile } from "@/lib/session";
import { AVATAR_PRESETS, stageLabelForXp } from "@/lib/constants";
import { updateProfile, signOut } from "./actions";
import { BookOpen, Frame, Heart, Sprout, Zap, Lock, User } from "lucide-react";

export default async function MyPage() {
  const { profile } = await requireProfile();

  return (
    <div
      className="flex flex-1 flex-col gap-4 px-8 py-8 pb-40"
      style={{
        backgroundImage: "url('/assets/profile/profile-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Top Text Section */}
      <div className="mb-2">
        <h1 className="text-3xl font-serif font-bold text-ink">마이</h1>
        <p className="text-xs text-muted mt-1">{stageLabelForXp(profile.xp)}</p>
      </div>

      {/* Profile Card */}
      <div className="flex gap-4 rounded-2xl bg-white/90 backdrop-blur p-5 shadow-sm">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center border border-line"
            style={{ background: AVATAR_PRESETS[0].shirt }}
          >
            <User size={32} className="text-white/80" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 flex flex-col justify-center gap-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted">닉네임</p>
              <p className="text-sm font-semibold text-ink">{profile.nickname}</p>
            </div>
            <p className="text-xs text-muted">공개 범위</p>
          </div>
          <div>
            <p className="text-xs text-muted">소개</p>
            <p className="text-xs text-ink/80">{profile.bio || "소개를 작성해보세요."}</p>
          </div>
          <div>
            <select
              defaultValue={profile.visibility}
              className="text-xs border border-line rounded bg-white px-2 py-1"
            >
              <option value="public">전체 공개</option>
              <option value="friends">친구 공개</option>
              <option value="private">비공개</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Card */}
      <div className="grid grid-cols-4 gap-3 rounded-2xl bg-white/90 backdrop-blur p-5 shadow-sm">
        <div className="flex flex-col items-center gap-1">
          <BookOpen size={24} className="text-ink/60" />
          <p className="text-lg font-bold">12</p>
          <p className="text-xs text-muted">작성한 기록</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Frame size={24} className="text-ink/60" />
          <p className="text-lg font-bold">3</p>
          <p className="text-xs text-muted">참여한 전시회</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Heart size={24} className="text-ink/60" />
          <p className="text-lg font-bold">28</p>
          <p className="text-xs text-muted">받은 공감</p>
        </div>
        <div className="flex flex-col items-center gap-1 border-l border-line/50 pl-3">
          <p className="text-xs text-muted text-center">새싹 Lv.2</p>
          <div className="w-full h-1.5 bg-bar-track rounded-full">
            <div className="h-full rounded-full bg-sage" style={{ width: "60%" }} />
          </div>
          <p className="text-xs text-muted">72 XP</p>
        </div>
      </div>

      {/* Badges Section */}
      <div>
        <h2 className="text-xs font-bold text-muted mb-3">나의 배지</h2>
        <div className="grid grid-cols-4 gap-3">
          <div className="flex flex-col items-center gap-1 rounded-xl bg-white/90 backdrop-blur p-3 shadow-sm">
            <Sprout size={24} className="text-ink/60" />
            <p className="text-xs text-center font-semibold">첫 기록</p>
            <p className="text-xs text-muted">2025.09.10</p>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl bg-white/90 backdrop-blur p-3 shadow-sm">
            <Zap size={24} className="text-ink/60" />
            <p className="text-xs text-center font-semibold">연속 기록 7일</p>
            <p className="text-xs text-muted">2025.09.17</p>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl bg-white/90 backdrop-blur p-3 shadow-sm">
            <Heart size={24} className="text-ink/60" />
            <p className="text-xs text-center font-semibold">공감 10개</p>
            <p className="text-xs text-muted">2025.09.18</p>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl bg-white/90 backdrop-blur p-3 shadow-sm opacity-50">
            <Lock size={24} className="text-ink/60" />
            <p className="text-xs text-center font-semibold">전시회 참여</p>
            <p className="text-xs text-muted">미작성</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-auto pt-4">
        <form action={updateProfile} className="flex-1">
          <button
            type="submit"
            className="w-full rounded-xl bg-sage text-white py-2 text-sm font-semibold hover:bg-sage/90 transition"
          >
            프로필 편집
          </button>
        </form>
        <form action={signOut} className="flex-1">
          <button
            type="submit"
            className="w-full rounded-xl bg-white/90 backdrop-blur text-muted py-2 text-sm hover:bg-red-50 hover:text-red-600 transition"
          >
            로그아웃
          </button>
        </form>
      </div>
    </div>
  );
}
