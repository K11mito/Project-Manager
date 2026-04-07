const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Projects
  getProjects: () => ipcRenderer.invoke('projects:getAll'),
  addProject: (data) => ipcRenderer.invoke('projects:add', data),
  updateProject: (id, data) => ipcRenderer.invoke('projects:update', id, data),
  deleteProject: (id) => ipcRenderer.invoke('projects:delete', id),
  scanRootFolder: () => ipcRenderer.invoke('projects:scanRootFolder'),

  // Tasks
  getAllTasks: () => ipcRenderer.invoke('tasks:getAll'),
  getTasksByProject: (projectId) => ipcRenderer.invoke('tasks:getByProject', projectId),
  addTask: (projectId, text, status, deadline) => ipcRenderer.invoke('tasks:add', projectId, text, status, deadline),
  updateTask: (id, data) => ipcRenderer.invoke('tasks:update', id, data),
  deleteTask: (id) => ipcRenderer.invoke('tasks:delete', id),

  // Scanner
  scanProject: (projectId) => ipcRenderer.invoke('scan:project', projectId),

  // AI Brief
  generateBrief: (projectId) => ipcRenderer.invoke('brief:generate', projectId),
  generateAllBriefs: () => ipcRenderer.invoke('brief:generateAll'),
  generateTasks: (projectId, goal) => ipcRenderer.invoke('ai:generateTasks', projectId, goal),

  // GitHub
  getCommits: (repoUrl) => ipcRenderer.invoke('github:getCommits', repoUrl),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),

  // Dialogs
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),

  // MAGI-04 Operator
  magiChat: (messages) => ipcRenderer.invoke('magi:chat', messages),
  magiChatWithVoice: (messages) => ipcRenderer.invoke('magi:chat-with-voice', messages),
  magiTranscribe: (audioBuffer) => ipcRenderer.invoke('magi:transcribe', audioBuffer),
  magiSpeak: (text) => ipcRenderer.invoke('magi:speak', text),
  magiPreviewVoice: (voice) => ipcRenderer.invoke('magi:preview-voice', voice),

  // Thumbnails
  loadThumbnail: (path) => ipcRenderer.invoke('thumbnail:load', path),

  // Greeting (clap/voice activation)
  onGreeting: (callback) => {
    ipcRenderer.on('greeting:show', (_, trigger) => callback(trigger));
  },
  removeGreetingListener: () => {
    ipcRenderer.removeAllListeners('greeting:show');
  },
});
