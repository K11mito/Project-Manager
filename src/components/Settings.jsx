import React, { useState, useEffect } from 'react';

export default function Settings({ settings, onUpdate, addToast, gmiMode }) {
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [aiProvider, setAiProvider] = useState('anthropic');
  const [githubToken, setGithubToken] = useState('');
  const [rootFolder, setRootFolder] = useState('');
  const [briefTime, setBriefTime] = useState('06:30');
  const [clapEnabled, setClapEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [gmiEnabled, setGmiEnabled] = useState(false);
  const [runningBrief, setRunningBrief] = useState(false);

  useEffect(() => {
    if (settings) {
      setAnthropicKey(settings.anthropicKey || '');
      setOpenaiKey(settings.openaiKey || '');
      setAiProvider(settings.aiProvider || 'anthropic');
      setGithubToken(settings.githubToken || '');
      setRootFolder(settings.rootFolder || '');
      setBriefTime(settings.briefTime || '06:30');
      setClapEnabled(settings.clapEnabled !== false);
      setVoiceEnabled(settings.voiceEnabled || false);
      setGmiEnabled(settings.gmiMode || false);
    }
  }, [settings]);

  const saveSetting = async (key, value) => {
    try {
      await window.api.setSetting(key, value);
      await onUpdate();
      addToast('Setting saved', 'success');
    } catch (err) {
      addToast('Failed to save setting');
    }
  };

  const handlePickRootFolder = async () => {
    const path = await window.api.openFolderDialog();
    if (path) {
      setRootFolder(path);
      saveSetting('rootFolder', path);
    }
  };

  const handleRunBrief = async () => {
    setRunningBrief(true);
    try {
      await window.api.generateAllBriefs();
      addToast(gmiMode ? 'All unit briefs compiled' : 'Morning brief complete', 'success');
    } catch (err) {
      addToast('Brief generation failed');
    } finally {
      setRunningBrief(false);
    }
  };

  const handleDiscoverProjects = async () => {
    try {
      const dirs = await window.api.scanRootFolder();
      if (dirs.length === 0) {
        addToast(gmiMode ? 'No subdirectories detected' : 'No subdirectories found in root folder');
        return;
      }
      const existing = await window.api.getProjects();
      const existingPaths = new Set(existing.map((p) => p.folder_path));

      let added = 0;
      for (const dir of dirs) {
        if (!existingPaths.has(dir.path)) {
          await window.api.addProject({
            name: dir.name,
            folder_path: dir.path,
            status: 'idea',
          });
          added++;
        }
      }

      addToast(gmiMode ? `${added} new unit(s) registered` : `Discovered ${added} new project(s)`, 'success');
    } catch (err) {
      addToast('Failed to scan root folder');
    }
  };

  return (
    <div className="settings fade-in">
      <h2>{gmiMode ? 'System Configuration' : 'Settings'}</h2>

      {/* GMI Mode Toggle */}
      <div className="gmi-toggle-section">
        <div className="settings-row" style={{ borderBottom: 'none', padding: 0 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: gmiMode ? 400 : 500, letterSpacing: gmiMode ? '0.06em' : undefined, textTransform: gmiMode ? 'uppercase' : undefined }}>
              {gmiMode ? 'GMI Mode // Active' : 'GMI Mode'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              {gmiMode ? 'Evangelion-inspired interface overlay active' : 'Neon Genesis Evangelion-inspired UI theme'}
            </div>
          </div>
          <div
            className={`toggle ${gmiEnabled ? 'on' : ''}`}
            onClick={() => {
              const val = !gmiEnabled;
              setGmiEnabled(val);
              saveSetting('gmiMode', val);
            }}
          />
        </div>
      </div>

      <div className="settings-group">
        <label>{gmiMode ? 'AI Provider' : 'AI Provider'}</label>
        <select
          value={aiProvider}
          onChange={(e) => {
            setAiProvider(e.target.value);
            saveSetting('aiProvider', e.target.value);
          }}
        >
          <option value="anthropic">{gmiMode ? 'Anthropic // Claude' : 'Anthropic (Claude)'}</option>
          <option value="openai">{gmiMode ? 'OpenAI // GPT-4o' : 'OpenAI (GPT-4o)'}</option>
        </select>
      </div>

      <div className="settings-group">
        <label>{gmiMode ? 'Anthropic API Key' : 'Anthropic API Key'}</label>
        <input
          type="password"
          value={anthropicKey}
          onChange={(e) => setAnthropicKey(e.target.value)}
          onBlur={() => saveSetting('anthropicKey', anthropicKey)}
          placeholder="sk-ant-..."
        />
      </div>

      <div className="settings-group">
        <label>{gmiMode ? 'OpenAI API Key' : 'OpenAI API Key'}</label>
        <input
          type="password"
          value={openaiKey}
          onChange={(e) => setOpenaiKey(e.target.value)}
          onBlur={() => saveSetting('openaiKey', openaiKey)}
          placeholder="sk-..."
        />
      </div>

      <div className="settings-group">
        <label>{gmiMode ? 'GitHub Access Token' : 'GitHub Personal Access Token'}</label>
        <input
          type="password"
          value={githubToken}
          onChange={(e) => setGithubToken(e.target.value)}
          onBlur={() => saveSetting('githubToken', githubToken)}
          placeholder="ghp_..."
        />
      </div>

      <div className="settings-group">
        <label>{gmiMode ? 'Root Projects Directory' : 'Root Projects Folder'}</label>
        <div className="form-row">
          <input type="text" value={rootFolder} readOnly placeholder={gmiMode ? '/ROOT/DIRECTORY' : '~/Projects'} />
          <button className="btn btn-ghost" onClick={handlePickRootFolder}>Browse</button>
        </div>
        {rootFolder && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleDiscoverProjects}
            style={{ marginTop: 8 }}
          >
            {gmiMode ? 'Scan for Units' : 'Discover Projects from Root Folder'}
          </button>
        )}
      </div>

      <div className="settings-group">
        <label>{gmiMode ? 'Morning Brief Schedule' : 'Morning Brief Time'}</label>
        <div className="form-row">
          <input
            type="time"
            value={briefTime}
            onChange={(e) => setBriefTime(e.target.value)}
            onBlur={() => saveSetting('briefTime', briefTime)}
          />
          <button className="btn btn-primary btn-sm" onClick={handleRunBrief} disabled={runningBrief}>
            {runningBrief ? <span className="spinner" /> : gmiMode ? 'Execute Brief' : 'Run Brief Now'}
          </button>
        </div>
      </div>

      <div className="settings-row">
        <div>
          <div style={{ fontSize: 13, fontWeight: gmiMode ? 400 : 500, letterSpacing: gmiMode ? '0.06em' : undefined, textTransform: gmiMode ? 'uppercase' : undefined }}>
            {gmiMode ? 'Acoustic Trigger // Double Clap' : 'Open on Double Clap'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {gmiMode ? 'Acoustic detection system for app activation' : 'Clap twice to show and focus the app window'}
          </div>
        </div>
        <div
          className={`toggle ${clapEnabled ? 'on' : ''}`}
          onClick={() => {
            const val = !clapEnabled;
            setClapEnabled(val);
            saveSetting('clapEnabled', val);
          }}
        />
      </div>

      <div className="settings-row">
        <div>
          <div style={{ fontSize: 13, fontWeight: gmiMode ? 400 : 500, letterSpacing: gmiMode ? '0.06em' : undefined, textTransform: gmiMode ? 'uppercase' : undefined }}>
            {gmiMode ? 'Voice Trigger // "Computer Start"' : 'Voice Activation'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {gmiMode ? 'Speech recognition trigger — say "computer start" to activate' : 'Say "computer start" to show and focus the app window'}
          </div>
        </div>
        <div
          className={`toggle ${voiceEnabled ? 'on' : ''}`}
          onClick={() => {
            const val = !voiceEnabled;
            setVoiceEnabled(val);
            saveSetting('voiceEnabled', val);
          }}
        />
      </div>
    </div>
  );
}
