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
  const autoPlayRef = useRef<NodeJS.Timeout>();

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
      }, 5000);
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

  return (
    <div className="relative w-full">
      {/* Carousel Container */}
      <div className="relative h-80 flex items-center justify-center gap-3 px-4">
        {/* Previous Item (Small) */}
        <div className="hidden sm:flex flex-col items-center opacity-40 w-1/4 flex-shrink-0">
          {prevItem.url ? (
            <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-line/30 bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={prevItem.url}
                alt="Previous artwork"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-full aspect-square rounded-lg border border-line/30 bg-tag-bg flex items-center justify-center">
              <span className="text-xs text-muted text-center px-2">활동을 해주세요!</span>
            </div>
          )}
        </div>

        {/* Current Item (Large) */}
        <div className="flex flex-col items-center w-full sm:w-1/2 flex-shrink-0">
          <div className="relative w-full aspect-square rounded-2xl overflow-hidden border-2 border-line bg-card shadow-lg">
            {currentItem.url ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentItem.url}
                  alt="Artwork"
                  className="w-full h-full object-cover"
                />
                {currentItem.mood !== null && currentItem.mood !== undefined && (
                  <div className="absolute top-3 right-3 text-2xl bg-white/80 backdrop-blur rounded-full w-10 h-10 flex items-center justify-center">
                    {MOODS[currentItem.mood]}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-tag-bg gap-3">
                <span className="text-lg text-muted">🎨</span>
                <span className="text-sm font-semibold text-muted text-center px-4">활동을 해주세요!</span>
              </div>
            )}
          </div>

          {/* Indicator Dots */}
          <div className="flex gap-2 mt-4 justify-center">
            {items.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goToSlide(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === currentIndex
                    ? "bg-ink w-6"
                    : "bg-line w-2 hover:bg-ink/50"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Next Item (Small) */}
        <div className="hidden sm:flex flex-col items-center opacity-40 w-1/4 flex-shrink-0">
          {nextItem.url ? (
            <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-line/30 bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={nextItem.url}
                alt="Next artwork"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-full aspect-square rounded-lg border border-line/30 bg-tag-bg flex items-center justify-center">
              <span className="text-xs text-muted text-center px-2">활동을 해주세요!</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Buttons */}
      <button
        onClick={prev}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 sm:-translate-x-0 p-2 rounded-full bg-white/80 hover:bg-white text-ink shadow-md transition z-10"
        aria-label="Previous artwork"
      >
        <ChevronLeft size={24} />
      </button>

      <button
        onClick={next}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 sm:translate-x-0 p-2 rounded-full bg-white/80 hover:bg-white text-ink shadow-md transition z-10"
        aria-label="Next artwork"
      >
        <ChevronRight size={24} />
      </button>
    </div>
  );
}
