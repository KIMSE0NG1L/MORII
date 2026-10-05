"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import Avatar from "@/components/Avatar";

type Artwork = { id: string; url: string; body: string; date: string; author: string };
type Walker = { id: string; nickname: string; avatarId: string; isMe: boolean };
type WalkerPos = { x: number; walking: boolean; facingLeft: boolean; duration: number };

const FRAME_SPACING = 240; // px of wall per artwork
const MIN_SLOTS = 4;

export default function ExhibitionHall({ artworks, walkers }: { artworks: Artwork[]; walkers: Walker[] }) {
  const slots = Math.max(MIN_SLOTS, artworks.length);
  // Percent position of each frame's center along the hall.
  const frameX = (i: number) => ((i + 0.5) / slots) * 100;

  // Deterministic start (no Math.random during render) so SSR and the first
  // client render match; wandering starts in the effect below.
  const [positions, setPositions] = useState<Record<string, WalkerPos>>(() =>
    Object.fromEntries(
      walkers.map((w, i) => [
        w.id,
        { x: ((i + 0.5) / walkers.length) * 90 + 5, walking: false, facingLeft: false, duration: 0 },
      ]),
    ),
  );
  const [selected, setSelected] = useState<Artwork | null>(null);
  const timers = useRef<number[]>([]);

  // Mirror of `positions` for event/timer handlers, so they never need to
  // run side effects inside a state updater.
  const posRef = useRef(positions);

  function move(id: string, patch: Partial<WalkerPos>) {
    const cur = posRef.current[id];
    if (!cur) return;
    posRef.current = { ...posRef.current, [id]: { ...cur, ...patch } };
    setPositions(posRef.current);
  }

  function walkTo(id: string, target: number) {
    const cur = posRef.current[id];
    if (!cur) return;
    const dx = target - cur.x;
    // Roughly constant walking speed regardless of distance.
    const duration = Math.min(8, 0.8 + Math.abs(dx) * 0.06 * (slots / MIN_SLOTS));
    move(id, { x: target, walking: true, facingLeft: dx < 0, duration });
    timers.current.push(window.setTimeout(() => move(id, { walking: false }), duration * 1000));
  }

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const pending = timers.current;

    // Everyone but me drifts between artworks every few seconds.
    walkers
      .filter((w) => !w.isMe)
      .forEach((w) => {
        const wander = () => {
          const slot = Math.floor(Math.random() * slots);
          walkTo(w.id, frameX(slot) + (Math.random() * 6 - 3));
          pending.push(window.setTimeout(wander, 5000 + Math.random() * 5000));
        };
        pending.push(window.setTimeout(wander, 600 + Math.random() * 2500));
      });

    return () => pending.forEach((t) => window.clearTimeout(t));
    // walkers/slots are fixed for this mount (the page keys the hall by group).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openArtwork(art: Artwork, i: number) {
    const me = walkers.find((w) => w.isMe);
    if (me) walkTo(me.id, frameX(i));
    setSelected(art);
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-line shadow-sm [scrollbar-width:thin]">
        <div
          className="relative h-[420px] md:h-[480px]"
          style={{ width: `max(100%, ${slots * FRAME_SPACING}px)` }}
        >
          {/* wall + floor */}
          <div className="absolute inset-x-0 top-0 h-[64%] bg-gradient-to-b from-[#fbf8f2] to-[#efe7da]" />
          <div className="absolute inset-x-0 top-[64%] h-1.5 bg-[#d8ccb8]" />
          <div className="absolute inset-x-0 bottom-0 top-[calc(64%+6px)] bg-gradient-to-b from-[#ddd0ba] to-[#cdbd9f]" />

          {/* artworks */}
          {Array.from({ length: slots }, (_, i) => {
            const art = artworks[i];
            return (
              <div
                key={art?.id ?? `empty-${i}`}
                className="absolute top-[9%] flex -translate-x-1/2 flex-col items-center"
                style={{ left: `${frameX(i)}%` }}
              >
                <div className="pointer-events-none absolute -top-8 h-40 w-48 rounded-full bg-[radial-gradient(ellipse_at_top,rgba(255,244,214,0.75),transparent_70%)]" />
                {art ? (
                  <button
                    type="button"
                    onClick={() => openArtwork(art, i)}
                    className="relative rounded-[3px] border-[7px] border-[#b48a4c] bg-white p-2 shadow-[0_8px_18px_rgba(60,45,25,0.28)] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
                    aria-label={`${art.author}의 작품 보기`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={art.url} alt="" className="h-32 w-32 object-cover md:h-36 md:w-36" />
                  </button>
                ) : (
                  <div className="relative flex h-[164px] w-[164px] items-center justify-center rounded-[3px] border-2 border-dashed border-[#d6c9b3] text-[11px] text-[#b3a58d] md:h-[180px] md:w-[180px]">
                    다음 작품을 기다려요
                  </div>
                )}
                {art && (
                  <p className="relative mt-2 rounded-sm bg-white/90 px-2 py-0.5 text-[10px] text-ink shadow-sm">
                    {art.author} · {art.date}
                  </p>
                )}
              </div>
            );
          })}

          {/* visitors */}
          {walkers.map((w, i) => {
            const pos = positions[w.id];
            if (!pos) return null;
            return (
              <div
                key={w.id}
                className="absolute flex -translate-x-1/2 flex-col items-center ease-linear"
                style={{
                  left: `${pos.x}%`,
                  // Stagger depth so overlapping visitors read as a crowd.
                  bottom: `${6 + (i % 3) * 6}%`,
                  zIndex: 10 + (2 - (i % 3)),
                  transitionProperty: "left",
                  transitionDuration: `${pos.duration}s`,
                }}
              >
                <div
                  className={pos.walking ? "walker-bob" : ""}
                  style={{ transform: pos.facingLeft ? "scaleX(-1)" : undefined }}
                >
                  <Avatar avatarId={w.avatarId} size={w.isMe ? 72 : 62} />
                </div>
                <span
                  className={`mt-0.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] ${
                    w.isMe ? "bg-sage text-white" : "bg-white/85 text-ink"
                  }`}
                >
                  {w.isMe ? "나" : w.nickname}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {artworks.length === 0 && (
        <p className="text-center text-sm text-muted">아직 전시된 작품이 없어요. 첫 작품을 걸어보세요!</p>
      )}

      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${selected.author}의 작품`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-card shadow-xl md:flex-row"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center bg-bg md:w-3/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selected.url} alt={`${selected.author}의 작품`} className="max-h-[55dvh] w-full object-contain md:max-h-[80dvh]" />
            </div>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-ink">{selected.author}</p>
                  <p className="text-xs text-muted">{selected.date}</p>
                </div>
                <button type="button" onClick={() => setSelected(null)} aria-label="닫기" className="text-muted">
                  <X size={20} />
                </button>
              </div>
              {selected.body ? (
                <p className="whitespace-pre-wrap font-serif text-sm leading-loose text-ink">{selected.body}</p>
              ) : (
                <p className="text-sm text-muted">작품으로만 마음을 전했어요.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
