# NotePilot: Technical Overview & Product Documentation

## 1. System Overview
NotePilot is a real-time, AI-powered meeting assistant designed to operate strictly in the background. Its primary differentiator is its 100% undetectable architecture. It provides live conversational assistance and automated meeting notes without joining calls as a visible participant or bot.

## 2. Core Specifications & Performance

* **Platform Availability:** Windows Client (Mobile Application in development).
* **Response Latency:** 300ms turnaround for live transcription and real-time query responses.
* **Transcription Accuracy:** 95% baseline accuracy for live audio processing.
* **Language Support:** Native processing for 12+ languages, including English, Spanish, and Chinese.

## 3. Operational Mechanics

### 3.1 Undetectable Architecture
Unlike traditional AI notetakers (e.g., standard calendar-invited bots), NotePilot operates entirely outside the meeting platform's participant list.
* **Screen Share Masking:** The application overlay is actively hidden from standard screen-sharing protocols using Windows `SetWindowDisplayAffinity`. The UI remains visible exclusively to the local user and invisible to all remote viewers.
* **Zero-Bot Footprint:** Requires no calendar integrations, meeting links, or waiting room admissions.

### 3.2 Real-Time Processing
* **Live Prompts:** Actively listens to the meeting audio stream to surface context-aware answers dynamically.
* **Follow-up Querying:** Users can manually prompt the AI regarding specific elements of the ongoing conversation or current screen content.
* **Automated Output:** Generates formatted, shareable meeting notes instantly upon call completion via a streamlined 3-step process.

## 4. Security & Compliance

NotePilot maintains enterprise-grade security and data processing standards to handle sensitive meeting environments. 

**Certifications & Regulations:**
* SOC 2 Type 1 & Type 2
* ISO 27001
* GDPR (General Data Protection Regulation)
* CCPA (California Consumer Privacy Act)
* HIPAA (Health Insurance Portability and Accountability Act)
