import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyGroups, requireProfile } from "@/lib/session";
import { MOODS } from "@/lib/constants";
import { DIARY_BUCKET, signedUrls } from "@/lib/storage";
import { formatDateTime, recordParts } from "@/lib/diary";
import type { DiaryEntry } from "@/lib/types/database";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { deleteRecord, setExhibition } from "../actions";

export default async function RecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await requireProfile();

  const { data: entry } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle<DiaryEntry>();
  if (!entry) notFound();

  const { imagePath, body } = recordParts(entry);
  const [urls, groups] = await Promise.all([
    signedUrls(supabase, DIARY_BUCKET, [imagePath]),
    getMyGroups(supabase),
  ]);
  const url = imagePath ? urls.get(imagePath) : null;
  // Exhibiting needs the new record shape (image_path), not legacy rows.
  const canExhibit = entry.entry_type === "record" && !!entry.image_path && groups.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 md:px-8 md:py-10">
      <div className="flex items-center justify-between">
        <Link href="/diary" className="text-sm text-muted">
          ← 마음기록
        </Link>
        <span className="text-xs text-muted">{formatDateTime(entry.created_at)}</span>
      </div>

      <article className="grid overflow-hidden rounded-2xl border border-line bg-card shadow-sm md:grid-cols-2">
        {imagePath && (
          <div className="flex items-center justify-center bg-bg">
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="그날의 그림" className="max-h-[70vh] w-full object-contain" />
            ) : (
              <p className="p-6 text-xs text-muted">이미지를 불러올 수 없어요.</p>
            )}
          </div>
        )}
        <div className={`flex flex-col gap-4 p-5 md:p-8 ${imagePath ? "" : "md:col-span-2"}`}>
          {entry.mood !== null && (
            <p className="text-sm text-muted">
              그날의 마음 <span className="ml-1 text-2xl">{MOODS[entry.mood]}</span>
            </p>
          )}
          {body ? (
            <p className="whitespace-pre-wrap font-serif text-base leading-loose text-ink">{body}</p>
          ) : (
            <p className="text-sm text-muted">글 없이 그림만 남긴 날이에요.</p>
          )}
        </div>
      </article>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {canExhibit ? (
          <form action={setExhibition} className="flex flex-wrap items-center gap-2 text-sm">
            <input type="hidden" name="id" value={entry.id} />
            <span className="text-muted">전시</span>
            <select
              name="group_id"
              defaultValue={entry.exhibit_group_id ?? ""}
              className="rounded-lg border border-line bg-white px-2 py-1.5"
            >
              <option value="">나만 보기</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title} 전시회
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-full bg-sage px-4 py-1.5 text-xs font-semibold text-white">
              적용
            </button>
          </form>
        ) : (
          <span />
        )}
        <form action={deleteRecord}>
          <input type="hidden" name="id" value={entry.id} />
          <ConfirmSubmit message="이 기록을 삭제할까요? 되돌릴 수 없어요." className="text-xs text-muted hover:text-red-600">
            기록 삭제
          </ConfirmSubmit>
        </form>
      </div>
    </div>
  );
}
