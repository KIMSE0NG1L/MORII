import { requireAuth } from "@/lib/session";
import { ProfileSetupForm } from "./form";

export default async function ProfileSetupPage() {
  const { supabase } = await requireAuth();

  const { data } = await supabase.auth.getUser();
  const userName = data?.user?.user_metadata?.name || data?.user?.email?.split("@")[0] || "";

  return (
    <div
      className="min-h-dvh w-full flex flex-col items-center justify-center px-8 py-12"
      style={{
        backgroundImage: "url('/assets/home/home-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="w-full max-w-md rounded-3xl bg-white/95 backdrop-blur p-8 shadow-lg">
        <h1 className="text-3xl font-serif font-bold text-ink text-center mb-2">프로필 설정</h1>
        <p className="text-sm text-muted text-center mb-6">Me:seum에 오신 것을 환영합니다!</p>

        <ProfileSetupForm defaultNickname={userName} />
      </div>
    </div>
  );
}
