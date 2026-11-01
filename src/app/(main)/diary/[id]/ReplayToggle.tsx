"use client";

import { useState } from "react";
import { Film } from "lucide-react";
import StrokeReplay from "./StrokeReplay";

// Keeps StrokeReplay unmounted (so it doesn't fetch the log) until the
// viewer actually asks to see it.
export default function ReplayToggle({ logUrl }: { logUrl: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 self-start rounded-full border border-line bg-white px-4 py-2 text-xs font-semibold text-ink hover:border-sage"
      >
        <Film size={14} /> 녹화 보기
      </button>
    );
  }

  return <StrokeReplay logUrl={logUrl} />;
}
