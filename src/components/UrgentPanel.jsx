import React, { useState, useEffect } from 'react';

function getUrgency(deadline) {
  if (!deadline) return null;
  const now = Date.now();
  const dl = new Date(deadline + (deadline.includes('T') ? '' : 'T23:59:59')).getTime();
  const hoursLeft = (dl - now) / (1000 * 60 * 60);
  if (hoursLeft < 0) return { level: 'overdue', label: 'OVERDUE', hours: hoursLeft };
  if (hoursLeft <= 24) return { level: 'critical', label: formatCountdown(hoursLeft), hours: hoursLeft };
  if (hoursLeft <= 72) return { level: 'warning', label: formatCountdown(hoursLeft), hours: hoursLeft };
  return null;
}

function formatCountdown(hours) {
  if (hours < 1) {
    const mins = Math.max(1, Math.floor(hours * 60));
    return `${mins}m left`;
  }
  if (hours < 24) return `${Math.floor(hours)}h left`;
  const days = Math.floor(hours / 24);
  const h = Math.floor(hours % 24);
  return `${days}d ${h}h left`;
}

export default function UrgentPanel({ gmiMode, onOpenProject }) {
  const [urgentTasks, setUrgentTasks] = useState([]);

  useEffect(() => {
    loadUrgentTasks();
    const id = setInterval(loadUrgentTasks, 60000);
    return () => clearInterval(id);
  }, []);

  const loadUrgentTasks = async () => {
    try {
      const allTasks = await window.api.getAllTasks();
      const urgent = allTasks
        .filter((t) => t.status !== 'done' && t.deadline)
        .map((t) => ({ ...t, urgency: getUrgency(t.deadline) }))
        .filter((t) => t.urgency)
        .sort((a, b) => a.urgency.hours - b.urgency.hours);
      setUrgentTasks(urgent);
    } catch (err) {
      // silently fail
    }
  };

  if (urgentTasks.length === 0) return null;

  const overdue = urgentTasks.filter((t) => t.urgency.level === 'overdue');
  const critical = urgentTasks.filter((t) => t.urgency.level === 'critical');
  const warning = urgentTasks.filter((t) => t.urgency.level === 'warning');

  return (
    <div className={`urgent-panel ${gmiMode ? 'eva-urgent' : ''}`}>
      <div className="urgent-header">
        <span className="urgent-title">
          {gmiMode && <span className="urgent-blink" />}
          {gmiMode ? 'Priority Alert // Deadline Monitor' : 'Urgent Tasks'}
        </span>
        <span className="urgent-count">{urgentTasks.length}</span>
      </div>
      <div className="urgent-tasks">
        {overdue.length > 0 && (
          <div className="urgent-group urgent-overdue">
            {gmiMode && <div className="urgent-group-label">OVERDUE</div>}
            {overdue.map((t) => (
              <UrgentTask key={t.id} task={t} gmiMode={gmiMode} onOpenProject={onOpenProject} />
            ))}
          </div>
        )}
        {critical.length > 0 && (
          <div className="urgent-group urgent-critical">
            {gmiMode && <div className="urgent-group-label">CRITICAL // &lt;24H</div>}
            {critical.map((t) => (
              <UrgentTask key={t.id} task={t} gmiMode={gmiMode} onOpenProject={onOpenProject} />
            ))}
          </div>
        )}
        {warning.length > 0 && (
          <div className="urgent-group urgent-warning">
            {gmiMode && <div className="urgent-group-label">WARNING // &lt;72H</div>}
            {warning.map((t) => (
              <UrgentTask key={t.id} task={t} gmiMode={gmiMode} onOpenProject={onOpenProject} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UrgentTask({ task, gmiMode, onOpenProject }) {
  const levelClass = `urgent-${task.urgency.level}`;

  return (
    <div
      className={`urgent-task ${levelClass}`}
      onClick={() => onOpenProject && onOpenProject(task.project_id)}
      style={{ cursor: 'pointer' }}
    >
      <div className="urgent-task-indicator" />
      <div className="urgent-task-body">
        <span className="urgent-task-project">{task.project_name}</span>
        <span className="urgent-task-text">{task.text}</span>
      </div>
      <span className={`urgent-task-countdown ${levelClass}`}>
        {task.urgency.label}
      </span>
    </div>
  );
}
