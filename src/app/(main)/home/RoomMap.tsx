"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PenLine, ImagePlus, Flower2, X } from "lucide-react";
import PixelAvatar from "@/components/PixelAvatar";
import SoundToggle from "@/components/SoundToggle";
import { playSfx } from "@/lib/sfx";

// All coordinates are percentages of room-map.png (688x1024), so they stay
// glued to the painted objects at any rendered size.
type Point = { x: number; y: number };
type Spot = {
  key: string;
  label: string;
  sub: string;
  box: { left: number; top: number; width: number; height: number };
  stand: Point; // where the player walks to (feet position)
  href?: string; // navigate on arrival; omitted = open the activity sheet
};

const HOME: Point = { x: 50, y: 33 }; // just below the cottage door

const SPOTS: Spot[] = [
  {
    key: "easel",
    label: "활동하기",
    sub: "그림으로 표현",
    box: { left: 13.5, top: 36, width: 16, height: 15.5 },
    stand: { x: 31, y: 52 },
  },
  {
    key: "mailbox",
    label: "오늘의 마음",
    sub: "기분 체크",
    box: { left: 68.5, top: 32, width: 13.5, height: 11.5 },
    stand: { x: 67, y: 45 },
    href: "/check",
  },
  {
    key: "bookshelf",
    label: "기록 보관함",
    sub: "나의 작품",
    box: { left: 65.5, top: 50, width: 22, height: 15 },
    stand: { x: 63, y: 67 },
    href: "/diary",
  },
];

const ACTIVITIES = [
  { href: "/diary/new?mode=draw", icon: PenLine, title: "직접 그리기", desc: "지금 떠오르는 대로 그려보세요." },
  { href: "/diary/new?mode=upload", icon: ImagePlus, title: "사진·이미지 불러오기", desc: "그려둔 그림이나 사진을 남겨요." },
  { href: "/diary/new?activity=mandala", icon: Flower2, title: "만다라 그리기", desc: "반복되는 무늬를 색칠하며 마음을 가라앉혀요." },
];

const WALK_SPEED = 55; // map-percent per second

