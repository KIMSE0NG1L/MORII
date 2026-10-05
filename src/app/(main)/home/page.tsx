import Link from "next/link";
import { ImagePlus, PenLine, HeartPulse } from "lucide-react";
import { requireAuth } from "@/lib/session";
import { DIARY_BUCKET, signedUrls } from "@/lib/storage";
import { recordParts } from "@/lib/diary";
import type { DiaryEntry } from "@/lib/types/database";

export default async function HomePage() {
  const { supabase, userId } = await requireAuth();

  // Auto-create profile if it doesn't exist
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();

  if (!existingProfile) {
    const { data: user } = await supabase.auth.getUser();
    const userName =
      user?.user?.user_metadata?.name ||
      user?.user?.user_metadata?.full_name ||
      user?.user?.email?.split("@")[0] ||
      "사용자";

    await supabase.from("profiles").insert({
      id: userId,
      nickname: userName,
      avatar_id: "a1",
      bio: "",
      visibility: "public",
      xp: 0,
      quest_done: false,
      garden_theme: "forest",
    });
  }

  const { data: recentRows } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(3)
    .returns<DiaryEntry[]>();
  const recent = (recentRows ?? []).map((e) => ({ entry: e, ...recordParts(e) }));
  const urls = await signedUrls(supabase, DIARY_BUCKET, recent.map((r) => r.imagePath));

  return (
    <div
      className="flex min-h-full w-full flex-col gap-8 px-5 py-10 md:px-10 md:py-12"
      style={{
        backgroundImage: "url('/assets/home/home-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="flex max-w-md flex-col items-start pt-4 text-left md:pt-8">
        <h1 className="mb-4 font-serif text-3xl font-bold leading-relaxed text-ink md:text-4xl">
          오늘의 마음을,<br />
          그림으로 남겨보세요.
        </h1>
        <p className="font-serif text-base font-light text-ink/80">
          당신의 마음이 머무는 작은 전시공간, <span className="font-bold">Me:seum</span>
        </p>
      </div>

      <div className="mt-auto grid w-full max-w-3xl gap-3 md:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-2xl bg-white/90 p-5 shadow-lg backdrop-blur">
          <h2 className="text-sm font-bold text-ink">내 그림 추가</h2>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/diary/new?mode=draw"
              className="flex flex-col items-center gap-2 rounded-xl bg-sage px-3 py-4 text-sm font-semibold text-white transition hover:bg-sage/90"
            >
              <PenLine size={22} strokeWidth={1.6} />
              직접 그리기
            </Link>
            <Link
              href="/diary/new?mode=upload"
              className="flex flex-col items-center gap-2 rounded-xl border border-line bg-white px-3 py-4 text-sm font-semibold text-ink transition hover:border-sage"
            >
              <ImagePlus size={22} strokeWidth={1.6} />
              사진·이미지 불러오기
            </Link>
          </div>
        </section>

        <Link
          href="/check"
          className="flex items-center gap-4 rounded-2xl bg-white/90 p-5 shadow-lg backdrop-blur transition hover:bg-white"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-peach/25 text-peach">
            <HeartPulse size={24} strokeWidth={1.6} />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-bold text-ink">오늘의 마음 체크</span>
            <span className="text-xs text-muted">간단한 질문에 답하고 나에게 맞는 활동을 추천받아요</span>
          </span>
          <span className="ml-auto text-muted">→</span>
        </Link>

        {recent.length > 0 && (
          <section className="flex flex-col gap-3 rounded-2xl bg-white/90 p-5 shadow-lg backdrop-blur md:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">최근 마음기록</h2>
              <Link href="/diary" className="text-xs text-muted">
                전체 보기 →
              </Link>
            </div>
            <ul className="grid grid-cols-3 gap-2">
              {recent.map(({ entry, imagePath, body }) => {
                const url = imagePath ? urls.get(imagePath) : null;
                return (
                  <li key={entry.id}>
                    <Link
                      href={`/diary/${entry.id}`}
                      className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-line bg-bg"
                    >
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="마음기록" className="h-full w-full object-cover" />
                      ) : (
                        <span className="line-clamp-4 p-2 text-[11px] leading-snug text-muted">{body}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
