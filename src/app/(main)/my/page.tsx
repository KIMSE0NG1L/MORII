import Link from "next/link";

export default async function MyPage() {
  return (
    <div
      className="flex h-full w-full flex-col items-start justify-between px-8 py-12"
      style={{
        backgroundImage: "url('/assets/profile/profile-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Top Left Content */}
      <div className="flex flex-col items-start text-left pt-8 max-w-md">
        <h1 className="text-4xl font-serif font-bold text-ink mb-4 leading-relaxed">
          당신의 이야기,<br />
          나누어보세요.
        </h1>
        <p className="text-base font-serif text-ink/80 font-light">
          당신의 마음이 머무는 작은 전시공간, <span className="font-bold">Me:seum</span>
        </p>
      </div>

      {/* Bottom Button */}
      <Link
        href="/check"
        className="mb-20 flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-ink shadow-lg hover:bg-white/90 transition"
      >
        <span>→</span>
        <span>프로필 편집</span>
      </Link>
    </div>
  );
}
