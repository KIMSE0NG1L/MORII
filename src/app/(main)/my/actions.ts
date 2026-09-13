"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import type { Visibility } from "@/lib/types/database";

export async function updateProfile(formData: FormData) {
  const nickname = String(formData.get("nickname") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const visibility = String(formData.get("visibility") ?? "public") as Visibility;
  if (!nickname) return;

  const { supabase, userId } = await requireProfile();
  await supabase.from("profiles").update({ nickname, bio, visibility }).eq("id", userId);

  revalidatePath("/my");
}

export async function selectAvatar(formData: FormData) {
  const avatarId = String(formData.get("avatar_id") ?? "");
  if (!avatarId) return;

  const { supabase, userId } = await requireProfile();
  await supabase.from("profiles").update({ avatar_id: avatarId }).eq("id", userId);

  revalidatePath("/my");
  revalidatePath("/garden");
}

export async function signOut() {
  const { supabase } = await requireProfile();
  await supabase.auth.signOut();
  redirect("/login");
}
