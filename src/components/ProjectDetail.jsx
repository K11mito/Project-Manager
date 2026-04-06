import React, { useState, useEffect, useCallback } from 'react';
import AIBrief from './AIBrief';
import CommitList from './CommitList';
import FileTree from './FileTree';
import KanbanBoard from './KanbanBoard';

export default function ProjectDetail({ projectId, onBack, onDelete, onUpdate, addToast, refreshProjects, gmiMode }) {
  const [project, setProject] = useState(null);
  const [scanData, setScanData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const loadProject = useCallback(async () => {
    try {
      const projects = await window.api.getProjects();
      const p = projects.find((p) => p.id === projectId);
      if (p) {
        setProject(p);
        setNameInput(p.name);
      }
    } catch (err) {
      addToast('Failed to load project');
    }
  }, [projectId, addToast]);

  const loadScan = useCallback(async () => {
    try {
      const data = await window.api.scanProject(projectId);
      setScanData(data);
    } catch (err) {
      // scan may fail if no folder
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
    loadScan();
  }, [loadProject, loadScan]);

  const handleRescan = async () => {
    setLoading(true);
    await loadScan();
    addToast('Scan complete', 'success');
  };

  const handleNameSave = async () => {
    if (nameInput.trim() && nameInput !== project.name) {
      await onUpdate(projectId, { name: nameInput.trim() });
      await loadProject();
    }
    setEditingName(false);
  };

  const handleStatusChange = async (newStatus) => {
    await onUpdate(projectId, { status: newStatus });
    await loadProject();
    refreshProjects();
  };

  if (!project) {
    return (
      <div className="project-detail">
        <div className="detail-left" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  const statusClass = {
    active: 'status-active',
    paused: 'status-paused',
    idea: 'status-idea',
  }[project.status] || 'status-idea';

  return (
    <div className="project-detail">
      <div className="detail-left">
        <div className="detail-header">
          <button className="back-btn" onClick={onBack}>&larr;</button>

          {editingName ? (
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
              autoFocus
              style={{ fontSize: 20, fontWeight: 700, background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent)', color: 'var(--text)', padding: 0, outline: 'none' }}
            />
          ) : (
            <span className="detail-name" onClick={() => setEditingName(true)} style={{ cursor: 'pointer' }}>
              {project.name}
            </span>
          )}

          <select
            value={project.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className={`status-pill ${statusClass}`}
            style={{ cursor: 'pointer', border: 'none', appearance: 'none', padding: '2px 8px' }}
          >
            <option value="active">{gmiMode ? 'Operational' : 'Active'}</option>
            <option value="paused">{gmiMode ? 'Standby' : 'Paused'}</option>
            <option value="idea">{gmiMode ? 'Concept' : 'Idea'}</option>
          </select>

          <div style={{ flex: 1 }} />

          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (confirm(gmiMode ? 'Confirm unit termination? All task data will be lost.' : 'Delete this project and all its tasks?')) {
                onDelete(projectId);
              }
            }}
            style={{ color: '#ef4444' }}
          >
            {gmiMode ? 'Terminate' : 'Delete'}
          </button>
        </div>

        {gmiMode && <div className="eva-section-label"><span className="eva-sec-id">SEC-01</span> Intelligence Brief</div>}
        <AIBrief project={project} onRefresh={loadProject} addToast={addToast} gmiMode={gmiMode} />

        {gmiMode && <div className="eva-section-label"><span className="eva-sec-id">SEC-02</span> Commit Log</div>}
        <CommitList project={project} gmiMode={gmiMode} />

        {scanData && scanData.tree && (
          <>
            {gmiMode && <div className="eva-section-label"><span className="eva-sec-id">SEC-03</span> File Structure</div>}
            <FileTree tree={scanData.tree} gmiMode={gmiMode} />
          </>
        )}
      </div>

      <div className="detail-right">
        <KanbanBoard projectId={projectId} projectName={project.name} addToast={addToast} gmiMode={gmiMode} />
      </div>
    </div>
  );
}
