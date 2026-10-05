"use client";

import { useActionState } from "react";
import { joinGroup } from "./actions";

export default function JoinGroupForm() {
  const [state, action, pending] = useActionState(joinGroup, { error: null });

  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          name="code"
          required
          maxLength={6}
          autoComplete="off"
          placeholder="초대 코드 6자리"
          className="min-w-0 flex-1 rounded-full border border-line bg-white px-4 py-2 text-sm uppercase tracking-[0.3em] outline-none focus:border-sage"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-full bg-sage px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "확인 중..." : "참여하기"}
        </button>
      </div>
      {state.error && <p className="text-xs text-red-500">{state.error}</p>}
    </form>
  );
}
