import Link from "next/link";
import { requireProfile } from "@/lib/session";
import { MOODS } from "@/lib/constants";
import { DIARY_BUCKET, signedUrls } from "@/lib/storage";
import { formatDateTime, recordParts } from "@/lib/diary";
import type { DiaryEntry } from "@/lib/types/database";

export default async function DiaryPage() {
  const { supabase, userId } = await requireProfile();
  const { data } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(60)
    .returns<DiaryEntry[]>();

  const records = (data ?? []).map((entry) => ({ entry, ...recordParts(entry) }));
  const urls = await signedUrls(supabase, DIARY_BUCKET, records.map((r) => r.imagePath));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-serif font-bold text-ink">마음기록</h1>
          <p className="mt-1 text-sm text-muted">그림과 그날의 글을 함께 돌아봐요.</p>
        </div>
        <Link
          href="/diary/new"
          className="shrink-0 rounded-full bg-sage px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
        >
          + 새 기록
        </Link>
      </header>

      {records.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-card py-16 text-center">
          <p className="text-sm text-muted">아직 남긴 기록이 없어요.</p>
          <Link href="/diary/new" className="text-sm font-semibold text-sage underline">
            첫 기록 남기기
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {records.map(({ entry, imagePath, body }) => {
            const url = imagePath ? urls.get(imagePath) : null;
            return (
              <li key={entry.id}>
                <Link
                  href={`/diary/${entry.id}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-line bg-card shadow-sm transition hover:shadow-md"
                >
                  <div className="relative aspect-square w-full bg-bg">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt="그날의 그림"
                        className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                      />
                    ) : (
                      <p className="flex h-full items-center justify-center p-3 text-center text-xs leading-snug text-muted">
                        {body ? body.slice(0, 60) : "이미지를 불러올 수 없어요."}
                      </p>
                    )}
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/50 to-transparent px-2 py-1.5">
                      <span className="text-[10px] font-medium text-white/90">
                        {formatDateTime(entry.created_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        {entry.exhibit_group_id && (
                          <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] text-tag-text">
                            Meseum
                          </span>
                        )}
                        {entry.mood !== null && <span className="text-sm leading-none">{MOODS[entry.mood]}</span>}
                      </span>
                    </div>
                  </div>
                  {url && body && (
                    <p className="line-clamp-2 px-2 py-1.5 text-[11px] leading-snug text-ink/80">{body}</p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
