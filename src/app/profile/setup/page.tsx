import { requireAuth } from "@/lib/session";
import { ProfileSetupForm } from "./form";

export default async function ProfileSetupPage() {
  const { supabase } = await requireAuth();

  const { data } = await supabase.auth.getUser();

  // Try multiple sources for name
  const userName =
    data?.user?.user_metadata?.name ||
    data?.user?.user_metadata?.full_name ||
    data?.user?.email?.split("@")[0] ||
    "사용자";

  console.log("🔍 Profile Setup Debug:");
  console.log("  user_metadata:", data?.user?.user_metadata);
  console.log("  email:", data?.user?.email);
  console.log("  Final userName:", userName);

  return (
    <div className="min-h-dvh w-full flex flex-col items-center justify-center bg-forest px-6 py-12">
      <div className="px-panel w-full max-w-md p-8">
        <h1 className="text-3xl font-pixel font-bold text-ink text-center mb-2">프로필 설정</h1>
        <p className="text-sm text-muted text-center mb-6">Me:seum에 오신 것을 환영합니다!</p>

        <ProfileSetupForm defaultNickname={userName} />
      </div>
    </div>
  );
}
