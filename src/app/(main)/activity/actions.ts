"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/session";

export async function saveDiaryEntry(formData: FormData) {
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return;

  const moodRaw = formData.get("mood");
  const mood = moodRaw === null || moodRaw === "" ? null : Number(moodRaw);

  const { supabase, userId } = await requireProfile();

  await supabase.from("diary_entries").insert({
    user_id: userId,
    entry_type: "text",
    content,
    mood,
  });
  await supabase.rpc("add_xp", { p_user_id: userId, p_amount: 5 });

  revalidatePath("/diary");
  revalidatePath("/garden");
  revalidatePath("/programs");
}

export async function saveDrawingEntry(storagePath: string, mood: number | null) {
  const { supabase, userId } = await requireProfile();

  if (!storagePath.startsWith(`${userId}/`)) {
    throw new Error("Invalid drawing path");
  }

  await supabase.from("diary_entries").insert({
    user_id: userId,
    entry_type: "drawing",
    content: storagePath,
    mood,
  });
  await supabase.rpc("add_xp", { p_user_id: userId, p_amount: 5 });

  revalidatePath("/diary");
  revalidatePath("/garden");
  revalidatePath("/programs");
}
