import Link from "next/link";

export default function HomePage() {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-end px-8 py-12"
      style={{
        backgroundImage: "url('/assets/home/home-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <Link
        href="/diary"
        className="mb-12 flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-ink shadow-lg hover:bg-white/90 transition"
      >
        <span>+</span>
        <span>새 작품 그리기</span>
      </Link>
    </div>
  );
}
