import Link from "next/link";
import { requireProfile } from "@/lib/session";
import { moodCheckResult } from "@/lib/constants";
import { formatDate } from "@/lib/diary";
import type { MoodCheck } from "@/lib/types/database";
import MoodCheckForm from "./MoodCheckForm";

export default async function CheckPage() {
  const { supabase, userId } = await requireProfile();
  const { data: history } = await supabase
    .from("mood_checks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5)
    .returns<MoodCheck[]>();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-6 md:py-10">
      <header>
        <Link href="/home" className="text-sm text-muted">
          ← 홈
        </Link>
        <h1 className="mt-3 text-3xl font-serif font-bold text-ink">마음 체크</h1>
        <p className="mt-1 text-sm text-muted">
          지금의 나에게 가까운 점수를 골라주세요. 결과에 맞는 활동을 추천해드려요.
        </p>
      </header>

      <MoodCheckForm />

      {history && history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-bold text-muted">최근 기록</h2>
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-card">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-muted">{formatDate(h.created_at)}</span>
                <span className="text-ink">{moodCheckResult(Number(h.score)).label}</span>
                <span className="font-semibold tabular-nums">{Number(h.score)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
