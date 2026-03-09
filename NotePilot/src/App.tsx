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

function App() {
  // ─── Core State ───
  const [activeTab, setActiveTab] = useState<"chat" | "transcript">("chat");
  const [inputText, setInputText] = useState("");

  // Recording state
  const [isRecording, setIsRecording] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // UI state
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isStealthMode, setIsStealthMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Meeting minutes
  const [minutes, setMinutes] = useState<MinuteEntry[]>([]);

  // AI Chat
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: generateId(),
      role: "system",
      text: "👋 Welcome to NotePilot! I'm your AI meeting assistant. Add meeting minutes in the Transcript tab, then ask me anything or use the quick actions above.",
      timestamp: getTimestamp(),
    },
  ]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Panel resize
  const [panelHeight, setPanelHeight] = useState<number | null>(null);

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ─── Resize State ───
  const isResizing = useRef(false);
  const resizeStart = useRef({ y: 0, height: 0 });

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
  }, [minutes, activeTab]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Handle resize
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

  // ─── Resize Handler ───
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const currentHeight = panelRef.current?.getBoundingClientRect().height || 400;
    resizeStart.current = { y: e.clientY, height: currentHeight };
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
  }, []);

  // ─── Button Handlers ───
  const handleToggleStealth = () => {
    setIsStealthMode((prev) => !prev);
    showToast(isStealthMode ? "🔓 Stealth mode OFF" : "🔒 Stealth mode ON — hidden from screen capture");
  };

  const handleTogglePause = () => {
    if (!isRecording) return;
    setIsPaused((prev) => !prev);
    showToast(isPaused ? "▶️ Recording resumed" : "⏸️ Recording paused");
  };

  const handleStop = () => {
    if (!isRecording) {
      setIsRecording(true);
      setIsPaused(false);
      showToast("🔴 Recording started");
      return;
    }
    setIsRecording(false);
    setIsPaused(false);
    showToast("⏹️ Recording stopped");
  };

  const handleCollapse = () => setIsCollapsed((prev) => !prev);

  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      getCurrentWindow().close();
    } catch {
      showToast("✕ Close (only works in desktop app)");
    }
  };

  const handleHome = () => {
    setActiveTab("chat");
    showToast("🏠 Home");
  };

  // ─── Add Meeting Minute ───
  const addMinute = (text: string) => {
    if (!text.trim()) return;
    const minute: MinuteEntry = {
      id: generateId(),
      text: text.trim(),
      timestamp: getTimestamp(),
    };
    setMinutes((prev) => [...prev, minute]);
    showToast("📝 Minute added");
  };

  // ─── AI Interaction ───
  const sendToAi = async (prompt: string, isActionButton = false) => {
    if (!prompt.trim() && !isActionButton) return;

    // Add user message to chat
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
      const aiMsg: ChatMessage = {
        id: generateId(),
        role: "ai",
        text: response,
        timestamp: getTimestamp(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: generateId(),
        role: "ai",
        text: "⚠️ Something went wrong. Please try again.",
        timestamp: getTimestamp(),
      };
      setMessages((prev) => [...prev, errorMsg]);
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

    // Show what the user clicked
    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      text: `✨ ${label}`,
      timestamp: getTimestamp(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      let response: string;
      switch (action) {
        case "assist":
          response = await getAssist(messages, minutes);
          break;
        case "suggest":
          response = await getSuggestion(messages, minutes);
          break;
        case "followup":
          response = await getFollowUps(messages, minutes);
          break;
        case "recap":
          response = await getRecap(messages, minutes);
          break;
      }
      const aiMsg: ChatMessage = {
        id: generateId(),
        role: "ai",
        text: response,
        timestamp: getTimestamp(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: generateId(),
        role: "ai",
        text: "⚠️ Could not get a response. Please try again.",
        timestamp: getTimestamp(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // ─── Send Handler ───
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

  // ─── Delete Minute ───
  const deleteMinute = (id: string) => {
    setMinutes((prev) => prev.filter((m) => m.id !== id));
    showToast("🗑️ Minute removed");
  };

  return (
    <div className="app-wrapper" ref={appRef}>
      {/* TOAST */}
      {toast && <div className="toast">{toast}</div>}

      {/* TOP PILL BAR */}
      <div data-tauri-drag-region className="top-bar-container">
        <div className="control-pill" data-tauri-drag-region>
          <button
            className="icon-btn tooltip-anchor"
            onClick={handleToggleStealth}
            title={isStealthMode ? "Disable stealth" : "Enable stealth mode"}
          >
            {isStealthMode ? <EyeOff /> : <Eye />}
          </button>
          <div className="playback-controls">
            <button
              className={`icon-btn ${isPaused ? "paused-btn" : ""}`}
              onClick={handleTogglePause}
              title={isPaused ? "Resume" : "Pause"}
              disabled={!isRecording}
            >
              {isPaused ? <Play /> : <Pause />}
            </button>
            <div className="divider-sm"></div>
            <button
              className={`icon-btn ${!isRecording ? "stopped-btn" : ""}`}
              onClick={handleStop}
              title={isRecording ? "Stop recording" : "Start recording"}
            >
              <Square />
            </button>
          </div>
          {isRecording && (
            <div className={`rec-indicator ${isPaused ? "paused" : ""}`}>
              <span className="rec-dot"></span>
              <span className="rec-text">{isPaused ? "PAUSED" : "REC"}</span>
            </div>
          )}
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
        style={panelHeight && !isCollapsed ? { height: `${panelHeight}px`, flex: 'none' } : undefined}
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
            </button>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="actions-row">
          <button className="action-btn" onClick={() => handleActionButton("assist", "Assist")} disabled={isAiLoading}>
            ✨ Assist
          </button>
          <span className="dot">•</span>
          <button className="action-btn" onClick={() => handleActionButton("suggest", "What should I say?")} disabled={isAiLoading}>
            🪄 What should I say?
          </button>
          <span className="dot">•</span>
          <button className="action-btn" onClick={() => handleActionButton("followup", "Follow-up questions")} disabled={isAiLoading}>
            💬 Follow-up questions
          </button>
          <span className="dot">•</span>
          <button className="action-btn" onClick={() => handleActionButton("recap", "Recap")} disabled={isAiLoading}>
            ↻ Recap
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
              {minutes.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">📝</span>
                  <p>No minutes yet. Type below and press Enter to add meeting minutes.</p>
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
                  <>
                    <Plus /> Add a meeting minute...
                  </>
                ) : (
                  <>
                    Ask about your screen or conversation, or <kbd>^</kbd>{" "}
                    <kbd>↵</kbd> for Assist
                  </>
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
