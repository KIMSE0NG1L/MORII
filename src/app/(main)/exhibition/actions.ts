"use server";

import { requireProfile } from "@/lib/session";

// RLS (migration 0011) decides who may like / comment / delete; these just
// shape the calls and return what the client needs to update in place.

export async function toggleLike(entryId: string) {
  const { supabase, userId } = await requireProfile();
  const { data: existing } = await supabase
    .from("artwork_likes")
    .select("entry_id")
    .eq("entry_id", entryId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await supabase.from("artwork_likes").delete().eq("entry_id", entryId).eq("user_id", userId);
  } else {
    const { error } = await supabase.from("artwork_likes").insert({ entry_id: entryId, user_id: userId });
    if (error) throw new Error("공감을 남기지 못했어요.");
  }

  const { count } = await supabase
    .from("artwork_likes")
    .select("entry_id", { count: "exact", head: true })
    .eq("entry_id", entryId);
  return { liked: !existing, count: count ?? 0 };
}

export async function addComment(entryId: string, rawBody: string) {
  const body = rawBody.trim().slice(0, 200);
  if (!body) throw new Error("한 줄 이상 적어주세요.");
  const { supabase, userId, profile } = await requireProfile();
  const { data, error } = await supabase
    .from("artwork_comments")
    .insert({ entry_id: entryId, user_id: userId, body })
    .select("id, created_at")
    .single();
  if (error || !data) throw new Error("방명록을 남기지 못했어요.");
  return { id: data.id, body, author: profile.nickname, createdAt: data.created_at };
}

export async function deleteComment(commentId: string) {
  const { supabase } = await requireProfile();
  const { error } = await supabase.from("artwork_comments").delete().eq("id", commentId);
  if (error) throw new Error("삭제하지 못했어요.");
}
