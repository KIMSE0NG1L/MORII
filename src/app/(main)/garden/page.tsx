import { requireProfile } from "@/lib/session";
import {
  GARDEN_STAGES,
  GARDEN_THEMES,
  STAGE_UNLOCK_ITEMS,
  avatarById,
  stageIndexForXp,
} from "@/lib/constants";
import type { GardenItemRow } from "@/lib/types/database";
import { completeQuest, generateFromText } from "./actions";

export default async function GardenPage() {
  const { supabase, userId, profile } = await requireProfile();
  const { data: items } = await supabase
    .from("garden_items")
    .select("*")
    .eq("user_id", userId)
    .returns<GardenItemRow[]>();

  const stageIndex = stageIndexForXp(profile.xp);
  const stage = GARDEN_STAGES[stageIndex];
  const theme = GARDEN_THEMES[profile.garden_theme];
  const avatar = avatarById(profile.avatar_id);
  const unlocked = STAGE_UNLOCK_ITEMS.slice(0, stageIndex);

  return (
    <main className="flex flex-1 flex-col gap-5 px-5 pt-8">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold">마음정원</h1>
          <p className="text-sm text-muted">{profile.nickname}님의 정원</p>
        </div>
        <span className="shrink-0 rounded-full bg-tag-bg px-3 py-1.5 text-xs font-semibold text-tag-text">
          {stage.emoji} {stage.name} Lv.{stageIndex + 1}
        </span>
      </header>

      <div className="flex flex-col gap-1.5">
        <div className="h-2 w-full overflow-hidden rounded-full bg-bar-track">
          <div
            className="h-full rounded-full bg-bar-fill transition-all"
            style={{ width: `${profile.xp}%` }}
          />
        </div>
        <p className="text-right text-xs text-muted">XP {profile.xp} / 100</p>
      </div>

      <div
        className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-line"
        style={{ background: `linear-gradient(180deg, ${theme.top}, ${theme.bottom})` }}
      >
        <div
          className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
          style={{ left: "45%", top: "62%" }}
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/70 text-2xl shadow-lg"
            style={{ background: avatar.shirt }}
          >
            🧑
          </span>
        </div>
        {unlocked.map((item) => (
          <span
            key={item.key}
            className="absolute -translate-x-1/2 -translate-y-1/2 drop-shadow"
            style={{ left: `${item.left * 100}%`, top: `${item.top * 100}%`, fontSize: item.fontSize }}
          >
            {item.emoji}
          </span>
        ))}
        {items?.map((item) => (
          <span
            key={item.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 drop-shadow"
            style={{
              left: `${Number(item.left_pct) * 100}%`,
              top: `${Number(item.top_pct) * 100}%`,
              fontSize: item.font_size,
            }}
          >
            {item.emoji}
          </span>
        ))}
      </div>

      <form action={completeQuest}>
        <button
          type="submit"
          disabled={profile.quest_done}
          className="w-full rounded-2xl bg-gradient-to-r from-[color:var(--color-peach)] to-[color:var(--color-blush)] px-4 py-3 text-sm font-semibold text-ink disabled:opacity-50"
        >
          {profile.quest_done ? "오늘의 퀘스트 완료 ✓" : "오늘의 퀘스트 완료하기 (+10 XP)"}
        </button>
      </form>

      <form action={generateFromText} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
        <label className="text-sm font-semibold">마음공간 만들기</label>
        <p className="text-xs text-muted">
          지금 떠오르는 장면을 문장으로 적어보세요. 정원에 반영돼요. (+5 XP)
        </p>
        <textarea
          name="text"
          rows={2}
          placeholder="예: 바다 앞에 강아지와 함께 앉아있어요"
          className="rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-sage"
        />
        <button
          type="submit"
          className="self-end rounded-full bg-sage px-4 py-2 text-xs font-semibold text-white"
        >
          정원에 반영하기
        </button>
      </form>
    </main>
  );
}
