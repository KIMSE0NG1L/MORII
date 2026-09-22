"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const [loading, setLoading] = useState<"google" | "kakao" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInWith(provider: "google" | "kakao") {
    setError(null);
    setLoading(provider);

    // 타임아웃: 5초 후 자동으로 버튼 다시 활성화
    const timeoutId = setTimeout(() => {
      setLoading(null);
      setError("로그인 요청 시간 초과. 다시 시도해주세요.");
    }, 5000);

    try {
      const supabase = createClient();
      const redirectUrl = `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: redirectUrl },
      });

      clearTimeout(timeoutId);

      if (error) {
        setError(error.message);
        setLoading(null);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const errMsg = err instanceof Error ? err.message : String(err);
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