export default function RoomMap({ avatarId }: { avatarId: string }) {
  const router = useRouter();
  const [pos, setPos] = useState<Point>(HOME);
  const [walk, setWalk] = useState<{ duration: number; facingLeft: boolean } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const steps = useRef<number | undefined>(undefined);
  const busy = useRef(false);

  useEffect(() => {
    router.prefetch("/check");
    router.prefetch("/diary");
    router.prefetch("/diary/new");
    return () => {
      window.clearTimeout(timer.current);
      window.clearInterval(steps.current);
    };
  }, [router]);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeSheet();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  function closeSheet() {
    playSfx("close");
    setSheetOpen(false);
  }

  function arrive(spot: Spot) {
    busy.current = false;
    if (spot.href) {
      playSfx("click");
      router.push(spot.href);
    } else {
      playSfx("open");
      setSheetOpen(true);
    }
  }

  function go(spot: Spot) {
    if (busy.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setPos(spot.stand);
      arrive(spot);
      return;
    }
    busy.current = true;
    const dist = Math.hypot(spot.stand.x - pos.x, spot.stand.y - pos.y);
    const duration = Math.max(0.35, dist / WALK_SPEED);
    setWalk({ duration, facingLeft: spot.stand.x < pos.x });
    setPos(spot.stand);
    playSfx("step");
    steps.current = window.setInterval(() => playSfx("step"), 180);
    timer.current = window.setTimeout(() => {
      window.clearInterval(steps.current);
      setWalk(null);
      arrive(spot);
    }, duration * 1000);
  }

  return (
    <div
      className="relative w-full overflow-hidden md:rounded-2xl md:border-4 md:border-[#173323] md:shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
      style={{
        aspectRatio: "688 / 1024",
        // Fit the whole map on screen: never taller than the viewport.
        maxWidth: "min(560px, calc((100dvh - 48px) * 688 / 1024))",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/home/room-map.png"
        alt="나의 방: 오두막 앞마당과 이젤, 우체통, 책장, 연못이 있는 픽셀 맵"
        className="pixelated absolute inset-0 h-full w-full select-none"
        draggable={false}
      />

      {/* Title */}
      <div className="pointer-events-none absolute left-[4%] top-[2.5%] font-pixel text-white [text-shadow:0_2px_0_#173323,0_0_6px_rgba(0,0,0,0.45)]">
        <h1 className="text-[clamp(18px,5vw,26px)] font-bold">
          나의 방 <span className="text-[#ff8a8a]">♥</span>
        </h1>
        <p className="mt-0.5 text-[clamp(11px,3vw,14px)]">오늘도, 조금 더 편안한 나</p>
      </div>

      <SoundToggle className="px-btn px-btn-cream absolute right-[3%] top-[2.5%] z-[5] h-9 w-9" />

      {/* Hotspots + floating labels */}
      {SPOTS.map((s, i) => (
        <button
          key={s.key}
          type="button"
          data-sfx="none"
          onClick={() => go(s)}
          aria-label={`${s.label} (${s.sub})`}
          className="group absolute rounded-lg outline-none focus-visible:ring-4 focus-visible:ring-[#fff3c4]"
          style={{ left: `${s.box.left}%`, top: `${s.box.top}%`, width: `${s.box.width}%`, height: `${s.box.height}%` }}
        >
          {/* Centering and floating both use `translate`, so they live on separate elements. */}
          <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2">
          <span
            className="block motion-safe:animate-[bubble-float_2.4s_ease-in-out_infinite]"
            style={{ animationDelay: `${i * 0.4}s` }}
          >
            <span className="relative block whitespace-nowrap rounded-md border-2 border-[#3b2a1a] bg-[#fdf6e3] px-2 py-1 text-center font-pixel leading-tight text-[#3b2a1a] shadow-[0_3px_0_#3b2a1a] transition group-hover:-translate-y-0.5 group-hover:bg-white">
              <span className="block text-[clamp(11px,3vw,14px)] font-bold">{s.label}</span>
              <span className="block text-[clamp(9px,2.4vw,11px)] text-[#7a6347]">({s.sub})</span>
              {/* tail */}
              <span className="absolute left-1/2 top-full -mt-px h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[7px] border-x-transparent border-t-[#3b2a1a]" />
              <span className="absolute left-1/2 top-full -mt-[3px] h-0 w-0 -translate-x-1/2 border-x-[4px] border-t-[5px] border-x-transparent border-t-[#fdf6e3]" />
            </span>
          </span>
          </span>
        </button>
      ))}

      {/* Player */}
      <div
        className="pointer-events-none absolute w-[7.5%] -translate-x-1/2 -translate-y-full"
        style={{
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          transition: walk ? `left ${walk.duration}s linear, top ${walk.duration}s linear` : "none",
        }}
      >
        <div className={walk ? "walker-bob" : ""} style={{ transform: walk?.facingLeft ? "scaleX(-1)" : undefined }}>
          <PixelAvatar avatarId={avatarId} walking={!!walk} className="block h-auto w-full" />
        </div>
      </div>

      {/* Activity sheet (from the easel) */}
      {sheetOpen && (
        <div className="absolute inset-0 z-10 flex items-end bg-black/35" onClick={closeSheet}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="활동하기"
            onClick={(e) => e.stopPropagation()}
            className="mx-[3%] mb-[3%] w-full rounded-xl border-4 border-[#3b2a1a] bg-[#fdf6e3] p-4 shadow-[0_6px_0_#3b2a1a]"
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-pixel text-lg font-bold text-[#3b2a1a]">🎨 활동하기</h2>
              <button
                type="button"
                data-sfx="none"
                onClick={closeSheet}
                aria-label="닫기"
                className="rounded p-1 text-[#7a6347] hover:bg-[#efe3c4]"
              >
                <X size={20} />
              </button>
            </div>
            <p className="mb-3 text-xs text-[#7a6347]">그림으로 지금의 마음을 편안하게 표현해 보세요.</p>
            <ul className="flex flex-col gap-2">
              {ACTIVITIES.map(({ href, icon: Icon, title, desc }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex items-center gap-3 rounded-lg border-2 border-[#3b2a1a] bg-white px-3 py-2.5 shadow-[0_3px_0_#3b2a1a] transition hover:-translate-y-0.5 hover:bg-[#f3f8ea] active:translate-y-0.5 active:shadow-none"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#7a9b56] text-white">
                      <Icon size={18} strokeWidth={2} />
                    </span>
                    <span className="flex flex-col">
                      <span className="font-pixel text-sm font-bold text-[#3b2a1a]">{title}</span>
                      <span className="text-[11px] text-[#7a6347]">{desc}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
