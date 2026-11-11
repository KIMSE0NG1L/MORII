"use client";

import { useState } from "react";
import Link from "next/link";
import { ACTIVITY_GUIDES, MOOD_CHECK_QUESTIONS, moodCheckResult } from "@/lib/constants";
import { recommendMandala, saveMoodCheck } from "./actions";
import { playSfx } from "@/lib/sfx";

type MandalaPick = { id: string; image: string; reason: string };

export default function MoodCheckForm() {
  const [answers, setAnswers] = useState<number[]>(() => MOOD_CHECK_QUESTIONS.map(() => 5));
  const [note, setNote] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [mandalaPicks, setMandalaPicks] = useState<MandalaPick[] | null>(null);

  async function handleSubmit() {
    setSaving(true);
    const avg = answers.reduce((sum, a) => sum + a, 0) / answers.length;
    const rounded = Math.round(avg * 10) / 10;
    const result = moodCheckResult(rounded);
    try {
      await saveMoodCheck(answers, note);
    } catch {
      // Saving the history is secondary - still show the recommendation.
    }
    // Only worth the AI call when mandala is actually one of the recommended
    // activities for this score range.
    if (result.activities.some((a) => a.id === "mandala")) {
      try {
        setMandalaPicks(await recommendMandala(answers, note));
      } catch {
        setMandalaPicks(null);
      }
    } else {
      setMandalaPicks(null);
    }
    playSfx("success");
    setScore(rounded);
    setSaving(false);
  }

  if (score !== null) {
    const result = moodCheckResult(score);
    return (
      <div className="flex flex-col gap-5">
        <div className="px-panel p-6 text-center">
          <p className="text-xs text-muted">오늘의 마음 점수</p>
          <p className="mt-1 text-5xl font-pixel font-bold text-ink">
            {score}
            <span className="text-lg text-muted"> / 10</span>
          </p>
          <p className="mt-3 text-base font-semibold text-ink">{result.label}</p>
        </div>

        {(() => {
          const mandalaActivity = result.activities.find((a) => a.id === "mandala");
          if (!mandalaActivity) return null;

          if (mandalaPicks && mandalaPicks.length > 0) {
            return (
              <div className="flex flex-col gap-3">
                <h2 className="text-sm font-bold text-ink">오늘의 추천 만다라</h2>
                {mandalaPicks.map((pick) => (
                  <Link
                    key={pick.id}
                    href={`/diary/new?activity=mandala&mandalaId=${pick.id}`}
                    className="flex gap-4 px-panel p-4 px-hover"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pick.image}
                      alt="추천 만다라 도안"
                      className="h-20 w-20 shrink-0 rounded-lg border-2 border-outline bg-white object-contain p-1"
                    />
                    <span className="flex min-w-0 flex-col justify-center gap-1">
                      <span className="text-xs text-muted">{pick.reason}</span>
                    </span>
                    <span className="ml-auto shrink-0 self-center text-muted">→</span>
                  </Link>
                ))}
              </div>
            );
          }

          // AI call failed/unavailable - fall back to a single generic card.
          const guide = ACTIVITY_GUIDES.mandala;
          return (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-bold text-ink">오늘의 추천 만다라</h2>
              <Link
                href="/diary/new?activity=mandala"
                className="flex items-center gap-4 px-panel p-4 px-hover"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-outline bg-tag-bg text-2xl">
                  {guide.emoji}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-ink">{guide.title}</span>
                  <span className="text-xs text-muted">{mandalaActivity.reason}</span>
                </span>
                <span className="ml-auto text-muted">→</span>
              </Link>
            </div>
          );
        })()}

        {result.activities.some((a) => a.id !== "mandala") && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-ink">다른 활동도 추천해요</h2>
            {result.activities
              .filter((a) => a.id !== "mandala")
              .map(({ id, reason }) => {
                const guide = ACTIVITY_GUIDES[id];
                return (
                  <Link
                    key={id}
                    href={`/diary/new?activity=${id}`}
                    className="flex items-center gap-4 px-panel p-4 px-hover"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-outline bg-tag-bg text-2xl">
                      {guide.emoji}
                    </span>
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold text-ink">{guide.title}</span>
                      <span className="text-xs text-muted">{reason}</span>
                    </span>
                    <span className="ml-auto text-muted">→</span>
                  </Link>
                );
              })}
          </div>
        )}

        <button type="button" onClick={() => setScore(null)} className="px-btn px-btn-cream self-center px-4 py-1.5 text-xs">
          다시 체크하기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {MOOD_CHECK_QUESTIONS.map((q, i) => (
        <fieldset key={q.id} className="px-panel p-4">
          <legend className="sr-only">{q.question}</legend>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-ink">
              {i + 1}. {q.question}
            </p>
            <span className="font-pixel text-2xl font-bold text-sage tabular-nums">{answers[i]}</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={answers[i]}
            aria-label={q.question}
            onChange={(e) => {
              const value = Number(e.target.value);
              setAnswers((prev) => prev.map((a, j) => (j === i ? value : a)));
            }}
            className="mt-3 w-full accent-sage"
          />
          <div className="mt-1 flex justify-between text-[11px] text-muted">
            <span>1 · {q.low}</span>
            <span>{q.high} · 10</span>
          </div>
        </fieldset>
      ))}

      <fieldset className="px-panel p-4">
        <legend className="sr-only">오늘 마음 한 줄</legend>
        <p className="text-sm font-semibold text-ink">오늘 마음을 글로도 남겨보세요 (선택)</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="숫자로 다 담기 어려운 마음이 있다면 자유롭게 적어주세요."
          className="mt-3 w-full px-input px-3 py-2 text-sm"
        />
      </fieldset>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving}
        className="px-btn px-btn-green mt-2 py-3 text-sm disabled:opacity-50"
      >
        {saving ? "결과 확인 중..." : "결과 보기"}
      </button>
    </div>
  );
}
