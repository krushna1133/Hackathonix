// Gemini AI Service for NotePilot Meeting Assistant
// Uses Gemini 2.0 Flash via REST API

// ⚠️ Replace with your API key from https://aistudio.google.com
const GEMINI_API_KEY = "AIzaSyApVoaskuxLXK7QJg5D3ONjUfdkAX23Gk8";

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models//gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `You are NotePilot, an intelligent AI meeting assistant embedded in a floating desktop widget. Your role is to help users during their meetings by:
- Taking and organizing meeting minutes
- Suggesting what to say next based on the meeting context
- Generating smart follow-up questions
- Providing concise recaps of the meeting so far

Keep responses concise (2-4 sentences max) since you're in a small floating widget. Use a professional but friendly tone. Format with bullet points when listing items.`;

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

function getTimestamp(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function buildContext(minutes: MinuteEntry[]): string {
  if (minutes.length === 0) return "No meeting minutes recorded yet.";
  return (
    "Current meeting minutes:\n" +
    minutes.map((m) => `  [${m.timestamp}] ${m.text}`).join("\n")
  );
}

async function callGemini(
  userPrompt: string,
  conversationHistory: ChatMessage[],
  minutes: MinuteEntry[]
): Promise<string> {
  const meetingContext = buildContext(minutes);

  // Build conversation parts for Gemini
  const contents: { role: string; parts: { text: string }[] }[] = [];

  // System instruction merged into first user message
  const systemContext = `${SYSTEM_PROMPT}\n\n--- Meeting Context ---\n${meetingContext}\n--- End Context ---\n\n`;

  // Add recent conversation history (last 10 messages)
  const recentHistory = conversationHistory.slice(-10);
  for (const msg of recentHistory) {
    if (msg.role === "system") continue;
    contents.push({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.text }],
    });
  }

  // Add current user prompt with system context prepended
  contents.push({
    role: "user",
    parts: [{ text: systemContext + userPrompt }],
  });

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300,
          topP: 0.9,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Gemini API error:", errorData);
     if (response.status === 400 && (GEMINI_API_KEY as string) === "YOUR_GEMINI_API_KEY_HERE") {
        return "⚠️ Please set your Gemini API key in `src/aiService.ts`. Get a free key at [aistudio.google.com](https://aistudio.google.com)";
      }
      return `⚠️ API Error (${response.status}). Please check your API key and try again.`;
    }

    const data = await response.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I couldn't generate a response. Please try again.";
    return text.trim();
  } catch (error) {
    console.error("Gemini fetch error:", error);
    return "⚠️ Network error. Please check your connection and try again.";
  }
}

// === Public API Functions ===

export async function sendChatMessage(
  message: string,
  history: ChatMessage[],
  minutes: MinuteEntry[]
): Promise<string> {
  return callGemini(message, history, minutes);
}

export async function getAssist(
  history: ChatMessage[],
  minutes: MinuteEntry[]
): Promise<string> {
  return callGemini(
    "Based on the current meeting context, provide a helpful insight or suggestion that would be useful right now. What should I be aware of or consider?",
    history,
    minutes
  );
}

export async function getSuggestion(
  history: ChatMessage[],
  minutes: MinuteEntry[]
): Promise<string> {
  return callGemini(
    "Based on the current meeting discussion, what should I say next? Provide a natural, professional response I could use.",
    history,
    minutes
  );
}

export async function getFollowUps(
  history: ChatMessage[],
  minutes: MinuteEntry[]
): Promise<string> {
  return callGemini(
    "Generate 3-4 smart follow-up questions I should ask based on the meeting context so far. Format as a bullet list.",
    history,
    minutes
  );
}

export async function getRecap(
  history: ChatMessage[],
  minutes: MinuteEntry[]
): Promise<string> {
  return callGemini(
    "Provide a concise, well-organized recap/summary of this meeting based on the minutes recorded so far. Include key decisions, action items, and important points discussed.",
    history,
    minutes
  );
}

export { getTimestamp, generateId };
