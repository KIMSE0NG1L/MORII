"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMyGroups, requireProfile } from "@/lib/session";
import { DIARY_BUCKET, VOICE_BUCKET } from "@/lib/storage";
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

// Downloads the just-uploaded recording, hands it to Gemini (via the Files
// API, since a full counseling session can run well past the ~20MB inline-
// request limit) and asks for a speaker-labeled transcript + a short title
// + summary. The audio file on Gemini's side is deleted right after use
// (best-effort) rather than left to its normal 48h expiry, since this is
// someone's private counseling conversation, not throwaway test data.
export async function summarizeVoiceNote(audioPath: string) {
  const { supabase, userId } = await requireProfile();
  if (!audioPath.startsWith(`${userId}/`)) throw new Error("Invalid audio path");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("AI 요약 기능이 아직 설정되어 있지 않아요.");

  const { data: blob, error: downloadError } = await supabase.storage.from(VOICE_BUCKET).download(audioPath);
  if (downloadError || !blob) throw new Error("녹음 파일을 불러오지 못했어요.");
  const bytes = await blob.arrayBuffer();
  const mimeType = blob.type || "audio/webm";

  const file = await uploadToGeminiFiles(apiKey, bytes, mimeType);
  try {
    await waitUntilGeminiFileActive(apiKey, file.name);
    return await requestTranscriptSummary(apiKey, file.uri, mimeType);
  } finally {
    void deleteGeminiFile(apiKey, file.name);
  }
}

async function uploadToGeminiFiles(apiKey: string, bytes: ArrayBuffer, mimeType: string) {
  const startRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: "voice-note" } }),
  });
  if (!startRes.ok) {
    console.error("summarizeVoiceNote: file upload start failed", startRes.status, await startRes.text());
    throw new Error("녹음 파일을 업로드하지 못했어요.");
  }
  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("녹음 파일을 업로드하지 못했어요.");

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });
  if (!uploadRes.ok) {
    console.error("summarizeVoiceNote: file upload failed", uploadRes.status, await uploadRes.text());
    throw new Error("녹음 파일을 업로드하지 못했어요.");
  }
  const { file } = await uploadRes.json();
  if (!file?.uri || !file?.name) throw new Error("녹음 파일을 업로드하지 못했어요.");
  return { name: file.name as string, uri: file.uri as string };
}

async function waitUntilGeminiFileActive(apiKey: string, name: string) {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}?key=${apiKey}`);
    if (res.ok) {
      const file = await res.json();
      if (file.state === "ACTIVE") return;
      if (file.state === "FAILED") throw new Error("녹음 파일을 처리하지 못했어요.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("녹음 파일 처리가 너무 오래 걸려요. 잠시 후 다시 시도해주세요.");
}

async function requestTranscriptSummary(apiKey: string, fileUri: string, mimeType: string) {
  const prompt = `다음은 상담사(혹은 대화 상대)와 나눈 대화를 녹음한 음성입니다. 한국어로 다음 세 가지를 작성하세요.
1. transcript: 화자를 구분해 ("상담사:", "나:" 등) 가능한 한 그대로 받아적은 전체 대화 스크립트.
2. summary: 대화에서 다룬 주요 내용, 감정, 상담사의 제안이나 다음 단계를 중심으로 자연스럽게 쓴 요약 (3~6문장).
3. title: 이 대화를 기록으로 남길 때 쓸 제목 (20자 이내).`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ fileData: { mimeType, fileUri } }, { text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 65536,
          responseSchema: {
            type: "object",
            properties: {
              transcript: { type: "string" },
              summary: { type: "string" },
              title: { type: "string" },
            },
            required: ["transcript", "summary", "title"],
          },
        },
      }),
    },
  );
  if (!res.ok) {
    console.error("summarizeVoiceNote: generateContent failed", res.status, await res.text());
    throw new Error("AI 요약에 실패했어요.");
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    console.error("summarizeVoiceNote: no text in response", JSON.stringify(data));
    throw new Error("AI 요약에 실패했어요.");
  }
  let parsed: { transcript?: unknown; summary?: unknown; title?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("summarizeVoiceNote: malformed JSON", text);
    throw new Error("AI 요약에 실패했어요.");
  }
  if (typeof parsed.transcript !== "string" || typeof parsed.summary !== "string" || typeof parsed.title !== "string") {
    throw new Error("AI 요약에 실패했어요.");
  }
  return { transcript: parsed.transcript, summary: parsed.summary, title: parsed.title.slice(0, 60) };
}

async function deleteGeminiFile(apiKey: string, name: string) {
  try {
    await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}?key=${apiKey}`, { method: "DELETE" });
  } catch (err) {
    console.error("summarizeVoiceNote: failed to delete Gemini file", err);
  }
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
