"use client";

import { useState } from "react";
import Link from "next/link";
import { ACTIVITY_GUIDES, MOOD_CHECK_QUESTIONS, moodCheckResult } from "@/lib/constants";
import { saveMoodCheck } from "./actions";

export default function MoodCheckForm() {
  const [answers, setAnswers] = useState<number[]>(() => MOOD_CHECK_QUESTIONS.map(() => 5));
  const [score, setScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    const avg = answers.reduce((sum, a) => sum + a, 0) / answers.length;
    try {
      await saveMoodCheck(answers);
    } catch {
      // Saving the history is secondary - still show the recommendation.
    }
    setScore(Math.round(avg * 10) / 10);
    setSaving(false);
  }

  if (score !== null) {
    const result = moodCheckResult(score);
    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-2xl border border-line bg-card p-6 text-center shadow-sm">
          <p className="text-xs text-muted">오늘의 마음 점수</p>
          <p className="mt-1 text-5xl font-serif font-bold text-ink">
            {score}
            <span className="text-lg text-muted"> / 10</span>
          </p>
          <p className="mt-3 text-base font-semibold text-ink">{result.label}</p>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-ink">이런 활동을 추천해요</h2>
          {result.activities.map(({ id, reason }) => {
            const guide = ACTIVITY_GUIDES[id];
            return (
              <Link
                key={id}
                href={`/diary/new?activity=${id}`}
                className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4 shadow-sm transition hover:border-sage hover:shadow-md"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tag-bg text-2xl">
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

        <button type="button" onClick={() => setScore(null)} className="self-center text-xs text-muted underline">
          다시 체크하기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {MOOD_CHECK_QUESTIONS.map((q, i) => (
        <fieldset key={q.id} className="rounded-2xl border border-line bg-card p-4 shadow-sm">
          <legend className="sr-only">{q.question}</legend>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-ink">
              {i + 1}. {q.question}
            </p>
            <span className="text-2xl font-bold text-sage tabular-nums">{answers[i]}</span>
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

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving}
        className="mt-2 rounded-full bg-sage py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
      >
        {saving ? "결과 확인 중..." : "결과 보기"}
      </button>
    </div>
  );
}
