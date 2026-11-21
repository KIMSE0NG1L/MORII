"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMyGroups, requireProfile } from "@/lib/session";
import { DIARY_BUCKET } from "@/lib/storage";
import type { DiaryEntry } from "@/lib/types/database";
import { normalizeTags } from "@/lib/diary";

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
  title?: string;
  mood: number | null;
  exhibitGroupId: string | null;
  strokeLogPath: string | null;
  tags?: string[];
  audioPath?: string | null;
  transcript?: string | null;
}) {
  const { supabase, userId } = await requireProfile();
  const body = input.body.trim();
  const title = input.title?.trim().slice(0, 60) || null;

  if (input.imagePath && !input.imagePath.startsWith(`${userId}/`)) {
    throw new Error("Invalid image path");
  }
  if (input.strokeLogPath && !input.strokeLogPath.startsWith(`${userId}/`)) {
    throw new Error("Invalid stroke log path");
  }
  if (input.audioPath && !input.audioPath.startsWith(`${userId}/`)) {
    throw new Error("Invalid audio path");
  }
  if (!input.imagePath && !input.audioPath && !body) {
    throw new Error("그림이나 글, 녹음 중 하나는 남겨주세요.");
  }
  const mood = input.mood !== null && input.mood >= 0 && input.mood <= 4 ? input.mood : null;
  // Voice notes (counseling recordings etc.) are never exhibitable - only
  // image records can be, same rule the DB side (setExhibition) enforces.
  const exhibitGroupId = await assertGroupMember(
    supabase,
    input.imagePath ? input.exhibitGroupId : null,
  );

  const { data, error } = await supabase
    .from("diary_entries")
    .insert({
      user_id: userId,
      entry_type: input.audioPath ? "voice" : "record",
      content: "",
      image_path: input.imagePath,
      image_source: input.imagePath ? input.imageSource : null,
      body,
      title,
      mood,
      exhibit_group_id: exhibitGroupId,
      stroke_log_path: input.imagePath ? input.strokeLogPath : null,
      tags: normalizeTags(input.tags),
      audio_path: input.audioPath || null,
      transcript: input.audioPath ? (input.transcript?.trim() || null) : null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "저장하지 못했어요.");

  await supabase.rpc("add_xp", { p_user_id: userId, p_amount: 5 });
  revalidateRecords();
  return data.id;
}

// The transcript itself comes from the browser's own speech-to-text (Web
// Speech API, see VoiceRecorder.tsx) while recording - the audio file never
// leaves the browser/our storage. This only sends that already-produced
// text to Gemini for a title + summary, which is both much faster (no audio
// upload/processing round trip - the old Files API version routinely blew
// past Vercel's Server Action timeout) and keeps the actual recording out
// of a third party's hands entirely.
export async function summarizeVoiceTranscript(rawTranscript: string) {
  const transcript = rawTranscript.trim().slice(0, 20000);
  if (!transcript) throw new Error("받아쓰기 결과가 없어요.");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("AI 요약 기능이 아직 설정되어 있지 않아요.");

  const prompt = `다음은 상담사(혹은 대화 상대)와 나눈 대화를 실시간 받아쓰기한 내용입니다 (화자 구분 없이 하나의 흐름으로 이어져 있을 수 있어요).

받아쓴 내용:
"""
${transcript}
"""

한국어로 다음 두 가지를 작성하세요.
1. summary: 대화에서 다룬 주요 내용, 감정, 상담사의 제안이나 다음 단계를 중심으로 자연스럽게 쓴 요약 (3~6문장).
2. title: 이 대화를 기록으로 남길 때 쓸 제목 (20자 이내).`;

  // Same retry pattern as recommendMandala - Gemini's Flash-Lite model
  // occasionally 503s under load and a retry or two usually clears it.
  const retryableStatus = new Set([429, 500, 503]);
  const maxAttempts = 3;
  let res: Response | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    res = await fetch(
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
              properties: { summary: { type: "string" }, title: { type: "string" } },
              required: ["summary", "title"],
            },
          },
        }),
      },
    );
    if (res.ok) break;
    if (!retryableStatus.has(res.status) || attempt === maxAttempts) break;
    console.error(`summarizeVoiceTranscript: attempt ${attempt} got ${res.status}, retrying`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }

  if (!res || !res.ok) {
    console.error("summarizeVoiceTranscript: Gemini request failed", res?.status, res && (await res.text()));
    throw new Error("AI 요약에 실패했어요.");
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    console.error("summarizeVoiceTranscript: no text in response", JSON.stringify(data));
    throw new Error("AI 요약에 실패했어요.");
  }
  let parsed: { summary?: unknown; title?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("summarizeVoiceTranscript: malformed JSON", text);
    throw new Error("AI 요약에 실패했어요.");
  }
  if (typeof parsed.summary !== "string" || typeof parsed.title !== "string") {
    throw new Error("AI 요약에 실패했어요.");
  }
  return { summary: parsed.summary, title: parsed.title.slice(0, 60) };
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
  const removePaths = [imagePath, entry.stroke_log_path].filter((p): p is string => !!p);
  if (removePaths.length) await supabase.storage.from(DIARY_BUCKET).remove(removePaths);

  revalidateRecords();
  redirect("/diary");
}

export async function updateTags(id: string, tags: string[]) {
  const { supabase, userId } = await requireProfile();
  const clean = normalizeTags(tags);
  const { error } = await supabase.from("diary_entries").update({ tags: clean }).eq("id", id).eq("user_id", userId);
  if (error) throw new Error("태그를 저장하지 못했어요.");
  revalidatePath("/diary");
  revalidatePath(`/diary/${id}`);
  return clean;
}
