import { requireAuth } from "@/lib/session";
import { recordStreak } from "@/lib/garden";
import RoomMap from "./RoomMap";

export default async function HomePage() {
  const { supabase, userId } = await requireAuth();

  // Profile (for avatar + garden XP) and record dates (for the streak) only
  // need userId, so fetch them together.
  const [{ data: existing }, { data: recordRows }] = await Promise.all([
    supabase.from("profiles").select("avatar_id, xp").eq("id", userId).maybeSingle(),
    supabase
      .from("diary_entries")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(400)
      .returns<{ created_at: string }[]>(),
  ]);

  // Auto-create the profile on first visit.
  if (!existing) {
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

  return (
    <div className="flex min-h-full w-full flex-1 items-center justify-center bg-forest md:p-6">
      <RoomMap
        avatarId={existing?.avatar_id ?? "a1"}
        xp={existing?.xp ?? 0}
        streak={recordStreak((recordRows ?? []).map((r) => r.created_at))}
      />
    </div>
  );
}
