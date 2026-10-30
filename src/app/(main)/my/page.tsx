import Link from "next/link";
import { requireAuth } from "@/lib/session";
import { GARDEN_STAGES, STAGE_THRESHOLDS, stageIndexForXp, stageLabelForXp } from "@/lib/constants";
import Avatar from "@/components/Avatar";
import { signOut } from "./actions";
import { BookOpen, Frame, Users, Sprout, Zap, HeartPulse, Lock } from "lucide-react";
import { DeleteAccountModal } from "./delete-modal";
import { EditProfileModal } from "./edit-modal";

// Pages render on the server (UTC on Vercel), so pin every date to KST -
// mirrors src/lib/diary.ts's convention.
function kstDateString(iso: string) {
  return new Date(new Date(iso).getTime() + 9 * 60 * 60_000).toISOString().slice(0, 10);
}

function formatBadgeDate(iso: string | null) {
  return iso ? kstDateString(iso).replaceAll("-", ".") : "미작성";
}

// `streakCompletionDate` already returns a KST "YYYY-MM-DD" calendar date
// (not a timestamp), so it only needs reformatting, not another TZ shift.
function formatKstDate(kstDate: string | null) {
  return kstDate ? kstDate.replaceAll("-", ".") : "미작성";
}

// First calendar date (KST) on which a `target`-day consecutive streak was
// reached, or null if the user's record dates never reach it.
function streakCompletionDate(createdAtAsc: string[], target: number) {
  const days = Array.from(new Set(createdAtAsc.map(kstDateString))).sort();
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const prevMs = new Date(`${days[i - 1]}T00:00:00Z`).getTime();
    const curMs = new Date(`${days[i]}T00:00:00Z`).getTime();
    streak = Math.round((curMs - prevMs) / 86_400_000) === 1 ? streak + 1 : 1;
    if (streak >= target) return days[i];
  }
  return null;
}

