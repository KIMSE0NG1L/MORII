"use client";

import { useState, useTransition } from "react";
import TagInput from "@/components/TagInput";
import { playSfx } from "@/lib/sfx";
import { updateTags } from "../actions";

// Tag editor on the record page; every change saves right away.
export default function RecordTags({ id, initial }: { id: string; initial: string[] }) {
  const [tags, setTags] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(next: string[]) {
    const prev = tags;
    setTags(next);
    setError(null);
    startTransition(async () => {
      try {
        setTags(await updateTags(id, next));
      } catch {
        playSfx("error");
        setTags(prev);
        setError("태그를 저장하지 못했어요.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="px-label flex items-center gap-2 text-xs text-ink">
        🏷️ 태그 {pending && <span className="font-sans text-[10px] font-normal text-muted">저장 중...</span>}
      </p>
      <TagInput value={tags} onChange={change} />
      {error && <p className="text-xs text-[#b23c26]">{error}</p>}
    </div>
  );
}
