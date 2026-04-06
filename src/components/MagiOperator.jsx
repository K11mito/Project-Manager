import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- Typewriter Hook ---
function useTypewriter(text, speed = 30, onComplete) {
  const [displayed, setDisplayed] = useState('');
  const [isDone, setIsDone] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    if (!text) { setDisplayed(''); setIsDone(true); return; }
    indexRef.current = 0;
    setDisplayed('');
    setIsDone(false);

    const id = setInterval(() => {
      indexRef.current++;
      setDisplayed(text.slice(0, indexRef.current));
      if (indexRef.current >= text.length) {
        clearInterval(id);
        setIsDone(true);
        onComplete && onComplete();
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return { displayed, isDone };
}

// --- TTS ---
function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const voiceRef = useRef(null);

  useEffect(() => {
    const loadVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const preferred = ['Fred', 'Alex', 'Samantha'];
      for (const name of preferred) {
        const v = voices.find((v) => v.name === name);
        if (v) { voiceRef.current = v; return; }
      }
      if (voices.length > 0) voiceRef.current = voices[0];
    };
    loadVoice();
    window.speechSynthesis.onvoiceschanged = loadVoice;
  }, []);

  const speak = useCallback((text) => {
    if (!voiceEnabled || !text) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    if (voiceRef.current) utter.voice = voiceRef.current;
    utter.rate = 0.65;
    utter.pitch = 0.5;
    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utter);
  }, [voiceEnabled]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { isSpeaking, voiceEnabled, setVoiceEnabled, speak, stop };
}

export default function MagiOperator({ isOpen, onClose, onProjectsChanged }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [typingResponse, setTypingResponse] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const tts = useTTS();
  const typewriter = useTypewriter(typingResponse, 25, () => {
    if (typingResponse) {
      tts.speak(typingResponse);
      setMessages((prev) => [...prev, { role: 'assistant', content: typingResponse }]);
      setTypingResponse(null);
      onProjectsChanged && onProjectsChanged();
    }
  });

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typewriter.displayed]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
    if (!isOpen) {
      tts.stop();
    }
  }, [isOpen]);

  // Cmd+Shift+Space push-to-talk
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.metaKey && e.shiftKey && e.code === 'Space' && !isRecording) {
        e.preventDefault();
        startRecording();
      }
    };
    const handleKeyUp = (e) => {
      if ((e.code === 'Space' || e.key === 'Meta' || e.key === 'Shift') && isRecording) {
        stopRecording();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen, isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const buffer = await blob.arrayBuffer();
        setIsRecording(false);
        try {
          const text = await window.api.magiTranscribe(buffer);
          if (text && text.trim()) {
            setInput(text.trim());
            sendMessage(text.trim());
          }
        } catch (err) {
          setError('TRANSCRIPTION FAILURE — ' + (err.message || 'UNKNOWN'));
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      setError('MICROPHONE ACCESS DENIED');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
  };

  const sendMessage = async (text) => {
    const content = text || input.trim();
    if (!content || loading || typingResponse) return;

    const userMsg = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const chatHistory = newMessages.map((m) => ({ role: m.role, content: m.content }));
      const response = await window.api.magiChat(chatHistory);
      setTypingResponse(response);
    } catch (err) {
      const msg = err.message || 'UNKNOWN ERROR';
      if (msg.includes('API KEY')) {
        setError('MAGI-04 OFFLINE — OPENAI API KEY NOT CONFIGURED');
      } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('ENOTFOUND')) {
        setError('COMMUNICATION FAILURE — CHECK UPLINK');
      } else {
        setError('SYSTEM ERROR — ' + msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="magi-overlay" onClick={onClose}>
      <div className="magi-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="magi-header">
          <div className="magi-header-left">
            <span className="magi-status-dot" />
            <div>
              <div className="magi-title">// MAGI-04 ONLINE</div>
              <div className="magi-subtitle">
                {tts.isSpeaking ? (
                  <span className="magi-transmitting">// TRANSMITTING</span>
                ) : isRecording ? (
                  <span className="magi-recording">// RECORDING</span>
                ) : (
                  'OPERATOR INTERFACE // AUTHORIZED'
                )}
              </div>
            </div>
          </div>
          <div className="magi-header-right">
            <button
              className={`magi-voice-btn ${tts.voiceEnabled ? 'on' : ''}`}
              onClick={() => tts.setVoiceEnabled(!tts.voiceEnabled)}
            >
              VOICE: {tts.voiceEnabled ? 'ON' : 'OFF'}
            </button>
            <button className="magi-close-btn" onClick={onClose}>&times;</button>
          </div>
        </div>

        {/* Messages */}
        <div className="magi-messages" ref={scrollRef}>
          {messages.length === 0 && !typingResponse && !error && (
            <div className="magi-welcome">
              <div className="magi-welcome-text">MAGI-04 STANDING BY</div>
              <div className="magi-welcome-hint">Cmd+K to toggle // Cmd+Shift+Space for voice</div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`magi-msg magi-msg-${msg.role}`}>
              <div className="magi-msg-prefix">
                {msg.role === 'user' ? '> PILOT //' : 'MAGI-04 //'}
              </div>
              <div className="magi-msg-content">{msg.content}</div>
            </div>
          ))}

          {typingResponse && (
            <div className="magi-msg magi-msg-assistant">
              <div className="magi-msg-prefix">MAGI-04 //</div>
              <div className="magi-msg-content">
                {typewriter.displayed}
                <span className="magi-cursor" />
              </div>
            </div>
          )}

          {loading && !typingResponse && (
            <div className="magi-loading">
              <span className="magi-loading-dots">PROCESSING</span>
            </div>
          )}

          {error && (
            <div className="magi-error">// {error}</div>
          )}
        </div>

        {/* Input */}
        <div className="magi-input-bar">
          <div className={`magi-rec-indicator ${isRecording ? 'active' : ''}`} />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="// ENTER DIRECTIVE"
            disabled={loading || !!typingResponse}
            className="magi-input"
          />
          <button
            className="magi-send-btn"
            onClick={() => sendMessage()}
            disabled={loading || !!typingResponse || !input.trim()}
          >
            TRANSMIT
          </button>
        </div>
      </div>
    </div>
  );
}
