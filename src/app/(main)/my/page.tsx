import { requireProfile } from "@/lib/session";
import { AVATAR_PRESETS, stageLabelForXp } from "@/lib/constants";
import { updateProfile, signOut } from "./actions";

export default async function MyPage() {
  const { profile } = await requireProfile();

  return (
    <div
      className="flex flex-1 flex-col gap-6 px-8 py-8"
      style={{
        backgroundImage: "url('/assets/profile/profile-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Header */}
      <div className="flex items-end gap-3">
        <h1 className="text-2xl font-bold">마이</h1>
        <p className="text-sm text-muted">{stageLabelForXp(profile.xp)}</p>
      </div>

      {/* Profile Card */}
      <div className="flex gap-6 rounded-3xl bg-white/90 backdrop-blur p-6">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-5xl border-2 border-line"
            style={{ background: AVATAR_PRESETS[0].shirt }}
          >
            🧑
          </div>
        </div>

        {/* Profile Info */}
        <div className="flex-1 flex flex-col justify-center gap-3">
          <div>
            <p className="text-xs text-muted mb-1">닉네임</p>
            <p className="text-sm font-semibold text-ink">{profile.nickname}</p>
          </div>
          <div>
            <p className="text-xs text-muted mb-1">소개</p>
            <p className="text-sm text-ink/80">{profile.bio || "소개를 작성해보세요."}</p>
          </div>
          <div>
            <p className="text-xs text-muted mb-1">공개 범위</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink">
                {profile.visibility === "public"
                  ? "전체 공개"
                  : profile.visibility === "friends"
                    ? "친구 공개"
                    : "비공개"}
              </span>
              <button className="text-xs text-muted hover:text-ink">✎</button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Card */}
      <div className="grid grid-cols-4 gap-4 rounded-3xl bg-white/90 backdrop-blur p-6">
        <div className="flex flex-col items-center gap-2">
          <div className="text-3xl">🧠</div>
          <p className="text-xl font-bold">12</p>
          <p className="text-xs text-muted">작성한 기록</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="text-3xl">🎨</div>
          <p className="text-xl font-bold">3</p>
          <p className="text-xs text-muted">참여한 전시회</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="text-3xl">❤️</div>
          <p className="text-xl font-bold">28</p>
          <p className="text-xs text-muted">받은 공감</p>
        </div>
        <div className="flex flex-col items-center gap-2 border-l border-line pl-4">
          <p className="text-xs text-muted">새싹 Lv.2</p>
          <div className="w-full h-2 bg-bar-track rounded-full">
            <div className="h-full rounded-full bg-sage" style={{ width: "60%" }} />
          </div>
          <p className="text-xs text-muted">다음까지 72 XP</p>
        </div>
      </div>

      {/* Badges Section */}
      <div>
        <h2 className="text-sm font-bold mb-4">나의 배지</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/90 backdrop-blur p-4">
            <div className="text-3xl">🌱</div>
            <p className="text-xs text-center font-semibold">첫 기록</p>
            <p className="text-xs text-muted">2025.09.10</p>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/90 backdrop-blur p-4">
            <div className="text-3xl">✍️</div>
            <p className="text-xs text-center font-semibold">연속 기록 7일</p>
            <p className="text-xs text-muted">2025.09.17</p>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/90 backdrop-blur p-4">
            <div className="text-3xl">❤️</div>
            <p className="text-xs text-center font-semibold">공감 10개</p>
            <p className="text-xs text-muted">2025.09.18</p>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/90 backdrop-blur p-4 opacity-50">
            <div className="text-3xl">🔒</div>
            <p className="text-xs text-center font-semibold">전시회 참여</p>
            <p className="text-xs text-muted">미작성</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mt-auto">
        <form action={updateProfile} className="flex-1">
          <button
            type="submit"
            className="w-full rounded-2xl bg-sage text-white py-3 font-semibold hover:bg-sage/90 transition"
          >
            프로필 편집
          </button>
        </form>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-2xl bg-white/90 backdrop-blur px-6 py-3 text-sm text-muted hover:bg-white transition"
          >
            로그아웃
          </button>
        </form>
      </div>
    </div>
  );
}
