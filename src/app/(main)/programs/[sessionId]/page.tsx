import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Video } from "lucide-react";
import { requireProfile } from "@/lib/session";
import { MATERIAL_KINDS } from "@/lib/constants";
import { formatDateTime } from "@/lib/diary";
import { MATERIALS_BUCKET, isImageFile, signedUrls } from "@/lib/storage";
import type { Group, ProgramSession, SessionMaterial } from "@/lib/types/database";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { deleteMaterial, deleteSession } from "../actions";
import SessionForm from "../SessionForm";
import MaterialUploader from "./MaterialUploader";

// Templates participants can color/draw over directly.
const DRAWABLE_KINDS = new Set(["mandala", "masterpiece", "mind_card"]);

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { supabase, userId } = await requireProfile();

  const { data: session } = await supabase
    .from("program_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle<ProgramSession>();
  if (!session) notFound();

  const [{ data: group }, { data: materialRows }] = await Promise.all([
    supabase.from("groups").select("*").eq("id", session.group_id).single<Group>(),
    supabase
      .from("session_materials")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at")
      .returns<SessionMaterial[]>(),
  ]);
  const materials = materialRows ?? [];
  const facilitator = group?.facilitator_id === userId;
  const urls = await signedUrls(supabase, MATERIALS_BUCKET, materials.map((m) => m.file_path));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 md:px-8 md:py-10">
      <Link href="/programs" className="text-sm text-muted">
        ← {group?.title ?? "프로그램"}
      </Link>

      <header className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5 shadow-sm md:p-6">
        <p className="text-xs font-semibold text-sage">{session.session_no}회기</p>
        <h1 className="text-2xl font-serif font-bold text-ink">{session.title}</h1>
        <p className="text-sm text-muted">
          {session.scheduled_at ? formatDateTime(session.scheduled_at) : "일정 미정"}
        </p>
        {session.description && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{session.description}</p>
        )}
        {session.zoom_url ? (
          <a
            href={session.zoom_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-fit items-center gap-2 rounded-full bg-[#2D8CFF] px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
          >
            <Video size={16} /> Zoom으로 참여하기
          </a>
        ) : (
          <p className="text-xs text-muted">Zoom 링크는 곧 올라올 예정이에요.</p>
        )}
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-bold text-ink">활동 자료</h2>
        {materials.length === 0 && <p className="text-sm text-muted">아직 올라온 자료가 없어요.</p>}
        {MATERIAL_KINDS.map((kind) => {
          const items = materials.filter((m) => m.kind === kind.id);
          if (items.length === 0) return null;
          return (
            <div key={kind.id} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold text-muted">{kind.label}</h3>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {items.map((m) => {
                  const url = urls.get(m.file_path);
                  const image = isImageFile(m.mime_type || m.file_path);
                  return (
                    <li key={m.id} className="flex flex-col overflow-hidden rounded-xl border border-line bg-card">
                      <a href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square bg-bg">
                        {image && url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt={m.title} className="h-full w-full object-contain" />
                        ) : (
                          <span className="flex h-full flex-col items-center justify-center gap-2 text-muted">
                            <FileText size={32} strokeWidth={1.5} />
                            <span className="text-xs">열어보기</span>
                          </span>
                        )}
                      </a>
                      <div className="flex flex-col gap-1.5 p-2.5">
                        <p className="truncate text-xs font-semibold text-ink">{m.title}</p>
                        {image && DRAWABLE_KINDS.has(m.kind) && (
                          <Link
                            href={`/diary/new?material=${m.id}`}
                            className="rounded-full bg-sage/15 px-2 py-1 text-center text-[11px] font-semibold text-sage"
                          >
                            이 도안으로 그리기
                          </Link>
                        )}
                        {facilitator && (
                          <form action={deleteMaterial}>
                            <input type="hidden" name="session_id" value={session.id} />
                            <input type="hidden" name="material_id" value={m.id} />
                            <ConfirmSubmit
                              message="이 자료를 삭제할까요?"
                              className="w-full text-center text-[11px] text-muted hover:text-red-600"
                            >
                              삭제
                            </ConfirmSubmit>
                          </form>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      {facilitator && (
        <>
          <section className="rounded-2xl border border-dashed border-line bg-card p-4 md:p-6">
            <h2 className="mb-3 text-sm font-bold text-ink">자료 올리기</h2>
            <MaterialUploader groupId={session.group_id} sessionId={session.id} />
          </section>

          <details className="rounded-2xl border border-line bg-card p-4 md:p-6">
            <summary className="cursor-pointer text-sm font-bold text-ink">회기 정보 수정</summary>
            <div className="mt-4">
              <SessionForm groupId={session.group_id} session={session} />
            </div>
            <form action={deleteSession} className="mt-4 border-t border-line pt-3 text-right">
              <input type="hidden" name="session_id" value={session.id} />
              <ConfirmSubmit
                message="이 회기와 올린 자료를 모두 삭제할까요?"
                className="text-xs text-muted hover:text-red-600"
              >
                회기 삭제
              </ConfirmSubmit>
            </form>
          </details>
        </>
      )}
    </div>
  );
}
