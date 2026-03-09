import { useState } from "react";
import "./App.css";

// Icons
const Eye = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>;
const Pause = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
const Square = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>;
const ChevronUp = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>;
const GripVertical = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>;
const X = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;
const Home = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const Send = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>;

function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [inputText, setInputText] = useState('');

  return (
    <div className="app-wrapper">
      {/* TOP PILL BAR */}
      <div className="top-bar-container">
        <div className="control-pill" data-tauri-drag-region>
          <button className="icon-btn tooltip-anchor"><Eye /></button>
          <div className="playback-controls">
            <button className="icon-btn"><Pause /></button>
            <div className="divider-sm"></div>
            <button className="icon-btn"><Square /></button>
          </div>
          <button className="icon-btn"><ChevronUp /></button>
          <div className="vertical-divider"></div>
          <button className="icon-btn drag-btn" data-tauri-drag-region><GripVertical /></button>
        </div>
        <button className="close-btn"><X /></button>
      </div>

      {/* MAIN PANEL */}
      <div className="main-panel">
        <div className="panel-header" data-tauri-drag-region>
          <button className="icon-btn home-btn"><Home /></button>
          <div className="tabs">
            <button 
              className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              Chat
            </button>
            <button 
              className={`tab ${activeTab === 'transcript' ? 'active' : ''}`}
              onClick={() => setActiveTab('transcript')}
            >
              Transcript
            </button>
          </div>
        </div>

        <div className="actions-row">
          <button className="action-btn">✨ Assist</button>
          <span className="dot">•</span>
          <button className="action-btn">🪄 What should I say?</button>
          <span className="dot">•</span>
          <button className="action-btn">💬 Follow-up questions</button>
          <span className="dot">•</span>
          <button className="action-btn">↻ Recap</button>
        </div>

        <div className="input-container">
          <div className="input-wrapper">
             {!inputText && (
               <div className="input-placeholder">
                 Ask about your screen or conversation, or <kbd>^</kbd> <kbd>↵</kbd> for Assist
               </div>
             )}
             <input 
               type="text" 
               value={inputText}
               onChange={(e) => setInputText(e.target.value)}
             />
          </div>
          <button className="send-btn"><Send /></button>
        </div>
      </div>
    </div>
  );
}

export default App;
