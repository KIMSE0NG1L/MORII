import Link from "next/link";

export default async function ExhibitionPage() {
  return (
    <div
      className="flex h-full w-full flex-col items-start justify-between px-8 py-12"
      style={{
        backgroundImage: "url('/assets/exhibition/exhibition-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Top Left Content */}
      <div className="flex flex-col items-start text-left pt-8 max-w-md">
        <h1 className="text-4xl font-serif font-bold text-ink mb-4 leading-relaxed">
          우리들의 전시회,<br />
          함께 만드는 공간.
        </h1>
        <p className="text-base font-serif text-ink/80 font-light">
          당신의 마음이 머무는 작은 전시공간, <span className="font-bold">Me:seum</span>
        </p>
      </div>

      {/* Bottom Button */}
      <Link
        href="/my"
        className="mb-20 flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-ink shadow-lg hover:bg-white/90 transition"
      >
        <span>→</span>
        <span>전시회 보기</span>
      </Link>
    </div>
  );
}
