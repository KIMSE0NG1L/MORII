import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdmin, requireProfile } from "@/lib/session";
import { DIARY_BUCKET, signedUrls } from "@/lib/storage";
import { formatDateTime, recordParts } from "@/lib/diary";
import { MOODS } from "@/lib/constants";
import Avatar from "@/components/Avatar";
import type { DiaryEntry, Profile } from "@/lib/types/database";

export default async function AdminUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { supabase, profile } = await requireProfile();
  if (!isAdmin(profile)) redirect("/home");

  const { data: member } = await supabase
    .from("profiles")
    .select("id, nickname, avatar_id, bio")
    .eq("id", userId)
    .maybeSingle<Pick<Profile, "id" | "nickname" | "avatar_id" | "bio">>();
  if (!member) notFound();

  const { data: entryRows } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<DiaryEntry[]>();
  const entries = (entryRows ?? []).map((entry) => ({ entry, ...recordParts(entry) }));
  const urls = await signedUrls(
    supabase,
    DIARY_BUCKET,
    entries.map((e) => e.imagePath),
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 md:px-8 md:py-10">
      <Link href="/admin" className="text-sm text-muted">
        ← 관리자 대시보드
      </Link>

      <header className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-end justify-center overflow-hidden rounded-full border border-line bg-tag-bg">
          <Avatar avatarId={member.avatar_id} size={50} />
        </div>
        <div>
          <h1 className="text-2xl font-serif font-bold text-ink">{member.nickname}</h1>
          <p className="text-xs text-muted">{entries.length}개 기록{member.bio ? ` · ${member.bio}` : ""}</p>
        </div>
      </header>

      {entries.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">아직 남긴 기록이 없어요.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {entries.map(({ entry, imagePath, body }) => {
            const url = imagePath ? urls.get(imagePath) : null;
            return (
              <li
                key={entry.id}
                className="flex flex-col overflow-hidden rounded-xl border border-line bg-card shadow-sm"
              >
                <div className="relative aspect-square w-full bg-bg">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="기록 이미지" className="h-full w-full object-cover" />
                  ) : (
                    <p className="flex h-full items-center justify-center p-2 text-center text-[11px] text-muted">
                      {body ? body.slice(0, 40) : "이미지 없음"}
                    </p>
                  )}
                  {entry.mood !== null && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-sm shadow-sm">
                      {MOODS[entry.mood]}
                    </span>
                  )}
                </div>
                <p className="px-2 py-1.5 text-[11px] text-muted">{formatDateTime(entry.created_at)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
