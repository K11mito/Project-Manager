import React, { useState, useEffect, useRef, useCallback } from 'react';

export default function MagiHero({ onBack, onProjectsChanged, gmiMode }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('standby');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [typingText, setTypingText] = useState(null);
  const [displayedText, setDisplayedText] = useState('');

  const canvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const micStreamRef = useRef(null);
  const inputRef = useRef(null);
  const transcriptRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const typingRef = useRef(null);
  const statusRef = useRef('standby');
  const messagesRef = useRef([]);

  useEffect(() => { typingRef.current = typingText; }, [typingText]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  // --- Canvas visualization ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 420;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Theme colors for canvas
    const accentRGB = gmiMode ? '255, 106, 0' : '108, 99, 255';
    const listenRGB = '255, 0, 51';

    const draw = () => {
      const t = Date.now() / 1000;
      const W = size;
      const H = size;
      const cx = W / 2;
      const cy = H / 2;
      const currentStatus = statusRef.current;

      ctx.clearRect(0, 0, W, H);

      // Frequency data
      let freqData = null;
      const analyser = analyserRef.current;
      if (analyser) {
        freqData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(freqData);
      }

      // Subtle crosshair
      ctx.strokeStyle = `rgba(${accentRGB}, 0.03)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, 0); ctx.lineTo(cx, H);
      ctx.moveTo(0, cy); ctx.lineTo(W, cy);
      ctx.stroke();

      // Tick marks on crosshair
      for (let i = 1; i <= 8; i++) {
        const d = i * 25;
        const tickLen = i % 2 === 0 ? 6 : 3;
        ctx.strokeStyle = `rgba(${accentRGB}, 0.04)`;
        ctx.beginPath();
        ctx.moveTo(cx + d, cy - tickLen); ctx.lineTo(cx + d, cy + tickLen);
        ctx.moveTo(cx - d, cy - tickLen); ctx.lineTo(cx - d, cy + tickLen);
        ctx.moveTo(cx - tickLen, cy + d); ctx.lineTo(cx + tickLen, cy + d);
        ctx.moveTo(cx - tickLen, cy - d); ctx.lineTo(cx + tickLen, cy - d);
        ctx.stroke();
      }

      // Concentric rings
      for (let i = 0; i < 6; i++) {
        const baseR = 50 + i * 28;
        const breathe = Math.sin(t * 0.8 + i * 0.5) * 2;
        const r = baseR + breathe;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${accentRGB}, ${Math.max(0.05 - i * 0.007, 0.01)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Rotating arc decorations
      for (let i = 0; i < 4; i++) {
        const r = 70 + i * 35;
        const speed = (0.25 + i * 0.12) * (i % 2 === 0 ? 1 : -1);
        const startAngle = t * speed;
        const arcLen = Math.PI * (0.2 + i * 0.08);
        ctx.beginPath();
        ctx.arc(cx, cy, r, startAngle, startAngle + arcLen);
        ctx.strokeStyle = `rgba(${accentRGB}, ${0.06 + i * 0.015})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Small orbiting dots
      for (let i = 0; i < 3; i++) {
        const orbitR = 90 + i * 40;
        const speed = 0.4 + i * 0.2;
        const angle = t * speed + i * (Math.PI * 2 / 3);
        const dx = cx + Math.cos(angle) * orbitR;
        const dy = cy + Math.sin(angle) * orbitR;
        ctx.beginPath();
        ctx.arc(dx, dy, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${accentRGB}, ${0.15 + i * 0.05})`;
        ctx.fill();
      }

      // Audio-reactive waveform ring
      if (freqData && (currentStatus === 'speaking' || currentStatus === 'listening')) {
        const baseRadius = currentStatus === 'listening' ? 80 : 95;
        const segments = freqData.length;
        const angleStep = (Math.PI * 2) / segments;
        const amplitude = currentStatus === 'listening' ? 25 : 40;
        const isListening = currentStatus === 'listening';

        // Outer glow first
        ctx.beginPath();
        for (let i = 0; i < segments; i++) {
          const v = freqData[i] / 255;
          const r = baseRadius + v * amplitude;
          const angle = i * angleStep - Math.PI / 2;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = isListening ? 'rgba(255, 0, 51, 0.1)' : `rgba(${accentRGB}, 0.1)`;
        ctx.lineWidth = 8;
        ctx.stroke();

        // Main line
        ctx.strokeStyle = isListening ? 'rgba(255, 0, 51, 0.5)' : `rgba(${accentRGB}, 0.5)`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Inner orb glow
      let intensity;
      if (currentStatus === 'speaking') {
        const avg = freqData ? freqData.reduce((a, b) => a + b, 0) / freqData.length / 255 : 0;
        intensity = 0.12 + avg * 0.3;
      } else if (currentStatus === 'processing') {
        intensity = 0.08 + Math.sin(t * 5) * 0.07;
      } else if (currentStatus === 'listening') {
        intensity = 0.12 + Math.sin(t * 3) * 0.08;
      } else {
        intensity = 0.05 + Math.sin(t * 1.5) * 0.03;
      }

      const orbColor = currentStatus === 'listening' ? '255, 0, 51' : accentRGB;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 70);
      grad.addColorStop(0, `rgba(${orbColor}, ${intensity})`);
      grad.addColorStop(0.5, `rgba(${orbColor}, ${intensity * 0.35})`);
      grad.addColorStop(1, `rgba(${orbColor}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 70, 0, Math.PI * 2);
      ctx.fill();

      // Processing spinner
      if (currentStatus === 'processing') {
        ctx.beginPath();
        ctx.arc(cx, cy, 85, t * 3, t * 3 + Math.PI * 1.5);
        ctx.strokeStyle = `rgba(${accentRGB}, 0.5)`;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, 95, -(t * 2), -(t * 2) + Math.PI);
        ctx.strokeStyle = `rgba(${accentRGB}, 0.25)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = currentStatus === 'listening' ? 'rgba(255, 0, 51, 0.8)' : `rgba(${accentRGB}, 0.5)`;
      ctx.fill();

      // Inner ring
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.strokeStyle = currentStatus === 'listening' ? 'rgba(255, 0, 51, 0.3)' : `rgba(${accentRGB}, 0.15)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, []);

  // --- Typewriter effect ---
  useEffect(() => {
    if (!typingText) { setDisplayedText(''); return; }
    let idx = 0;
    setDisplayedText('');
    const interval = setInterval(() => {
      idx++;
      setDisplayedText(typingText.slice(0, idx));
      if (idx >= typingText.length) {
        clearInterval(interval);
        setMessages((prev) => [...prev, { role: 'assistant', content: typingText }]);
        setTypingText(null);
        onProjectsChanged?.();
        if (!sourceNodeRef.current) setStatus('standby');
      }
    }, 20);
    return () => clearInterval(interval);
  }, [typingText]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages, displayedText]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handleDown = (e) => {
      if (e.code === 'Space' && document.activeElement !== inputRef.current && !e.repeat) {
        e.preventDefault();
        if (statusRef.current === 'standby') startRecording();
      }
      if (e.key === 'Escape') {
        interrupt();
        onBack();
      }
    };
    const handleUp = (e) => {
      if (e.code === 'Space' && statusRef.current === 'listening') {
        e.preventDefault();
        stopRecording();
      }
    };
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sourceNodeRef.current) { try { sourceNodeRef.current.stop(); } catch (e) {} }
      if (micStreamRef.current) { micStreamRef.current.getTracks().forEach((t) => t.stop()); }
      if (recorderRef.current?.state === 'recording') { recorderRef.current.stop(); }
    };
  }, []);

  // --- Interrupt ---
  const interrupt = () => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) {}
      sourceNodeRef.current = null;
    }
    analyserRef.current = null;
    if (typingRef.current) {
      setMessages((prev) => [...prev, { role: 'assistant', content: typingRef.current }]);
      setTypingText(null);
    }
    setStatus('standby');
  };

  // --- TTS Playback (from pre-fetched audio data) ---
  const playAudioData = async (audioData) => {
    if (!audioData || audioData.length === 0) return;
    try {
      const audioCtx = getAudioContext();
      if (audioCtx.state === 'suspended') await audioCtx.resume();

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      const arrayBuffer = audioData.slice(0).buffer;
      const buffer = await audioCtx.decodeAudioData(arrayBuffer);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      sourceNodeRef.current = source;
      analyserRef.current = analyser;

      source.onended = () => {
        analyserRef.current = null;
        sourceNodeRef.current = null;
        if (!typingRef.current) setStatus('standby');
      };

      source.start();
    } catch (err) {
      console.error('TTS playback failed:', err);
    }
  };

  // --- Recording ---
  const startRecording = async () => {
    if (statusRef.current !== 'standby') {
      if (statusRef.current === 'speaking') interrupt();
      else return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const audioCtx = getAudioContext();
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      const micSource = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      micSource.connect(analyser);
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
        analyserRef.current = null;

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const buf = await blob.arrayBuffer();
        setStatus('processing');
        try {
          const text = await window.api.magiTranscribe(buf);
          if (text?.trim()) {
            sendMessage(text.trim());
          } else {
            setStatus('standby');
          }
        } catch (err) {
          setStatus('standby');
          setMessages((prev) => [
            ...prev,
            { role: 'error', content: 'TRANSCRIPTION FAILURE -- ' + (err.message || 'UNKNOWN') },
          ]);
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setStatus('listening');
    } catch (err) {
      setStatus('standby');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  };

  // --- Send message ---
  const sendMessage = async (text) => {
    const content = text || input.trim();
    if (!content || typingRef.current) return;
    if (statusRef.current === 'speaking') interrupt();

    const userMsg = { role: 'user', content };
    const newMessages = [...messagesRef.current, userMsg];
    setMessages(newMessages);
    setInput('');
    setStatus('processing');

    try {
      const chatHistory = newMessages
        .filter((m) => m.role !== 'error')
        .map((m) => ({ role: m.role, content: m.content }));

      if (voiceEnabled) {
        // Single call returns text + audio together — both start simultaneously
        const { text: response, audio } = await window.api.magiChatWithVoice(chatHistory);
        setStatus('speaking');
        setTypingText(response);
        if (audio) playAudioData(audio);
      } else {
        const response = await window.api.magiChat(chatHistory);
        setStatus('speaking');
        setTypingText(response);
      }
    } catch (err) {
      setStatus('standby');
      const msg = err.message || 'UNKNOWN';
      setMessages((prev) => [
        ...prev,
        {
          role: 'error',
          content: msg.includes('API KEY')
            ? (gmiMode ? 'MAGI-04 OFFLINE -- API KEY NOT CONFIGURED' : 'API key not configured. Add one in Settings.')
            : (gmiMode ? 'SYSTEM ERROR -- ' + msg : 'Something went wrong: ' + msg),
        },
      ]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const statusLabels = gmiMode ? {
    standby: '// STANDING BY',
    listening: '// VOICE INPUT ACTIVE',
    processing: '// PROCESSING DIRECTIVE',
    speaking: '// TRANSMITTING',
  } : {
    standby: 'Standing by',
    listening: 'Listening...',
    processing: 'Thinking...',
    speaking: 'Speaking...',
  };

  const visibleMessages = messages.slice(-6);

  return (
    <div className="magi-hero">
      <div className="magi-hero-grid" />

      {/* Top bar */}
      <div className="magi-hero-topbar">
        <div className="magi-hero-topbar-left">
          {gmiMode && <span className="eva-nerv-logo">NERV</span>}
          <span className="magi-hero-label">{gmiMode ? 'MAGI-04 // OPERATOR INTERFACE' : 'Voice Assistant'}</span>
        </div>
        <div className="magi-hero-topbar-right">
          <button
            className={`magi-voice-btn ${voiceEnabled ? 'on' : ''}`}
            onClick={() => setVoiceEnabled(!voiceEnabled)}
          >
            {gmiMode ? `VOICE: ${voiceEnabled ? 'ON' : 'OFF'}` : `Voice ${voiceEnabled ? 'On' : 'Off'}`}
          </button>
          <button className="magi-hero-back" onClick={() => { interrupt(); onBack(); }}>
            &larr; {gmiMode ? 'EXIT' : 'Back'}
          </button>
        </div>
      </div>

      {/* Center visualization */}
      <div className="magi-hero-center">
        <canvas ref={canvasRef} className="magi-hero-canvas" />
        <div className={`magi-hero-status magi-hero-status-${status}`}>
          {statusLabels[status]}
        </div>
      </div>

      {/* Transcript */}
      <div className="magi-hero-transcript" ref={transcriptRef}>
        {visibleMessages.map((msg, i) => (
          <div key={i} className={`magi-hero-msg magi-hero-msg-${msg.role}`}>
            <span className="magi-hero-msg-prefix">
              {msg.role === 'user'
                ? (gmiMode ? '> PILOT //' : 'You')
                : msg.role === 'error'
                  ? (gmiMode ? '// ERROR //' : 'Error')
                  : (gmiMode ? 'MAGI-04 //' : 'Assistant')}
            </span>{' '}
            <span className="magi-hero-msg-text">{msg.content}</span>
          </div>
        ))}
        {typingText && (
          <div className="magi-hero-msg magi-hero-msg-assistant">
            <span className="magi-hero-msg-prefix">{gmiMode ? 'MAGI-04 //' : 'Assistant'}</span>{' '}
            <span className="magi-hero-msg-text">
              {displayedText}
              <span className="magi-cursor" />
            </span>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="magi-hero-input-bar">
        <button
          className={`magi-hero-mic ${status === 'listening' ? 'active' : ''}`}
          onMouseDown={() => {
            if (status === 'standby' || status === 'speaking') startRecording();
          }}
          onMouseUp={() => {
            if (status === 'listening') stopRecording();
          }}
          disabled={status === 'processing'}
          title="Hold to speak"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={gmiMode ? '// ENTER DIRECTIVE' : 'Type a message...'}
          disabled={status === 'processing' || status === 'listening'}
          className="magi-hero-input"
        />
        <button
          className="magi-hero-send"
          onClick={() => sendMessage()}
          disabled={status !== 'standby' || !input.trim()}
        >
          {gmiMode ? 'TRANSMIT' : 'Send'}
        </button>
      </div>

      <div className="magi-hero-hint">
        {gmiMode
          ? 'HOLD SPACE TO SPEAK // TYPE TO ENTER DIRECTIVE // ESC TO EXIT'
          : 'Hold Space to speak \u00B7 Type to send \u00B7 Esc to go back'}
      </div>
    </div>
  );
}
