const { ipcRenderer } = require('electron');

// --- Clap Detection ---
let lastClapTime = 0;
let clapCount = 0;

async function startClapDetection() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;

    source.connect(analyser);

    const dataArray = new Float32Array(analyser.fftSize);
    const threshold = 0.7;
    const minGap = 150;
    const maxGap = 600;

    let cooldown = false;

    setInterval(() => {
      analyser.getFloatTimeDomainData(dataArray);

      let maxAmplitude = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const abs = Math.abs(dataArray[i]);
        if (abs > maxAmplitude) maxAmplitude = abs;
      }

      const now = Date.now();

      if (maxAmplitude > threshold && !cooldown) {
        cooldown = true;
        setTimeout(() => { cooldown = false; }, 100);

        const timeSinceLastClap = now - lastClapTime;

        if (timeSinceLastClap >= minGap && timeSinceLastClap <= maxGap) {
          clapCount++;
          if (clapCount >= 1) {
            ipcRenderer.send('clap:detected');
            clapCount = 0;
            lastClapTime = 0;
          }
        } else {
          clapCount = 0;
          lastClapTime = now;
        }
      }
    }, 50);

    console.log('Clap detection started');
  } catch (err) {
    console.error('Clap listener failed:', err);
  }
}

// --- Voice Detection ("computer start") ---
function startVoiceDetection() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.log('SpeechRecognition API not available');
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  let cooldown = false;

  recognition.onresult = (event) => {
    if (cooldown) return;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.toLowerCase().trim();
      if (transcript.includes('computer start')) {
        cooldown = true;
        ipcRenderer.send('voice:detected');
        recognition.stop();
        return;
      }
    }
  };

  recognition.onend = () => {
    // Restart after a brief pause — speech recognition auto-stops on silence
    setTimeout(() => {
      cooldown = false;
      try { recognition.start(); } catch (e) {}
    }, 500);
  };

  recognition.onerror = (event) => {
    // Don't retry if permanently blocked
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      console.error('Speech recognition denied:', event.error);
      return;
    }
    // Retry on transient errors (network, no-speech, etc.)
    setTimeout(() => {
      try { recognition.start(); } catch (e) {}
    }, 1000);
  };

  try {
    recognition.start();
    console.log('Voice detection started — listening for "computer start"');
  } catch (e) {
    console.error('Failed to start voice detection:', e);
  }
}

// --- Init ---
window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer.invoke('settings:get').then((settings) => {
    if (settings.clapEnabled !== false) startClapDetection();
    if (settings.voiceEnabled) startVoiceDetection();
  }).catch(() => {
    // Fallback: start clap detection
    startClapDetection();
  });
});
