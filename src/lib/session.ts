import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Group, Profile } from "@/lib/types/database";

export async function requireAuth() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    redirect("/login");
  }

  return { supabase, userId };
}

export async function requireProfile() {
  const { supabase, userId } = await requireAuth();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single<Profile>();

  if (error || !profile) {
    redirect("/profile/setup");
  }

  return { supabase, userId, profile };
}

export function isTherapist(profile: Pick<Profile, "role">) {
  return profile.role === "therapist";
}

// RLS only returns groups the user facilitates or has joined.
export async function getMyGroups(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("groups")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Group[]>();
  return data ?? [];
}
