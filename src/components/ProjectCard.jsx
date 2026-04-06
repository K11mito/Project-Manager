import React, { useState, useEffect } from 'react';
import Sparkline, { generateSparkData } from './Sparkline';

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function generateGradient(name) {
  const h = hashCode(name);
  const hue1 = h % 360;
  const hue2 = (h * 7 + 120) % 360;
  const angle = (h * 3) % 360;
  return `linear-gradient(${angle}deg, hsl(${hue1}, 60%, 25%), hsl(${hue2}, 50%, 20%))`;
}

export default function ProjectCard({ project, index, onClick, onEdit, style, gmiMode }) {
  const [thumbnail, setThumbnail] = useState(null);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    if (project.thumbnail_path) {
      window.api.loadThumbnail(project.thumbnail_path).then((data) => {
        if (data) setThumbnail(data);
      });
    }
  }, [project.thumbnail_path]);

  useEffect(() => {
    window.api.getTasksByProject(project.id).then(setTasks).catch(() => {});
  }, [project.id]);

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const progress = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

  const briefToday = project.brief_timestamp
    ? new Date(project.brief_timestamp + 'Z').toDateString() === new Date().toDateString()
    : false;

  const briefTime = project.brief_timestamp
    ? new Date(project.brief_timestamp + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const firstBullet = project.brief
    ? project.brief.split('\n').find((l) => l.trim().length > 0)?.replace(/^[-\u2022*]\s*/, '') || ''
    : '';

  const statusClass = {
    active: 'status-active',
    paused: 'status-paused',
    idea: 'status-idea',
  }[project.status] || 'status-idea';

  const unitNum = String(index !== undefined ? index + 1 : project.id).padStart(2, '0');

  // Sparkline data based on project
  const sparkData = generateSparkData(project.name + project.id, 14);
  const sparkColor = gmiMode
    ? (project.status === 'active' ? '#00ff41' : '#ff6a00')
    : (project.status === 'active' ? '#22c55e' : '#6c63ff');

  return (
    <div className="project-card" onClick={onClick} style={style}>
      {gmiMode ? (
        <div className="card-thumbnail" style={{ background: 'linear-gradient(90deg, rgba(255,106,0,0.15), transparent)' }} />
      ) : thumbnail ? (
        <img className="card-thumbnail" src={thumbnail} alt="" />
      ) : (
        <div className="card-thumbnail" style={{ background: generateGradient(project.name) }} />
      )}
      {gmiMode && (
        <div className="eva-unit-designation">Unit-{unitNum} // {project.status === 'active' ? 'operational' : project.status}</div>
      )}
      <div className="card-body">
        <div className="card-header">
          <span className="card-name">{project.name}</span>
          <span className={`status-pill ${statusClass}`}>{project.status}</span>
        </div>

        {firstBullet && <div className="card-summary">{firstBullet}</div>}

        <div className="card-sparkline">
          <Sparkline
            data={sparkData}
            width={gmiMode ? 120 : 100}
            height={gmiMode ? 28 : 22}
            color={sparkColor}
            glow={gmiMode}
            animated={gmiMode}
          />
        </div>

        <div className="card-meta">
          {totalTasks > 0 && (
            <div className="card-footer">
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="progress-text">{doneTasks}/{totalTasks}</span>
            </div>
          )}

          {briefToday && (
            <div className="brief-badge">
              {gmiMode ? `BRIEFED ${briefTime}` : `\u2713 Briefed at ${briefTime}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
