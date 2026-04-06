import React, { useState, useEffect, useCallback } from 'react';
import Dashboard from './components/Dashboard';
import ProjectDetail from './components/ProjectDetail';
import Settings from './components/Settings';
import AddProjectModal from './components/AddProjectModal';
import MagiOperator from './components/MagiOperator';

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

      <div className="topbar">
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
          {gmiMode && (
            <button
              className={`btn magi-operator-btn ${operatorOpen ? 'active' : ''}`}
              onClick={() => setOperatorOpen((prev) => !prev)}
            >
              {!operatorOpen && <span className="magi-online-dot" />}
              {operatorOpen ? '// DISCONNECT' : '// OPERATOR'}
            </button>
          )}
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

      <MagiOperator
        isOpen={operatorOpen}
        onClose={() => setOperatorOpen(false)}
        onProjectsChanged={loadProjects}
      />

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
