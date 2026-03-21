# Hackathonix 2.0 - NotePilot

### An AI-Powered, Undetectable Meeting Assistant

*Real-time transcription • AI assistance • Automated meeting notes*

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Security & Compliance](#security--compliance)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**NotePilot** is a real-time, AI-powered meeting assistant designed to operate strictly in the background. Its primary differentiator is its **100% undetectable architecture**, providing live conversational assistance and automated meeting notes without joining calls as a visible participant or bot.

Unlike traditional AI notetakers that appear as calendar-invited bots, NotePilot operates entirely outside the meeting platform's participant list, making it invisible to other meeting attendees while still providing powerful AI assistance.

---

## Features

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **Real-Time Transcription** | Live speech-to-text with 95% baseline accuracy for audio processing |
| **AI Chat Assistant** | Context-aware AI responses powered by Google Gemini 2.0 Flash |
| **Automated Meeting Notes** | Instant generation of formatted, shareable meeting notes |
| **PDF Export** | One-click export of meeting transcripts and notes |
| **Stealth Mode** | Screen share masking using Windows `SetWindowDisplayAffinity` API |
| **Multi-Language Support** | Native processing for 12+ languages |

### Key Highlights

- **300ms Response Latency** - Near-instant turnaround for live transcription and query responses
- **Zero-Bot Footprint** - No calendar integrations, meeting links, or waiting room admissions required
- **Undetectable UI** - Application overlay is hidden from screen-sharing protocols
- **Floating Widget Design** - Compact, always-on-top interface for seamless meeting integration

### AI-Powered Actions

- **Assist** - Get helpful insights based on current meeting context
- **Suggestion** - AI-generated suggestions for what to say next
- **Follow-Up Questions** - Smart follow-up questions based on discussion
- **Recap** - Concise meeting summary with key decisions and action items

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.1.0 | UI Framework |
| TypeScript | 5.8.3 | Type-safe JavaScript |
| Vite | 7.0.4 | Build tool & dev server |
| CSS3 | - | Styling with backdrop-filter effects |

### Backend / Native
| Technology | Purpose |
|------------|---------|
| Tauri 2.0 | Cross-platform native desktop framework |
| Rust | System-level operations & window management |

### AI Services
| Service | Purpose |
|---------|---------|
| Google Gemini 2.0 Flash | AI chat completions & meeting assistance |
| Web Speech API | Browser-based speech recognition |

---

## Project Structure

```
krushna1133-hackathonix/
├── README.md                    # Project overview
└── NotePilot/
    ├── README.md                # Technical documentation
    ├── index.html               # Entry HTML file
    ├── package.json             # Dependencies & scripts
    ├── tsconfig.json            # TypeScript configuration
    ├── tsconfig.node.json       # Node TypeScript config
    ├── vite.config.ts           # Vite build configuration
    │
    ├── src/                     # Frontend source code
    │   ├── aiService.ts         # Gemini AI integration
    │   ├── App.tsx              # Main React component
    │   ├── App.css              # Application styles
    │   ├── audioService.ts      # Speech recognition service
    │   ├── pdfService.ts        # PDF export functionality
    │   ├── main.tsx             # React entry point
    │   └── vite-env.d.ts        # Vite type declarations
    │
    └── src-tauri/               # Tauri/Rust backend
        ├── build.rs             # Build script
        ├── Cargo.toml           # Rust dependencies
        ├── tauri.conf.json      # Tauri configuration
        ├── capabilities/
        │   └── default.json     # Permission capabilities
        └── src/
            ├── lib.rs           # Library entry
            ├── main.rs          # Application entry
            └── system_audio.rs  # System audio capture
```

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 18.x
- **Rust** >= 1.70 (for Tauri)
- **pnpm** or **npm** or **yarn**
- **Windows 10/11** (primary target platform)

### Tauri Prerequisites

Follow the [Tauri setup guide](https://tauri.app/start/prerequisites/) for platform-specific requirements:

```bash
# Windows requires:
# - Microsoft Visual Studio C++ Build Tools
# - WebView2 (included in Windows 10/11)
```

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/krushna1133/hackathonix.git
cd hackathonix/NotePilot
```

### 2. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 3. Development Mode

```bash
# Start the development server with Tauri
npm run tauri dev
```

### 4. Production Build

```bash
# Build for production
npm run tauri build
```

The built application will be available in `src-tauri/target/release/`.

---

## Configuration

### API Key Setup

NotePilot uses Google Gemini AI for intelligent meeting assistance. You will need Gemini API access for both the core AI features and the audio/transcription features.

1. Get a free API key from [Google AI Studio](https://aistudio.google.com)

2. **Recommended (secure):** Configure your Gemini keys via environment variables or a secret manager instead of hard‑coding them into source files. For example, you can set:

   - `GEMINI_API_KEY` – used by `src/aiService.ts` for general AI functionality
   - `GEMINI_AUDIO_API_KEY` (or reuse `GEMINI_API_KEY`) – used by `src/audioService.ts` for audio/transcription features

   Use your preferred approach (e.g. `.env` file loaded by your tooling, OS environment variables, Docker/Kubernetes secret injection, or your CI/CD secret store) and ensure these values are **never committed to version control**.

3. **Not recommended (local development only):** If you cannot use environment variables yet, you may temporarily paste your API key into `src/aiService.ts` and `src/audioService.ts` for quick local experiments. Do **not** commit these changes or share them publicly.
### Tauri Configuration

Edit `src-tauri/tauri.conf.json` to customize:

```json
{
  "productName": "NotePilot",
  "version": "0.1.0",
  "identifier": "com.notepilot.app"
}
```

### Window Settings

The application uses a transparent, always-on-top floating window:

- **Width**: 700px (max)
- **Height**: Adaptive (resizable)
- **Transparent**: Yes
- **Decorations**: No (custom title bar)

---

## Usage

### Starting a Meeting Session

1. **Launch NotePilot** - The floating widget appears on your screen
2. **Position the Widget** - Drag using the grip handle to your preferred location
3. **Start Recording** - Click the microphone button to begin transcription
4. **Switch Tabs**:
   - **Chat** - Interact with AI assistant
   - **Transcript** - View live transcription

### Recording Controls

| Control | Action |
|---------|--------|
| 🎤 **Mic** | Start recording |
| ⏸️ **Pause** | Pause/resume transcription |
| ⏹️ **Stop** | Stop recording |
| 👁️ **Eye** | Toggle stealth mode |

### AI Assistant Actions

| Action | Description |
|--------|-------------|
| **Assist** | Get context-aware insights |
| **Suggest** | What to say next |
| **Follow-ups** | Smart follow-up questions |
| **Recap** | Meeting summary |

### Exporting Notes

Click the **PDF Export** button to download a formatted PDF of your meeting transcript and notes.

---

## API Reference

### aiService.ts

```typescript
// Send a chat message to the AI
sendChatMessage(message: string, history: ChatMessage[], minutes: MinuteEntry[]): Promise<string>

// Get AI assistance based on context
getAssist(history: ChatMessage[], minutes: MinuteEntry[]): Promise<string>

// Get suggestion for next response
getSuggestion(history: ChatMessage[], minutes: MinuteEntry[]): Promise<string>

// Generate follow-up questions
getFollowUps(history: ChatMessage[], minutes: MinuteEntry[]): Promise<string>

// Get meeting recap
getRecap(history: ChatMessage[], minutes: MinuteEntry[]): Promise<string>
```

### audioService.ts

```typescript
// Check if speech recognition is supported
isSpeechRecognitionSupported(): boolean

// AudioRecorder class for managing transcription
class AudioRecorder {
  start(): Promise<void>
  stop(): void
  pause(): void
  resume(): void
  onStatusChange: (status: AudioStatus) => void
  onTranscript: (segment: TranscriptSegment) => void
  onError: (error: string) => void
}
```

### pdfService.ts

```typescript
// Download meeting notes as PDF
downloadMeetingPDF(messages: Message[], minutes: MinuteEntry[]): void
```

---

## Security & Compliance

NotePilot is designed with enterprise-grade security and data processing standards in mind:

### Certifications & Regulations

| Standard | Current Status |
|----------|----------------|
| SOC 2 Type 1 & Type 2 | Target standard (not formally audited) |
| ISO 27001 | Target certification (not yet certified) |
| GDPR | Best-effort alignment (no legal advice; verify for your use case) |
| CCPA | Best-effort alignment (no legal advice; verify for your use case) |
| HIPAA | Not for production PHI use; HIPAA compliance not attested |

_The above reflects design goals and current assumptions, not formal compliance attestations or legal guarantees._
### Privacy Features

- **Hybrid Processing** – Depending on how you configure NotePilot, some speech recognition may run locally via the Web Speech API, while system audio capture and transcription are processed by Google Gemini APIs.
- **Data Sent to Gemini** – When transcription/AI features are active, segments of captured audio (including system audio) and related text prompts are transmitted off-device to Google Gemini for real-time transcription, analysis, and summarization.
- **Ephemeral In-App Storage** – NotePilot keeps transcripts and AI outputs in memory for the duration of a session; they are discarded when you close the app unless you explicitly export or save them.
- **No Server-Side Storage by NotePilot** – The NotePilot application does not send your audio or transcripts to any backend servers owned by the NotePilot developers; communication is directly between your device and the Google Gemini APIs.
- **API Security** – All AI requests are sent over HTTPS using your configured Gemini API key.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Escape` | Clear input |

---

## Troubleshooting

### Common Issues

**Microphone not working?**
- Ensure browser/system permissions are granted
- Check if another application is using the microphone

**AI not responding?**
- Verify your Gemini API key is valid
- Check internet connectivity

**Window not appearing?**
- Check if the app is minimized to system tray
- Restart the application

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

---

## Roadmap

- [ ] Mobile application (iOS/Android)
- [ ] Multi-meeting session support
- [ ] Integration with calendar apps
- [ ] Custom AI model support
- [ ] Team collaboration features

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [Tauri](https://tauri.app/) - For the amazing native desktop framework
- [Google Gemini](https://ai.google.dev/) - For powerful AI capabilities
- [React](https://react.dev/) - For the robust UI framework

---

**Built with ❤️ for Hackathonix 2.0**

[Report Bug](https://github.com/krushna1133/hackathonix/issues) · [Request Feature](https://github.com/krushna1133/hackathonix/issues)
