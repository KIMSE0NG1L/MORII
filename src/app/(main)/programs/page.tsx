import Link from "next/link";
import { Video, Paperclip } from "lucide-react";
import { getMyGroups, isTherapist, requireProfile } from "@/lib/session";
import { formatDateTime } from "@/lib/diary";
import type { ProgramSession } from "@/lib/types/database";
import { createGroup } from "./actions";
import JoinGroupForm from "./JoinGroupForm";
import SessionForm from "./SessionForm";

export default async function ProgramsPage() {
  const { supabase, userId, profile } = await requireProfile();
  const therapist = isTherapist(profile);
  const groups = await getMyGroups(supabase);
  const groupIds = groups.map((g) => g.id);

  const { data: sessionRows } = groupIds.length
    ? await supabase
        .from("program_sessions")
        .select("*")
        .in("group_id", groupIds)
        .order("session_no")
        .returns<ProgramSession[]>()
    : { data: [] as ProgramSession[] };
  const sessions = sessionRows ?? [];

  const { data: materialRows } = sessions.length
    ? await supabase
        .from("session_materials")
        .select("session_id")
        .in("session_id", sessions.map((s) => s.id))
    : { data: [] as { session_id: string }[] };
  const materialCount = new Map<string, number>();
  materialRows?.forEach((m) => materialCount.set(m.session_id, (materialCount.get(m.session_id) ?? 0) + 1));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
      <header>
        <h1 className="text-3xl font-serif font-bold text-ink">프로그램</h1>
        <p className="mt-1 text-sm text-muted">
          {therapist
            ? "집단을 만들고 회기별 활동과 자료, Zoom 링크를 올려주세요."
            : "함께 그리는 시간, 회기별 활동과 자료를 확인하세요."}
        </p>
      </header>

      {groups.length === 0 && !therapist && (
        <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
          <h2 className="text-base font-semibold text-ink">집단에 참여하기</h2>
          <p className="mb-4 mt-1 text-sm text-muted">미술치료사에게 받은 초대 코드를 입력해주세요.</p>
          <JoinGroupForm />
        </section>
      )}

      {groups.map((group) => {
        const mine = group.facilitator_id === userId;
        const groupSessions = sessions.filter((s) => s.group_id === group.id);
        return (
          <section key={group.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-ink">{group.title}</h2>
                {group.description && <p className="text-sm text-muted">{group.description}</p>}
              </div>
              {mine && (
                <p className="rounded-full bg-tag-bg px-3 py-1 text-xs text-tag-text">
                  초대 코드 <span className="ml-1 font-mono font-bold tracking-widest text-ink">{group.invite_code}</span>
                </p>
              )}
            </div>

            {groupSessions.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">아직 등록된 회기가 없어요.</p>
            ) : (
              <ol className="flex flex-col divide-y divide-line">
                {groupSessions.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 py-3">
                    <Link href={`/programs/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full bg-sage/15 text-sage">
                        <span className="text-sm font-bold leading-none">{s.session_no}</span>
                        <span className="text-[9px] leading-none">회기</span>
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-semibold text-ink">{s.title}</span>
                        <span className="flex items-center gap-2 text-xs text-muted">
                          {s.scheduled_at ? formatDateTime(s.scheduled_at) : "일정 미정"}
                          {(materialCount.get(s.id) ?? 0) > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Paperclip size={12} /> {materialCount.get(s.id)}
                            </span>
                          )}
                        </span>
                      </span>
                    </Link>
                    {s.zoom_url && (
                      <a
                        href={s.zoom_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex shrink-0 items-center gap-1 rounded-full bg-[#2D8CFF] px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        <Video size={14} /> Zoom
                      </a>
                    )}
                  </li>
                ))}
              </ol>
            )}

            {mine && (
              <details className="rounded-xl bg-bg p-3">
                <summary className="cursor-pointer text-sm font-semibold text-sage">+ 회기 추가</summary>
                <div className="mt-3">
                  <SessionForm
                    groupId={group.id}
                    nextSessionNo={Math.max(0, ...groupSessions.map((s) => s.session_no)) + 1}
                  />
                </div>
              </details>
            )}
          </section>
        );
      })}

      {therapist && (
        <section className="rounded-2xl border border-dashed border-line bg-card p-4 md:p-6">
          <h2 className="text-base font-semibold text-ink">새 집단 만들기</h2>
          <p className="mb-3 mt-1 text-xs text-muted">만들면 참여자에게 공유할 초대 코드가 생겨요.</p>
          <form action={createGroup} className="flex flex-col gap-2 sm:flex-row">
            <input
              name="title"
              required
              placeholder="집단 이름 (예: 가을 마음 미술치료 8주)"
              className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-sage"
            />
            <input
              name="description"
              placeholder="한 줄 소개 (선택)"
              className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-sage"
            />
            <button type="submit" className="shrink-0 rounded-full bg-sage px-5 py-2 text-sm font-semibold text-white">
              만들기
            </button>
          </form>
        </section>
      )}

      {groups.length > 0 && !therapist && (
        <details className="rounded-2xl border border-line bg-card p-4">
          <summary className="cursor-pointer text-sm text-muted">다른 집단에 참여하기</summary>
          <div className="mt-3">
            <JoinGroupForm />
          </div>
        </details>
      )}
    </div>
  );
}
