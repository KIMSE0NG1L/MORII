// Gentle looping 8-bit background music, synthesized with WebAudio (no files).
// Off by default. Browsers only allow audio after a user gesture, so a saved
// "on" preference starts playing at the first click of the visit.

const STORAGE_KEY = "meseum-bgm";
const listeners = new Set<() => void>();
let enabled: boolean | null = null;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: number | null = null;
let nextTime = 0;
let step = 0;

const BPM = 76;
const BEAT = 60 / BPM / 2; // eighth notes

// C-major pentatonic lullaby; null = rest. One entry per eighth note.
const MELODY: (number | null)[] = [
  76, null, 79, null, 81, 79, 76, null, 74, null, 72, null, 74, 76, null, null,
  76, null, 79, null, 84, 81, 79, null, 76, null, 74, 76, 72, null, null, null,
  72, null, 74, null, 76, 79, 76, null, 74, 72, 69, null, 72, null, null, null,
  67, null, 69, 72, 74, null, 76, 74, 72, null, 69, null, 72, null, null, null,
];
// Root of each bar's chord (one bar = 16 eighths).
const BASS = [48, 45, 41, 43];

const midiHz = (n: number) => 440 * 2 ** ((n - 69) / 12);

export function isBgmOn() {
  if (enabled === null) {
    try {
      enabled = localStorage.getItem(STORAGE_KEY) === "on";
    } catch {
      enabled = false;
    }
  }
  return enabled;
}

export function subscribeBgm(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function note(freq: number, at: number, dur: number, type: OscillatorType, vol: number) {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(vol, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(master);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

function schedule() {
  if (!ctx) return;
  while (nextTime < ctx.currentTime + 0.4) {
    const i = step % MELODY.length;
    const m = MELODY[i];
    if (m !== null) note(midiHz(m), nextTime, BEAT * 1.8, "triangle", 0.09);
    if (i % 4 === 0) {
      const root = BASS[Math.floor(i / 16) % BASS.length];
      note(midiHz(root), nextTime, BEAT * 3.5, "sine", 0.08);
      if (i % 8 === 4) note(midiHz(root + 7), nextTime, BEAT * 2, "sine", 0.05);
    }
    nextTime += BEAT;
    step++;
  }
}

function start() {
  if (timer !== null || typeof window === "undefined") return;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    }
    void ctx.resume();
    nextTime = ctx.currentTime + 0.1;
    step = 0;
    timer = window.setInterval(schedule, 120);
    schedule();
  } catch {
    // audio unavailable - music is decoration only
  }
}

function stop() {
  if (timer !== null) window.clearInterval(timer);
  timer = null;
  void ctx?.suspend();
}

export function setBgm(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // keep the in-memory choice
  }
  if (on) start();
  else stop();
  listeners.forEach((fn) => fn());
}

/** Called on any user gesture: honors a saved "on" choice once audio is allowed. */
export function resumeBgmIfWanted() {
  if (isBgmOn() && timer === null) start();
}
