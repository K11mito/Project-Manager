const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, systemPreferences, session } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const cron = require('node-cron');

const store = new Store();

// Database and modules - loaded after app is ready
let db, scanner, claude, github, cronManager, magi;

let mainWindow = null;
let clapWindow = null;
let tray = null;
let cronJob = null;

function getAIConfig() {
  const provider = store.get('aiProvider', 'anthropic');
  const apiKey = provider === 'openai'
    ? store.get('openaiKey')
    : store.get('anthropicKey');
  return { provider, apiKey };
}

function getDbPath() {
  return path.join(app.getPath('userData'), 'projects.db');
}

function getThumbnailDir() {
  const dir = path.join(app.getPath('userData'), 'thumbnails');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#0e0e0f',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createListenerWindow() {
  const clapEnabled = store.get('clapEnabled', true);
  const voiceEnabled = store.get('voiceEnabled', false);
  if (!clapEnabled && !voiceEnabled) return;

  clapWindow = new BrowserWindow({
    show: false,
    width: 1,
    height: 1,
    webPreferences: {
      preload: path.join(__dirname, 'clap-listener.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  clapWindow.loadFile(path.join(__dirname, 'clap.html'));
}

function recreateListenerWindow() {
  if (clapWindow) {
    clapWindow.destroy();
    clapWindow = null;
  }
  createListenerWindow();
}

function createTray() {
  // Create a simple 16x16 tray icon
  const icon = nativeImage.createFromBuffer(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABfSURBVDiNY/z//z8DEwMDAwMDAwOTnIICAwMDA8P/f/8YGBj+MTAxMDAwMDAw/P/3j4GBgYGBiQEKGBkYGBgYGP4z/GdgYGBg+M/wn4GJAQr+//vHwMDAyPCfkQEAP4oOeY3GLQQAAAAASUVORK5CYII=',
      'base64'
    )
  );

  tray = new Tray(icon);
  updateTrayMenu();
}

function updateTrayMenu() {
  const clapEnabled = store.get('clapEnabled', true);
  const voiceEnabled = store.get('voiceEnabled', false);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Clap to open: ${clapEnabled ? 'ON' : 'OFF'}`,
      click: () => {
        store.set('clapEnabled', !clapEnabled);
        recreateListenerWindow();
        updateTrayMenu();
      },
    },
    {
      label: `Voice activation: ${voiceEnabled ? 'ON' : 'OFF'}`,
      click: () => {
        store.set('voiceEnabled', !voiceEnabled);
        recreateListenerWindow();
        updateTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Open Project Manager',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
  tray.setToolTip('Side Project Manager');
}

function setupCron() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }

  const briefTime = store.get('briefTime', '06:30');
  const [hour, minute] = briefTime.split(':');

  cronJob = cron.schedule(`${minute} ${hour} * * *`, async () => {
    try {
      await runMorningBrief();
    } catch (err) {
      console.error('Morning brief failed:', err);
    }
  });
}

async function runMorningBrief() {
  const { provider, apiKey } = getAIConfig();
  if (!apiKey) return;

  const projects = db.getAllProjects().filter((p) => p.status === 'active');

  for (const project of projects) {
    try {
      const scanResult = await scanner.scanProject(project.folder_path);
      const tasks = db.getTasksByProject(project.id);

      const brief = await claude.generateBrief(provider, apiKey, {
        projectName: project.name,
        fileTree: scanResult.fileTree,
        fileContents: scanResult.fileContents,
        gitLog: scanResult.gitLog,
        tasks: tasks,
      });

      db.saveBrief(project.id, brief);
    } catch (err) {
      console.error(`Brief failed for ${project.name}:`, err);
    }
  }
}

// IPC Handlers
function setupIPC() {
  // Projects
  ipcMain.handle('projects:getAll', () => {
    return db.getAllProjects();
  });

  ipcMain.handle('projects:add', async (_, data) => {
    const project = db.addProject(data);
    return project;
  });

  ipcMain.handle('projects:update', (_, id, data) => {
    db.updateProject(id, data);
    return db.getProject(id);
  });

  ipcMain.handle('projects:delete', (_, id) => {
    db.deleteProject(id);
    return { success: true };
  });

  // Tasks
  ipcMain.handle('tasks:getByProject', (_, projectId) => {
    return db.getTasksByProject(projectId);
  });

  ipcMain.handle('tasks:getAll', () => {
    return db.getAllTasks();
  });

  ipcMain.handle('tasks:add', (_, projectId, text, status, deadline) => {
    return db.addTask(projectId, text, status || 'todo', deadline || null);
  });

  ipcMain.handle('tasks:update', (_, id, data) => {
    db.updateTask(id, data);
    return db.getTask(id);
  });

  ipcMain.handle('tasks:delete', (_, id) => {
    db.deleteTask(id);
    return { success: true };
  });

  // Scanner
  ipcMain.handle('scan:project', async (_, projectId) => {
    const project = db.getProject(projectId);
    if (!project || !project.folder_path) return null;
    return scanner.scanProject(project.folder_path);
  });

  // AI Brief
  ipcMain.handle('brief:generate', async (_, projectId) => {
    const { provider, apiKey } = getAIConfig();
    if (!apiKey) throw new Error('No API key configured');

    const project = db.getProject(projectId);
    if (!project) throw new Error('Project not found');

    const scanResult = project.folder_path
      ? await scanner.scanProject(project.folder_path)
      : { fileTree: '', fileContents: '', gitLog: '' };
    const tasks = db.getTasksByProject(projectId);

    const brief = await claude.generateBrief(provider, apiKey, {
      projectName: project.name,
      fileTree: scanResult.fileTree,
      fileContents: scanResult.fileContents,
      gitLog: scanResult.gitLog,
      tasks: tasks,
    });

    db.saveBrief(projectId, brief);
    return { brief, timestamp: new Date().toISOString() };
  });

  ipcMain.handle('brief:generateAll', async () => {
    await runMorningBrief();
    return { success: true };
  });

  // AI Task Delegation
  ipcMain.handle('ai:generateTasks', async (_, projectId, goal) => {
    const { provider, apiKey } = getAIConfig();
    if (!apiKey) throw new Error('No API key configured');

    const project = db.getProject(projectId);
    const tasks = await claude.generateTasks(provider, apiKey, project.name, goal);
    const addedTasks = [];
    for (const text of tasks) {
      addedTasks.push(db.addTask(projectId, text, 'todo'));
    }
    return addedTasks;
  });

  // GitHub
  ipcMain.handle('github:getCommits', async (_, repoUrl) => {
    const token = store.get('githubToken');
    if (!token || !repoUrl) return [];
    return github.getRecentCommits(token, repoUrl);
  });

  // Settings
  ipcMain.handle('settings:get', () => {
    return {
      anthropicKey: store.get('anthropicKey', ''),
      openaiKey: store.get('openaiKey', ''),
      aiProvider: store.get('aiProvider', 'anthropic'),
      githubToken: store.get('githubToken', ''),
      rootFolder: store.get('rootFolder', ''),
      briefTime: store.get('briefTime', '06:30'),
      clapEnabled: store.get('clapEnabled', true),
      voiceEnabled: store.get('voiceEnabled', false),
      gmiMode: store.get('gmiMode', false),
    };
  });

  ipcMain.handle('settings:set', (_, key, value) => {
    store.set(key, value);
    if (key === 'briefTime') setupCron();
    if (key === 'clapEnabled' || key === 'voiceEnabled') {
      recreateListenerWindow();
      updateTrayMenu();
    }
    return { success: true };
  });

  // Dialogs
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
    });
    if (result.canceled) return null;
    const srcPath = result.filePaths[0];
    const ext = path.extname(srcPath);
    const destName = `thumb_${Date.now()}${ext}`;
    const destPath = path.join(getThumbnailDir(), destName);
    fs.copyFileSync(srcPath, destPath);
    return destPath;
  });

  // Root folder scan
  ipcMain.handle('projects:scanRootFolder', async () => {
    const rootFolder = store.get('rootFolder');
    if (!rootFolder || !fs.existsSync(rootFolder)) return [];

    const entries = fs.readdirSync(rootFolder, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => ({
        name: e.name,
        path: path.join(rootFolder, e.name),
      }));
    return dirs;
  });

  // Thumbnail loading
  ipcMain.handle('thumbnail:load', async (_, thumbPath) => {
    if (!thumbPath || !fs.existsSync(thumbPath)) return null;
    const data = fs.readFileSync(thumbPath);
    const ext = path.extname(thumbPath).slice(1);
    return `data:image/${ext};base64,${data.toString('base64')}`;
  });

  // Clap detected
  ipcMain.on('clap:detected', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Voice detected — "computer start"
  ipcMain.on('voice:detected', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // MAGI-04 Operator
  ipcMain.handle('magi:chat', async (_, messages) => {
    return magi.chat(messages);
  });

  ipcMain.handle('magi:transcribe', async (_, audioBuffer) => {
    return magi.transcribe(audioBuffer);
  });
}

app.whenReady().then(async () => {
  // Request mic access on macOS
  if (process.platform === 'darwin') {
    try {
      await systemPreferences.askForMediaAccess('microphone');
    } catch (e) {
      console.log('Mic access request failed:', e);
    }
  }

  // Initialize modules
  db = require('./src/db')(getDbPath());
  scanner = require('./src/scanner');
  claude = require('./src/claude');
  github = require('./src/github');
  magi = require('./src/magi')(db, scanner, claude, store, app);

  // Allow microphone access for clap detection
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
      return;
    }
    callback(true);
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media') return true;
    return true;
  });

  setupIPC();
  createMainWindow();
  createTray();
  createListenerWindow();
  setupCron();
});

app.on('window-all-closed', () => {
  // Don't quit - keep tray alive
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createMainWindow();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (cronJob) cronJob.stop();
});
