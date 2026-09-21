import { requireProfile } from "@/lib/session";
import { MOODS } from "@/lib/constants";
import type { DiaryEntry } from "@/lib/types/database";
import DiaryComposer from "./DiaryComposer";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DiaryPage() {
  const { supabase, userId } = await requireProfile();
  const { data: entries } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<DiaryEntry[]>();

  const drawingPaths = (entries ?? [])
    .filter((e) => e.entry_type === "drawing")
    .map((e) => e.content);

  const signedUrlByPath = new Map<string, string>();
  if (drawingPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("diary-drawings")
      .createSignedUrls(drawingPaths, 3600);
    signed?.forEach((s) => {
      if (s.signedUrl) signedUrlByPath.set(s.path ?? "", s.signedUrl);
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-8">
      <header>
        <h1 className="text-lg font-bold">다이어리</h1>
        <p className="text-sm text-muted">오늘 하루의 마음을 기록해보세요.</p>
      </header>

      <DiaryComposer />

      <section className="flex flex-col gap-4">
        {entries?.length ? (
          entries.map((entry) => (
            <article key={entry.id} className="rounded-2xl border border-line bg-card p-4">
              <div className="mb-1 flex items-center justify-between text-xs text-muted">
                <span>{formatDate(entry.created_at)}</span>
                {entry.mood !== null && <span className="text-base">{MOODS[entry.mood]}</span>}
              </div>
              {entry.entry_type === "drawing" ? (
                signedUrlByPath.get(entry.content) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={signedUrlByPath.get(entry.content)}
                    alt="그림 일기"
                    className="aspect-square w-full rounded-xl border border-line object-cover"
                  />
                ) : (
                  <p className="text-xs text-muted">이미지를 불러올 수 없어요.</p>
                )
              ) : (
                <p className="whitespace-pre-wrap text-sm">{entry.content}</p>
              )}
            </article>
          ))
        ) : (
          <p className="py-8 text-center text-sm text-muted">아직 작성한 다이어리가 없어요.</p>
        )}
      </section>
    </div>
  );
}
