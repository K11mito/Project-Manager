import React, { useState, useEffect } from 'react';

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function CommitList({ project }) {
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!project.github_url) return;

    setLoading(true);
    window.api
      .getCommits(project.github_url)
      .then(setCommits)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [project.github_url]);

  if (!project.github_url) return null;

  return (
    <div className="commits-panel">
      <h3>Recent Commits</h3>

      {loading ? (
        <div style={{ padding: '8px 0' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="loading-skeleton" style={{ height: 16, marginBottom: 8 }} />
          ))}
        </div>
      ) : commits.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>No commits found</div>
      ) : (
        commits.map((c, i) => (
          <div key={i} className="commit-item">
            <span className="commit-sha">{c.sha}</span>
            <span className="commit-msg">{c.message}</span>
            <span className="commit-time">{formatTimeAgo(c.date)}</span>
          </div>
        ))
      )}
    </div>
  );
}
