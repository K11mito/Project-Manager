import React, { useState, useEffect } from 'react';
import ProjectCard from './ProjectCard';
import UrgentPanel from './UrgentPanel';
import Sparkline, { generateSparkData } from './Sparkline';
import EvaCommandPanels from './EvaCommandPanels';

function EvaDataStream() {
  const [lines, setLines] = useState([]);

  useEffect(() => {
    const gen = () => {
      const chars = '0123456789ABCDEF';
      const hexBlock = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * 16)]).join('');
      return `${hexBlock()} ${hexBlock()} ${hexBlock()}`;
    };
    setLines(Array.from({ length: 20 }, gen));
    const id = setInterval(() => {
      setLines((prev) => [...prev.slice(1), gen()]);
    }, 300);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="eva-data-stream">
      {lines.map((line, i) => (
        <div key={i} className="eva-data-stream-line" style={{ opacity: 0.15 + (i / 20) * 0.25 }}>
          {line}
        </div>
      ))}
    </div>
  );
}

function EvaTelemetry({ projects }) {
  const [allTasks, setAllTasks] = useState([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    window.api.getAllTasks().then(setAllTasks).catch(() => {});
  }, [projects]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  const total = allTasks.length;
  const done = allTasks.filter((t) => t.status === 'done').length;
  const active = allTasks.filter((t) => t.status === 'in_progress').length;
  const queued = allTasks.filter((t) => t.status === 'todo').length;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;

  const sparkData = generateSparkData('telemetry-' + tick, 24);

  return (
    <div className="eva-telemetry">
      <div className="eva-telemetry-left">
        <div className="eva-telemetry-label">System Telemetry</div>
        <div className="eva-telemetry-stats">
          <span><span className="eva-tele-key">TASKS</span> <span className="eva-tele-val">{total}</span></span>
          <span><span className="eva-tele-key">QUEUE</span> <span className="eva-tele-val">{queued}</span></span>
          <span><span className="eva-tele-key">ACTIVE</span> <span className="eva-tele-val eva-tele-green">{active}</span></span>
          <span><span className="eva-tele-key">DONE</span> <span className="eva-tele-val eva-tele-green">{done}</span></span>
          <span><span className="eva-tele-key">RATE</span> <span className="eva-tele-val">{rate}%</span></span>
        </div>
      </div>
      <div className="eva-telemetry-spark">
        <Sparkline data={sparkData} width={200} height={28} color="#ff6a00" glow animated />
      </div>
    </div>
  );
}

function EvaReticle() {
  return (
    <svg className="eva-reticle" width="60" height="60" viewBox="0 0 60 60">
      <circle cx="30" cy="30" r="20" fill="none" stroke="rgba(255,106,0,0.12)" strokeWidth="1" />
      <circle cx="30" cy="30" r="12" fill="none" stroke="rgba(255,106,0,0.08)" strokeWidth="1" strokeDasharray="3 3" />
      <line x1="30" y1="5" x2="30" y2="15" stroke="rgba(255,106,0,0.15)" strokeWidth="1" />
      <line x1="30" y1="45" x2="30" y2="55" stroke="rgba(255,106,0,0.15)" strokeWidth="1" />
      <line x1="5" y1="30" x2="15" y2="30" stroke="rgba(255,106,0,0.15)" strokeWidth="1" />
      <line x1="45" y1="30" x2="55" y2="30" stroke="rgba(255,106,0,0.15)" strokeWidth="1" />
    </svg>
  );
}

export default function Dashboard({ projects, onOpenProject, onEdit, hasApiKey, onOpenSettings, addToast, gmiMode, magiBarOpen, onOpenMagi }) {
  const [lastScanned, setLastScanned] = useState(null);

  useEffect(() => {
    const latest = projects.reduce((latest, p) => {
      if (p.brief_timestamp && (!latest || p.brief_timestamp > latest)) return p.brief_timestamp;
      return latest;
    }, null);
    if (latest) setLastScanned(latest);
  }, [projects]);

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const diff = Date.now() - new Date(timestamp + 'Z').getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const activeCount = projects.filter((p) => p.status === 'active').length;
  const pausedCount = projects.filter((p) => p.status === 'paused').length;

  return (
    <div className={`dashboard fade-in ${gmiMode ? 'eva-command-centre' : ''}`}>
      {gmiMode && <EvaDataStream />}
      {gmiMode && <EvaReticle />}

      {!hasApiKey && (
        <div className="api-banner">
          <span>{gmiMode ? 'API KEY NOT CONFIGURED // AI SYSTEMS OFFLINE' : 'No API key configured. AI features won\'t work until you add one.'}</span>
          <button className="btn btn-sm btn-primary" onClick={onOpenSettings}>
            {gmiMode ? 'Configure' : 'Open Settings'}
          </button>
        </div>
      )}

      {gmiMode ? (
        <div className="eva-dashboard-header">
          <div className="eva-dashboard-title">
            MAGI System // All Units
            <span className="eva-unit-count">[{projects.length} REGISTERED]</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {activeCount > 0 && <span style={{ fontSize: 10, color: '#00ff41', letterSpacing: '0.08em' }}>ACTIVE: {activeCount}</span>}
            {pausedCount > 0 && <span style={{ fontSize: 10, color: '#ffd600', letterSpacing: '0.08em' }}>STANDBY: {pausedCount}</span>}
            {lastScanned && <span className="last-scanned">Last scan: {formatTimeAgo(lastScanned)}</span>}
          </div>
        </div>
      ) : (
        <div className="dashboard-header">
          <div />
          {lastScanned && (
            <span className="last-scanned">Last scanned: {formatTimeAgo(lastScanned)}</span>
          )}
        </div>
      )}

      <UrgentPanel gmiMode={gmiMode} onOpenProject={onOpenProject} />

      {projects.length === 0 ? (
        <div className="empty-state">
          <p>{gmiMode ? 'No units registered. Register your first unit to begin monitoring.' : 'No projects yet. Add your first project to get started.'}</p>
          <button className="btn btn-primary" onClick={() => onEdit(null)}>
            {gmiMode ? '+ Register Unit' : '+ Add Project'}
          </button>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map((project, i) => (
            <ProjectCard
              key={project.id}
              project={project}
              index={i}
              onClick={() => onOpenProject(project.id)}
              onEdit={() => onEdit(project)}
              style={{ animationDelay: `${i * 0.04}s` }}
              gmiMode={gmiMode}
            />
          ))}
        </div>
      )}

      {gmiMode && projects.length > 0 && <EvaTelemetry projects={projects} />}
      {gmiMode && <EvaCommandPanels />}

      {onOpenMagi && !magiBarOpen && (
        <button className="magi-fab" onClick={onOpenMagi} title={gmiMode ? 'MAGI-04 // Voice Operator' : 'Voice Assistant'}>
          <svg className="magi-fab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
          <span className="magi-fab-label">{gmiMode ? 'MAGI' : 'VOICE'}</span>
          <span className="magi-fab-ring" />
          <span className="magi-fab-ring magi-fab-ring-2" />
        </button>
      )}
    </div>
  );
}
