import Link from "next/link";
import { getMyGroups, requireProfile } from "@/lib/session";
import { DIARY_BUCKET, signedUrls } from "@/lib/storage";
import { formatDate } from "@/lib/diary";
import type { DiaryEntry, Profile } from "@/lib/types/database";
import ExhibitionHall from "./ExhibitionHall";

export default async function ExhibitionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { group: groupParam } = await searchParams;
  const { supabase, userId } = await requireProfile();
  const groups = await getMyGroups(supabase);
  const group = groups.find((g) => g.id === groupParam) ?? groups[0];

  if (!group) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-4 py-20 text-center">
        <h1 className="text-3xl font-serif font-bold text-ink">우리들의 전시회</h1>
        <p className="text-sm text-muted">
          집단에 참여하면 함께하는 사람들의 작품이 한 공간에 전시돼요.
        </p>
        <Link href="/programs" className="rounded-full bg-sage px-5 py-2.5 text-sm font-semibold text-white">
          초대 코드로 참여하기
        </Link>
      </div>
    );
  }

  const [{ data: entryRows }, { data: memberRows }] = await Promise.all([
    supabase
      .from("diary_entries")
      .select("*")
      .eq("exhibit_group_id", group.id)
      .not("image_path", "is", null)
      .order("created_at", { ascending: false })
      .limit(40)
      .returns<DiaryEntry[]>(),
    supabase.from("group_members").select("user_id").eq("group_id", group.id).eq("status", "accepted"),
  ]);
  const entries = entryRows ?? [];

  const memberIds = [
    ...new Set([group.facilitator_id, ...(memberRows ?? []).map((m) => m.user_id), ...entries.map((e) => e.user_id)]),
  ];
  const [{ data: profileRows }, urls] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nickname, avatar_id")
      .in("id", memberIds)
      .returns<Pick<Profile, "id" | "nickname" | "avatar_id">[]>(),
    signedUrls(supabase, DIARY_BUCKET, entries.map((e) => e.image_path)),
  ]);
  const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]));

  const artworks = entries
    .filter((e) => e.image_path && urls.has(e.image_path))
    .map((e) => ({
      id: e.id,
      url: urls.get(e.image_path!)!,
      body: e.body,
      date: formatDate(e.created_at),
      author: profileById.get(e.user_id)?.nickname ?? "참여자",
    }));

  const walkers = memberIds
    .filter((id) => profileById.has(id))
    .map((id) => {
      const p = profileById.get(id)!;
      return { id, nickname: p.nickname, avatarId: p.avatar_id, isMe: id === userId };
    });

  return (
    <div className="flex min-h-full flex-col gap-4 px-4 py-6 md:px-8 md:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-serif font-bold text-ink">우리들의 전시회</h1>
        <p className="text-sm text-muted">
          {group.title} · 작품 {artworks.length}점 · 함께하는 사람 {walkers.length}명
        </p>
        {groups.length > 1 && (
          <nav className="flex flex-wrap gap-1.5">
            {groups.map((g) => (
              <Link
                key={g.id}
                href={`/exhibition?group=${g.id}`}
                className={`rounded-full px-3 py-1 text-xs ${
                  g.id === group.id ? "bg-sage text-white" : "bg-tag-bg text-tag-text"
                }`}
              >
                {g.title}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <ExhibitionHall key={group.id} artworks={artworks} walkers={walkers} />

      <p className="text-center text-xs text-muted">
        작품을 누르면 내 캐릭터가 다가가 감상해요. 내 기록에서 &lsquo;전시회에 걸기&rsquo;를 선택하면 이곳에 걸려요.
      </p>
    </div>
  );
}
