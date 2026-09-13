"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/session";

export async function enrollProgram(formData: FormData) {
  const programId = String(formData.get("program_id") ?? "");
  if (!programId) return;

  const { supabase, userId } = await requireProfile();
  await supabase
    .from("program_enrollments")
    .upsert(
      { user_id: userId, program_id: programId, status: "ongoing", progress: 0.1 },
      { onConflict: "user_id,program_id" },
    );

  revalidatePath("/programs");
}

export async function completeProgram(formData: FormData) {
  const programId = String(formData.get("program_id") ?? "");
  if (!programId) return;

  const { supabase, userId } = await requireProfile();
  await supabase
    .from("program_enrollments")
    .update({ status: "completed", progress: 1 })
    .eq("user_id", userId)
    .eq("program_id", programId);
  await supabase.rpc("add_xp", { p_user_id: userId, p_amount: 10 });

  revalidatePath("/programs");
  revalidatePath("/garden");
}
