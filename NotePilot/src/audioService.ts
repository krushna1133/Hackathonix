// Audio Service for NotePilot
// Uses Web Speech API for real-time speech-to-text (free, no API key needed)
// Falls back to Gemini audio transcription if Web Speech API is unavailable

const GEMINI_API_KEY = "AIzaSyCSUGXTpci6F4pJSwn_LLJXzw8n41dTiwI";

// ─── Types ───
export interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: string;
  isFinal: boolean;
  speaker?: "you" | "other";
}

export type AudioStatus =
  | "idle"
  | "requesting"
  | "listening"
  | "paused"
  | "stopped"
  | "error";

// ─── Web Speech API type declarations ───
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
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

// Get SpeechRecognition constructor cross-browser
function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w["SpeechRecognition"] as new () => SpeechRecognitionInstance) ||
    (w["webkitSpeechRecognition"] as new () => SpeechRecognitionInstance) ||
    null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognition() !== null;
}

// ─── Audio Recorder class ───
export class AudioRecorder {
  private recognition: SpeechRecognitionInstance | null = null;
  private mediaStream: MediaStream | null = null;
  private isRunning = false;
  private isPaused = false;

  // Callbacks
  onTranscript: ((segment: TranscriptSegment) => void) | null = null;
  onStatusChange: ((status: AudioStatus) => void) | null = null;
  onError: ((error: string) => void) | null = null;

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  private getTimestamp(): string {
    return new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      this.onError?.("Speech recognition is not supported in this browser/environment.");
      this.onStatusChange?.("error");
      return;
    }

    // Request microphone permission
    this.onStatusChange?.("requesting");
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      this.onError?.("Microphone access denied. Please allow microphone access and try again.");
      this.onStatusChange?.("error");
      return;
    }

    // Setup recognition
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";
    this.recognition.maxAlternatives = 1;

    // Interim transcript id (to update same entry while speaking)
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
          // Final result — save as a proper transcript entry
          this.onTranscript?.({
            id: interimId,
            text,
            timestamp: this.getTimestamp(),
            isFinal: true,
          });
          // Reset interim id for next utterance
          interimId = this.generateId();
        } else {
          // Interim — send with same id so UI can update in place
          this.onTranscript?.({
            id: interimId,
            text,
            timestamp: this.getTimestamp(),
            isFinal: false,
          });
        }
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") return; // ignore silence
      if (event.error === "aborted") return;   // ignore manual stop
      this.onError?.(`Speech recognition error: ${event.error}`);
      if (event.error === "not-allowed") {
        this.onStatusChange?.("error");
      }
    };

    this.recognition.onend = () => {
      // Auto-restart if we're still supposed to be running and not paused
      if (this.isRunning && !this.isPaused) {
        try {
          this.recognition?.start();
        } catch {
          // already started
        }
      }
    };

    try {
      this.recognition.start();
    } catch (err) {
      this.onError?.("Failed to start speech recognition.");
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
    try {
      this.recognition?.start();
    } catch {
      // may already be starting
    }
    this.onStatusChange?.("listening");
  }

  stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    this.recognition?.abort();
    this.recognition = null;
    // Stop microphone tracks
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    this.onStatusChange?.("stopped");
  }

  get running(): boolean {
    return this.isRunning;
  }

  get paused(): boolean {
    return this.isPaused;
  }
}

// ─── Gemini audio transcription (for recorded audio blobs) ───
export async function transcribeAudioWithGemini(audioBlob: Blob): Promise<string> {
  // Convert blob to base64
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: audioBlob.type || "audio/webm",
                  data: base64,
                },
              },
              {
                text: "Transcribe this audio exactly as spoken. Return only the transcription text, nothing else.",
              },
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini transcription failed: ${response.status}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}