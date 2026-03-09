import { useState, useRef, useEffect, useCallback } from "react";
import {
  sendChatMessage,
  getAssist,
  getSuggestion,
  getFollowUps,
  getRecap,
  getTimestamp,
  generateId,
  type ChatMessage,
  type MinuteEntry,
} from "./aiService";
import {
  AudioRecorder,
  isSpeechRecognitionSupported,
  type TranscriptSegment,
  type AudioStatus,
} from "./audioService";
import { downloadMeetingPDF } from "./pdfService";
import "./App.css";

// ─── SVG Icons ───
const Eye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
const Pause = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
  </svg>
);
const Play = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);
const Square = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
  </svg>
);
const Mic = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </svg>
);
const ChevronUp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m18 15-6-6-6 6" />
  </svg>
);
const ChevronDown = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const GripVertical = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="5" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="9" cy="19" r="1.5" />
    <circle cx="15" cy="5" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="15" cy="19" r="1.5" />
  </svg>
);
const X = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
  </svg>
);
const Home = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const Send = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
  </svg>
);
const Plus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14" /><path d="M5 12h14" />
  </svg>
);
const Trash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
  </svg>
);
// NEW: Download PDF icon
const DownloadPdf = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="12" x2="12" y2="18" />
    <polyline points="9 15 12 18 15 15" />
  </svg>
);

