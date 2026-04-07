import React, { useState, useEffect, useCallback, useRef } from 'react';
import Dashboard from './components/Dashboard';
import ProjectDetail from './components/ProjectDetail';
import Settings from './components/Settings';
import AddProjectModal from './components/AddProjectModal';
import MagiOperator from './components/MagiOperator';
import MagiHero from './components/MagiHero';
import MagiBar from './components/MagiBar';

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

const normalGreetings = {
  morning: [
    { greeting: 'Good morning!', subtitle: 'What shall we work on today?' },
    { greeting: 'Rise and shine!', subtitle: 'Ready to build something great?' },
    { greeting: 'Morning!', subtitle: "Let's get productive today." },
  ],
  afternoon: [
    { greeting: 'Good afternoon!', subtitle: "What's on the agenda?" },
    { greeting: 'Hey there!', subtitle: "Let's keep the momentum going." },
    { greeting: 'Afternoon!', subtitle: 'What shall we tackle next?' },
  ],
  evening: [
    { greeting: 'Good evening!', subtitle: 'Squeezing in some coding tonight?' },
    { greeting: 'Evening!', subtitle: 'What shall we work on tonight?' },
    { greeting: 'Hey, night owl!', subtitle: "Let's make some progress." },
  ],
  night: [
    { greeting: 'Burning the midnight oil?', subtitle: 'What are we building tonight?' },
    { greeting: 'Late night session!', subtitle: "Let's make it count." },
    { greeting: 'Still going strong!', subtitle: 'What shall we work on?' },
  ],
};

const gmiGreetings = {
  morning: [
    { greeting: 'SYSTEMS ONLINE', subtitle: 'Good morning, sir. All protocols are active and standing by.' },
    { greeting: 'USER AUTHENTICATED', subtitle: 'Morning check complete. What shall we focus on today?' },
    { greeting: 'INTERFACE ACTIVE', subtitle: 'Good morning. I am ready to assist with your projects.' },
  ],
  afternoon: [
    { greeting: 'SYSTEMS ONLINE', subtitle: 'Good afternoon, sir. All projects are synchronized and ready.' },
    { greeting: 'USER AUTHENTICATED', subtitle: 'Afternoon systems nominal. Awaiting your next command.' },
    { greeting: 'INTERFACE ACTIVE', subtitle: 'Good afternoon. How shall we proceed with the current tasks?' },
  ],
  evening: [
    { greeting: 'SYSTEMS ONLINE', subtitle: 'Good evening, sir. Evening protocols have been initialized.' },
    { greeting: 'USER AUTHENTICATED', subtitle: 'Good evening. I have optimized the workspace for low-light conditions.' },
    { greeting: 'INTERFACE ACTIVE', subtitle: 'Good evening, sir. Shall we review today\'s progress?' },
  ],
  night: [
    { greeting: 'NIGHT PROTOCOLS ACTIVE', subtitle: 'Working late, sir? All systems are at your disposal.' },
    { greeting: 'SYSTEMS ONLINE', subtitle: 'After-hours access granted. Standing by for late-night directives.' },
    { greeting: 'USER AUTHENTICATED', subtitle: 'Midnight protocols engaged. How can I assist you tonight?' },
  ],
};

