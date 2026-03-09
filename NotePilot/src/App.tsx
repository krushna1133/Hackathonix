import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [transcription, setTranscription] = useState<string>("Listening...");
  const [insight, setInsight] = useState<string>("Waiting for context...");

  // Simulate real-time transcription updates
  useEffect(() => {
    const timer = setTimeout(() => {
      setTranscription("The DCF model projects a 15% revenue growth over the next 5 years, assuming stable market conditions.");
      setInsight("DCF (Discounted Cash Flow): A valuation method used to estimate the value of an investment based on its expected future cash flows.");
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="container" data-tauri-drag-region>
      <div className="header" data-tauri-drag-region>
        <div className="logo-container" data-tauri-drag-region>
          <div className="status-indicator"></div>
          <h1 data-tauri-drag-region>NotePilot</h1>
        </div>
        <div className="controls">
          {/* Add basic controls if needed, like a minimize button */}
        </div>
      </div>
      
      <main className="content">
        <section className="live-transcription">
          <h2>Transcription</h2>
          <p className="text-content">{transcription}</p>
        </section>

        <section className="ai-insights">
          <h2>AI Insight</h2>
          <p className="insight-content">{insight}</p>
        </section>
      </main>
    </div>
  );
}

export default App;
