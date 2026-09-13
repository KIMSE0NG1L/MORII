"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/session";

const GRADIENTS = [
  ["#D4E1E5", "#E7D8C9"],
  ["#EAD9C9", "#D9C7DE"],
  ["#DCE9E6", "#B8C9A5"],
  ["#F3D9C4", "#F0D6D2"],
] as const;

export async function createPost(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const emoji = String(formData.get("emoji") ?? "🌊").trim() || "🌊";
  if (!title) return;

  const { supabase, userId } = await requireProfile();
  const [gradient_start, gradient_end] = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];

  await supabase.from("community_posts").insert({
    user_id: userId,
    title,
    description,
    emoji,
    gradient_start,
    gradient_end,
  });

  revalidatePath("/gallery");
}

export async function toggleLike(formData: FormData) {
  const postId = String(formData.get("post_id") ?? "");
  const liked = formData.get("liked") === "true";
  if (!postId) return;

  const { supabase, userId } = await requireProfile();

  if (liked) {
    await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
  } else {
    await supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
  }

  revalidatePath("/gallery");
}

export async function addComment(formData: FormData) {
  const postId = String(formData.get("post_id") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!postId || !text) return;

  const { supabase, userId } = await requireProfile();
  await supabase.from("post_comments").insert({ post_id: postId, user_id: userId, text });

  revalidatePath("/gallery");
}
