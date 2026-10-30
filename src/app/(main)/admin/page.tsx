import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin, requireProfile } from "@/lib/session";
import Avatar from "@/components/Avatar";
import type { Profile } from "@/lib/types/database";

export default async function AdminPage() {
  const { supabase, profile } = await requireProfile();
  if (!isAdmin(profile)) redirect("/home");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nickname, avatar_id, role, created_at")
    .order("created_at", { ascending: false })
    .returns<Pick<Profile, "id" | "nickname" | "avatar_id" | "role" | "created_at">[]>();

  const { data: counts } = await supabase.from("diary_entries").select("user_id");
  const recordCountByUser = new Map<string, number>();
  (counts ?? []).forEach((c) => recordCountByUser.set(c.user_id, (recordCountByUser.get(c.user_id) ?? 0) + 1));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-8 md:py-10">
      <header>
        <h1 className="text-3xl font-serif font-bold text-ink">관리자 대시보드</h1>
        <p className="mt-1 text-sm text-muted">회원을 선택하면 그 사람이 남긴 모든 그림/기록을 볼 수 있어요.</p>
      </header>

      <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-card">
        {(profiles ?? []).map((p) => (
          <li key={p.id}>
            <Link href={`/admin/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-bg">
              <div className="flex h-10 w-10 shrink-0 items-end justify-center overflow-hidden rounded-full border border-line bg-tag-bg">
                <Avatar avatarId={p.avatar_id} size={38} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{p.nickname}</p>
                <p className="text-xs text-muted">
                  {p.role === "therapist" ? "미술치료사" : p.role === "admin" ? "관리자" : "참여자"} ·{" "}
                  {recordCountByUser.get(p.id) ?? 0}개 기록
                </p>
              </div>
            </Link>
          </li>
        ))}
        {(profiles ?? []).length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted">아직 회원이 없어요.</li>
        )}
      </ul>
    </div>
  );
}