function GreetingOverlay({ visible, onDismiss, gmiMode }) {
  const [phase, setPhase] = useState('entering');
  const greetingRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const spokenRef = useRef(false);

  const stopAudio = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch (e) { }
      sourceRef.current = null;
    }
  }, []);

  const playGreetingAudio = useCallback(async (text) => {
    try {
      const audioData = await window.api.magiSpeak(text);
      if (!audioData || audioData.length === 0) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
      const buffer = await ctx.decodeAudioData(audioData.slice(0).buffer);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      sourceRef.current = source;
      source.onended = () => { sourceRef.current = null; };
      source.start();
    } catch (e) {
      // TTS failure is non-fatal
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setPhase('entering');
      spokenRef.current = false;
      const enterTimer = setTimeout(() => setPhase('visible'), 50);
      const autoClose = setTimeout(() => {
        setPhase('exiting');
        setTimeout(() => { stopAudio(); onDismiss(); }, 600);
      }, 5000);
      return () => {
        clearTimeout(enterTimer);
        clearTimeout(autoClose);
      };
    }
  }, [visible, onDismiss, stopAudio]);

  if (!visible) return null;

  const timeOfDay = getTimeOfDay();
  const pool = gmiMode ? gmiGreetings[timeOfDay] : normalGreetings[timeOfDay];

  if (!greetingRef.current || !greetingRef.current._ts || Date.now() - greetingRef.current._ts > 2000) {
    const idx = Math.floor(Math.random() * pool.length);
    greetingRef.current = { ...pool[idx], _ts: Date.now() };
  }

  const { greeting, subtitle } = greetingRef.current;

  // Speak the greeting once
  if (!spokenRef.current) {
    spokenRef.current = true;
    playGreetingAudio(`${greeting}. ${subtitle}`);
  }

  const handleClick = () => {
    setPhase('exiting');
    setTimeout(() => { stopAudio(); onDismiss(); }, 600);
  };

  return (
    <div className={`greeting-overlay ${phase} ${gmiMode ? 'greeting-gmi' : ''}`} onClick={handleClick}>
      <div className="greeting-content">
        {gmiMode && <div className="greeting-gmi-border-top" />}
        <div className="greeting-text">{greeting}</div>
        <div className="greeting-subtitle">{subtitle}</div>
        {gmiMode && <div className="greeting-gmi-border-bottom" />}
        <div className="greeting-hint">{gmiMode ? '[ CLICK TO PROCEED ]' : 'Click anywhere to continue'}</div>
      </div>
    </div>
  );
}

function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => onDismiss(t.id)}>
          {t.type === 'error' ? '\u2716' : '\u2714'} {t.message}
        </div>
      ))}
    </div>
  );
}

function EvaTime() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('en-US', { hour12: false }) +
        '.' +
        String(now.getMilliseconds()).padStart(3, '0').slice(0, 2)
      );
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, []);
  return <span className="eva-time-display">{time}</span>;
}

