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
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const items = artwork.length > 0
    ? artwork
    : [{ id: "empty", url: null, mood: null, createdAt: "" }];

  const getNextIndex = (index: number) => (index + 1) % items.length;
  const getPrevIndex = (index: number) => (index - 1 + items.length) % items.length;

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

  // 카드 렌더링
  const renderCard = (item: Artwork, isCenter: boolean) => (
    <div className={`flex-shrink-0 ${isCenter ? "w-56 sm:w-80" : "w-52 sm:w-72"}`}>
      {item.url ? (
        <div className={`relative ${isCenter ? "w-56 h-56 sm:w-80 sm:h-80" : "w-52 h-52 sm:w-72 sm:h-72"} rounded-2xl overflow-hidden border-2 border-line bg-card shadow-lg`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.url} alt="artwork" className="w-full h-full object-cover" />
          {item.mood !== null && item.mood !== undefined && (
            <div className="absolute top-4 right-4 text-3xl bg-white/90 backdrop-blur rounded-full w-12 h-12 flex items-center justify-center shadow-md">
              {MOODS[item.mood]}
            </div>
          )}
        </div>
      ) : (
        <div className={`${isCenter ? "w-56 h-56 sm:w-80 sm:h-80" : "w-52 h-52 sm:w-72 sm:h-72"} rounded-2xl flex flex-col items-center justify-center bg-gradient-to-br from-tag-bg to-tag-bg/50 border-2 border-line shadow-lg gap-4`}>
          <span className="text-5xl">🎨</span>
          <span className={`font-semibold text-muted text-center ${isCenter ? "text-base" : "text-sm"}`}>
            활동을 해주세요!
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative w-full flex items-center justify-center">
      {/* Left Button */}
      <button
        onClick={prev}
        onTouchStart={(e) => {
          e.preventDefault();
          prev();
        }}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-10 sm:-translate-x-12 p-2 rounded-full bg-white/80 hover:bg-white text-ink shadow-md z-20 active:scale-95 cursor-pointer"
        aria-label="Previous"
      >
        <ChevronLeft size={20} />
      </button>

      {/* Carousel */}
      <div className="relative w-full max-w-5xl px-4">
        <div className="relative h-80 overflow-hidden rounded-2xl">
          {/* Sliding Container */}
          <div
            className="flex gap-4 sm:gap-6 transition-transform duration-500 ease-in-out"
            style={{
              transform: `translateX(calc(-${currentIndex} * (100% + 1rem)))`,
            }}
          >
            {items.map((item, idx) => (
              <div key={idx} className="flex-shrink-0">
                {renderCard(item, idx === currentIndex)}
              </div>
            ))}
          </div>
        </div>

        {/* Indicator Dots */}
        <div className="flex gap-2 mt-6 justify-center flex-wrap">
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

      {/* Right Button */}
      <button
        onClick={next}
        onTouchStart={(e) => {
          e.preventDefault();
          next();
        }}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-10 sm:translate-x-12 p-2 rounded-full bg-white/80 hover:bg-white text-ink shadow-md z-20 active:scale-95 cursor-pointer"
        aria-label="Next"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
