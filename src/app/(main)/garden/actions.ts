"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/session";
import { TEXT_TO_GARDEN_ITEMS } from "@/lib/constants";
import type { GardenTheme } from "@/lib/types/database";

export async function completeQuest() {
  const { supabase, userId, profile } = await requireProfile();
  if (profile.quest_done) return;

  await supabase.from("profiles").update({ quest_done: true }).eq("id", userId);
  await supabase.rpc("add_xp", { p_user_id: userId, p_amount: 10 });

  revalidatePath("/garden");
}

export async function generateFromText(formData: FormData) {
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;

  const { supabase, userId } = await requireProfile();

  const matches = TEXT_TO_GARDEN_ITEMS.filter((item) =>
    item.keywords.some((k) => text.includes(k)),
  );

  if (matches.length > 0) {
    await supabase.from("garden_items").upsert(
      matches.map((item) => ({
        user_id: userId,
        item_key: item.key,
        emoji: item.emoji,
        left_pct: item.left,
        top_pct: item.top,
        font_size: item.fontSize,
      })),
      { onConflict: "user_id,item_key", ignoreDuplicates: true },
    );
  }

  let theme: GardenTheme | null = null;
  if (text.includes("바다") || text.includes("파도")) theme = "sea";
  if (text.includes("밤") || text.includes("어두")) theme = "night";
  if (theme) {
    await supabase.from("profiles").update({ garden_theme: theme }).eq("id", userId);
  }

  await supabase.rpc("add_xp", { p_user_id: userId, p_amount: 5 });

  revalidatePath("/garden");
}
