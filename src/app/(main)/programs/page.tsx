import { requireProfile } from "@/lib/session";
import { recommendProgram } from "@/lib/constants";
import type { ProgramTemplate, ProgramEnrollment, DiaryEntry } from "@/lib/types/database";
import { enrollProgram, completeProgram } from "./actions";

export default async function ProgramsPage() {
  const { supabase, userId } = await requireProfile();

  const [{ data: templates }, { data: enrollments }, { data: latestDiary }] = await Promise.all([
    supabase.from("program_templates").select("*").order("sort_order").returns<ProgramTemplate[]>(),
    supabase.from("program_enrollments").select("*").eq("user_id", userId).returns<ProgramEnrollment[]>(),
    supabase
      .from("diary_entries")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .returns<DiaryEntry[]>(),
  ]);

  const enrollmentByProgram = new Map((enrollments ?? []).map((e) => [e.program_id, e]));
  const recommendation = templates?.length
    ? recommendProgram(latestDiary?.[0]?.content ?? "", templates)
    : null;

  const ongoing = (templates ?? []).filter((t) => enrollmentByProgram.get(t.id)?.status === "ongoing");
  const completed = (templates ?? []).filter((t) => enrollmentByProgram.get(t.id)?.status === "completed");
  const notStarted = (templates ?? []).filter((t) => !enrollmentByProgram.has(t.id));

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 pt-8">
      <header>
        <h1 className="text-lg font-bold">프로그램</h1>
        <p className="text-sm text-muted">마음을 돌보는 짧은 여정들이에요.</p>
      </header>

      {recommendation && (
        <section className="rounded-2xl bg-gradient-to-br from-[color:var(--color-peach)] to-[color:var(--color-blush)] p-4">
          <p className="mb-1 text-xs font-semibold text-ink/70">AI 추천</p>
          <p className="text-sm font-bold">
            {recommendation.icon} {recommendation.title}
          </p>
          <p className="mt-1 text-xs text-ink/70">{recommendation.reason}</p>
        </section>
      )}

      {ongoing.length > 0 && (
        <Section title="진행중">
          {ongoing.map((t) => (
            <ProgramCard key={t.id} template={t} progress={enrollmentByProgram.get(t.id)?.progress}>
              <form action={completeProgram}>
                <input type="hidden" name="program_id" value={t.id} />
                <button type="submit" className="rounded-full bg-sage px-3 py-1.5 text-xs font-semibold text-white">
                  완료하기
                </button>
              </form>
            </ProgramCard>
          ))}
        </Section>
      )}

      {notStarted.length > 0 && (
        <Section title="새로운 프로그램">
          {notStarted.map((t) => (
            <ProgramCard key={t.id} template={t}>
              <form action={enrollProgram}>
                <input type="hidden" name="program_id" value={t.id} />
                <button
                  type="submit"
                  className="rounded-full border border-sage px-3 py-1.5 text-xs font-semibold text-sage"
                >
                  시작하기
                </button>
              </form>
            </ProgramCard>
          ))}
        </Section>
      )}

      {completed.length > 0 && (
        <Section title="완료">
          {completed.map((t) => (
            <ProgramCard key={t.id} template={t} progress={1} done />
          ))}
        </Section>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-muted">{title}</h2>
      {children}
    </section>
  );
}

function ProgramCard({
  template,
  progress,
  done,
  children,
}: {
  template: ProgramTemplate;
  progress?: number;
  done?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4">
      <span className="text-2xl">{template.icon}</span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${done ? "text-muted line-through" : ""}`}>{template.title}</p>
        <p className="truncate text-xs text-muted">{template.subtitle}</p>
        {typeof progress === "number" && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-bar-track">
            <div className="h-full rounded-full bg-bar-fill" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
