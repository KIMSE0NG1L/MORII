"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PenLine, ImagePlus, X } from "lucide-react";
import PixelAvatar from "@/components/PixelAvatar";
import SoundToggle from "@/components/SoundToggle";
import BgmToggle from "@/components/BgmToggle";
import { playSfx } from "@/lib/sfx";
import { nextGardenItem } from "@/lib/garden";
import { quoteOfTheDay } from "@/lib/quotes";
import GardenLayer from "./GardenLayer";
import TimeOfDay from "./TimeOfDay";
import ThemePicker from "./ThemePicker";
import { THEMES, type MapLayout, type Point, type SpotKey } from "./maps";
import { useHomeTheme, useWideScreen } from "./useHomeTheme";

type Spot = {
  key: SpotKey;
  label: string;
  sub: string;
  href?: string; // navigate on arrival; omitted = open the activity sheet
};

// Where each spot sits on the painting lives in maps.ts, per theme and shape.
const SPOTS: Spot[] = [
  { key: "easel", label: "활동하기", sub: "그림으로 표현" },
  { key: "mood", label: "오늘의 마음", sub: "기분 체크", href: "/check" },
  { key: "bookshelf", label: "기록 보관함", sub: "나의 작품", href: "/diary" },
  { key: "gallery", label: "전시회", sub: "함께 걷기", href: "/exhibition" },
];

// 만다라 그리기 is deliberately absent here - it's only reachable from the
// mood check (/check), which recommends it based on today's mood.
const ACTIVITIES = [
  { href: "/diary/new?mode=draw", icon: PenLine, title: "직접 그리기", desc: "지금 떠오르는 대로 그려보세요." },
  { href: "/diary/new?mode=upload", icon: ImagePlus, title: "사진·이미지 불러오기", desc: "그려둔 그림이나 사진을 남겨요." },
];

const WALK_SPEED = 55; // map-height-percent per second

type Props = { avatarId: string; xp: number; streak: number };

// Picks the wide (PC / landscape) or tall (mobile / portrait) painting of the
// chosen theme. Until the client knows the screen shape it renders an empty
// frame, so PC users never see the tall map flash first.
export default function RoomMap(props: Props) {
  const [themeId, setThemeId] = useHomeTheme();
  const wide = useWideScreen();
  const theme = THEMES[themeId];
  const layout = wide === null ? null : wide ? theme.wide : theme.tall;

  return (
    <div
      // On phones the map is full-bleed: it fills the whole screen and runs
      // under the floating bottom nav (-mb-24 cancels <main>'s nav padding).
      className={`flex min-h-full w-full flex-1 items-center justify-center transition-colors duration-500 md:p-6 ${
        wide ? "" : "max-md:h-dvh max-md:flex-none max-md:-mb-24"
      }`}
      style={{ background: theme.bg }}
    >
      {layout && (
        <Scene
          key={layout.src}
          {...props}
          layout={layout}
          wide={!!wide}
          themePicker={<ThemePicker value={themeId} onChange={setThemeId} />}
        />
      )}
    </div>
  );
}

