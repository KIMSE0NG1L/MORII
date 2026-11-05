"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/session";
import { MOOD_CHECK_QUESTIONS, moodCheckResult } from "@/lib/constants";
import { MANDALA_LIBRARY } from "@/lib/mandalaLibrary";

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

// Asks Gemini Flash-Lite to pick the mandala design (out of MANDALA_LIBRARY)
// that best fits today's mood-check answers, out of the library's mood tags
// + paired quotes. Best-effort: any failure (missing key, network, a
// malformed/hallucinated id) just means no specific pick - the mandala
// activity card falls back to the generic template, same as before this
// feature existed.
export async function recommendMandala(answers: number[]) {
  if (answers.length !== MOOD_CHECK_QUESTIONS.length || answers.some((a) => !Number.isInteger(a) || a < 1 || a > 10)) {
    return null;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const answerLines = MOOD_CHECK_QUESTIONS.map(
    (q, i) => `- ${q.question} (1=${q.low}, 10=${q.high}): ${answers[i]}`,
  ).join("\n");
  const mandalaLines = MANDALA_LIBRARY.map(
    (m) => `${m.id}: 분위기[${m.moodTags.join(", ")}] 글귀"${m.quote.replace(/\n/g, " ")}" (${m.author})`,
  ).join("\n");

  const prompt = `당신은 미술치료 보조 도구입니다. 아래는 사용자가 오늘 작성한 마음체크 답변입니다 (1~10점):
${answerLines}

아래는 선택 가능한 만다라 색칠 도안 목록입니다:
${mandalaLines}

사용자의 지금 마음 상태에 가장 어울리는 만다라 도안을 정확히 하나 고르고, 왜 그 도안을 골랐는지 한국어 한 문장으로 설명하세요.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                id: { type: "string", enum: MANDALA_LIBRARY.map((m) => m.id) },
                reason: { type: "string" },
              },
              required: ["id", "reason"],
            },
          },
        }),
      },
    );
    if (!res.ok) return null;

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") return null;
    const parsed = JSON.parse(text);

    const entry = MANDALA_LIBRARY.find((m) => m.id === parsed.id);
    if (!entry || typeof parsed.reason !== "string") return null;
    return { id: entry.id, image: entry.image, quote: entry.quote, author: entry.author, reason: parsed.reason };
  } catch {
    return null;
  }
}
