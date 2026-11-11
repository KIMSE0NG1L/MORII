"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, Trash2, X } from "lucide-react";
import PixelAvatar from "@/components/PixelAvatar";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/diary";
import { playSfx } from "@/lib/sfx";
import { addComment, deleteComment, toggleLike } from "./actions";

type Comment = { id: string; body: string; author: string; createdAt: string; canDelete: boolean };
type Artwork = {
  id: string;
  url: string;
  body: string;
  date: string;
  author: string;
  likeCount: number;
  likedByMe: boolean;
  comments: Comment[];
};
type Walker = { id: string; nickname: string; avatarId: string; isMe: boolean };
type Visitor = { id: string; nickname: string; avatarId: string; x: number };

const FRAME_SPACING = 240; // px of wall per artwork
const MIN_SLOTS = 4;
const SPEED_PX = 260; // walking speed, px per second
const NEAR = 0.38; // how close (in frame widths) counts as "in front of" an artwork

export default function ExhibitionHall({
  groupId,
  artworks: initialArtworks,
  walkers,
}: {
  groupId: string;
  artworks: Artwork[];
  walkers: Walker[];
}) {
  const [artworks, setArtworks] = useState(initialArtworks);
  const slots = Math.max(MIN_SLOTS, artworks.length);
  const hallPx = slots * FRAME_SPACING;
  const frameX = useCallback((i: number) => ((i + 0.5) / slots) * 100, [slots]);
  const speedPct = (SPEED_PX / hallPx) * 100;

  const me = walkers.find((w) => w.isMe);
  const [myX, setMyX] = useState(() => frameX(0) - 6);
  const [walking, setWalking] = useState(false);
  const [facingLeft, setFacingLeft] = useState(false);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = artworks.find((a) => a.id === selectedId) ?? null;

  const xRef = useRef(myX);
  const keysRef = useRef({ left: false, right: false });
  const targetRef = useRef<{ x: number; then?: () => void } | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastStepSfx = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const lastSent = useRef(0);

  // ---- presence: who's in the hall right now, and where ----
  const announce = useCallback(
    (force = false) => {
      const ch = channelRef.current;
      if (!ch || !me) return;
      const now = performance.now();
      if (!force && now - lastSent.current < 250) return;
      lastSent.current = now;
      void ch.track({ nickname: me.nickname, avatarId: me.avatarId, x: xRef.current });
    },
    [me],
  );

  useEffect(() => {
    if (!me) return;
    const supabase = createClient();
    const channel = supabase.channel(`meseum:${groupId}`, { config: { presence: { key: me.id } } });
    channelRef.current = channel;
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ nickname: string; avatarId: string; x: number }>();
        setVisitors(
          Object.entries(state)
            .filter(([id]) => id !== me.id)
            .map(([id, metas]) => {
              const m = metas[metas.length - 1];
              return { id, nickname: m.nickname, avatarId: m.avatarId, x: m.x };
            }),
        );
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") announce(true);
      });
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [groupId, me, announce]);

  // ---- movement loop (keys held, or walking to a clicked target) ----
  const tick = useCallback(
    function step(prev: number) {
      const now = performance.now();
      const dt = Math.min(0.05, (now - prev) / 1000);
      const { left, right } = keysRef.current;
      let dir = 0;
      if (left !== right) {
        dir = left ? -1 : 1;
        targetRef.current = null;
      } else if (targetRef.current) {
        const dx = targetRef.current.x - xRef.current;
        if (Math.abs(dx) < speedPct * dt * 1.2) {
          xRef.current = targetRef.current.x;
          const then = targetRef.current.then;
          targetRef.current = null;
          then?.();
        } else dir = Math.sign(dx);
      }

      if (dir !== 0) {
        xRef.current = Math.min(97, Math.max(3, xRef.current + dir * speedPct * dt));
        setFacingLeft(dir < 0);
        if (now - lastStepSfx.current > 200) {
          playSfx("step");
          lastStepSfx.current = now;
        }
      }
      setMyX(xRef.current);
      announce();

      if (dir !== 0 || targetRef.current) {
        setWalking(true);
        rafRef.current = requestAnimationFrame(() => step(now));
      } else {
        setWalking(false);
        rafRef.current = null;
        announce(true);
      }
    },
    [speedPct, announce],
  );

  const startLoop = useCallback(() => {
    if (rafRef.current === null) {
      const t = performance.now();
      rafRef.current = requestAnimationFrame(() => tick(t));
    }
  }, [tick]);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  function walkTo(x: number, then?: () => void) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      xRef.current = x;
      setMyX(x);
      announce(true);
      then?.();
      return;
    }
    targetRef.current = { x: Math.min(97, Math.max(3, x)), then };
    startLoop();
  }

  const nearestIndex = artworks.findIndex((_, i) => Math.abs(frameX(i) - myX) < (NEAR * 100) / slots);

  const openArtwork = useCallback(
    (i: number) => {
      const art = artworks[i];
      if (!art) return;
      playSfx("open");
      setSelectedId(art.id);
    },
    [artworks],
  );

  // keyboard: arrows / A-D to walk, Enter / Space to look at the artwork in front
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (selectedId || (e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keysRef.current.left = true;
      else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keysRef.current.right = true;
      else if ((e.key === "Enter" || e.key === " ") && nearestIndex >= 0) {
        e.preventDefault();
        openArtwork(nearestIndex);
        return;
      } else return;
      e.preventDefault();
      startLoop();
    }
    function up(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keysRef.current.left = false;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keysRef.current.right = false;
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [selectedId, nearestIndex, openArtwork, startLoop]);

  // keep my character in view while walking through a long hall
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const px = (myX / 100) * el.scrollWidth;
    if (px < el.scrollLeft + 60 || px > el.scrollLeft + el.clientWidth - 60) {
      el.scrollTo({ left: px - el.clientWidth / 2, behavior: "smooth" });
    }
  }, [myX]);

  function onFloorClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    walkTo(((e.clientX - rect.left) / rect.width) * 100);
  }

  // ---- likes & guestbook (optimistic where safe) ----
  function patchArt(id: string, fn: (a: Artwork) => Artwork) {
    setArtworks((list) => list.map((a) => (a.id === id ? fn(a) : a)));
  }

  async function onLike(art: Artwork) {
    playSfx(art.likedByMe ? "select" : "success");
    patchArt(art.id, (a) => ({ ...a, likedByMe: !a.likedByMe, likeCount: a.likeCount + (a.likedByMe ? -1 : 1) }));
    try {
      const res = await toggleLike(art.id);
      patchArt(art.id, (a) => ({ ...a, likedByMe: res.liked, likeCount: res.count }));
    } catch {
      playSfx("error");
      patchArt(art.id, () => art);
    }
  }

  return (
    <>
      <div ref={scrollRef} className="relative overflow-x-auto rounded-xl border-[3px] border-outline shadow-[0_4px_0_var(--color-outline)] [scrollbar-width:thin]">
        <div className="relative h-[420px] md:h-[480px]" style={{ width: `max(100%, ${hallPx}px)` }}>
          {/* wall + floor */}
          <div className="absolute inset-x-0 top-0 h-[64%] bg-[#f7efd9] bg-[repeating-linear-gradient(90deg,transparent_0_28px,rgba(160,138,104,0.12)_28px_32px)]" />
          <div className="absolute inset-x-0 top-[64%] h-2.5 border-y-2 border-outline bg-wood" />
          <div
            onClick={onFloorClick}
            className="absolute inset-x-0 bottom-0 top-[calc(64%+10px)] cursor-pointer bg-[#c99a62] bg-[repeating-linear-gradient(0deg,transparent_0_22px,rgba(59,42,26,0.22)_22px_24px)]"
            aria-label="바닥 - 눌러서 이동"
          />

          {/* online badge */}
          <div className="pointer-events-none sticky left-2 top-2 z-30 inline-flex items-center gap-1.5 rounded-md border-2 border-outline bg-card px-2 py-1 font-pixel text-[11px] font-bold text-ink">
            <span className="h-2 w-2 rounded-full bg-[#4caf50] shadow-[0_0_0_2px_#c8e6c9]" />
            {visitors.length + 1}명 감상 중
          </div>

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
                    data-sfx="none"
                    onClick={() => walkTo(frameX(i), () => openArtwork(i))}
                    className={`relative rounded-[3px] border-[6px] border-wood bg-white p-2 outline-2 outline-outline shadow-[0_5px_0_var(--color-outline)] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sage ${
                      nearestIndex === i ? "ring-4 ring-[#ffe08a]" : ""
                    }`}
                    aria-label={`${art.author}의 작품 보기`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={art.url} alt="" className="h-32 w-32 object-cover md:h-36 md:w-36" />
                  </button>
                ) : (
                  <div className="relative flex h-[164px] w-[164px] items-center justify-center rounded-[3px] border-[3px] border-dashed border-[#c9b48e] font-pixel text-[11px] text-[#a08a68] md:h-[180px] md:w-[180px]">
                    다음 작품을 기다려요
                  </div>
                )}
                {art && (
                  <p className="relative mt-2 flex items-center gap-1.5 rounded-sm border-2 border-outline bg-card px-2 py-0.5 font-pixel text-[10px] text-ink">
                    {art.author} · {art.date}
                    <span className="flex items-center gap-0.5 text-[#c8553d]">
                      <Heart size={10} fill={art.likedByMe ? "currentColor" : "none"} /> {art.likeCount}
                    </span>
                    {art.comments.length > 0 && <span>💬 {art.comments.length}</span>}
                  </p>
                )}
              </div>
            );
          })}

          {/* other visitors (live) */}
          {visitors.map((v, i) => (
            <div
              key={v.id}
              className="pointer-events-none absolute flex -translate-x-1/2 flex-col items-center"
              style={{
                left: `${v.x}%`,
                bottom: `${10 + (i % 2) * 6}%`,
                zIndex: 10 + (i % 2),
                transition: "left 0.35s linear",
              }}
            >
              <PixelAvatar avatarId={v.avatarId} className="w-10" />
              <span className="mt-0.5 whitespace-nowrap rounded-md border-2 border-outline bg-card px-1.5 py-0.5 font-pixel text-[10px] text-ink">
                {v.nickname}
              </span>
            </div>
          ))}

          {/* me */}
          {me && (
            <div
              className="pointer-events-none absolute bottom-[6%] z-20 flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${myX}%` }}
            >
              {nearestIndex >= 0 && !walking && (
                <button
                  type="button"
                  data-sfx="none"
                  onClick={() => openArtwork(nearestIndex)}
                  className="px-btn px-btn-cream pointer-events-auto mb-1 whitespace-nowrap px-2 py-1 text-[11px] motion-safe:animate-[bubble-float_2.4s_ease-in-out_infinite]"
                >
                  🔍 감상하기
                </button>
              )}
              <div style={{ transform: facingLeft ? "scaleX(-1)" : undefined }}>
                <PixelAvatar avatarId={me.avatarId} walking={walking} className="w-12" />
              </div>
              <span className="mt-0.5 whitespace-nowrap rounded-md border-2 border-outline bg-sage px-1.5 py-0.5 font-pixel text-[10px] text-white">
                나
              </span>
            </div>
          )}
        </div>
      </div>

      {artworks.length === 0 && (
        <p className="text-center text-sm text-muted">아직 전시된 작품이 없어요. 첫 작품을 걸어보세요!</p>
      )}

      {selected && (
        <ArtworkDialog
          art={selected}
          onClose={() => {
            playSfx("close");
            setSelectedId(null);
          }}
          onLike={() => onLike(selected)}
          onComment={(c) => patchArt(selected.id, (a) => ({ ...a, comments: [...a.comments, c] }))}
          onDeleteComment={(id) => patchArt(selected.id, (a) => ({ ...a, comments: a.comments.filter((c) => c.id !== id) }))}
        />
      )}
    </>
  );
}

