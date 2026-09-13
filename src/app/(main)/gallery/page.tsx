import { requireProfile } from "@/lib/session";
import type { CommunityPost, PostComment, PostLike, Profile } from "@/lib/types/database";
import { createPost, toggleLike, addComment } from "./actions";

export default async function GalleryPage() {
  const { supabase, userId } = await requireProfile();

  const { data: posts } = await supabase
    .from("community_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<CommunityPost[]>();

  const postIds = (posts ?? []).map((p) => p.id);

  const [{ data: myLikes }, { data: comments }] = await Promise.all([
    postIds.length
      ? supabase.from("post_likes").select("*").eq("user_id", userId).in("post_id", postIds).returns<PostLike[]>()
      : Promise.resolve({ data: [] as PostLike[] }),
    postIds.length
      ? supabase
          .from("post_comments")
          .select("*")
          .in("post_id", postIds)
          .order("created_at", { ascending: true })
          .returns<PostComment[]>()
      : Promise.resolve({ data: [] as PostComment[] }),
  ]);

  const authorIds = Array.from(
    new Set([...(posts ?? []).map((p) => p.user_id), ...(comments ?? []).map((c) => c.user_id)]),
  );
  const { data: authors } = authorIds.length
    ? await supabase.from("profiles").select("id, nickname").in("id", authorIds).returns<Pick<Profile, "id" | "nickname">[]>()
    : { data: [] as Pick<Profile, "id" | "nickname">[] };

  const nicknameById = new Map((authors ?? []).map((a) => [a.id, a.nickname]));
  const likedPostIds = new Set((myLikes ?? []).map((l) => l.post_id));
  const commentsByPost = new Map<string, PostComment[]>();
  for (const c of comments ?? []) {
    const list = commentsByPost.get(c.post_id) ?? [];
    list.push(c);
    commentsByPost.set(c.post_id, list);
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 pt-8">
      <header>
        <h1 className="text-lg font-bold">오픈 마음전시</h1>
        <p className="text-sm text-muted">서로의 마음 조각을 나눠보세요.</p>
      </header>

      <form action={createPost} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
        <div className="flex gap-2">
          <input
            name="emoji"
            defaultValue="🌊"
            maxLength={2}
            className="w-12 rounded-xl border border-line bg-bg px-2 py-2 text-center text-lg"
          />
          <input
            name="title"
            required
            placeholder="제목"
            className="flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-sage"
          />
        </div>
        <textarea
          name="description"
          rows={2}
          placeholder="짧은 설명을 남겨주세요"
          className="rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-sage"
        />
        <button type="submit" className="self-end rounded-full bg-sage px-5 py-2 text-xs font-semibold text-white">
          전시하기
        </button>
      </form>

      <section className="flex flex-col gap-4">
        {posts?.length ? (
          posts.map((post) => {
            const liked = likedPostIds.has(post.id);
            const postComments = commentsByPost.get(post.id) ?? [];
            return (
              <article key={post.id} className="overflow-hidden rounded-2xl border border-line bg-card">
                <div
                  className="flex h-32 items-center justify-center text-4xl"
                  style={{ background: `linear-gradient(135deg, ${post.gradient_start}, ${post.gradient_end})` }}
                >
                  {post.emoji}
                </div>
                <div className="flex flex-col gap-2 p-4">
                  <p className="text-xs text-muted">{nicknameById.get(post.user_id) ?? "익명의 정원사"}</p>
                  <h3 className="text-sm font-bold">{post.title}</h3>
                  {post.description && <p className="text-sm text-ink/80">{post.description}</p>}

                  <form action={toggleLike} className="flex items-center gap-1">
                    <input type="hidden" name="post_id" value={post.id} />
                    <input type="hidden" name="liked" value={String(liked)} />
                    <button type="submit" className="text-sm">
                      {liked ? "❤️" : "🤍"}
                    </button>
                    <span className="text-xs text-muted">{post.like_count}</span>
                  </form>

                  {postComments.length > 0 && (
                    <ul className="flex flex-col gap-1 border-t border-line pt-2">
                      {postComments.map((c) => (
                        <li key={c.id} className="text-xs">
                          <span className="font-semibold">{nicknameById.get(c.user_id) ?? "익명"}</span>{" "}
                          <span className="text-ink/80">{c.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <form action={addComment} className="flex gap-2 pt-1">
                    <input type="hidden" name="post_id" value={post.id} />
                    <input
                      name="text"
                      placeholder="따뜻한 말을 남겨주세요"
                      className="flex-1 rounded-full border border-line bg-bg px-3 py-1.5 text-xs outline-none focus:border-sage"
                    />
                    <button type="submit" className="rounded-full bg-button-bg px-3 py-1.5 text-xs font-semibold">
                      등록
                    </button>
                  </form>
                </div>
              </article>
            );
          })
        ) : (
          <p className="py-8 text-center text-sm text-muted">아직 전시된 마음이 없어요.</p>
        )}
      </section>
    </main>
  );
}
