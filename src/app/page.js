'use client';

import { useAssistant } from 'ai/react';
import { useEffect, useState, useRef } from 'react';

export default function Chat() {
  const { status, messages, input, submitMessage, handleInputChange, error } =
    useAssistant({ api: '/api/assistant' });

  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [voices, setVoices] = useState([]);
  const messagesEndRef = useRef(null);

  // Initialize Speech Synthesis and find voices
  useEffect(() => {
    const synth = window.speechSynthesis;
    const loadVoices = () => {
      setVoices(synth.getVoices());
    };
    
    // Voice loading is async in some browsers
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = loadVoices;
    }
    loadVoices();
    
    return () => {
      synth.cancel();
    };
  }, []);

  // Speak when a new assistant message is added and done streaming
  const previousMessageCount = useRef(0);
  useEffect(() => {
    if (!speechEnabled || status === 'in_progress' || messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    
    if (lastMessage.role === 'assistant' && messages.length > previousMessageCount.current) {
      speak(lastMessage.content);
      previousMessageCount.current = messages.length;
    }
  }, [messages, status, speechEnabled]);

  // Handle scrolling
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const speak = (text) => {
    if (!('speechSynthesis' in window)) return;
    
    const synth = window.speechSynthesis;
    synth.cancel(); // stop any current speech

    // strip markdown before speaking
    const cleanText = text.replace(/[#_*\[\]()`]/g, '').trim();
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Set properties as requested
    utterance.rate = 1.11;
    utterance.pitch = 1.19;

    // Find "Google US English" or fallback
    let selectedVoice = voices.find(v => v.name === 'Google US English' || (v.name.includes('Google') && v.name.includes('Female')));
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Female')) || 
                      voices.find(v => v.lang.startsWith('en')) || 
                      voices[0];
    }
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    synth.speak(utterance);
  };

  const toggleSpeech = () => {
    if (speechEnabled) {
      window.speechSynthesis.cancel();
    }
    setSpeechEnabled(!speechEnabled);
  };

  // Convert markdown-like text (simple parsing for display)
  const formatText = (text) => {
    // Simple line break and bold parsing for display
    const lines = text.split('\n');
    return lines.map((line, i) => {
      const bolded = line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={j}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });
      return <p key={i}>{bolded}</p>;
    });
  };

  return (
    <div className="app-container">
      <div className="header">
        <div className="avatar">GX</div>
        <div className="header-info">
          <h1>Grace-X AI</h1>
          <p>
            <span className="status-dot"></span> Ecosystem Expert
          </p>
        </div>
      </div>

      <div className="chat-container">
        {messages.length === 0 && (
          <div className="message-wrapper assistant">
            <div className="message-label">Grace-X</div>
            <div className="message assistant">
              <div className="message-content">
                <p>Hello Dionne. I am Grace-X AI, your personal ecosystem expert.</p>
                <p>I have been trained on all GitHub repositories, whitepapers, and the Deezie project.</p>
                <p>Ask me anything about the Grace X Ecosystem.</p>
              </div>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`message-wrapper ${m.role === 'user' ? 'user' : 'assistant'}`}>
            <div className="message-label">{m.role === 'user' ? 'Dionne' : 'Grace-X'}</div>
            <div className={`message ${m.role === 'user' ? 'user' : 'assistant'}`}>
              <div className="message-content">
                {formatText(m.content)}
              </div>
            </div>
          </div>
        ))}

        {status === 'in_progress' && (
          <div className="message-wrapper assistant">
            <div className="message-label">Grace-X</div>
            <div className="message assistant">
              <div className="typing-indicator">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            </div>
          </div>
        )}
        
        {error && (
          <div style={{color: 'red', fontSize: '12px', textAlign: 'center'}}>
            Error: {error.message}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <form onSubmit={submitMessage} className="input-container">
          <button 
            type="button" 
            className={`speech-toggle ${speechEnabled ? 'active' : ''}`}
            onClick={toggleSpeech}
            title={speechEnabled ? "Voice Enabled" : "Voice Disabled"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {speechEnabled ? (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </>
              ) : (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <line x1="23" y1="9" x2="17" y2="15"></line>
                  <line x1="17" y1="9" x2="23" y2="15"></line>
                </>
              )}
            </svg>
          </button>
          
          <input
            className="chat-input"
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about the Grace X Ecosystem..."
            disabled={status !== 'awaiting_message'}
            autoFocus
          />
          
          <button 
            type="submit" 
            className="send-button"
            disabled={status !== 'awaiting_message' || !input.trim()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
