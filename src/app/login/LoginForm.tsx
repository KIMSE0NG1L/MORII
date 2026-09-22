"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const [loading, setLoading] = useState<"google" | "kakao" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInWith(provider: "google" | "kakao") {
    alert(`✅ 버튼 클릭됨: ${provider}`);
    setError(null);
    setLoading(provider);

    try {
      const supabase = createClient();
      alert("✅ Supabase 로드됨");

      const redirectUrl = `${window.location.origin}/auth/callback`;
      alert(`✅ Redirect URL: ${redirectUrl}`);

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: redirectUrl },
      });

      if (error) {
        alert(`❌ 에러: ${error.message}`);
        setError(error.message);
        setLoading(null);
      } else {
        alert("✅ OAuth 시작 중...");
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      alert(`❌ 예외: ${errMsg}`);
      setError(errMsg);
      setLoading(null);
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <button
        type="button"
        onClick={() => signInWith("kakao")}
        disabled={loading !== null}
        className="flex items-center justify-center gap-2 rounded-2xl bg-[#FEE500] px-4 py-3 text-sm font-semibold text-[#191919] transition disabled:opacity-60"
      >
        {loading === "kakao" ? "이동 중..." : "카카오로 계속하기"}
      </button>
      <button
        type="button"
        onClick={() => signInWith("google")}
        disabled={loading !== null}
        className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition disabled:opacity-60"
      >
        {loading === "google" ? "이동 중..." : "Google로 계속하기"}
      </button>
      {error && <p className="text-center text-sm text-red-500">{error}</p>}
    </div>
  );
}
