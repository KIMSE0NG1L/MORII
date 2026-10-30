import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Group, Profile } from "@/lib/types/database";

export async function requireAuth() {
  const supabase = await createClient();

  // The proxy (src/proxy.ts) already verifies the session on every request
  // and forwards the verified id via this header, so the common case skips
  // a second round trip to Supabase here. Falls back to a full check if the
  // header is ever missing (e.g. a request that bypassed the proxy).
  const forwardedUserId = (await headers()).get("x-user-id");
  if (forwardedUserId) {
    return { supabase, userId: forwardedUserId };
  }

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

export function isAdmin(profile: Pick<Profile, "role">) {
  return profile.role === "admin";
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
