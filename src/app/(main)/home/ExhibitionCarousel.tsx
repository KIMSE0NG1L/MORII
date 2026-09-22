"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Artwork {
  id: string;
  url: string | null;
  mood?: number | null;
  createdAt: string;
}

const MOODS = ["😢", "😔", "😐", "🙂", "😄"];

export default function ExhibitionCarousel({ artwork }: { artwork: Artwork[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const items = artwork.length > 0
    ? artwork
    : [{ id: "empty", url: null, mood: null, createdAt: "" }];

  const getPrevIndex = (index: number) => (index - 1 + items.length) % items.length;
  const getNextIndex = (index: number) => (index + 1) % items.length;

  const prevItem = items[getPrevIndex(currentIndex)];
  const currentItem = items[currentIndex];
  const nextItem = items[getNextIndex(currentIndex)];

  const next = () => setCurrentIndex((prev) => getNextIndex(prev));
  const prev = () => setCurrentIndex((prev) => getPrevIndex(prev));

  // 자동 슬라이드
  useEffect(() => {
    if (items.length <= 1) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => getNextIndex(prev));
    }, 7000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [items.length]);

  return (
    <div className="relative w-full flex items-center justify-center">
      {/* Navigation Button - Left */}
      <button
        onClick={prev}
        onTouchStart={(e) => {
          e.preventDefault();
          prev();
        }}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-10 sm:-translate-x-12 p-2 rounded-full bg-white/80 hover:bg-white text-ink shadow-md transition z-20 active:scale-95 cursor-pointer"
        aria-label="Previous"
      >
        <ChevronLeft size={20} />
      </button>

      {/* Carousel Container with Transform Animation */}
      <div className="relative w-full h-80 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center gap-6 px-4">
          {/* Previous Item - Slides out left */}
          <div className="hidden lg:flex flex-shrink-0 opacity-60 transition-all duration-500" style={{ transform: 'translateX(-200%)' }}>
            {prevItem.url ? (
              <div className="relative w-52 h-52 sm:w-72 sm:h-72 rounded-xl overflow-hidden border border-line/30 bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={prevItem.url} alt="Previous" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-52 h-52 sm:w-72 sm:h-72 rounded-xl border border-line/30 bg-tag-bg flex items-center justify-center">
                <span className="text-sm text-muted">활동</span>
              </div>
            )}
          </div>

          {/* Current Item - Center */}
          <div className="flex flex-shrink-0 flex-col items-center transition-all duration-500" style={{ transform: 'translateX(0)' }}>
            <div className="relative w-56 h-56 sm:w-80 sm:h-80 rounded-2xl overflow-hidden border-2 border-line bg-card shadow-lg">
              {currentItem.url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={currentItem.url} alt="Current" className="w-full h-full object-cover" />
                  {currentItem.mood !== null && currentItem.mood !== undefined && (
                    <div className="absolute top-4 right-4 text-3xl bg-white/90 backdrop-blur rounded-full w-12 h-12 flex items-center justify-center shadow-md">
                      {MOODS[currentItem.mood]}
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-tag-bg to-tag-bg/50 gap-4">
                  <span className="text-5xl">🎨</span>
                  <span className="text-base font-semibold text-muted">활동을 해주세요!</span>
                </div>
              )}
            </div>

            {/* Indicator Dots */}
            <div className="flex gap-2 mt-6 justify-center flex-wrap max-w-sm">
              {items.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-2 rounded-full transition-all cursor-pointer active:scale-95 ${
                    idx === currentIndex ? "bg-ink w-6" : "bg-line w-2 hover:bg-ink/50"
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Next Item - Slides in from right */}
          <div className="hidden lg:flex flex-shrink-0 opacity-60 transition-all duration-500" style={{ transform: 'translateX(200%)' }}>
            {nextItem.url ? (
              <div className="relative w-52 h-52 sm:w-72 sm:h-72 rounded-xl overflow-hidden border border-line/30 bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={nextItem.url} alt="Next" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-52 h-52 sm:w-72 sm:h-72 rounded-xl border border-line/30 bg-tag-bg flex items-center justify-center">
                <span className="text-sm text-muted">활동</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Button - Right */}
      <button
        onClick={next}
        onTouchStart={(e) => {
          e.preventDefault();
          next();
        }}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-10 sm:translate-x-12 p-2 rounded-full bg-white/80 hover:bg-white text-ink shadow-md transition z-20 active:scale-95 cursor-pointer"
        aria-label="Next"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
