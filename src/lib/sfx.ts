// Tiny 8-bit sound effects synthesized with WebAudio - no audio files.
// All sounds are triggered by user gestures, so autoplay rules never block
// them. The on/off choice is a per-device convenience kept in localStorage.

export type SfxName = "click" | "select" | "open" | "close" | "step" | "success" | "error";

const STORAGE_KEY = "meseum-sfx";
const listeners = new Set<(muted: boolean) => void>();
let ctx: AudioContext | null = null;
let muted: boolean | null = null;

export function isMuted() {
  if (muted === null) {
    try {
      muted = localStorage.getItem(STORAGE_KEY) === "off";
    } catch {
      muted = false;
    }
  }
  return muted;
}

export function setMuted(next: boolean) {
  muted = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? "off" : "on");
  } catch {
    // storage blocked - keep the in-memory choice for this visit
  }
  listeners.forEach((fn) => fn(next));
}

export function subscribeMuted(fn: (muted: boolean) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type Note = { f: number; to?: number; at?: number; dur: number; type?: OscillatorType; vol?: number };

function tones(notes: Note[]) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  for (const n of notes) {
    const start = now + (n.at ?? 0);
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = n.type ?? "square";
    osc.frequency.setValueAtTime(n.f, start);
    if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, start + n.dur);
    const vol = n.vol ?? 0.045;
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + n.dur + 0.02);
  }
}

const SOUNDS: Record<SfxName, Note[]> = {
  click: [{ f: 660, to: 880, dur: 0.05 }],
  select: [{ f: 990, dur: 0.04, vol: 0.035 }],
  open: [
    { f: 523, dur: 0.06 },
    { f: 784, at: 0.06, dur: 0.08 },
  ],
  close: [{ f: 620, to: 380, dur: 0.08 }],
  step: [{ f: 170, to: 120, dur: 0.035, type: "triangle", vol: 0.06 }],
  success: [
    { f: 523, dur: 0.07 },
    { f: 659, at: 0.07, dur: 0.07 },
    { f: 784, at: 0.14, dur: 0.07 },
    { f: 1047, at: 0.21, dur: 0.16 },
  ],
  error: [
    { f: 220, dur: 0.09, type: "sawtooth", vol: 0.035 },
    { f: 165, at: 0.1, dur: 0.14, type: "sawtooth", vol: 0.035 },
  ],
};

export function playSfx(name: SfxName) {
  if (isMuted()) return;
  try {
    tones(SOUNDS[name]);
  } catch {
    // audio unavailable - sounds are decoration only
  }
}
