"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMyGroups, requireProfile } from "@/lib/session";
import { DIARY_BUCKET } from "@/lib/storage";
import type { DiaryEntry } from "@/lib/types/database";

async function assertGroupMember(
  supabase: Awaited<ReturnType<typeof requireProfile>>["supabase"],
  groupId: string | null,
) {
  if (!groupId) return null;
  const groups = await getMyGroups(supabase);
  if (!groups.some((g) => g.id === groupId)) throw new Error("참여 중인 집단이 아니에요.");
  return groupId;
}

function revalidateRecords() {
  revalidatePath("/diary");
  revalidatePath("/home");
  revalidatePath("/exhibition");
}

export async function saveRecord(input: {
  imagePath: string | null;
  imageSource: "drawn" | "uploaded" | null;
  body: string;
  mood: number | null;
  exhibitGroupId: string | null;
}) {
  const { supabase, userId } = await requireProfile();
  const body = input.body.trim();

  if (input.imagePath && !input.imagePath.startsWith(`${userId}/`)) {
    throw new Error("Invalid image path");
  }
  if (!input.imagePath && !body) {
    throw new Error("그림이나 글 중 하나는 남겨주세요.");
  }
  const mood = input.mood !== null && input.mood >= 0 && input.mood <= 4 ? input.mood : null;
  const exhibitGroupId = await assertGroupMember(
    supabase,
    input.imagePath ? input.exhibitGroupId : null,
  );

  const { data, error } = await supabase
    .from("diary_entries")
    .insert({
      user_id: userId,
      entry_type: "record",
      content: "",
      image_path: input.imagePath,
      image_source: input.imagePath ? input.imageSource : null,
      body,
      mood,
      exhibit_group_id: exhibitGroupId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "저장하지 못했어요.");

  await supabase.rpc("add_xp", { p_user_id: userId, p_amount: 5 });
  revalidateRecords();
  return data.id;
}

export async function setExhibition(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const groupId = String(formData.get("group_id") ?? "") || null;
  const { supabase, userId } = await requireProfile();

  await assertGroupMember(supabase, groupId);
  await supabase
    .from("diary_entries")
    .update({ exhibit_group_id: groupId })
    .eq("id", id)
    .eq("user_id", userId)
    .not("image_path", "is", null);

  revalidateRecords();
  revalidatePath(`/diary/${id}`);
}

export async function deleteRecord(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const { supabase, userId } = await requireProfile();

  const { data: entry } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single<DiaryEntry>();
  if (!entry) redirect("/diary");

  const imagePath = entry.image_path ?? (entry.entry_type === "drawing" ? entry.content : null);
  await supabase.from("diary_entries").delete().eq("id", id).eq("user_id", userId);
  if (imagePath) await supabase.storage.from(DIARY_BUCKET).remove([imagePath]);

  revalidateRecords();
  redirect("/diary");
}
