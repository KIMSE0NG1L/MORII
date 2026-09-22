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
  const autoPlayRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const items = artwork.length > 0
    ? artwork
    : [{ id: "empty", url: null, mood: null, createdAt: "" }];

  const goToSlide = (index: number) => {
    setCurrentIndex((index + items.length) % items.length);
    resetAutoPlay();
  };

  const next = () => goToSlide(currentIndex + 1);
  const prev = () => goToSlide(currentIndex - 1);

  const resetAutoPlay = () => {
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    if (artwork.length > 1) {
      autoPlayRef.current = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % items.length);
      }, 7000);
    }
  };

  useEffect(() => {
    resetAutoPlay();
    return () => {
      if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    };
  }, [artwork.length, items.length]);

  const getPrevIndex = (index: number) => (index - 1 + items.length) % items.length;
  const getNextIndex = (index: number) => (index + 1) % items.length;

  const prevItem = items[getPrevIndex(currentIndex)];
  const currentItem = items[currentIndex];
  const nextItem = items[getNextIndex(currentIndex)];

  const handlePrev = () => {
    prev();
  };

  const handleNext = () => {
    next();
  };

  return (
    <div className="relative w-full flex items-center justify-center">
      {/* Navigation Button - Left */}
      <button
        onClick={handlePrev}
        onTouchStart={handlePrev}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-14 sm:-translate-x-16 p-2 rounded-full bg-white/80 hover:bg-white text-ink shadow-md transition z-10 active:scale-95 cursor-pointer"
        aria-label="Previous artwork"
      >
        <ChevronLeft size={24} />
      </button>

      {/* Carousel Container */}
      <div className="relative h-72 flex items-center justify-center gap-2 sm:gap-4 px-4">
        {/* Previous Item (Visible on larger screens) */}
        <div className="hidden lg:flex flex-col items-center opacity-50 flex-shrink-0">
          {prevItem.url ? (
            <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-line/30 bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={prevItem.url}
                alt="Previous artwork"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-lg border border-line/30 bg-tag-bg flex items-center justify-center">
              <span className="text-xs text-muted text-center px-1">활동</span>
            </div>
          )}
        </div>

        {/* Current Item (Large, Center) */}
        <div className="flex flex-col items-center w-56 sm:w-80 flex-shrink-0 transition-all duration-300">
          <div className="relative w-full aspect-square rounded-2xl overflow-hidden border-2 border-line bg-card shadow-lg transition-all duration-300">
            {currentItem.url ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentItem.url}
                  alt="Artwork"
                  className="w-full h-full object-cover"
                />
                {currentItem.mood !== null && currentItem.mood !== undefined && (
                  <div className="absolute top-3 right-3 text-2xl bg-white/80 backdrop-blur rounded-full w-10 h-10 flex items-center justify-center shadow-md">
                    {MOODS[currentItem.mood]}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-tag-bg to-tag-bg/50 gap-3">
                <span className="text-4xl">🎨</span>
                <span className="text-sm font-semibold text-muted text-center px-4">활동을 해주세요!</span>
              </div>
            )}
          </div>

          {/* Indicator Dots */}
          <div className="flex gap-1.5 mt-4 justify-center flex-wrap max-w-xs">
            {items.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goToSlide(idx)}
                onTouchStart={() => goToSlide(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer active:scale-95 ${
                  idx === currentIndex
                    ? "bg-ink w-5"
                    : "bg-line w-1.5 hover:bg-ink/50"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Next Item (Visible on larger screens) */}
        <div className="hidden lg:flex flex-col items-center opacity-50 flex-shrink-0">
          {nextItem.url ? (
            <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-line/30 bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={nextItem.url}
                alt="Next artwork"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-lg border border-line/30 bg-tag-bg flex items-center justify-center">
              <span className="text-xs text-muted text-center px-1">활동</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Button - Right */}
      <button
        onClick={handleNext}
        onTouchStart={handleNext}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-14 sm:translate-x-16 p-2 rounded-full bg-white/80 hover:bg-white text-ink shadow-md transition z-10 active:scale-95 cursor-pointer"
        aria-label="Next artwork"
      >
        <ChevronRight size={24} />
      </button>
    </div>
  );
}
