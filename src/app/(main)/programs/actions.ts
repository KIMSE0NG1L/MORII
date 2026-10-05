"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isTherapist, requireProfile } from "@/lib/session";
import { MATERIAL_KINDS } from "@/lib/constants";
import { MATERIALS_BUCKET } from "@/lib/storage";
import type { MaterialKind, ProgramSession } from "@/lib/types/database";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function zoomUrl(raw: string) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// datetime-local gives "YYYY-MM-DDTHH:mm" with no zone; sessions are run in
// Korea, so read it as KST (and display in KST, see formatKst).
function scheduledAt(formData: FormData) {
  const local = text(formData, "scheduled_at");
  if (!local) return null;
  const date = new Date(`${local}:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function requireFacilitatedSession(sessionId: string) {
  const ctx = await requireProfile();
  const { data: session } = await ctx.supabase
    .from("program_sessions")
    .select("*")
    .eq("id", sessionId)
    .single<ProgramSession>();
  if (!session) throw new Error("회기를 찾을 수 없어요.");

  const { data: group } = await ctx.supabase
    .from("groups")
    .select("id")
    .eq("id", session.group_id)
    .eq("facilitator_id", ctx.userId)
    .maybeSingle();
  if (!group) throw new Error("이 집단의 치료사만 수정할 수 있어요.");

  return { ...ctx, session };
}

export async function createGroup(formData: FormData) {
  const title = text(formData, "title");
  const description = text(formData, "description");
  if (!title) return;

  const { supabase, userId, profile } = await requireProfile();
  if (!isTherapist(profile)) throw new Error("치료사만 집단을 만들 수 있어요.");

  await supabase.from("groups").insert({ facilitator_id: userId, title, description });
  revalidatePath("/programs");
}

export async function joinGroup(_prev: { error: string | null }, formData: FormData) {
  const code = text(formData, "code").toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(code)) return { error: "6자리 초대 코드를 확인해주세요." };

  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc("join_group_by_code", { p_code: code });
  if (error) return { error: "초대 코드가 맞지 않거나 종료된 집단이에요." };

  revalidatePath("/programs");
  revalidatePath("/exhibition");
  return { error: null };
}

export async function upsertSession(formData: FormData) {
  const sessionId = text(formData, "session_id");
  const groupId = text(formData, "group_id");
  const fields = {
    session_no: Math.max(1, Number(text(formData, "session_no")) || 1),
    title: text(formData, "title"),
    description: text(formData, "description"),
    scheduled_at: scheduledAt(formData),
    zoom_url: zoomUrl(text(formData, "zoom_url")),
  };
  if (!fields.title) return;

  if (sessionId) {
    const { supabase } = await requireFacilitatedSession(sessionId);
    await supabase.from("program_sessions").update(fields).eq("id", sessionId);
    revalidatePath(`/programs/${sessionId}`);
  } else {
    // RLS only lets the group's facilitator insert.
    const { supabase } = await requireProfile();
    await supabase.from("program_sessions").insert({ ...fields, group_id: groupId });
  }
  revalidatePath("/programs");
}

export async function deleteSession(formData: FormData) {
  const sessionId = text(formData, "session_id");
  const { supabase } = await requireFacilitatedSession(sessionId);

  const { data: materials } = await supabase
    .from("session_materials")
    .select("file_path")
    .eq("session_id", sessionId);
  if (materials?.length) {
    await supabase.storage.from(MATERIALS_BUCKET).remove(materials.map((m) => m.file_path));
  }
  await supabase.from("program_sessions").delete().eq("id", sessionId);

  revalidatePath("/programs");
  redirect("/programs");
}

export async function addMaterial(input: {
  sessionId: string;
  kind: MaterialKind;
  title: string;
  filePath: string;
  mimeType: string;
}) {
  const { supabase, session } = await requireFacilitatedSession(input.sessionId);
  if (!input.filePath.startsWith(`${session.group_id}/${session.id}/`)) {
    throw new Error("Invalid file path");
  }
  const kind = MATERIAL_KINDS.some((k) => k.id === input.kind) ? input.kind : "etc";

  const { error } = await supabase.from("session_materials").insert({
    session_id: session.id,
    kind,
    title: input.title.trim() || "자료",
    file_path: input.filePath,
    mime_type: input.mimeType,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/programs/${session.id}`);
  revalidatePath("/programs");
}

export async function deleteMaterial(formData: FormData) {
  const sessionId = text(formData, "session_id");
  const materialId = text(formData, "material_id");
  const { supabase } = await requireFacilitatedSession(sessionId);

  const { data: material } = await supabase
    .from("session_materials")
    .select("file_path")
    .eq("id", materialId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!material) return;

  await supabase.from("session_materials").delete().eq("id", materialId);
  await supabase.storage.from(MATERIALS_BUCKET).remove([material.file_path]);

  revalidatePath(`/programs/${sessionId}`);
  revalidatePath("/programs");
}