function Scene({
  avatarId,
  xp,
  streak,
  layout,
  wide,
  themePicker,
}: Props & { layout: MapLayout; wide: boolean; themePicker: React.ReactNode }) {
  const router = useRouter();
  const [pos, setPos] = useState<Point>(layout.home);
  const [walk, setWalk] = useState<{ duration: number; facingLeft: boolean } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const steps = useRef<number | undefined>(undefined);
  const busy = useRef(false);
  const quote = useMemo(() => quoteOfTheDay(), []);

  useEffect(() => {
    router.prefetch("/check");
    router.prefetch("/diary");
    router.prefetch("/diary/new");
    router.prefetch("/exhibition");
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
    const stand = layout.spots[spot.key].stand;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setPos(stand);
      arrive(spot);
      return;
    }
    busy.current = true;
    // Measure in map heights so walking speed feels the same on both shapes.
    const dist = Math.hypot((stand.x - pos.x) * layout.ratio, stand.y - pos.y);
    const duration = Math.max(0.35, dist / WALK_SPEED);
    setWalk({ duration, facingLeft: stand.x < pos.x });
    setPos(stand);
    playSfx("step");
    steps.current = window.setInterval(() => playSfx("step"), 180);
    timer.current = window.setTimeout(() => {
      window.clearInterval(steps.current);
      setWalk(null);
      arrive(spot);
    }, duration * 1000);
  }

  const r = layout.ratio;
  const fit = wide ? `calc((100dvh - 48px) * ${r})` : `min(560px, calc((100dvh - 48px) * ${r}))`;

  return (
    <div
      className={`relative w-full overflow-hidden md:rounded-2xl md:border-4 md:border-[#173323] md:shadow-[0_16px_40px_rgba(0,0,0,0.35)] ${
        wide
          ? "aspect-[var(--r)] max-w-[var(--fit)]"
          : "max-md:h-full md:aspect-[var(--r)] md:max-w-[var(--fit)]"
      }`}
      style={{ "--r": String(r), "--fit": fit, containerType: "size" } as React.CSSProperties}
    >
      {/* The painting and everything pinned to it. It covers the frame (like
          object-fit: cover), so on a phone taller than 9:16 the sides are
          trimmed a little instead of leaving empty bands. */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: `max(100cqw, calc(100cqh * ${r}))`, height: `max(100cqh, calc(100cqw / ${r}))` }}
      >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={layout.src}
        alt="나의 방: 이젤, 마음 체크, 책장, 전시회가 있는 픽셀 맵"
        className="absolute inset-0 h-full w-full select-none"
        draggable={false}
      />

      <GardenLayer xp={xp} slots={layout.garden} scale={layout.gardenScale} />
      <TimeOfDay windows={layout.windows} />

      <Hotspots layout={layout} onGo={go} />

      {/* Player */}
      <div
        className="pointer-events-none absolute z-[100] -translate-x-1/2 -translate-y-full"
        style={{
          width: `${layout.avatarW}%`,
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          transition: walk ? `left ${walk.duration}s linear, top ${walk.duration}s linear` : "none",
        }}
      >
        <div className={walk ? "walker-bob" : ""} style={{ transform: walk?.facingLeft ? "scaleX(-1)" : undefined }}>
          <PixelAvatar avatarId={avatarId} walking={!!walk} className="block h-auto w-full" />
        </div>
      </div>
      </div>

      {/* Title */}
      <div className="pointer-events-none absolute left-[3%] top-[2.5%] z-[115] font-pixel text-white [text-shadow:0_2px_0_#173323,0_0_6px_rgba(0,0,0,0.45)]">
        <div className={wide ? "flex flex-wrap items-baseline gap-x-3" : ""}>
          <h1 className="text-[clamp(18px,5vw,26px)] font-bold">
            나의 방 <span className="text-[#ff8a8a]">♥</span>
          </h1>
          <p className="mt-0.5 text-[clamp(11px,3vw,14px)]">오늘도, 조금 더 편안한 나</p>
        </div>
        <p className={`mt-1 text-[clamp(9px,2.4vw,11.5px)] italic text-white/90 ${wide ? "max-w-[420px]" : "max-w-[220px]"}`}>
          “{quote}”
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1 [text-shadow:none]">
          {streak > 0 && (
            <span className="rounded-md border-2 border-outline bg-card px-1.5 py-0.5 text-[clamp(9px,2.4vw,11px)] text-ink">
              🔥 {streak}일째 기록 중
            </span>
          )}
          <span className="rounded-md border-2 border-outline bg-card px-1.5 py-0.5 text-[clamp(9px,2.4vw,11px)] text-ink">
            {(() => {
              const next = nextGardenItem(xp);
              return next ? `🌱 ${next.name}까지 ${next.xp - xp} XP` : "🌳 정원이 활짝 피었어요";
            })()}
          </span>
        </div>
      </div>

      <div className="absolute right-[3%] top-[2.5%] z-[125] flex gap-1.5">
        {themePicker}
        <BgmToggle className="px-btn px-btn-cream h-9 w-9" />
        <SoundToggle className="px-btn px-btn-cream h-9 w-9" />
      </div>

      {/* Activity sheet (from the easel) */}
      {sheetOpen && (
        <div className="absolute inset-0 z-[130] flex items-end justify-center bg-black/35" onClick={closeSheet}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="활동하기"
            onClick={(e) => e.stopPropagation()}
            className="mx-[3%] mb-[3%] w-full max-w-[480px] rounded-xl border-4 border-[#3b2a1a] bg-[#fdf6e3] p-4 shadow-[0_6px_0_#3b2a1a]"
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

// Clickable spots with their floating name labels. Labels near the left or
// right edge hug that edge, and if the cover fit trims the painting there,
// they are pulled back on screen. Pure CSS: the frame is a size container,
// so the stage width S and the trim are expressible in cq units.
function Hotspots({ layout, onGo }: { layout: MapLayout; onGo: (s: Spot) => void }) {
  const S = `max(100cqw, calc(100cqh * ${layout.ratio}))`;
  return (
    <>
      {SPOTS.map((s, i) => {
        const box = layout.spots[s.key].box;
        const cx = box.left + box.width / 2;
        const R = (box.left + box.width) / 100;
        const L = box.left / 100;
        let anchor = "left-1/2 -translate-x-1/2";
        let edge: React.CSSProperties = {};
        if (cx > 75) {
          anchor = "";
          // right offset = how far the box's right edge sits past the visible edge
          edge = { right: `max(0px, calc(${R - 0.5} * ${S} - 50cqw))` };
        } else if (cx < 25) {
          anchor = "";
          edge = { left: `max(0px, calc(${0.5 - L} * ${S} - 50cqw))` };
        }
        return (
          <button
            key={s.key}
            type="button"
            data-sfx="none"
            onClick={() => onGo(s)}
            aria-label={`${s.label} (${s.sub})`}
            className="group absolute z-[112] rounded-lg outline-none focus-visible:ring-4 focus-visible:ring-[#fff3c4]"
            style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}
          >
            {/* Centering and floating both use `translate`, so they live on separate elements. */}
            <span className={`absolute bottom-full mb-1 ${anchor}`} style={edge}>
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
        );
      })}
    </>
  );
}
