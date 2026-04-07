import React, { useState, useEffect, useRef, useCallback } from 'react';

export default function MagiBar({ isOpen, onClose, onProjectsChanged, gmiMode }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('standby');
  const [typingText, setTypingText] = useState(null);
  const [displayedText, setDisplayedText] = useState('');

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const micStreamRef = useRef(null);
  const inputRef = useRef(null);
  const typingRef = useRef(null);
  const statusRef = useRef('standby');
  const messagesRef = useRef([]);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => { typingRef.current = typingText; }, [typingText]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sourceNodeRef.current) { try { sourceNodeRef.current.stop(); } catch (e) {} }
      if (micStreamRef.current) { micStreamRef.current.getTracks().forEach((t) => t.stop()); }
      if (recorderRef.current?.state === 'recording') { recorderRef.current.stop(); }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // --- Mini waveform canvas ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const W = 120, H = 32;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const accentRGB = gmiMode ? '255, 106, 0' : '108, 99, 255';

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const currentStatus = statusRef.current;
      const analyser = analyserRef.current;

      if (analyser && (currentStatus === 'speaking' || currentStatus === 'listening')) {
        const freqData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(freqData);
        const barCount = 24;
        const step = Math.floor(freqData.length / barCount);
        const barW = (W - (barCount - 1) * 2) / barCount;
        const isListening = currentStatus === 'listening';

        for (let i = 0; i < barCount; i++) {
          const v = freqData[i * step] / 255;
          const h = Math.max(2, v * (H - 4));
          const x = i * (barW + 2);
          const y = (H - h) / 2;
          ctx.fillStyle = isListening
            ? `rgba(255, 0, 51, ${0.4 + v * 0.5})`
            : `rgba(${accentRGB}, ${0.3 + v * 0.5})`;
          ctx.fillRect(x, y, barW, h);
        }
      } else if (currentStatus === 'processing') {
        const t = Date.now() / 1000;
        for (let i = 0; i < 24; i++) {
          const phase = Math.sin(t * 4 + i * 0.4) * 0.5 + 0.5;
          const h = 2 + phase * 8;
          const barW = 3;
          const x = i * 5;
          const y = (H - h) / 2;
          ctx.fillStyle = `rgba(${accentRGB}, ${0.2 + phase * 0.3})`;
          ctx.fillRect(x, y, barW, h);
        }
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, []);

  // --- Typewriter ---
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

  // --- Audio playback ---
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

      const { text: response, audio } = await window.api.magiChatWithVoice(chatHistory);
      setStatus('speaking');
      setTypingText(response);
      if (audio) playAudioData(audio);
    } catch (err) {
      setStatus('standby');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    if (e.key === 'Escape') {
      interrupt();
      onClose();
    }
  };

  const handleClose = () => {
    interrupt();
    onClose();
  };

  if (!isOpen) return null;

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const showResponse = typingText || lastAssistant;

  const statusLabels = gmiMode ? {
    standby: null,
    listening: 'LISTENING',
    processing: 'PROCESSING',
    speaking: 'TRANSMITTING',
  } : {
    standby: null,
    listening: 'Listening...',
    processing: 'Thinking...',
    speaking: 'Speaking...',
  };

  return (
    <div className="magi-bar">
      {/* Ambient glow */}
      <div className="magi-bar-glow" />

      <div className="magi-bar-inner">
        {/* Response area */}
        {showResponse && (
          <div className="magi-bar-response">
            <span className="magi-bar-response-prefix">{gmiMode ? 'MAGI-04 //' : 'Assistant'}</span>{' '}
            <span className="magi-bar-response-text">
              {typingText ? (
                <>{displayedText}<span className="magi-cursor" /></>
              ) : (
                lastAssistant.content
              )}
            </span>
          </div>
        )}

        {/* Input row */}
        <div className="magi-bar-row">
          {/* Waveform / status */}
          <div className="magi-bar-viz">
            {status !== 'standby' ? (
              <canvas ref={canvasRef} className="magi-bar-canvas" />
            ) : (
              <canvas ref={canvasRef} className="magi-bar-canvas" />
            )}
            {statusLabels[status] && (
              <span className={`magi-bar-status magi-bar-status-${status}`}>
                {statusLabels[status]}
              </span>
            )}
          </div>

          {/* Mic */}
          <button
            className={`magi-bar-mic ${status === 'listening' ? 'active' : ''}`}
            onMouseDown={() => {
              if (status === 'standby' || status === 'speaking') startRecording();
            }}
            onMouseUp={() => {
              if (status === 'listening') stopRecording();
            }}
            disabled={status === 'processing'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>

          {/* Input */}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={gmiMode ? '// ENTER DIRECTIVE' : 'Ask anything...'}
            disabled={status === 'processing' || status === 'listening'}
            className="magi-bar-input"
          />

          {/* Send */}
          <button
            className="magi-bar-send"
            onClick={() => sendMessage()}
            disabled={status !== 'standby' || !input.trim()}
          >
            {gmiMode ? 'SEND' : 'Send'}
          </button>

          {/* Close */}
          <button className="magi-bar-close" onClick={handleClose}>&times;</button>
        </div>
      </div>
    </div>
  );
}
