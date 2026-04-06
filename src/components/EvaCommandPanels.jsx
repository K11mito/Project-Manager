import React, { useState, useEffect, useRef } from 'react';

// --- MAGI Triad Status ---
const MAGI_UNITS = [
  { name: 'MELCHIOR-1', role: 'SCIENTIST', color: '#ff6a00' },
  { name: 'BALTHASAR-2', role: 'MOTHER', color: '#00ff41' },
  { name: 'CASPER-3', role: 'WOMAN', color: '#00c8ff' },
];

function MagiTriad() {
  const [ticks, setTicks] = useState([0, 0, 0]);
  const [decisions, setDecisions] = useState(['APPROVE', 'APPROVE', 'APPROVE']);

  useEffect(() => {
    const id = setInterval(() => {
      setTicks((prev) => prev.map((t) => t + 1));
      setDecisions((prev) =>
        prev.map(() => {
          const r = Math.random();
          if (r < 0.6) return 'APPROVE';
          if (r < 0.85) return 'CONSIDER';
          return 'DENY';
        })
      );
    }, 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="eva-cmd-panel eva-magi-triad">
      <div className="eva-cmd-label">MAGI Decision System</div>
      <div className="eva-magi-grid">
        {MAGI_UNITS.map((unit, i) => (
          <div key={unit.name} className="eva-magi-unit" style={{ '--magi-color': unit.color }}>
            <div className="eva-magi-name">{unit.name}</div>
            <div className="eva-magi-role">{unit.role}</div>
            <div className={`eva-magi-decision ${decisions[i].toLowerCase()}`}>
              {decisions[i]}
            </div>
            <div className="eva-magi-bar">
              <div
                className="eva-magi-bar-fill"
                style={{
                  width: `${40 + Math.sin(ticks[i] * 0.7 + i * 2) * 30 + 30}%`,
                  background: unit.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Waveform Monitor ---
function WaveformMonitor() {
  const canvasRef = useRef(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    let animId;

    function draw() {
      phaseRef.current += 0.04;
      ctx.clearRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = 'rgba(255, 106, 0, 0.06)';
      ctx.lineWidth = 0.5;
      for (let y = 0; y < h; y += 10) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      for (let x = 0; x < w; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Waveform 1 - orange
      ctx.strokeStyle = 'rgba(255, 106, 0, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(255, 106, 0, 0.3)';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.sin(x * 0.03 + phaseRef.current) * 15
          + Math.sin(x * 0.07 + phaseRef.current * 1.3) * 8
          + Math.sin(x * 0.01 + phaseRef.current * 0.5) * 10;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Waveform 2 - green
      ctx.strokeStyle = 'rgba(0, 255, 65, 0.3)';
      ctx.lineWidth = 1;
      ctx.shadowColor = 'rgba(0, 255, 65, 0.2)';
      ctx.shadowBlur = 3;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.cos(x * 0.04 + phaseRef.current * 0.8) * 12
          + Math.sin(x * 0.09 + phaseRef.current * 1.6) * 5;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="eva-cmd-panel eva-waveform">
      <div className="eva-cmd-label">Pattern Analysis // Waveform</div>
      <canvas ref={canvasRef} width={400} height={80} className="eva-waveform-canvas" />
    </div>
  );
}

// --- Spectrum Analyzer ---
function SpectrumAnalyzer() {
  const [bars, setBars] = useState(Array(24).fill(0.3));

  useEffect(() => {
    const id = setInterval(() => {
      setBars((prev) =>
        prev.map((v, i) => {
          const target = 0.15 + Math.random() * 0.7 + Math.sin(Date.now() * 0.002 + i * 0.5) * 0.15;
          return v + (target - v) * 0.3;
        })
      );
    }, 120);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="eva-cmd-panel eva-spectrum">
      <div className="eva-cmd-label">Signal Spectrum // Real-Time</div>
      <div className="eva-spectrum-bars">
        {bars.map((v, i) => (
          <div key={i} className="eva-spectrum-bar-wrap">
            <div
              className="eva-spectrum-bar"
              style={{
                height: `${v * 100}%`,
                background: v > 0.7
                  ? '#ff0033'
                  : v > 0.45
                  ? '#ff6a00'
                  : '#00ff41',
                boxShadow: `0 0 4px ${v > 0.7 ? 'rgba(255,0,51,0.4)' : v > 0.45 ? 'rgba(255,106,0,0.3)' : 'rgba(0,255,65,0.2)'}`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// --- System Log ---
function SystemLog() {
  const [entries, setEntries] = useState([]);
  const scrollRef = useRef(null);

  const MESSAGES = [
    'SYNC // unit telemetry data refreshed',
    'MAGI // decision cycle complete',
    'SCAN // file system delta computed',
    'AUTH // session token validated',
    'NET  // heartbeat response: 12ms',
    'TASK // priority queue rebalanced',
    'CRON // morning brief scheduled',
    'MEM  // garbage collection cycle',
    'DB   // WAL checkpoint complete',
    'API  // rate limiter reset',
    'SYNC // commit history fetched',
    'MAGI // consensus reached: 3/3',
    'SCAN // anomaly detection: nominal',
    'SYS  // thermal status: optimal',
    'NET  // upstream latency: 8ms',
    'TASK // deadline monitor sweep',
  ];

  useEffect(() => {
    const genEntry = () => {
      const now = new Date();
      const ts = now.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0').slice(0, 2);
      const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
      return { ts, msg, id: Date.now() + Math.random() };
    };

    // Initial entries
    setEntries(Array.from({ length: 6 }, genEntry));

    const id = setInterval(() => {
      setEntries((prev) => [...prev.slice(-11), genEntry()]);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <div className="eva-cmd-panel eva-syslog">
      <div className="eva-cmd-label">System Log // Live Feed</div>
      <div className="eva-syslog-entries" ref={scrollRef}>
        {entries.map((e) => (
          <div key={e.id} className="eva-syslog-entry">
            <span className="eva-syslog-ts">{e.ts}</span>
            <span className="eva-syslog-msg">{e.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Radar Sweep ---
function RadarSweep() {
  const canvasRef = useRef(null);
  const angleRef = useRef(0);
  const blobsRef = useRef(
    Array.from({ length: 6 }, () => ({
      r: 15 + Math.random() * 30,
      a: Math.random() * Math.PI * 2,
      life: 0,
    }))
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 4;
    let animId;

    function draw() {
      angleRef.current += 0.02;
      ctx.clearRect(0, 0, size, size);

      // Rings
      for (let i = 1; i <= 3; i++) {
        ctx.strokeStyle = 'rgba(255, 106, 0, 0.08)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, (radius / 3) * i, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Cross
      ctx.strokeStyle = 'rgba(255, 106, 0, 0.06)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx, cy + radius);
      ctx.moveTo(cx - radius, cy);
      ctx.lineTo(cx + radius, cy);
      ctx.stroke();

      // Sweep gradient
      const sweepAngle = angleRef.current;
      const grad = ctx.createConicalGradient
        ? null
        : null;

      // Draw sweep arc
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(sweepAngle);

      // Sweep trail
      for (let i = 0; i < 30; i++) {
        const a = -(i / 30) * 0.8;
        const opacity = (1 - i / 30) * 0.15;
        ctx.strokeStyle = `rgba(255, 106, 0, ${opacity})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(
          Math.cos(a) * radius,
          Math.sin(a) * radius
        );
        ctx.stroke();
      }

      // Sweep line
      ctx.strokeStyle = 'rgba(255, 106, 0, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(255, 106, 0, 0.4)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(radius, 0);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();

      // Blobs
      blobsRef.current.forEach((blob) => {
        const angleDiff = ((sweepAngle % (Math.PI * 2)) - blob.a + Math.PI * 4) % (Math.PI * 2);
        if (angleDiff < 0.3 && angleDiff > 0) {
          blob.life = 1;
        }
        if (blob.life > 0) {
          blob.life -= 0.008;
          const bx = cx + Math.cos(blob.a) * blob.r;
          const by = cy + Math.sin(blob.a) * blob.r;
          ctx.fillStyle = `rgba(255, 106, 0, ${blob.life * 0.6})`;
          ctx.shadowColor = `rgba(255, 106, 0, ${blob.life * 0.3})`;
          ctx.shadowBlur = 4;
          ctx.beginPath();
          ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="eva-cmd-panel eva-radar">
      <div className="eva-cmd-label">Area Scan // Radar</div>
      <div className="eva-radar-wrap">
        <canvas ref={canvasRef} width={120} height={120} className="eva-radar-canvas" />
      </div>
    </div>
  );
}

// --- Hex Status Grid ---
function HexStatusGrid() {
  const [cells, setCells] = useState(Array(48).fill(0));

  useEffect(() => {
    const id = setInterval(() => {
      setCells((prev) =>
        prev.map((v) => {
          const r = Math.random();
          if (r < 0.08) return 1;
          if (r < 0.15) return 0.5;
          if (r < 0.4) return v * 0.85;
          return v * 0.92;
        })
      );
    }, 200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="eva-cmd-panel eva-hexgrid-panel">
      <div className="eva-cmd-label">Node Status // Network</div>
      <div className="eva-hexgrid-cells">
        {cells.map((v, i) => (
          <div
            key={i}
            className="eva-hexgrid-cell"
            style={{
              opacity: 0.1 + v * 0.9,
              background: v > 0.8 ? '#ff6a00' : v > 0.4 ? 'rgba(255, 106, 0, 0.5)' : 'rgba(255, 106, 0, 0.15)',
              boxShadow: v > 0.7 ? '0 0 4px rgba(255, 106, 0, 0.4)' : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// --- Main Export ---
export default function EvaCommandPanels() {
  return (
    <div className="eva-command-panels">
      <div className="eva-cmd-row">
        <MagiTriad />
        <WaveformMonitor />
      </div>
      <div className="eva-cmd-row">
        <SpectrumAnalyzer />
        <RadarSweep />
        <HexStatusGrid />
      </div>
      <div className="eva-cmd-row">
        <SystemLog />
      </div>
    </div>
  );
}
