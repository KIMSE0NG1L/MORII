"use client";

import { useState } from "react";
import { MOOD_CHECK_ACTIVITIES } from "@/lib/constants";

export default function MoodCheckPage() {
  const [score, setScore] = useState(5);
  const activity = MOOD_CHECK_ACTIVITIES.find((a) => score >= a.range[0] && score <= a.range[1]);

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 pt-8">
      <header>
        <h1 className="text-lg font-bold">마음 체크</h1>
        <p className="text-sm text-muted">오늘 하루, 당신의 마음은 어떤가요?</p>
      </header>

      <div className="flex flex-col gap-6">
        {/* Score Input */}
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-6">
          <div className="text-center">
            <div className="text-5xl font-bold text-sage">{score}</div>
            <p className="mt-2 text-sm text-muted">점</p>
          </div>

          <input
            type="range"
            min={1}
            max={10}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="h-2 w-full accent-[color:var(--color-sage)]"
          />

          <div className="flex justify-between text-xs text-muted">
            <span>😔</span>
            <span>😐</span>
            <span>😊</span>
          </div>

          {activity && <p className="mt-2 text-center text-sm text-ink">{activity.label}</p>}
        </div>

        {/* Recommended Activities */}
        {activity && (
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-bold text-muted uppercase tracking-wide">오늘의 미술 활동</h2>
            <div className="rounded-xl overflow-hidden mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/emotions/emotion-faces.png"
                alt="Emotion expression"
                className="w-full h-auto rounded-xl border border-line"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {activity.activities.map((act) => (
                <button
                  key={act.id}
                  className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 text-left transition hover:bg-tag-bg"
                >
                  <span className="text-3xl">{act.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold">{act.title}</p>
                    <p className="mt-1 text-xs text-muted">{act.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
