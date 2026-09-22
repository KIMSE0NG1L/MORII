import Link from "next/link";
import { requireAuth } from "@/lib/session";
import type { DiaryEntry } from "@/lib/types/database";
import ExhibitionCarousel from "./ExhibitionCarousel";

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

  // Fetch public artwork from all users
  const { data: publicEntries } = await supabase
    .from("diary_entries")
    .select("id, user_id, content, created_at, mood")
    .eq("entry_type", "drawing")
    .in(
      "user_id",
      (
        await supabase
          .from("profiles")
          .select("id")
          .eq("visibility", "public")
      ).data?.map((p) => p.id) ?? []
    )
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<DiaryEntry[]>();

  // Get signed URLs for all drawing paths
  const drawingPaths = (publicEntries ?? [])
    .filter((e) => e.content)
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

  const artworkList = (publicEntries ?? []).map((entry) => ({
    id: entry.id,
    url: signedUrlByPath.get(entry.content) || null,
    mood: entry.mood,
    createdAt: entry.created_at,
  }));

  return (
    <div
      className="flex h-full w-full flex-col items-start justify-between px-8 py-12"
      style={{
        backgroundImage: "url('/assets/home/home-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Top Left Content */}
      <div className="flex flex-col items-start text-left pt-8 max-w-md">
        <h1 className="text-4xl font-serif font-bold text-ink mb-4 leading-relaxed">
          오늘의 마음을,<br />
          그림으로 남겨보세요.
        </h1>
        <p className="text-base font-serif text-ink/80 font-light">
          당신의 마음이 머무는 작은 전시공간, <span className="font-bold">Me:seum</span>
        </p>
      </div>

      {/* Exhibition Carousel */}
      <div className="w-full mb-8">
        <h2 className="text-sm font-bold text-ink/70 mb-4">우리들의 전시회</h2>
        <ExhibitionCarousel artwork={artworkList} />
      </div>

      {/* Bottom Button */}
      <Link
        href="/diary"
        className="mb-20 flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-ink shadow-lg hover:bg-white/90 transition"
      >
        <span>+</span>
        <span>새 작품 그리기</span>
      </Link>
    </div>
  );
}