function App() {
  // ─── Core State ───
  const [activeTab, setActiveTab] = useState<"chat" | "transcript">("chat");
  const [inputText, setInputText] = useState("");

  // Audio / recording state
  const [audioStatus, setAudioStatus] = useState<AudioStatus>("idle");
  const [isSupported] = useState(() => isSpeechRecognitionSupported());

  // UI state
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isStealthMode, setIsStealthMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Meeting minutes (manual entries)
  const [minutes, setMinutes] = useState<MinuteEntry[]>([]);

  // Live transcript segments from speech recognition
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);

  // AI Chat
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: generateId(),
      role: "system",
      text: "👋 Welcome to NotePilot! Click 🎤 to start recording. Spoken words will appear in the Transcript tab automatically. You can also type minutes manually.",
      timestamp: getTimestamp(),
    },
  ]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // PDF export state
  const [isPdfExporting, setIsPdfExporting] = useState(false);

  // Panel resize
  const [panelHeight, setPanelHeight] = useState<number | null>(null);

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);

  // Resize refs
  const isResizing = useRef(false);
  const resizeStart = useRef({ y: 0, height: 0 });

  // ─── Initialize AudioRecorder once ───
  useEffect(() => {
    const recorder = new AudioRecorder();

    recorder.onStatusChange = (status: AudioStatus) => {
      setAudioStatus(status);
      if (status === "listening") showToast("🎤 Listening...");
      if (status === "paused") showToast("⏸️ Recording paused");
      if (status === "stopped") showToast("⏹️ Recording stopped");
      if (status === "error") showToast("❌ Mic error — check permissions");
    };

    recorder.onTranscript = (segment: TranscriptSegment) => {
      setTranscriptSegments((prev) => {
        const exists = prev.findIndex((s) => s.id === segment.id);
        if (exists !== -1) {
          const updated = [...prev];
          updated[exists] = segment;
          return updated;
        }
        return [...prev, segment];
      });

      if (segment.isFinal && segment.text.trim().length > 3) {
        setMinutes((prev) => [
          ...prev,
          {
            id: generateId(),
            text: segment.text.trim(),
            timestamp: segment.timestamp,
          },
        ]);
      }
    };

    recorder.onError = (error: string) => {
      showToast(`❌ ${error}`);
    };

    recorderRef.current = recorder;

    return () => {
      recorder.stop();
    };
  }, []);

  // ─── Toast Helper ───
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // ─── Auto-scroll ───
  useEffect(() => {
    if (activeTab === "chat") chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTab]);

  useEffect(() => {
    if (activeTab === "transcript") transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [minutes, transcriptSegments, activeTab]);

  // ─── Window resize drag ───
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing.current) {
        const delta = e.clientY - resizeStart.current.y;
        const newHeight = Math.max(120, Math.min(800, resizeStart.current.height + delta));
        setPanelHeight(newHeight);
      }
    };
    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const currentHeight = panelRef.current?.getBoundingClientRect().height || 400;
    resizeStart.current = { y: e.clientY, height: currentHeight };
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
  }, []);

  // ─── Audio Controls ───
  const handleStartRecording = async () => {
    if (!isSupported) {
      showToast("❌ Speech recognition not supported in this browser");
      return;
    }
    await recorderRef.current?.start();
    setActiveTab("transcript");
  };

  const handleTogglePause = () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.paused) {
      recorder.resume();
    } else {
      recorder.pause();
    }
  };

  const handleStop = () => {
    recorderRef.current?.stop();
  };

  // ─── Other UI Handlers ───
  const handleToggleStealth = () => {
    setIsStealthMode((prev) => !prev);
    showToast(isStealthMode ? "🔓 Stealth mode OFF" : "🔒 Stealth mode ON");
  };

  const handleCollapse = () => setIsCollapsed((prev) => !prev);

  const handleClose = async () => {
    try {
      const { Window } = await import("@tauri-apps/api/window");
      const win = Window.getCurrent();
      await win.close();
    } catch (e) {
      console.error("Close failed:", e);
      showToast("✕ Close (only works in desktop app)");
    }
  };

  const handleHome = () => {
    setActiveTab("chat");
  };

  // ─── Add Manual Minute ───
  const addMinute = (text: string) => {
    if (!text.trim()) return;
    setMinutes((prev) => [
      ...prev,
      { id: generateId(), text: text.trim(), timestamp: getTimestamp() },
    ]);
    showToast("📝 Minute added");
  };

  const deleteMinute = (id: string) => {
    setMinutes((prev) => prev.filter((m) => m.id !== id));
    showToast("🗑️ Removed");
  };

  const clearTranscript = () => {
    setTranscriptSegments([]);
    showToast("🗑️ Transcript cleared");
  };

  // ─── PDF Export ───
  const handleDownloadPDF = async () => {
    if (isPdfExporting) return;
    const hasContent = minutes.length > 0 || messages.filter((m) => m.role !== "system").length > 0;
    if (!hasContent) {
      showToast("📄 No meeting content to export yet");
      return;
    }
    setIsPdfExporting(true);
    showToast("📄 Generating PDF...");
    try {
      await downloadMeetingPDF(messages, minutes);
      showToast("✅ PDF downloaded!");
    } catch (err) {
      console.error("PDF export failed:", err);
      showToast("❌ PDF export failed — check console");
    } finally {
      setIsPdfExporting(false);
    }
  };

  // ─── AI Interaction ───
  const sendToAi = async (prompt: string) => {
    if (!prompt.trim()) return;
    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      text: prompt.trim(),
      timestamp: getTimestamp(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsAiLoading(true);
    setActiveTab("chat");
    try {
      const response = await sendChatMessage(prompt, messages, minutes);
      setMessages((prev) => [
        ...prev,
        { id: generateId(), role: "ai", text: response, timestamp: getTimestamp() },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: generateId(), role: "ai", text: "⚠️ Something went wrong. Please try again.", timestamp: getTimestamp() },
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleActionButton = async (
    action: "assist" | "suggest" | "followup" | "recap",
    label: string
  ) => {
    setIsAiLoading(true);
    setActiveTab("chat");
    setMessages((prev) => [
      ...prev,
      { id: generateId(), role: "user", text: `✨ ${label}`, timestamp: getTimestamp() },
    ]);
    try {
      let response: string;
      if (action === "assist") response = await getAssist(messages, minutes);
      else if (action === "suggest") response = await getSuggestion(messages, minutes);
      else if (action === "followup") response = await getFollowUps(messages, minutes);
      else response = await getRecap(messages, minutes);
      setMessages((prev) => [
        ...prev,
        { id: generateId(), role: "ai", text: response, timestamp: getTimestamp() },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: generateId(), role: "ai", text: "⚠️ Could not get a response.", timestamp: getTimestamp() },
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    if (activeTab === "transcript") {
      addMinute(inputText);
    } else {
      sendToAi(inputText);
    }
    setInputText("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── Derived state ───
  const isRecording = audioStatus === "listening" || audioStatus === "paused";
  const isPaused = audioStatus === "paused";
  const isListening = audioStatus === "listening";

  const liveSegments = transcriptSegments.filter((s) => !s.isFinal);

  const hasMeetingContent =
    minutes.length > 0 || messages.filter((m) => m.role !== "system").length > 0;

  return (
    <div className="app-wrapper">
      {/* TOAST */}
      {toast && <div className="toast">{toast}</div>}

      {/* TOP PILL BAR */}
      <div data-tauri-drag-region className="top-bar-container">
        <div className="control-pill" data-tauri-drag-region>
          <button
            className="icon-btn"
            onClick={handleToggleStealth}
            title={isStealthMode ? "Disable stealth" : "Enable stealth mode"}
          >
            {isStealthMode ? <EyeOff /> : <Eye />}
          </button>

          <div className="playback-controls">
            {!isRecording && (
              <button
                className="icon-btn mic-start-btn"
                onClick={handleStartRecording}
                title={isSupported ? "Start recording" : "Speech recognition not supported"}
                disabled={!isSupported || audioStatus === "requesting"}
              >
                <Mic />
              </button>
            )}

            {isRecording && (
              <button
                className={`icon-btn ${isPaused ? "paused-btn" : ""}`}
                onClick={handleTogglePause}
                title={isPaused ? "Resume" : "Pause"}
              >
                {isPaused ? <Play /> : <Pause />}
              </button>
            )}

            {isRecording && <div className="divider-sm"></div>}

            {isRecording && (
              <button
                className="icon-btn"
                onClick={handleStop}
                title="Stop recording"
              >
                <Square />
              </button>
            )}
          </div>

          {/* Recording indicator */}
          {isListening && (
            <div className="rec-indicator">
              <span className="rec-dot"></span>
              <span className="rec-text">LIVE</span>
            </div>
          )}
          {isPaused && (
            <div className="rec-indicator paused">
              <span className="rec-dot"></span>
              <span className="rec-text">PAUSED</span>
            </div>
          )}
          {audioStatus === "requesting" && (
            <div className="rec-indicator">
              <span className="rec-text">MIC...</span>
            </div>
          )}

          {/* ─── PDF Export Button ─── */}
          <button
            className={`icon-btn pdf-export-btn ${!hasMeetingContent ? "pdf-export-btn--disabled" : ""} ${isPdfExporting ? "pdf-export-btn--loading" : ""}`}
            onClick={handleDownloadPDF}
            title={hasMeetingContent ? "Download meeting PDF" : "No meeting content yet"}
            disabled={isPdfExporting}
          >
            {isPdfExporting ? (
              <span className="pdf-spinner" />
            ) : (
              <DownloadPdf />
            )}
          </button>

          <button className="icon-btn" onClick={handleCollapse} title={isCollapsed ? "Expand" : "Collapse"}>
            {isCollapsed ? <ChevronDown /> : <ChevronUp />}
          </button>
          <div className="vertical-divider"></div>
          <button
            className="icon-btn drag-btn"
            data-tauri-drag-region
            title="Drag to move"
          >
            <GripVertical />
          </button>
        </div>
        <button className="close-btn" onClick={handleClose} title="Close">
          <X />
        </button>
      </div>

      {/* MAIN PANEL */}
      <div
        ref={panelRef}
        className={`main-panel ${isCollapsed ? "collapsed" : ""}`}
        style={panelHeight && !isCollapsed ? { height: `${panelHeight}px` } : undefined}
      >
        <div className="panel-header">
          <button className="icon-btn home-btn" onClick={handleHome} title="Home">
            <Home />
          </button>
          <div className="tabs">
            <button
              className={`tab ${activeTab === "chat" ? "active" : ""}`}
              onClick={() => setActiveTab("chat")}
            >
              Chat
            </button>
            <button
              className={`tab ${activeTab === "transcript" ? "active" : ""}`}
              onClick={() => setActiveTab("transcript")}
            >
              Transcript
              {minutes.length > 0 && (
                <span className="tab-badge">{minutes.length}</span>
              )}
            </button>
          </div>
          {activeTab === "transcript" && (transcriptSegments.length > 0 || minutes.length > 0) && (
            <button
              className="icon-btn"
              onClick={clearTranscript}
              title="Clear live transcript"
              style={{ marginLeft: "auto", opacity: 0.6 }}
            >
              <Trash />
            </button>
          )}
        </div>

        {/* ACTION BUTTONS */}
        <div className="actions-row">
          <button className="action-btn" onClick={() => handleActionButton("assist", "Assist")} disabled={isAiLoading}>
            ✨ Assist
          </button>
          <span className="dot">•</span>
          <button className="action-btn" onClick={() => handleActionButton("suggest", "What should I say?")} disabled={isAiLoading}>
            🪄 Suggest
          </button>
          <span className="dot">•</span>
          <button className="action-btn" onClick={() => handleActionButton("followup", "Follow-up questions")} disabled={isAiLoading}>
            💬 Follow-ups
          </button>
          <span className="dot">•</span>
          <button className="action-btn" onClick={() => handleActionButton("recap", "Recap")} disabled={isAiLoading}>
            ↻ Recap
          </button>
          <span className="dot">•</span>
          {/* PDF button also in action row for discoverability */}
          <button
            className={`action-btn pdf-action-btn ${isPdfExporting ? "pdf-action-btn--loading" : ""}`}
            onClick={handleDownloadPDF}
            disabled={isPdfExporting || !hasMeetingContent}
            title="Download meeting report as PDF"
          >
            {isPdfExporting ? "⏳ Exporting…" : "📄 Export PDF"}
          </button>
        </div>

        {/* CONTENT AREA */}
        <div className="content-area">
          {activeTab === "chat" ? (
            <div className="chat-messages">
              {messages.map((msg) => (
                <div key={msg.id} className={`message message-${msg.role}`}>
                  <div className="message-bubble">
                    <div className="message-text">{msg.text}</div>
                    <div className="message-time">{msg.timestamp}</div>
                  </div>
                </div>
              ))}
              {isAiLoading && (
                <div className="message message-ai">
                  <div className="message-bubble">
                    <div className="typing-indicator">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          ) : (
            <div className="transcript-list">
              {liveSegments.length > 0 && (
                <div className="live-transcript-banner">
                  <span className="live-dot"></span>
                  <span className="live-text">
                    {liveSegments[liveSegments.length - 1].text}
                  </span>
                </div>
              )}

              {minutes.length === 0 && liveSegments.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">🎤</span>
                  <p>
                    {isSupported
                      ? "Press the mic button to start recording. Speech will appear here automatically."
                      : "Speech recognition not supported. Type minutes manually below."}
                  </p>
                </div>
              ) : (
                minutes.map((minute) => (
                  <div key={minute.id} className="minute-item">
                    <div className="minute-content">
                      <span className="minute-time">{minute.timestamp}</span>
                      <span className="minute-text">{minute.text}</span>
                    </div>
                    <button
                      className="minute-delete"
                      onClick={() => deleteMinute(minute.id)}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>
          )}
        </div>

        {/* INPUT */}
        <div className="input-container">
          <div className="input-wrapper">
            {!inputText && (
              <div className="input-placeholder">
                {activeTab === "transcript" ? (
                  <><Plus /> Add a minute manually...</>
                ) : (
                  <>Ask anything about the meeting...</>
                )}
              </div>
            )}
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <button className="send-btn" onClick={handleSend} disabled={!inputText.trim() || isAiLoading}>
            <Send />
          </button>
        </div>

        {/* RESIZE HANDLE */}
        <div className="resize-handle" onMouseDown={handleResizeStart} title="Drag to resize">
          <div className="resize-bar"></div>
        </div>
      </div>
    </div>
  );
}

export default App;