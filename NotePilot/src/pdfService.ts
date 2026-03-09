// pdfService.ts — Meeting PDF export for NotePilot
// Uses jsPDF loaded from CDN via dynamic import trick (works in Tauri WebView)

import type { ChatMessage, MinuteEntry } from "./aiService";

declare global {
  interface Window {
    jspdf: { jsPDF: new (opts?: unknown) => JsPDFInstance };
  }
}

interface JsPDFInstance {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  setFont(name: string, style?: string): void;
  setFontSize(size: number): void;
  setTextColor(r: number, g: number, b: number): void;
  setDrawColor(r: number, g: number, b: number): void;
  setFillColor(r: number, g: number, b: number): void;
  rect(x: number, y: number, w: number, h: number, style?: string): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  text(text: string | string[], x: number, y: number, opts?: { align?: string; maxWidth?: number }): void;
  splitTextToSize(text: string, maxWidth: number): string[];
  addPage(): void;
  save(filename: string): void;
  getNumberOfPages(): number;
  setPage(page: number): void;
}

async function loadJsPDF(): Promise<new (opts?: unknown) => JsPDFInstance> {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load jsPDF"));
    document.head.appendChild(script);
  });

  return window.jspdf.jsPDF;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function formatTime(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function getAiSummary(messages: ChatMessage[]): string {
  // Find the last AI recap/summary message, or fall back to last AI message
  const recapMsg = [...messages]
    .reverse()
    .find((m) => m.role === "ai" && (
      m.text.toLowerCase().includes("recap") ||
      m.text.toLowerCase().includes("summary") ||
      m.text.toLowerCase().includes("action item") ||
      m.text.toLowerCase().includes("key point") ||
      m.text.toLowerCase().includes("decision")
    ));

  if (recapMsg) return recapMsg.text;

  const lastAi = [...messages].reverse().find((m) => m.role === "ai");
  return lastAi?.text ?? "No AI summary available. Use the ↻ Recap button during your meeting to generate a summary.";
}

function getKeyInsights(messages: ChatMessage[]): string[] {
  const insights: string[] = [];
  for (const msg of messages) {
    if (msg.role !== "ai") continue;
    const lines = msg.text.split("\n").filter((l) => l.trim().startsWith("•") || l.trim().startsWith("-") || l.trim().match(/^\d+\./));
    for (const line of lines) {
      const clean = line.replace(/^[•\-\d.]\s*/, "").trim();
      if (clean.length > 10 && !insights.includes(clean)) {
        insights.push(clean);
      }
    }
  }
  return insights.slice(0, 8);
}

// ─── PDF Generation ─────────────────────────────────────────────────────────

export async function downloadMeetingPDF(
  messages: ChatMessage[],
  minutes: MinuteEntry[]
): Promise<void> {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const PW = doc.internal.pageSize.getWidth();   // 210
  const PH = doc.internal.pageSize.getHeight();  // 297
  const ML = 18; // margin left
  const MR = 18; // margin right
  const CW = PW - ML - MR; // content width

  // ── Colour palette ──
  const NAVY  = [15,  23,  42]  as [number, number, number];
  const BLUE  = [11,  87,  208] as [number, number, number];
  const TEAL  = [20, 184, 166]  as [number, number, number];
  const LIGHT = [241, 245, 249] as [number, number, number];
  const MID   = [100, 116, 139] as [number, number, number];
  const WHITE = [255, 255, 255] as [number, number, number];
  const DARK  = [30,  41,  59]  as [number, number, number];

  let y = 0;

  function newPageIfNeeded(needed: number) {
    if (y + needed > PH - 20) {
      doc.addPage();
      y = 22;
      drawPageHeader();
    }
  }

  function drawPageHeader() {
    // Thin top accent bar
    doc.setFillColor(...BLUE);
    doc.rect(0, 0, PW, 6, "F");
    // Page number
    const pg = doc.getNumberOfPages();
    doc.setFontSize(7);
    doc.setTextColor(...MID);
    doc.text(`NotePilot  ·  Page ${pg}`, PW - MR, 4, { align: "right" });
  }

  // ── COVER HEADER ────────────────────────────────────────────────────────
  // Deep navy header band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PW, 52, "F");

  // Accent stripe
  doc.setFillColor(...BLUE);
  doc.rect(0, 48, PW, 4, "F");

  // Logo mark — simple geometric "N"
  doc.setFillColor(...BLUE);
  doc.rect(ML, 10, 8, 8, "F");
  doc.setFillColor(...TEAL);
  doc.rect(ML + 2, 12, 4, 4, "F");

  // App name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...TEAL);
  doc.text("NotePilot", ML + 12, 16);

  // Title
  doc.setFontSize(22);
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.text("Meeting Summary Report", ML, 32);

  // Date & time
  doc.setFontSize(8.5);
  doc.setTextColor(180, 200, 230);
  doc.setFont("helvetica", "normal");
  doc.text(`${formatDate()}  ·  Generated at ${formatTime()}`, ML, 43);

  y = 62;

  // ── STATS ROW ──────────────────────────────────────────────────────────
  const statW = (CW - 8) / 3;
  const stats = [
    { label: "Minutes Recorded", value: String(minutes.length) },
    { label: "AI Interactions",  value: String(messages.filter((m) => m.role === "user").length) },
    { label: "Duration",         value: minutes.length > 0 ? `${minutes[0].timestamp} – ${minutes[minutes.length - 1]?.timestamp ?? minutes[0].timestamp}` : "—" },
  ];

  stats.forEach((s, i) => {
    const sx = ML + i * (statW + 4);
    doc.setFillColor(...LIGHT);
    doc.rect(sx, y, statW, 16, "F");
    doc.setFillColor(...BLUE);
    doc.rect(sx, y, 2, 16, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...DARK);
    doc.text(s.value, sx + 6, y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MID);
    doc.text(s.label, sx + 6, y + 13);
  });

  y += 24;

  // ── SECTION: AI SUMMARY ─────────────────────────────────────────────────
  function sectionTitle(title: string, accent: [number, number, number]) {
    newPageIfNeeded(16);
    doc.setFillColor(...accent);
    doc.rect(ML, y, 3, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...DARK);
    doc.text(title, ML + 6, y + 7);
    y += 14;
  }

  sectionTitle("AI Summary", BLUE);

  const summary = getAiSummary(messages);
  const summaryLines = doc.splitTextToSize(summary, CW);

  // Light background card
  const summaryH = summaryLines.length * 5 + 10;
  newPageIfNeeded(summaryH + 4);
  doc.setFillColor(248, 251, 255);
  doc.rect(ML, y, CW, summaryH, "F");
  doc.setDrawColor(...BLUE);
  // left border accent
  doc.setFillColor(...BLUE);
  doc.rect(ML, y, 2, summaryH, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(summaryLines, ML + 6, y + 6);
  y += summaryH + 8;

  // ── SECTION: KEY INSIGHTS ───────────────────────────────────────────────
  const insights = getKeyInsights(messages);
  if (insights.length > 0) {
    sectionTitle("Key Insights", TEAL);

    for (const insight of insights) {
      newPageIfNeeded(10);
      const lines = doc.splitTextToSize(insight, CW - 10);
      const h = lines.length * 5 + 6;
      doc.setFillColor(...LIGHT);
      doc.rect(ML, y, CW, h, "F");
      doc.setFillColor(...TEAL);
      doc.rect(ML, y, 2, h, "F");
      // bullet dot
      doc.setFillColor(...TEAL);
      doc.rect(ML + 5, y + h / 2 - 1, 2, 2, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...DARK);
      doc.text(lines, ML + 10, y + 5);
      y += h + 3;
    }
    y += 4;
  }

  // ── SECTION: MEETING MINUTES ────────────────────────────────────────────
  sectionTitle("Meeting Minutes", [99, 102, 241]);

  if (minutes.length === 0) {
    newPageIfNeeded(14);
    doc.setFillColor(...LIGHT);
    doc.rect(ML, y, CW, 12, "F");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...MID);
    doc.text("No minutes were recorded during this session.", ML + 6, y + 7);
    y += 16;
  } else {
    for (let i = 0; i < minutes.length; i++) {
      const min = minutes[i];
      const textLines = doc.splitTextToSize(min.text, CW - 28);
      const rowH = Math.max(textLines.length * 4.8 + 6, 12);
      newPageIfNeeded(rowH + 2);

      // Alternating row background
      if (i % 2 === 0) {
        doc.setFillColor(248, 250, 253);
        doc.rect(ML, y, CW, rowH, "F");
      }

      // Row number pill
      doc.setFillColor(...BLUE);
      doc.rect(ML + 1, y + 2, 7, rowH - 4, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(...WHITE);
      doc.text(String(i + 1), ML + 4.5, y + rowH / 2 + 2, { align: "center" });

      // Timestamp
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...BLUE);
      doc.text(min.timestamp, ML + 11, y + 5);

      // Minute text
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...DARK);
      doc.text(textLines, ML + 11, y + 10);

      y += rowH + 2;
    }
  }

  y += 6;

  // ── SECTION: FULL AI CONVERSATION LOG ──────────────────────────────────
  const aiMessages = messages.filter((m) => m.role !== "system");
  if (aiMessages.length > 0) {
    sectionTitle("AI Conversation Log", [234, 88, 12]);

    for (const msg of aiMessages) {
      const isUser = msg.role === "user";
      const label = isUser ? "You" : "NotePilot AI";
      const textLines = doc.splitTextToSize(msg.text, CW - 14);
      const msgH = textLines.length * 4.8 + 10;
      newPageIfNeeded(msgH + 4);

      const bgColor: [number, number, number] = isUser ? [239, 246, 255] : [240, 253, 250];
      const accentColor: [number, number, number] = isUser ? BLUE : TEAL;

      doc.setFillColor(...bgColor);
      doc.rect(ML, y, CW, msgH, "F");
      doc.setFillColor(...accentColor);
      doc.rect(isUser ? PW - MR - 2 : ML, y, 2, msgH, "F");

      // Label + time
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...accentColor);
      doc.text(label, ML + 4, y + 5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...MID);
      doc.text(msg.timestamp, PW - MR - 4, y + 5, { align: "right" });

      // Message body
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...DARK);
      doc.text(textLines, ML + 4, y + 9);
      y += msgH + 3;
    }
  }

  // ── FOOTER ON ALL PAGES ─────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(...NAVY);
    doc.rect(0, PH - 10, PW, 10, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150, 170, 200);
    doc.text("Generated by NotePilot  ·  Confidential", ML, PH - 4);
    doc.text(`Page ${p} of ${totalPages}`, PW - MR, PH - 4, { align: "right" });
  }

  // ── Save ────────────────────────────────────────────────────────────────
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`NotePilot-Meeting-${dateStr}.pdf`);
}