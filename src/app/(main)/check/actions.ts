"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/session";
import { MOOD_CHECK_QUESTIONS, moodCheckResult } from "@/lib/constants";

export async function saveMoodCheck(answers: number[]) {
  if (
    answers.length !== MOOD_CHECK_QUESTIONS.length ||
    answers.some((a) => !Number.isInteger(a) || a < 1 || a > 10)
  ) {
    throw new Error("Invalid answers");
  }

  const { supabase, userId } = await requireProfile();
  const score = Math.round((answers.reduce((sum, a) => sum + a, 0) / answers.length) * 10) / 10;
  const result = moodCheckResult(score);

  await supabase.from("mood_checks").insert({
    user_id: userId,
    answers,
    score,
    recommended: result.activities.map((a) => a.id).join(","),
  });

  revalidatePath("/check");
  revalidatePath("/home");
}