export default async function MyPage() {
  const { supabase, userId } = await requireAuth();

  // All five only need userId, so run them concurrently in one round trip
  // instead of two sequential batches.
  const [
    { data: profileData },
    { data: profile, error },
    { data: diaryRows },
    { data: moodRows },
    { count: groupCount },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("profiles")
      .select("id, nickname, bio, avatar_id, visibility, xp, quest_done, garden_theme, role")
      .eq("id", userId)
      .single(),
    supabase
      .from("diary_entries")
      .select("created_at, exhibit_group_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .returns<{ created_at: string; exhibit_group_id: string | null }[]>(),
    supabase
      .from("mood_checks")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .returns<{ created_at: string }[]>(),
    supabase
      .from("group_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "accepted"),
  ]);
  const oauthName =
    profileData?.user?.user_metadata?.name ||
    profileData?.user?.user_metadata?.full_name ||
    profileData?.user?.email?.split("@")[0] ||
    "사용자";

  if (!profile || error) {
    throw new Error("Profile not found");
  }

  // Always use OAuth name as display nickname
  const displayProfile = { ...profile, nickname: oauthName };

  const entries = diaryRows ?? [];
  const moodChecks = moodRows ?? [];
  const recordCount = entries.length;
  const exhibitEntries = entries.filter((e) => e.exhibit_group_id);
  const exhibitionCount = new Set(exhibitEntries.map((e) => e.exhibit_group_id)).size;

  const firstRecordDate = formatBadgeDate(entries[0]?.created_at ?? null);
  const streak7Date = streakCompletionDate(
    entries.map((e) => e.created_at),
    7,
  );
  const moodCheckBadgeDate = moodChecks.length >= 5 ? formatBadgeDate(moodChecks[4].created_at) : null;
  const firstExhibitDate = formatBadgeDate(exhibitEntries[0]?.created_at ?? null);

  const stageIdx = stageIndexForXp(profile.xp);
  const stage = GARDEN_STAGES[stageIdx];
  const stageLower = stageIdx === 0 ? 0 : STAGE_THRESHOLDS[stageIdx - 1];
  const stageUpper = STAGE_THRESHOLDS.at(stageIdx) ?? stageLower;
  const stagePercent =
    stageIdx >= STAGE_THRESHOLDS.length
      ? 100
      : Math.min(100, Math.max(0, ((profile.xp - stageLower) / (stageUpper - stageLower)) * 100));

  const badges = [
    {
      key: "first",
      label: "첫 기록",
      Icon: Sprout,
      achieved: recordCount > 0,
      date: firstRecordDate,
    },
    {
      key: "streak",
      label: "연속 기록 7일",
      Icon: Zap,
      achieved: Boolean(streak7Date),
      date: formatKstDate(streak7Date),
    },
    {
      key: "mood",
      label: "마음 체크 5회",
      Icon: HeartPulse,
      achieved: moodChecks.length >= 5,
      date: moodCheckBadgeDate ?? "미작성",
    },
    {
      key: "exhibit",
      label: "전시회 참여",
      Icon: Frame,
      achieved: exhibitionCount > 0,
      date: firstExhibitDate,
    },
  ];

  return (
    <div
      className="flex flex-1 flex-col gap-4 px-8 py-8 min-h-dvh overflow-y-auto"
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
          <div className="w-20 h-20 rounded-full flex items-end justify-center overflow-hidden border border-line bg-tag-bg">
            <Avatar avatarId={profile.avatar_id} size={72} />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 flex flex-col justify-center gap-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted">닉네임</p>
              <p className="text-sm font-semibold text-ink">{displayProfile.nickname}</p>
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
          <p className="text-lg font-bold">{recordCount}</p>
          <p className="text-xs text-muted">작성한 기록</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Frame size={24} className="text-ink/60" />
          <p className="text-lg font-bold">{exhibitionCount}</p>
          <p className="text-xs text-muted">참여한 전시회</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Users size={24} className="text-ink/60" />
          <p className="text-lg font-bold">{groupCount ?? 0}</p>
          <p className="text-xs text-muted">참여 중인 집단</p>
        </div>
        <div className="flex flex-col items-center gap-1 border-l border-line/50 pl-3">
          <p className="text-xs text-muted text-center">{stage.emoji} {stage.name} Lv.{stageIdx + 1}</p>
          <div className="w-full h-1.5 bg-bar-track rounded-full">
            <div className="h-full rounded-full bg-sage" style={{ width: `${stagePercent}%` }} />
          </div>
          <p className="text-xs text-muted">{profile.xp} XP</p>
        </div>
      </div>

      {/* Badges Section */}
      <div>
        <h2 className="text-xs font-bold text-muted mb-3">나의 배지</h2>
        <div className="grid grid-cols-4 gap-3">
          {badges.map((badge) => (
            <div
              key={badge.key}
              className={`flex flex-col items-center gap-1 rounded-xl bg-white/90 backdrop-blur p-3 shadow-sm ${
                badge.achieved ? "" : "opacity-50"
              }`}
            >
              {badge.achieved ? (
                <badge.Icon size={24} className="text-ink/60" />
              ) : (
                <Lock size={24} className="text-ink/60" />
              )}
              <p className="text-xs text-center font-semibold">{badge.label}</p>
              <p className="text-xs text-muted">{badge.date}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 mt-auto pt-4">
        {profile.role === "admin" && (
          <Link
            href="/admin"
            className="rounded-xl bg-white/90 backdrop-blur text-center text-sm font-semibold text-ink py-2 hover:bg-sage/10"
          >
            🛠️ 관리자 대시보드
          </Link>
        )}
        <div className="flex gap-2">
          <div className="flex-1">
            <EditProfileModal nickname={displayProfile.nickname} bio={profile.bio} visibility={profile.visibility} />
          </div>
          <form action={signOut} className="flex-1">
            <button
              type="submit"
              className="w-full rounded-xl bg-white/90 backdrop-blur text-muted py-2 text-sm hover:bg-red-50 hover:text-red-600 transition"
            >
              로그아웃
            </button>
          </form>
        </div>
        <DeleteAccountModal />
      </div>
    </div>
  );
}
