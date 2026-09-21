"use server";

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/session";

export async function createProfile(formData: FormData) {
  const { supabase, userId } = await requireAuth();

  const nickname = formData.get("nickname") as string;
  const avatar_id = formData.get("avatar_id") as string;
  const bio = (formData.get("bio") as string) || "";
  const visibility = (formData.get("visibility") as "public" | "friends" | "private") || "public";

  if (!nickname.trim()) {
    throw new Error("닉네임은 필수입니다");
  }

  const { error } = await supabase.from("profiles").insert({
    id: userId,
    nickname: nickname.trim(),
    avatar_id,
    bio,
    visibility,
    xp: 0,
    quest_done: false,
    garden_theme: "forest",
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/check");
}
