import Link from "next/link";

export default function HomePage() {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-between px-8 py-12"
      style={{
        backgroundImage: "url('/assets/home/home-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Top Right Content */}
      <div className="flex flex-col items-end text-right pt-8 max-w-md">
        <h1 className="text-4xl font-serif font-bold text-ink mb-4 leading-relaxed">
          오늘의 마음을,<br />
          그림으로 남겨보세요.
        </h1>
        <p className="text-base font-serif text-ink/80 font-light">
          당신의 마음이 머무는 작은 전시공간, <span className="font-bold">MORII</span>
        </p>
      </div>

      {/* Bottom Button */}
      <Link
        href="/diary"
        className="mb-20 flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-ink shadow-lg hover:bg-white/90 transition"
      >
        <span>+</span>
        <span>새 작품 그리기</span>
      </Link>
    </div>
  );
}
