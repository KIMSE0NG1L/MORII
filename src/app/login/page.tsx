import PixelAvatar from "@/components/PixelAvatar";
import LoginForm from "./LoginForm";

// Splash-style entrance: dark forest, a little pixel resident, one way in.
export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-forest px-6">
      <div
        aria-hidden="true"
        className="pixelated pointer-events-none absolute inset-x-0 top-0 h-[60px] bg-repeat-x md:h-[80px]"
        style={{ backgroundImage: "url('/assets/ui/canopy.png')", backgroundSize: "auto 100%" }}
      />

      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="font-pixel text-xs tracking-[0.4em] text-[#cfe3b0]">마 음 의 &nbsp;아 트 테 라 피</p>
          <PixelAvatar avatarId="a1" className="w-14" />
          <h1 className="font-pixel text-3xl font-bold text-[#fdf6e3] [text-shadow:0_3px_0_#173323]">
            Me:seum <span className="text-[#9fd06a]">🌱</span>
          </h1>
          <p className="text-sm text-[#e7f0d8]/85">그림으로 마음을 돌보는 나만의 공간</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
