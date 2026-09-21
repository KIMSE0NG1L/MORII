import Link from "next/link";

export default async function ProgramsPage() {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-between px-8 py-12"
      style={{
        backgroundImage: "url('/assets/programs/program-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Top Content */}
      <div className="flex flex-col items-center text-center pt-8">
        <h1 className="text-3xl font-bold text-white mb-3">함께 그리는 시간,</h1>
        <h2 className="text-3xl font-bold text-white mb-6">조금 더 나를 만나는 시간</h2>
        <p className="text-sm text-white/80 max-w-md">
          미술치료사와의 1:1 세션에서 진행하는 전문 프로그램입니다.
        </p>
      </div>

      {/* Bottom Button */}
      <Link
        href="/exhibition"
        className="mb-12 flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-ink shadow-lg hover:bg-white/90 transition"
      >
        <span>프로그램 목록 보기</span>
        <span>→</span>
      </Link>
    </div>
  );
}
