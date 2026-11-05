"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/session";
import { MOOD_CHECK_QUESTIONS, moodCheckResult } from "@/lib/constants";
import { MANDALA_LIBRARY } from "@/lib/mandalaLibrary";

export async function saveMoodCheck(answers: number[], note: string = "") {
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
    note: note.trim().slice(0, 500),
  });

  revalidatePath("/check");
  revalidatePath("/home");
}

// Asks Gemini Flash-Lite to pick 3 distinct mandala designs (out of
// MANDALA_LIBRARY) that best fit today's mood-check answers, out of the
// library's mood tags + paired quotes - each with its own one-line reason.
// Best-effort: any failure (missing key, network, a malformed/hallucinated
// response) just means no picks - the mandala card falls back to the
// generic template, same as before this feature existed.
export async function recommendMandala(answers: number[], note: string = "") {
  if (answers.length !== MOOD_CHECK_QUESTIONS.length || answers.some((a) => !Number.isInteger(a) || a < 1 || a > 10)) {
    return null;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("recommendMandala: GEMINI_API_KEY is not set in this environment");
    return null;
  }

  const answerLines = MOOD_CHECK_QUESTIONS.map(
    (q, i) => `- ${q.question} (1=${q.low}, 10=${q.high}): ${answers[i]}`,
  ).join("\n");
  const mandalaLines = MANDALA_LIBRARY.map(
    (m) => `${m.id}: 분위기[${m.moodTags.join(", ")}] 글귀"${m.quote.replace(/\n/g, " ")}" (${m.author})`,
  ).join("\n");
  const trimmedNote = note.trim().slice(0, 500);

  const prompt = `당신은 미술치료 보조 도구입니다. 아래는 사용자가 오늘 작성한 마음체크 답변입니다 (1~10점):
${answerLines}
${trimmedNote ? `\n사용자가 직접 남긴 오늘의 마음 (자유 서술): "${trimmedNote}"\n` : ""}
아래는 선택 가능한 만다라 색칠 도안 목록입니다:
${mandalaLines}

사용자의 지금 마음 상태에 가장 어울리는 만다라 도안을 서로 다른 것으로 정확히 3개 고르고, 각각 왜 그 도안을 골랐는지 한국어 한 문장으로 설명하세요.${trimmedNote ? " 사용자가 직접 남긴 서술이 있다면 그 내용을 특히 중요하게 반영하세요." : ""}`;

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
              type: "array",
              minItems: 3,
              maxItems: 3,
              items: {
                type: "object",
                properties: {
                  id: { type: "string", enum: MANDALA_LIBRARY.map((m) => m.id) },
                  reason: { type: "string" },
                },
                required: ["id", "reason"],
              },
            },
          },
        }),
      },
    );
    if (!res.ok) {
      console.error("recommendMandala: Gemini request failed", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") {
      console.error("recommendMandala: no text in response", JSON.stringify(data));
      return null;
    }
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      console.error("recommendMandala: response wasn't an array", text);
      return null;
    }

    const seen = new Set<string>();
    const picks = [];
    for (const item of parsed) {
      const entry = MANDALA_LIBRARY.find((m) => m.id === item?.id);
      if (!entry || typeof item.reason !== "string" || seen.has(entry.id)) continue;
      seen.add(entry.id);
      picks.push({ id: entry.id, image: entry.image, quote: entry.quote, author: entry.author, reason: item.reason });
    }
    return picks.length > 0 ? picks : null;
  } catch (err) {
    console.error("recommendMandala: unexpected error", err);
    return null;
  }
}