export default function App() {
  const [view, setView] = useState('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [settings, setSettings] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [magiBarOpen, setMagiBarOpen] = useState(false);
  const [showGreeting, setShowGreeting] = useState(false);

  const gmiMode = settings?.gmiMode || false;

  const addToast = useCallback((message, type = 'error') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const data = await window.api.getProjects();
      setProjects(data);
    } catch (err) {
      addToast('Failed to load projects');
    }
  }, [addToast]);

  const loadSettings = useCallback(async () => {
    try {
      const s = await window.api.getSettings();
      setSettings(s);
    } catch (err) {
      addToast('Failed to load settings');
    }
  }, [addToast]);

  useEffect(() => {
    loadProjects();
    loadSettings();
  }, [loadProjects, loadSettings]);

  // Cmd+K to toggle MAGI-04 Operator
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOperatorOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for greeting events (clap/voice activation)
  useEffect(() => {
    if (window.api.onGreeting) {
      window.api.onGreeting(() => {
        setShowGreeting(true);
      });
      return () => {
        if (window.api.removeGreetingListener) {
          window.api.removeGreetingListener();
        }
      };
    }
  }, []);

  const openProject = (id) => {
    setSelectedProjectId(id);
    setView('detail');
  };

  const handleAddProject = async (data) => {
    try {
      await window.api.addProject(data);
      await loadProjects();
      setShowAddModal(false);
    } catch (err) {
      addToast('Failed to add project');
    }
  };

  const handleUpdateProject = async (id, data) => {
    try {
      await window.api.updateProject(id, data);
      await loadProjects();
      setEditProject(null);
      setShowAddModal(false);
    } catch (err) {
      addToast('Failed to update project');
    }
  };

  const handleDeleteProject = async (id) => {
    try {
      await window.api.deleteProject(id);
      await loadProjects();
      if (selectedProjectId === id) {
        setView('dashboard');
        setSelectedProjectId(null);
      }
    } catch (err) {
      addToast('Failed to delete project');
    }
  };

  const hasApiKey = !!(settings && (
    (settings.aiProvider === 'openai' && settings.openaiKey) ||
    (settings.aiProvider !== 'openai' && settings.anthropicKey)
  ));

  return (
    <div className={gmiMode ? 'gmi' : ''}>
      {gmiMode && (
        <>
          <div className="eva-hexgrid" />
          <div className="eva-scanlines" />
        </>
      )}

      {view === 'magi' && (
        <MagiHero
          onBack={() => setView('dashboard')}
          onProjectsChanged={loadProjects}
          gmiMode={gmiMode}
        />
      )}

      {view !== 'magi' && <><div className="topbar">
        <div className="topbar-left">
          {gmiMode ? (
            <div className="eva-topbar-brand">
              <span className="eva-nerv-logo">NERV</span>
              <div>
                <span className="topbar-title">
                  {view === 'detail' && (
                    <button className="back-btn" onClick={() => setView('dashboard')}>&larr;</button>
                  )}
                  {view === 'settings' && (
                    <button className="back-btn" onClick={() => setView('dashboard')}>&larr;</button>
                  )}
                </span>
                <div className="eva-system-title">Project Monitoring System v3.01</div>
              </div>
            </div>
          ) : (
            <span className="topbar-title">
              {view === 'dashboard' && 'Side Project Manager'}
              {view === 'detail' && (
                <button className="back-btn" onClick={() => setView('dashboard')}>
                  &larr;
                </button>
              )}
              {view === 'settings' && (
                <>
                  <button className="back-btn" onClick={() => setView('dashboard')}>
                    &larr;
                  </button>
                  {' '}Settings
                </>
              )}
            </span>
          )}
        </div>
        <div className="topbar-right">
          {gmiMode && (
            <div className="eva-topbar-status">
              <span><span className="eva-status-dot" />Systems Online</span>
              <EvaTime />
            </div>
          )}
          <button
            className="btn magi-operator-btn"
            onClick={() => setView('magi')}
          >
            <span className="magi-online-dot" />
            {gmiMode ? '// MAGI-04' : 'Assistant'}
          </button>
          {view === 'dashboard' && (
            <>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setEditProject(null);
                  setShowAddModal(true);
                }}
              >
                {gmiMode ? '+ Register Unit' : '+ Add Project'}
              </button>
              <button className="btn btn-ghost" onClick={() => setView('settings')}>
                &#9881;
              </button>
            </>
          )}
        </div>
      </div>

        {view === 'dashboard' && (
          <Dashboard
            projects={projects}
            onOpenProject={openProject}
            onEdit={(p) => {
              setEditProject(p);
              setShowAddModal(true);
            }}
            hasApiKey={hasApiKey}
            onOpenSettings={() => setView('settings')}
            addToast={addToast}
            gmiMode={gmiMode}
            magiBarOpen={magiBarOpen}
            onOpenMagi={() => setMagiBarOpen((prev) => !prev)}
          />
        )}

        {view === 'detail' && selectedProjectId && (
          <ProjectDetail
            projectId={selectedProjectId}
            onBack={() => setView('dashboard')}
            onDelete={handleDeleteProject}
            onUpdate={handleUpdateProject}
            addToast={addToast}
            refreshProjects={loadProjects}
            gmiMode={gmiMode}
          />
        )}

        {view === 'settings' && (
          <Settings
            settings={settings}
            onUpdate={loadSettings}
            addToast={addToast}
            gmiMode={gmiMode}
          />
        )}

        {showAddModal && (
          <AddProjectModal
            project={editProject}
            onSave={editProject ? (data) => handleUpdateProject(editProject.id, data) : handleAddProject}
            onClose={() => {
              setShowAddModal(false);
              setEditProject(null);
            }}
            gmiMode={gmiMode}
          />
        )}
      </>}

      <MagiOperator
        isOpen={operatorOpen}
        onClose={() => setOperatorOpen(false)}
        onProjectsChanged={loadProjects}
        gmiMode={gmiMode}
      />

      <MagiBar
        isOpen={magiBarOpen}
        onClose={() => setMagiBarOpen(false)}
        onProjectsChanged={loadProjects}
        gmiMode={gmiMode}
      />

      <GreetingOverlay
        visible={showGreeting}
        onDismiss={() => setShowGreeting(false)}
        gmiMode={gmiMode}
      />

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
