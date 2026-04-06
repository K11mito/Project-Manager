import React, { useState, useEffect } from 'react';

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s % 1000) / 1000;
  };
}

function hashStr(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function generateSparkData(seed, length = 16) {
  const rng = seededRandom(hashStr(String(seed)));
  const data = [];
  let val = 30 + rng() * 40;
  for (let i = 0; i < length; i++) {
    val += (rng() - 0.45) * 18;
    val = Math.max(5, Math.min(95, val));
    data.push(val);
  }
  return data;
}

export default function Sparkline({ data, width = 80, height = 24, color = '#ff6a00', glow = false, animated = false }) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!animated) return;
    const id = setInterval(() => setOffset((o) => o + 1), 2000);
    return () => clearInterval(id);
  }, [animated]);

  if (!data || data.length < 2) return null;

  const displayData = animated
    ? data.map((v, i) => v + Math.sin((i + offset) * 0.8) * 6)
    : data;

  const max = Math.max(...displayData);
  const min = Math.min(...displayData);
  const range = max - min || 1;

  const points = displayData.map((v, i) => {
    const x = (i / (displayData.length - 1)) * width;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  const glowId = `sparkglow-${hashStr(String(data[0]) + color)}`;

  return (
    <svg width={width} height={height} className="sparkline-svg" style={{ display: 'block', overflow: 'visible' }}>
      {glow && (
        <defs>
          <filter id={glowId}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}
      <polygon
        points={areaPoints}
        fill={color}
        opacity="0.06"
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        opacity="0.7"
        strokeLinejoin="round"
        strokeLinecap="round"
        filter={glow ? `url(#${glowId})` : undefined}
      />
      <circle
        cx={width}
        cy={parseFloat(points.split(' ').pop().split(',')[1])}
        r="2"
        fill={color}
        opacity="0.9"
      />
    </svg>
  );
}
