import Link from "next/link";

export default async function ProgramsPage() {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-end px-8 py-12"
      style={{
        backgroundImage: "url('/assets/programs/program-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <Link
        href="/exhibition"
        className="mb-12 flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-ink shadow-lg hover:bg-white/90 transition"
      >
        <span>→</span>
        <span>프로그램 둘러보기</span>
      </Link>
    </div>
  );
}
