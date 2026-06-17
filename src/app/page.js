'use client';

import { useEffect, useState, useRef } from 'react';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('awaiting_message'); // awaiting_message, in_progress
  const [threadId, setThreadId] = useState(null);
  const [error, setError] = useState(null);

  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [voices, setVoices] = useState([]);
  const messagesEndRef = useRef(null);

  // Voice setup
  useEffect(() => {
    const synth = window.speechSynthesis;
    const loadVoices = () => setVoices(synth.getVoices());
    if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = loadVoices;
    loadVoices();
    return () => synth.cancel();
  }, []);

  // Text to speech
  const speak = (text) => {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();

    const cleanText = text.replace(/[#_*\[\]()`]/g, '').trim();
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.11;
    utterance.pitch = 1.19;

    let selectedVoice = voices.find(v => v.name === 'Google US English') ||
                        voices.find(v => v.name.includes('Google') && v.name.includes('Female')) ||
                        voices.find(v => v.name.includes('Female') && v.lang.startsWith('en')) ||
                        voices.find(v => v.name.includes('Zira')) ||
                        voices.find(v => v.name.includes('Samantha')) ||
                        voices.find(v => v.lang.startsWith('en')) || 
                        voices[0];
    
    if (selectedVoice) utterance.voice = selectedVoice;
    synth.speak(utterance);
  };

  // Speak when assistant message finishes
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

  const toggleSpeech = () => {
    if (speechEnabled) window.speechSynthesis.cancel();
    setSpeechEnabled(!speechEnabled);
  };

  const stopTalking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const exportToPdf = async () => {
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      // We clone the chat container so we can remove typing indicators before export
      const element = document.querySelector('.chat-container').cloneNode(true);
      // Remove any typing indicators or error messages
      const typingIndicators = element.querySelectorAll('.typing-indicator');
      typingIndicators.forEach(t => t.closest('.message-wrapper')?.remove());
      
      const opt = {
        margin:       10,
        filename:     'Grace-X-Chat-Export.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      html2pdf().set(opt).from(element).save();
    } catch (e) {
      console.error('Failed to export PDF:', e);
    }
  };

  const handleInputChange = (e) => setInput(e.target.value);

  const handlePromptClick = (prompt) => {
    setInput(prompt);
  };

  const submitMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || status === 'in_progress') return;

    const userMsg = input.trim();
    setInput('');
    setStatus('in_progress');
    setError(null);
    
    const newMessages = [...messages, { id: Date.now().toString(), role: 'user', content: userMsg }];
    setMessages(newMessages);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, threadId })
      });

      if (!res.ok) throw new Error(await res.text());

      const returnedThreadId = res.headers.get('x-thread-id');
      if (returnedThreadId && !threadId) setThreadId(returnedThreadId);

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');

      // Create empty assistant message
      let assistantMsgId = (Date.now() + 1).toString();
      let assistantContent = '';
      
      setMessages(msgs => [...msgs, { id: assistantMsgId, role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;

        setMessages(msgs => {
          const updated = [...msgs];
          const lastIndex = updated.length - 1;
          if (updated[lastIndex].role === 'assistant') {
            updated[lastIndex].content = assistantContent;
          }
          return updated;
        });
      }

    } catch (err) {
      console.error(err);
      setError(err);
    } finally {
      setStatus('awaiting_message');
    }
  };

  const formatText = (text) => {
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

  const oneClickPrompts = [
    "What is the Grace X Ecosystem?",
    "Tell me about the Deezie project.",
    "Summarize the latest whitepapers."
  ];

  return (
    <div className="app-container">
      <div className="header">
        <div className="avatar">GX</div>
        <div className="header-info">
          <h1>Grace-X AI</h1>
          <p><span className="status-dot"></span> Ecosystem Expert</p>
        </div>
        <button className="export-pdf-btn" onClick={exportToPdf} title="Export to PDF">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span className="export-text">Export PDF</span>
        </button>
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

        {status === 'in_progress' && messages[messages.length - 1]?.role === 'user' && (
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
          <div style={{color: '#ff4444', fontSize: '13px', textAlign: 'center', marginTop: '10px'}}>
            Error: {error.message}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <div className="prompts-container">
          {oneClickPrompts.map((prompt, idx) => (
            <button 
              key={idx} 
              className="prompt-chip" 
              onClick={() => handlePromptClick(prompt)}
              disabled={status !== 'awaiting_message'}
            >
              {prompt}
            </button>
          ))}
        </div>
        <form onSubmit={submitMessage} className="input-container">
          <div className="voice-controls">
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
            <button 
              type="button" 
              className="stop-talking-btn"
              onClick={stopTalking}
              title="Stop Talking"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              </svg>
            </button>
          </div>
          
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
