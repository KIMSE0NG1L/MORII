"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { MAX_TAGS, normalizeTags } from "@/lib/diary";

const SUGGESTIONS = ["편안함", "여유", "회복", "설렘", "불안", "그리움", "감사", "피곤"];

// Pixel chip-style tag editor. Controlled; tags are stored without '#'.
export default function TagInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const next = normalizeTags([...value, ...raw.split(/[,\s]+/)]);
    if (next.length !== value.length) onChange(next);
    setDraft("");
  }

  const suggestions = SUGGESTIONS.filter((s) => !value.includes(s)).slice(0, 5);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((t) => (
          <span key={t} className="flex items-center gap-1 rounded-md border-2 border-outline bg-tag-bg px-2 py-0.5 font-pixel text-xs font-bold text-tag-text">
            #{t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`${t} 태그 지우기`} className="text-tag-text/70 hover:text-[#b23c26]">
              <X size={12} />
            </button>
          </span>
        ))}
        {value.length < MAX_TAGS && (
          <input
            value={draft}
            onChange={(e) => {
              const v = e.target.value;
              if (/[,\s]$/.test(v)) add(v);
              else setDraft(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (draft.trim()) add(draft);
              } else if (e.key === "Backspace" && !draft && value.length) {
                onChange(value.slice(0, -1));
              }
            }}
            onBlur={() => draft.trim() && add(draft)}
            placeholder={value.length ? "태그 추가" : "#태그 입력 후 Enter"}
            className="px-input min-w-[8rem] flex-1 px-2 py-1 text-xs"
          />
        )}
      </div>
      {suggestions.length > 0 && value.length < MAX_TAGS && (
        <div className="flex flex-wrap gap-1">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="px-chip px-2 py-0.5 text-[11px]">
              + #{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
