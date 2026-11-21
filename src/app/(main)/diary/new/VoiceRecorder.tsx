"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { VOICE_BUCKET } from "@/lib/storage";
import { playSfx } from "@/lib/sfx";
import { summarizeVoiceTranscript } from "../actions";

type Status = "idle" | "recording" | "uploading" | "summarizing" | "done" | "error";

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
}

function extFor(mimeType: string) {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

// Minimal shape of the bits of the Web Speech API this component actually
// uses - the DOM lib doesn't ship types for it, and it only exists as the
// vendor-prefixed `webkitSpeechRecognition` outside of a few browsers.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function VoiceRecorder({
  userId,
  onAudioPath,
  onSummary,
}: {
  userId: string;
  onAudioPath: (path: string | null) => void;
  onSummary: (result: { title: string; summary: string; transcript: string }) => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [liveText, setLiveText] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  // Only ever read once an actual recording exists (post-interaction), so
  // computing it straight from the browser on every render is fine - it
  // can't cause a hydration mismatch since nothing during the initial
  // server/client render depends on it.
  const speechSupported = getSpeechRecognitionCtor() !== null;

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewRef = useRef<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const keepListening = useRef(false);
  const transcriptRef = useRef("");

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function stopRecognition() {
    keepListening.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      // already stopped - fine
    }
  }

  // If the user navigates away mid-recording, don't leave the mic (or
  // speech recognition) running.
  useEffect(
    () => () => {
      stopTimer();
      stopStream();
      stopRecognition();
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  function startRecognition() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          transcriptRef.current += (transcriptRef.current ? " " : "") + text.trim();
        } else {
          interim += text;
        }
      }
      setLiveText(interim);
    };
    recognition.onerror = () => {
      // "no-speech" / transient network hiccups are routine during a long
      // recording - onend's auto-restart (below) is what actually recovers.
    };
    recognition.onend = () => {
      if (!keepListening.current) return;
      try {
        recognition.start();
      } catch {
        // ignore - a stray onend right after our own stop() call
      }
    };
    recognitionRef.current = recognition;
    keepListening.current = true;
    try {
      recognition.start();
    } catch {
      // ignore - rare double-start
    }
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      transcriptRef.current = "";
      setLiveText("");
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stopStream();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        previewRef.current = URL.createObjectURL(blob);
        setPreviewUrl(previewRef.current);
        void uploadAndSummarize(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      startRecognition();
      setElapsed(0);
      setStatus("recording");
      playSfx("success");
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setError("마이크 권한을 허용해주세요.");
    }
  }

  function stopRecording() {
    stopTimer();
    stopRecognition();
    mediaRecorderRef.current?.stop();
  }

  async function uploadAndSummarize(blob: Blob) {
    setStatus("uploading");
    try {
      const path = `${userId}/${crypto.randomUUID()}.${extFor(blob.type)}`;
      const { error: uploadError } = await createClient()
        .storage.from(VOICE_BUCKET)
        .upload(path, blob, { contentType: blob.type || "audio/webm" });
      if (uploadError) throw new Error(uploadError.message);
      onAudioPath(path);

      const finalTranscript = transcriptRef.current.trim();
      setTranscript(finalTranscript || null);
      if (!finalTranscript) {
        setStatus("done");
        setError(
          speechSupported
            ? "받아쓰기 결과가 없어서 자동 요약은 건너뛰었어요. 제목과 글을 직접 적어주세요."
            : "이 브라우저는 실시간 받아쓰기를 지원하지 않아요 (Chrome을 권장해요). 녹음은 저장됐으니 제목과 글을 직접 적어주세요.",
        );
        return;
      }

      setStatus("summarizing");
      const result = await summarizeVoiceTranscript(finalTranscript);
      setStatus("done");
      playSfx("success");
      onSummary({ ...result, transcript: finalTranscript });
    } catch (err) {
      playSfx("error");
      setStatus("error");
      setError(
        err instanceof Error
          ? `${err.message} 녹음은 저장돼 있으니, 제목과 글을 직접 적어서 저장할 수 있어요.`
          : "요약에 실패했어요. 제목과 글을 직접 적어서 저장할 수 있어요.",
      );
    }
  }

  function reset() {
    stopTimer();
    stopStream();
    stopRecognition();
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreviewUrl(null);
    setTranscript(null);
    setLiveText("");
    setShowTranscript(false);
    setStatus("idle");
    setError(null);
    onAudioPath(null);
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="flex flex-col gap-3 px-panel p-4 md:p-6">
      <p className="text-xs text-muted">
        상담사(혹은 대화 상대)와 나눈 대화를 녹음하면, 브라우저가 실시간으로 받아쓴 글만 AI에게 보내 요약해서 아래 제목·글에
        채워 넣어요 (녹음 파일 자체는 AI에게 보내지 않아요). 녹음과 받아쓴 글은 본인만 볼 수 있어요.
      </p>

      {status === "idle" && !previewUrl && (
        <button
          type="button"
          onClick={startRecording}
          className="px-btn px-btn-green mx-auto flex items-center gap-2 px-6 py-3 text-sm"
        >
          <Mic size={16} /> 대화 녹음 시작
        </button>
      )}

      {status === "recording" && (
        <div className="flex flex-col items-center gap-2">
          <span className="font-pixel text-lg text-ink">🔴 {mm}:{ss}</span>
          {speechSupported ? (
            liveText && <p className="max-w-full truncate text-xs italic text-muted">“{liveText}”</p>
          ) : (
            <p className="text-xs text-muted">이 브라우저는 실시간 받아쓰기를 지원하지 않아요. 녹음만 저장돼요.</p>
          )}
          <button
            type="button"
            onClick={stopRecording}
            className="px-btn px-btn-cream flex items-center gap-2 px-6 py-3 text-sm"
          >
            <Square size={16} /> 녹음 종료
          </button>
        </div>
      )}

      {previewUrl && (
        <div className="flex flex-col gap-2">
          <audio controls src={previewUrl} className="w-full" />

          {(status === "uploading" || status === "summarizing") && (
            <p className="flex items-center justify-center gap-2 text-xs text-muted">
              <Loader2 size={14} className="animate-spin" />
              {status === "uploading" ? "녹음 파일을 저장하는 중..." : "받아쓴 글을 AI가 요약하는 중..."}
            </p>
          )}

          {status === "done" && transcript && (
            <div>
              <button
                type="button"
                onClick={() => setShowTranscript((v) => !v)}
                className="text-xs text-muted underline"
              >
                {showTranscript ? "받아쓴 전체 글 숨기기" : "받아쓴 전체 글 보기"}
              </button>
              {showTranscript && (
                <p className="mt-2 max-h-60 overflow-y-auto whitespace-pre-wrap rounded-lg border-2 border-outline/20 bg-bg p-3 text-xs leading-relaxed text-ink">
                  {transcript}
                </p>
              )}
            </div>
          )}

          <button type="button" onClick={reset} className="self-center text-xs text-muted underline">
            다시 녹음하기
          </button>
        </div>
      )}

      {error && <p className="text-center text-xs text-red-500">{error}</p>}
    </div>
  );
}
