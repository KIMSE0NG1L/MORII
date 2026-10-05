import type { DiaryEntry } from "@/lib/types/database";

// Old entries stored either a drawing path or text in `content`; new
// "record" entries keep the image and the writing side by side.
export function recordParts(entry: DiaryEntry) {
  if (entry.entry_type === "record") {
    return { imagePath: entry.image_path, body: entry.body };
  }
  if (entry.entry_type === "drawing") {
    return { imagePath: entry.content, body: "" };
  }
  return { imagePath: null, body: entry.content };
}

// Pages render on the server (UTC on Vercel), so pin every date to KST.
const TIME_ZONE = "Asia/Seoul";

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    timeZone: TIME_ZONE,
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Value for an <input type="datetime-local"> showing the KST wall time.
export function toKstInputValue(iso: string | null) {
  if (!iso) return "";
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60_000);
  return kst.toISOString().slice(0, 16);
}
