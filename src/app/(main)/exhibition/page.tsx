import Link from "next/link";
import { getMyGroups, isAdmin, requireProfile } from "@/lib/session";
import { DIARY_BUCKET, signedUrls } from "@/lib/storage";
import { formatDate } from "@/lib/diary";
import type { ArtworkComment, ArtworkLike, DiaryEntry, Profile } from "@/lib/types/database";
import ExhibitionHall from "./ExhibitionHall";

export default async function ExhibitionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { group: groupParam } = await searchParams;
  const { supabase, userId, profile } = await requireProfile();
  const groups = await getMyGroups(supabase);

  if (groups.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-4 py-20 text-center">
        <h1 className="text-3xl font-pixel font-bold text-ink">전시회</h1>
        <p className="text-sm text-muted">
          집단에 참여하면 함께하는 사람들의 작품이 한 공간에 전시돼요.
        </p>
        <Link href="/programs" className="px-btn px-btn-green px-5 py-2.5 text-sm">
          초대 코드로 참여하기
        </Link>
      </div>
    );
  }

  // "전체" (all of my groups merged into one hall) is the default; picking a
  // chip narrows it down to that single group's hall, same as before.
  const selectedGroup = groups.find((g) => g.id === groupParam);
  const viewGroups = selectedGroup ? [selectedGroup] : groups;
  const viewGroupIds = viewGroups.map((g) => g.id);
  const hallKey = selectedGroup ? selectedGroup.id : `all:${[...viewGroupIds].sort().join(",")}`;
  const hallTitle = selectedGroup ? selectedGroup.title : viewGroups.map((g) => g.title).join(" · ");

  const [{ data: entryRows }, { data: memberRows }] = await Promise.all([
    supabase
      .from("diary_entries")
      .select("*")
      .in("exhibit_group_id", viewGroupIds)
      .not("image_path", "is", null)
      .order("created_at", { ascending: false })
      .limit(40)
      .returns<DiaryEntry[]>(),
    supabase.from("group_members").select("user_id").in("group_id", viewGroupIds).eq("status", "accepted"),
  ]);
  const entries = entryRows ?? [];
  const groupTitleById = new Map(viewGroups.map((g) => [g.id, g.title]));

  const entryIds = entries.map((e) => e.id);
  const [{ data: likeRows }, { data: commentRows }] = entryIds.length
    ? await Promise.all([
        supabase.from("artwork_likes").select("entry_id, user_id").in("entry_id", entryIds).returns<Pick<ArtworkLike, "entry_id" | "user_id">[]>(),
        supabase.from("artwork_comments").select("*").in("entry_id", entryIds).order("created_at").returns<ArtworkComment[]>(),
      ])
    : [{ data: [] }, { data: [] }];
  const likes = likeRows ?? [];
  const comments = commentRows ?? [];

  const memberIds = [
    ...new Set([
      ...viewGroups.map((g) => g.facilitator_id),
      ...(memberRows ?? []).map((m) => m.user_id),
      ...entries.map((e) => e.user_id),
      ...comments.map((c) => c.user_id),
    ]),
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
      title: e.title,
      body: e.body,
      date: formatDate(e.created_at),
      author: profileById.get(e.user_id)?.nickname ?? "참여자",
      // Only meaningful (and only shown) in the merged "전체" hall, where
      // pieces from different groups sit side by side.
      groupTitle: viewGroups.length > 1 ? (groupTitleById.get(e.exhibit_group_id!) ?? "") : "",
      likeCount: likes.filter((l) => l.entry_id === e.id).length,
      likedByMe: likes.some((l) => l.entry_id === e.id && l.user_id === userId),
      comments: comments
        .filter((c) => c.entry_id === e.id)
        .map((c) => ({
          id: c.id,
          body: c.body,
          author: profileById.get(c.user_id)?.nickname ?? "참여자",
          createdAt: c.created_at,
          canDelete: c.user_id === userId || e.user_id === userId || isAdmin(profile),
        })),
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
        <h1 className="text-3xl font-pixel font-bold text-ink">전시회</h1>
        <p className="text-sm text-muted">
          {hallTitle} · 작품 {artworks.length}점 · 함께하는 사람 {walkers.length}명
        </p>
        {groups.length > 1 && (
          <nav className="flex flex-wrap gap-1.5">
            <Link
              href="/exhibition"
              className={`px-chip px-3 py-1 text-xs ${!selectedGroup ? "px-chip-on" : ""}`}
            >
              전체
            </Link>
            {groups.map((g) => (
              <Link
                key={g.id}
                href={`/exhibition?group=${g.id}`}
                className={`px-chip px-3 py-1 text-xs ${
                  g.id === selectedGroup?.id ? "px-chip-on" : ""
                }`}
              >
                {g.title}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <ExhibitionHall key={hallKey} groupId={hallKey} artworks={artworks} walkers={walkers} />

      <p className="text-center text-xs text-muted">
        ← → 방향키나 바닥을 눌러 걸어보세요. 작품 앞에서 Enter(또는 &lsquo;감상하기&rsquo;)를 누르면 크게 볼 수 있어요.
        <br />
        내 기록에서 &lsquo;전시회에 걸기&rsquo;를 선택하면 이곳에 걸려요.
      </p>
    </div>
  );
}
