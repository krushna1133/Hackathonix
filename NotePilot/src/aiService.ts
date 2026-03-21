const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// Rate limit tracking
const MIN_REQUEST_GAP_MS = 1500;
let lastRequestTime = 0;

const SYSTEM_PROMPT = `You are NotePilot, an AI meeting assistant running inside a compact floating desktop widget. You are listening to a live meeting in real-time and helping the user.

CORE PRINCIPLES:
- Be DIRECT and ACTIONABLE. Never waste words on filler or pleasantries.
- You have access to live meeting minutes and conversation context. USE IT.
- If you see meeting data, analyze it. Don't say "I don't have context" when you do.
- Match the language the user writes in. The meeting may be in English, Spanish, Chinese, Hindi, or any language — follow their lead.
- Keep responses to 2-4 sentences. This is a small widget, not a document.
- Use bullet points for lists, suggestions, and action items.
- Be specific. Generic advice is useless. Reference actual meeting content when available.

WHAT YOU CAN DO:
- Assist: Provide a sharp insight or recommendation based on what's happening RIGHT NOW.
- Suggest: Write what the user should say next — natural, professional, context-aware.
- Follow-ups: Generate 3-4 pointed questions the user should ask based on the discussion.
- Recap: Summarize key decisions, action items, and open items. Be structured.
- Chat: Answer any question about the meeting context conversationally.

TONE: Professional but human. Think "smart colleague whispering advice" not "corporate AI assistant."

IMPORTANT: Never say "Based on the current meeting context..." or "It seems like..." — just state the insight directly.`;

export interface ChatMessage {
  id: string;
  role: "user" | "ai" | "system";
  text: string;
  timestamp: string;
}

export interface MinuteEntry {
  id: string;
  text: string;
  timestamp: string;
}

export function getTimestamp(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function buildContext(minutes: MinuteEntry[]): string {
  if (minutes.length === 0) return "No meeting minutes recorded yet.";
  return (
    "LIVE MEETING MINUTES (most recent last):\n" +
    minutes.map((m) => `[${m.timestamp}] ${m.text}`).join("\n")
  );
}

/**
 * Respect global rate limit across all Gemini calls.
 */
async function respectRateLimit(): Promise<void> {
  const now = Date.now();
  const gap = now - lastRequestTime;
  if (gap < MIN_REQUEST_GAP_MS) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_GAP_MS - gap));
  }
  lastRequestTime = Date.now();
}

/**
 * Call Gemini with retry on 429.
 */
async function callGemini(
  userPrompt: string,
  conversationHistory: ChatMessage[],
  minutes: MinuteEntry[],
): Promise<string> {
  await respectRateLimit();

  const meetingContext = buildContext(minutes);

  const contents: { role: string; parts: { text: string }[] }[] = [];

  // System + meeting context as first message
  const systemContext = `${SYSTEM_PROMPT}\n\n---\nCURRENT MEETING CONTEXT:\n${meetingContext}\n---\n\n`;

  // Include last 15 messages for conversation continuity
  const recentHistory = conversationHistory.slice(-15);
  for (const msg of recentHistory) {
    if (msg.role === "system") continue;
    contents.push({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.text }],
    });
  }

  // Current prompt with system context
  contents.push({
    role: "user",
    parts: [{ text: systemContext + userPrompt }],
  });

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 400,
            topP: 0.9,
          },
        }),
      });

      // Rate limited — back off
      if (response.status === 429) {
        const backoff = Math.min(
          1000 * Math.pow(2, attempt) + Math.random() * 1000,
          15000,
        );
        console.warn(
          `[Gemini] 429, retry ${attempt + 1} in ${Math.round(backoff)}ms`,
        );
        await new Promise((r) => setTimeout(r, backoff));
        lastRequestTime = Date.now();
        continue;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Gemini API error:", errorData);

        if (
          response.status === 400 &&
          GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE"
        ) {
          return "⚠️ API key not set. Open `src/aiService.ts` and replace `YOUR_GEMINI_API_KEY_HERE` with your key from aistudio.google.com";
        }
        return `⚠️ API Error (${response.status}). Check your API key and try again.`;
      }

      const data = await response.json();
      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "I couldn't generate a response. Try rephrasing.";
      return text.trim();
    } catch (error) {
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        lastRequestTime = Date.now();
        continue;
      }
      console.error("Gemini fetch error:", error);
      return "⚠️ Network error. Check your connection and try again.";
    }
  }

  return "⚠️ Request failed after retries. Please wait a moment and try again.";
}

// === Public API ===

export async function sendChatMessage(
  message: string,
  history: ChatMessage[],
  minutes: MinuteEntry[],
): Promise<string> {
  return callGemini(message, history, minutes);
}

export async function getAssist(
  history: ChatMessage[],
  minutes: MinuteEntry[],
): Promise<string> {
  return callGemini(
    "What's the most important insight or action item from what's been discussed so far? Be specific and actionable.",
    history,
    minutes,
  );
}

export async function getSuggestion(
  history: ChatMessage[],
  minutes: MinuteEntry[],
): Promise<string> {
  return callGemini(
    "Based on what's being discussed, write exactly what I should say next. Make it natural and professional — something I could actually say out loud in the meeting.",
    history,
    minutes,
  );
}

export async function getFollowUps(
  history: ChatMessage[],
  minutes: MinuteEntry[],
): Promise<string> {
  return callGemini(
    "Generate 3-4 specific follow-up questions I should ask based on what's been discussed. Format as a bullet list. Make them pointed and useful, not generic.",
    history,
    minutes,
  );
}

export async function getRecap(
  history: ChatMessage[],
  minutes: MinuteEntry[],
): Promise<string> {
  return callGemini(
    "Give me a structured recap of this meeting so far. Include: Key Decisions Made, Action Items (with owners if mentioned), Open Questions, and Next Steps.",
    history,
    minutes,
  );
}
