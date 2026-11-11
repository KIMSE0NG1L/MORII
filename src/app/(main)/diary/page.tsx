import Link from "next/link";
import { requireProfile } from "@/lib/session";
import { MOODS } from "@/lib/constants";
import { DIARY_BUCKET, signedUrls } from "@/lib/storage";
import { formatDateTime, recordParts } from "@/lib/diary";
import type { DiaryEntry } from "@/lib/types/database";

const FILTERS = [
  { id: "all", label: "전체" },
  { id: "drawn", label: "그린 그림" },
  { id: "uploaded", label: "사진" },
  { id: "text", label: "글" },
  { id: "exhibit", label: "전시 중" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

function kindOf(entry: DiaryEntry, imagePath: string | null): Exclude<FilterId, "all" | "exhibit"> {
  if (!imagePath) return "text";
  return entry.image_source === "uploaded" ? "uploaded" : "drawn";
}

function href(f: FilterId, tag: string | null) {
  const q = new URLSearchParams();
  if (f !== "all") q.set("f", f);
  if (tag) q.set("tag", tag);
  const qs = q.toString();
  return qs ? `/diary?${qs}` : "/diary";
}

export default async function DiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const filter: FilterId = FILTERS.some((f) => f.id === params.f) ? (params.f as FilterId) : "all";
  const tag = typeof params.tag === "string" && params.tag ? params.tag : null;

  const { supabase, userId } = await requireProfile();
  const { data } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<DiaryEntry[]>();

  const all = (data ?? []).map((entry) => {
    const parts = recordParts(entry);
    return { entry, ...parts, kind: kindOf(entry, parts.imagePath) };
  });
  const matchesFilter = (r: (typeof all)[number], f: FilterId) =>
    f === "all" || (f === "exhibit" ? !!r.entry.exhibit_group_id : r.kind === f);
  const tagged = tag ? all.filter((r) => (r.entry.tags ?? []).includes(tag)) : all;
  const records = tagged.filter((r) => matchesFilter(r, filter)).slice(0, 60);
  const allTags = [...new Set(all.flatMap((r) => r.entry.tags ?? []))].sort((a, b) => a.localeCompare(b, "ko"));
  const urls = await signedUrls(supabase, DIARY_BUCKET, records.map((r) => r.imagePath));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 md:px-8 md:py-10">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-pixel font-bold text-ink">마음기록</h1>
          <p className="mt-1 text-sm text-muted">그림과 그날의 글을 함께 돌아봐요.</p>
        </div>
        <Link
          href="/diary/new"
          className="px-btn px-btn-green shrink-0 px-5 py-2.5 text-sm"
        >
          + 새 기록
        </Link>
      </header>

      {all.length > 0 && (
        <nav className="flex flex-col gap-2" aria-label="기록 필터">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const count = tagged.filter((r) => matchesFilter(r, f.id)).length;
              return (
                <Link
                  key={f.id}
                  href={href(f.id, tag)}
                  aria-current={filter === f.id ? "page" : undefined}
                  className={`px-chip px-3 py-1 text-xs ${filter === f.id ? "px-chip-on" : ""}`}
                >
                  {f.label} <span className="opacity-70">{count}</span>
                </Link>
              );
            })}
          </div>
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[11px] text-muted">🏷️</span>
              {allTags.map((t) => (
                <Link
                  key={t}
                  href={href(filter, tag === t ? null : t)}
                  className={`rounded-md border-2 px-1.5 py-0.5 font-pixel text-[11px] font-bold ${
                    tag === t ? "border-outline bg-sage text-white" : "border-outline/30 bg-tag-bg text-tag-text hover:border-outline"
                  }`}
                >
                  #{t}
                </Link>
              ))}
            </div>
          )}
        </nav>
      )}

      {records.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-panel-dashed py-16 text-center">
          <p className="text-sm text-muted">{all.length === 0 ? "아직 남긴 기록이 없어요." : "이 조건에 맞는 기록이 없어요."}</p>
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
                  className="group flex flex-col overflow-hidden px-card px-hover"
                >
                  <div className="relative aspect-square w-full border-b-2 border-outline bg-bg">
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
                          <span className="rounded-sm border border-outline bg-card px-1.5 py-0.5 text-[9px] text-tag-text">
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
                  {(entry.tags ?? []).length > 0 && (
                    <p className="flex flex-wrap gap-1 px-2 pb-1.5 font-pixel text-[10px] text-tag-text">
                      {entry.tags.slice(0, 3).map((t) => (
                        <span key={t}>#{t}</span>
                      ))}
                    </p>
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
