import { toKstInputValue } from "@/lib/diary";
import type { ProgramSession } from "@/lib/types/database";
import { upsertSession } from "./actions";

const input =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-sage";

// Create (groupId) or edit (session) a 회기. Therapist-only; RLS enforces it.
export default function SessionForm({
  groupId,
  session,
  nextSessionNo = 1,
}: {
  groupId: string;
  session?: ProgramSession;
  nextSessionNo?: number;
}) {
  return (
    <form action={upsertSession} className="flex flex-col gap-3">
      <input type="hidden" name="group_id" value={groupId} />
      {session && <input type="hidden" name="session_id" value={session.id} />}
      <div className="grid grid-cols-[5rem_1fr] gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          회기
          <input
            name="session_no"
            type="number"
            min={1}
            defaultValue={session?.session_no ?? nextSessionNo}
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          제목
          <input
            name="title"
            required
            defaultValue={session?.title}
            placeholder="예) 나를 만나는 시간"
            className={input}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs text-muted">
        활동 안내
        <textarea
          name="description"
          rows={3}
          defaultValue={session?.description}
          placeholder="이번 회기에 함께할 활동과 준비물을 적어주세요."
          className={input}
        />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          일시 (한국 시간)
          <input
            name="scheduled_at"
            type="datetime-local"
            defaultValue={toKstInputValue(session?.scheduled_at ?? null)}
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Zoom 링크
          <input
            name="zoom_url"
            type="url"
            defaultValue={session?.zoom_url ?? ""}
            placeholder="https://zoom.us/j/..."
            className={input}
          />
        </label>
      </div>
      <button type="submit" className="self-end rounded-full bg-sage px-5 py-2 text-xs font-semibold text-white">
        {session ? "회기 저장" : "회기 추가"}
      </button>
    </form>
  );
}
