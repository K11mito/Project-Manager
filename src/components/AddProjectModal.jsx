import React, { useState } from 'react';

export default function AddProjectModal({ project, onSave, onClose, gmiMode }) {
  const [name, setName] = useState(project?.name || '');
  const [folderPath, setFolderPath] = useState(project?.folder_path || '');
  const [githubUrl, setGithubUrl] = useState(project?.github_url || '');
  const [status, setStatus] = useState(project?.status || 'active');
  const [thumbnailPath, setThumbnailPath] = useState(project?.thumbnail_path || '');

  const handlePickFolder = async () => {
    const path = await window.api.openFolderDialog();
    if (path) setFolderPath(path);
  };

  const handlePickThumbnail = async () => {
    const path = await window.api.openFileDialog();
    if (path) setThumbnailPath(path);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      folder_path: folderPath || null,
      github_url: githubUrl || null,
      status,
      thumbnail_path: thumbnailPath || null,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{project ? (gmiMode ? 'Modify Unit' : 'Edit Project') : (gmiMode ? 'Register New Unit' : 'Add Project')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{gmiMode ? 'Unit Designation' : 'Project Name'}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={gmiMode ? 'UNIT DESIGNATION' : 'My Side Project'}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>{gmiMode ? 'Local Directory Path' : 'Local Folder Path'}</label>
            <div className="form-row">
              <input type="text" value={folderPath} onChange={(e) => setFolderPath(e.target.value)} placeholder={gmiMode ? '/PATH/TO/UNIT' : '/path/to/project'} readOnly />
              <button type="button" className="btn btn-ghost" onClick={handlePickFolder}>Browse</button>
            </div>
          </div>

          <div className="form-group">
            <label>{gmiMode ? 'Repository URL' : 'GitHub Repo URL (optional)'}</label>
            <input
              type="text"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/user/repo"
            />
          </div>

          <div className="form-group">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">{gmiMode ? 'Operational' : 'Active'}</option>
              <option value="paused">{gmiMode ? 'Standby' : 'Paused'}</option>
              <option value="idea">{gmiMode ? 'Concept' : 'Idea'}</option>
            </select>
          </div>

          {!gmiMode && (
            <div className="form-group">
              <label>Thumbnail (optional)</label>
              <div className="form-row">
                <input type="text" value={thumbnailPath} readOnly placeholder="Auto-generated gradient" />
                <button type="button" className="btn btn-ghost" onClick={handlePickThumbnail}>Upload</button>
              </div>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{gmiMode ? 'Abort' : 'Cancel'}</button>
            <button type="submit" className="btn btn-primary">
              {project ? (gmiMode ? 'Confirm Changes' : 'Save Changes') : (gmiMode ? 'Register Unit' : 'Add Project')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
