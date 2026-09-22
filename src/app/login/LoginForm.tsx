"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const [loading, setLoading] = useState<"google" | "kakao" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInWith(provider: "google" | "kakao") {
    // Prevent double-click
    if (loading !== null) return;

    setError(null);
    setLoading(provider);

    const timeoutId = setTimeout(() => {
      setLoading(null);
      setError("로그인 요청 시간 초과. 다시 시도해주세요.");
    }, 8000);

    try {
      const supabase = createClient();

      // iOS Safari 호환성: 절대 URL 하드코딩
      const redirectUrl = "https://morii-five.vercel.app/auth/callback";

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
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

  const handleSignIn = (provider: "google" | "kakao") => {
    signInWith(provider);
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <button
        type="button"
        onClick={() => handleSignIn("kakao")}
        onTouchStart={(e) => {
          e.preventDefault();
          handleSignIn("kakao");
        }}
        disabled={loading !== null}
        className="flex items-center justify-center gap-2 rounded-2xl bg-[#FEE500] px-4 py-3 text-sm font-semibold text-[#191919] transition disabled:opacity-60 cursor-pointer pointer-events-auto active:scale-95"
      >
        {loading === "kakao" ? "이동 중..." : "카카오로 계속하기"}
      </button>
      <button
        type="button"
        onClick={() => handleSignIn("google")}
        onTouchStart={(e) => {
          e.preventDefault();
          handleSignIn("google");
        }}
        disabled={loading !== null}
        className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition disabled:opacity-60 cursor-pointer pointer-events-auto active:scale-95"
      >
        {loading === "google" ? "이동 중..." : "Google로 계속하기"}
      </button>
      {error && <p className="text-center text-sm text-red-500">{error}</p>}
    </div>
  );
}
