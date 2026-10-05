import Link from "next/link";
import { getMyGroups, requireProfile } from "@/lib/session";
import { ACTIVITY_GUIDES, isActivityId } from "@/lib/constants";
import { MATERIALS_BUCKET, isImageFile, signedUrls } from "@/lib/storage";
import type { SessionMaterial } from "@/lib/types/database";
import RecordComposer from "./RecordComposer";

export default async function NewRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { mode, activity, material } = await searchParams;
  const { supabase, userId } = await requireProfile();
  const groups = await getMyGroups(supabase);

  const guide = isActivityId(activity) ? ACTIVITY_GUIDES[activity] : null;
  let templateUrl = guide?.template;
  let templateTitle: string | null = null;

  // "이 도안으로 그리기" from a session's uploaded material.
  if (typeof material === "string" && material) {
    const { data: m } = await supabase
      .from("session_materials")
      .select("*")
      .eq("id", material)
      .single<SessionMaterial>();
    if (m && isImageFile(m.mime_type || m.file_path)) {
      const urls = await signedUrls(supabase, MATERIALS_BUCKET, [m.file_path]);
      templateUrl = urls.get(m.file_path);
      templateTitle = m.title;
    }
  }

  const initialMode =
    mode === "upload" || mode === "none" ? mode : mode === "draw" ? "draw" : (guide?.mode ?? "draw");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-ink">
            {guide ? `${guide.emoji} ${guide.title}` : "오늘의 마음 기록"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {templateTitle
              ? `"${templateTitle}" 도안 위에 마음을 담아보세요.`
              : (guide?.guide ?? "그림과 글로 오늘의 마음을 함께 남겨보세요.")}
          </p>
        </div>
        <Link href="/diary" className="shrink-0 text-xs text-muted underline">
          목록으로
        </Link>
      </header>

      {guide?.reference && (
        <figure className="overflow-hidden rounded-2xl border border-line bg-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={guide.reference} alt="감상할 명화" className="max-h-72 w-full object-cover" />
          <figcaption className="px-4 py-2 text-xs text-muted">
            잠시 그림을 바라보며 어떤 색과 감정이 느껴지는지 살펴보세요.
          </figcaption>
        </figure>
      )}

      <RecordComposer
        userId={userId}
        initialMode={initialMode}
        templateUrl={templateUrl}
        groups={groups.map((g) => ({ id: g.id, title: g.title }))}
      />
    </div>
  );
}