function ArtworkDialog({
  art,
  onClose,
  onLike,
  onComment,
  onDeleteComment,
}: {
  art: Artwork;
  onClose: () => void;
  onLike: () => void;
  onComment: (c: Comment) => void;
  onDeleteComment: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const c = await addComment(art.id, draft);
      onComment({ ...c, canDelete: true });
      setDraft("");
      playSfx("success");
    } catch (err) {
      playSfx("error");
      setError(err instanceof Error ? err.message : "남기지 못했어요.");
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("이 방명록을 지울까요?")) return;
    try {
      await deleteComment(id);
      onDeleteComment(id);
    } catch {
      playSfx("error");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${art.author}의 작품`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="px-panel flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center border-b-[3px] border-outline bg-[#f6efdc] md:w-3/5 md:border-b-0 md:border-r-[3px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={art.url} alt={`${art.author}의 작품`} className="max-h-[40dvh] w-full object-contain md:max-h-[80dvh]" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-pixel text-base font-bold text-ink">{art.author}</p>
              <p className="text-xs text-muted">{art.date}</p>
            </div>
            <button type="button" data-sfx="none" onClick={onClose} aria-label="닫기" className="px-tool h-8 w-8 text-muted">
              <X size={18} />
            </button>
          </div>
          {art.body ? (
            <p className="whitespace-pre-wrap font-serif text-sm leading-loose text-ink">{art.body}</p>
          ) : (
            <p className="text-sm text-muted">작품으로만 마음을 전했어요.</p>
          )}

          <button
            type="button"
            data-sfx="none"
            onClick={onLike}
            aria-pressed={art.likedByMe}
            className={`px-btn w-fit gap-1.5 px-3 py-1.5 text-sm ${art.likedByMe ? "bg-[#f8d7d0] text-[#b23c26]" : "px-btn-cream"}`}
          >
            <Heart size={16} fill={art.likedByMe ? "currentColor" : "none"} /> 공감 {art.likeCount}
          </button>

          <div className="flex flex-col gap-2 border-t-2 border-dashed border-outline/25 pt-3">
            <p className="px-label text-xs text-ink">💬 방명록</p>
            {art.comments.length === 0 ? (
              <p className="text-xs text-muted">첫 응원의 한 줄을 남겨주세요.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {art.comments.map((c) => (
                  <li key={c.id} className="rounded-md border-2 border-outline/20 bg-white px-2.5 py-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-pixel font-bold text-ink">{c.author}</span>
                      <span className="flex items-center gap-1.5 text-[10px] text-muted">
                        {formatDateTime(c.createdAt)}
                        {c.canDelete && (
                          <button type="button" onClick={() => remove(c.id)} aria-label="방명록 삭제" className="hover:text-[#b23c26]">
                            <Trash2 size={11} />
                          </button>
                        )}
                      </span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-ink/90">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={submit} className="flex gap-1.5">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={200}
                placeholder="따뜻한 한 줄을 남겨보세요"
                className="px-input min-w-0 flex-1 px-2.5 py-1.5 text-xs"
              />
              <button type="submit" data-sfx="none" disabled={sending || !draft.trim()} className="px-btn px-btn-green shrink-0 px-3 py-1.5 text-xs">
                {sending ? "..." : "남기기"}
              </button>
            </form>
            {error && <p className="text-xs text-[#b23c26]">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
