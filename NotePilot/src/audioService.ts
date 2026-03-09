// Audio Service for NotePilot
// - Microphone: Web Speech API (your voice)
// - System audio: Rust WASAPI loopback → Gemini transcription (others' voices)

import { invoke } from "@tauri-apps/api/core";

const GEMINI_API_KEY = "AIzaSyCSUGXTpci6F4pJSwn_LLJXzw8n41dTiwI";

export interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: string;
  isFinal: boolean;
  source: "mic" | "system";
}

export type AudioStatus = "idle" | "requesting" | "listening" | "paused" | "stopped" | "error";

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  const w = window as unknown as Record<string, unknown>;
  return (
    (w["SpeechRecognition"] as new () => SpeechRecognitionInstance) ||
    (w["webkitSpeechRecognition"] as new () => SpeechRecognitionInstance) ||
    null
  );
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognition() !== null;
}

async function transcribeWithGemini(base64Wav: string): Promise<string> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: "audio/wav", data: base64Wav } },
              { text: "Transcribe this audio accurately. Return only the spoken words, nothing else. If silence or no speech, return empty string." },
            ],
          }],
          generationConfig: { temperature: 0 },
        }),
      }
    );
    if (!response.ok) return "";
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    if (text.length < 2) return "";
    return text;
  } catch {
    return "";
  }
}

export class AudioRecorder {
  private recognition: SpeechRecognitionInstance | null = null;
  private mediaStream: MediaStream | null = null;
  private isRunning = false;
  private isPaused = false;
  private systemAudioPollInterval: ReturnType<typeof setInterval> | null = null;
  private systemAudioAvailable = false;

  onTranscript: ((segment: TranscriptSegment) => void) | null = null;
  onStatusChange: ((status: AudioStatus) => void) | null = null;
  onError: ((error: string) => void) | null = null;

  private generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  private getTimestamp = () => new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  private async startSystemAudio(): Promise<void> {
    try {
      await invoke("start_system_audio");
      this.systemAudioAvailable = true;
      this.systemAudioPollInterval = setInterval(async () => {
        if (this.isPaused || !this.isRunning) return;
        try {
          const base64Chunk = await invoke<string | null>("get_audio_chunk");
          if (!base64Chunk) return;
          const text = await transcribeWithGemini(base64Chunk);
          if (!text) return;
          this.onTranscript?.({
            id: this.generateId(),
            text,
            timestamp: this.getTimestamp(),
            isFinal: true,
            source: "system",
          });
        } catch { /* ignore */ }
      }, 5000);
    } catch {
      this.systemAudioAvailable = false;
    }
  }

  private stopSystemAudio(): void {
    if (this.systemAudioPollInterval) {
      clearInterval(this.systemAudioPollInterval);
      this.systemAudioPollInterval = null;
    }
    if (this.systemAudioAvailable) {
      invoke("stop_system_audio").catch(() => {});
      this.systemAudioAvailable = false;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      this.onError?.("Speech recognition not supported.");
      this.onStatusChange?.("error");
      return;
    }
    this.onStatusChange?.("requesting");
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this.onError?.("Microphone access denied.");
      this.onStatusChange?.("error");
      return;
    }

    await this.startSystemAudio();

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";
    this.recognition.maxAlternatives = 1;
    let interimId = this.generateId();

    this.recognition.onstart = () => {
      this.isRunning = true;
      this.onStatusChange?.("listening");
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (this.isPaused) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();
        if (!text) continue;
        if (result.isFinal) {
          this.onTranscript?.({ id: interimId, text, timestamp: this.getTimestamp(), isFinal: true, source: "mic" });
          interimId = this.generateId();
        } else {
          this.onTranscript?.({ id: interimId, text, timestamp: this.getTimestamp(), isFinal: false, source: "mic" });
        }
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      this.onError?.(`Mic error: ${event.error}`);
    };

    this.recognition.onend = () => {
      if (this.isRunning && !this.isPaused) {
        try { this.recognition?.start(); } catch { /* already starting */ }
      }
    };

    try { this.recognition.start(); } catch {
      this.onError?.("Failed to start microphone.");
      this.onStatusChange?.("error");
    }
  }

  pause(): void {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    this.recognition?.stop();
    this.onStatusChange?.("paused");
  }

  resume(): void {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    try { this.recognition?.start(); } catch { /* may already be starting */ }
    this.onStatusChange?.("listening");
  }

  stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    this.recognition?.abort();
    this.recognition = null;
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    this.stopSystemAudio();
    this.onStatusChange?.("stopped");
  }

  get running() { return this.isRunning; }
  get paused() { return this.isPaused; }
  get hasSystemAudio() { return this.systemAudioAvailable; }
}