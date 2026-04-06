import React, { useState } from 'react';

export default function AIBrief({ project, onRefresh, addToast, gmiMode }) {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      await window.api.generateBrief(project.id);
      await onRefresh();
      addToast(gmiMode ? 'Intelligence brief compiled' : 'Brief generated', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to generate brief');
    } finally {
      setLoading(false);
    }
  };

  const briefTime = project.brief_timestamp
    ? new Date(project.brief_timestamp + 'Z').toLocaleString()
    : null;

  return (
    <div className="brief-panel">
      <h3>
        <span>{gmiMode ? 'AI Intelligence Brief' : 'AI Brief'}</span>
        <button className="btn btn-ghost btn-sm" onClick={handleGenerate} disabled={loading}>
          {loading ? <span className="spinner" /> : gmiMode ? 'Re-scan' : 'Re-scan now'}
        </button>
      </h3>

      {project.brief ? (
        <>
          <div className="brief-content">{project.brief}</div>
          {briefTime && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>
              {gmiMode ? `Compiled: ${briefTime}` : `Generated: ${briefTime}`}
            </div>
          )}
        </>
      ) : (
        <div className="brief-content" style={{ color: 'var(--muted)' }}>
          {gmiMode ? 'No intelligence data. Initiate scan to compile brief.' : 'No brief yet. Click "Re-scan now" to generate one.'}
        </div>
      )}
    </div>
  );
}
