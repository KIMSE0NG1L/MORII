import { requireAuth } from "@/lib/session";
import RoomMap from "./RoomMap";

export default async function HomePage() {
  const { supabase, userId } = await requireAuth();

  // Auto-create the profile on first visit; the map needs its avatar either way.
  const { data: existing } = await supabase
    .from("profiles")
    .select("avatar_id")
    .eq("id", userId)
    .single();

  let avatarId = existing?.avatar_id ?? "a1";
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
    avatarId = "a1";
  }

  return (
    <div className="flex min-h-full w-full flex-1 items-center justify-center bg-forest md:p-6">
      <RoomMap avatarId={avatarId} />
    </div>
  );
}
