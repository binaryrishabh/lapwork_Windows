import { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import { autoUpdater } from 'electron-updater';

declare global {
  namespace Electron {
    interface App {
      isQuitting?: boolean;
    }
  }
}

// ===== CRASH GUARDS: log instead of dying =====
process.on('uncaughtException', (error) => {
  console.error('[MAIN] Uncaught exception (app kept alive):', error);
});
process.on('unhandledRejection', (reason) => {
  console.error('[MAIN] Unhandled rejection (app kept alive):', reason);
});

// SINGLE INSTANCE LOCK
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Disable DevTools
app.on('web-contents-created', (_event, contents) => {
  contents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
      event.preventDefault();
    }
  });
});

let mainWindow: BrowserWindow | null = null;
let miniWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let db: any = null;
let SQL: any = null;
let isRunning = false;
let isMinimizingFromMini = false;

// Helper to safely send IPC messages without crashing if window is destroyed/reloading
function safeSend(win: BrowserWindow | null | undefined, channel: string, ...args: any[]) {
  try {
    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  } catch (e) {
    // Silently ignore IPC send errors to prevent main process crash
  }
}

// ===== DATABASE FUNCTIONS =====
async function initDatabase() {
  const sqlModule: any = await import('sql.js');
  const initSqlJs = sqlModule.default || sqlModule;
  SQL = await initSqlJs();

  const dbPath = getDbPath();

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    total_ms INTEGER NOT NULL DEFAULT 0,
    note TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS laps (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    number INTEGER NOT NULL,
    lap_time_ms INTEGER NOT NULL,
    split_ms INTEGER NOT NULL,
    note TEXT DEFAULT '',
    flagged INTEGER DEFAULT 0,
    timestamp TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS distractions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    name TEXT DEFAULT '',
    start_ms INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    note TEXT DEFAULT '',
    timestamp TEXT NOT NULL
  )`);

  saveDatabase();
}

function getDbPath(): string {
  return app.isPackaged
    ? path.join(app.getPath('userData'), 'lapwork.db')
    : path.join(app.getPath('userData'), 'lapwork-dev.db');
}

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(getDbPath(), Buffer.from(data));
}

// ===== TRAY =====
function createTray() {
  try {
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'icon.ico')
      : path.join(__dirname, '..', 'build', 'icon.ico');

    if (!fs.existsSync(iconPath)) {
      console.warn('Tray icon not found:', iconPath);
      return;
    }

    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

    if (icon.isEmpty()) {
      console.warn('Tray icon is empty:', iconPath);
      return;
    }

    tray = new Tray(icon);
    updateTrayMenu();
    tray.setToolTip('lapwork');

    tray.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (error) {
    console.error('Tray creation failed:', error);
  }
}

function updateTrayMenu() {
  if (!tray) return;
  const contextMenu = Menu.buildFromTemplate([
    { label: isRunning ? '⏸ Stop Stopwatch' : '▶ Start Stopwatch', click: () => safeSend(mainWindow, 'global-shortcut', 'space') },
    { label: '🏁 Add Lap', click: () => safeSend(mainWindow, 'global-shortcut', 'l') },
    { type: 'separator' },
    { label: 'Show Window', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(contextMenu);
}

// ===== IPC HANDLERS =====
function setupIpcHandlers() {
  // ===== Database Handlers =====
  ipcMain.handle('db:save-session', async (_event, session: any) => {
    if (!db) return { success: false, error: 'Database not initialized' };
    try {
      db.run('DELETE FROM laps WHERE session_id = ?', [session.id]);
      db.run('DELETE FROM distractions WHERE session_id = ?', [session.id]);
      db.run(
        `INSERT OR REPLACE INTO sessions (id, name, date, total_ms, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [session.id, session.name || 'Untitled Session', session.date, Math.round(session.totalMs || 0), session.note || '', session.createdAt, new Date().toISOString()]
      );
      for (const lap of session.laps || []) {
        db.run(
          `INSERT OR REPLACE INTO laps (id, session_id, number, lap_time_ms, split_ms, note, flagged, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [lap.id, session.id, lap.number, Math.round(lap.time || 0), Math.round(lap.split || 0), lap.note || '', lap.flagged ? 1 : 0, lap.timestamp]
        );
      }
      for (const d of session.distractions || []) {
        db.run(
          `INSERT OR REPLACE INTO distractions (id, session_id, name, start_ms, duration_ms, note, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [d.id, session.id, d.name || '', Math.round(d.startMs || 0), Math.round(d.durationMs || 0), d.note || '', d.timestamp]
        );
      }
      saveDatabase();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db:get-sessions', () => {
    if (!db) return [];
    const sessions: any[] = [];
    const stmt = db.prepare('SELECT * FROM sessions ORDER BY date DESC');
    while (stmt.step()) {
      const s = stmt.getAsObject();
      const session = { ...s, totalMs: s.total_ms, laps: [], distractions: [] };
      const lstmt = db.prepare('SELECT * FROM laps WHERE session_id = ? ORDER BY number ASC');
      lstmt.bind([session.id]);
      while (lstmt.step()) {
        const l = lstmt.getAsObject();
        session.laps.push({ ...l, time: l.lap_time_ms, split: l.split_ms, flagged: l.flagged === 1 });
      }
      lstmt.free();
      const dstmt = db.prepare('SELECT * FROM distractions WHERE session_id = ? ORDER BY start_ms ASC');
      dstmt.bind([session.id]);
      while (dstmt.step()) {
        const d = dstmt.getAsObject();
        session.distractions.push({ ...d, startMs: d.start_ms, durationMs: d.duration_ms });
      }
      dstmt.free();
      sessions.push(session);
    }
    stmt.free();
    return sessions;
  });

  ipcMain.handle('db:get-sessions-by-date', (_event, date: string) => {
    if (!db) return [];
    const sessions: any[] = [];
    const stmt = db.prepare('SELECT * FROM sessions WHERE date LIKE ? ORDER BY created_at DESC');
    stmt.bind([date + '%']);
    while (stmt.step()) {
      const s = stmt.getAsObject();
      sessions.push({ ...s, totalMs: s.total_ms, laps: [], distractions: [] });
    }
    stmt.free();
    return sessions;
  });

  ipcMain.handle('get-is-running', () => isRunning);

  ipcMain.handle('db:delete-session', (_event, id: string) => {
    if (!db) return { success: false, error: 'Database not initialized' };
    try {
      db.run('DELETE FROM laps WHERE session_id = ?', [id]);
      db.run('DELETE FROM distractions WHERE session_id = ?', [id]);
      db.run('DELETE FROM sessions WHERE id = ?', [id]);
      saveDatabase();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  // ===== State Sync (✅ NaN-safe & throttled tray updates) =====
  ipcMain.handle('update-running-state', (_event, running: boolean, elapsedMs: number, isDistracted: boolean, distractionName: string, distractionElapsed: number) => {
    const newRunning = !!running;
    
    // ✅ CRITICAL FIX: Only rebuild the tray menu when the running state ACTUALLY flips.
    // Rebuilding it 60x/sec causes a fatal Windows GDI crash that silently kills the app.
    if (newRunning !== isRunning) {
      isRunning = newRunning;
      updateTrayMenu();
    }

    safeSend(miniWindow, 'stopwatch-state-update', {
      isRunning: newRunning,
      elapsedMs: Number.isFinite(elapsedMs) ? elapsedMs : 0,
      isDistracted: !!isDistracted,
      distractionName: distractionName || '',
      distractionElapsed: Number.isFinite(distractionElapsed) ? distractionElapsed : 0,
    });
  });

  ipcMain.handle('confirm-quit', () => {
    app.isQuitting = true;
    app.quit();
  });

  ipcMain.on('mini-command', (_event, command: string) => {
    safeSend(mainWindow, 'global-shortcut',
      command === 'toggle' ? 'space' :
      command === 'd' ? 'd' :
      command === 'reset' ? 'ctrl+r' :
      command === 'save' ? 'ctrl+s' : command
    );
  });

  // ===== Window Management =====
  ipcMain.handle('minimize-to-tray', () => {
    if (miniWindow && !miniWindow.isDestroyed()) miniWindow.close();
    if (mainWindow && !mainWindow.isDestroyed()) {
      isMinimizingFromMini = true;
      mainWindow.show();
      mainWindow.minimize();
    }
  });

  ipcMain.on('sync-elapsed-to-main', (_event, elapsedMs: number) => {
    safeSend(mainWindow, 'sync-elapsed-from-mini', Number.isFinite(elapsedMs) ? elapsedMs : 0);
  });

  ipcMain.on('distraction-stop-with-name', (_event, name: string) => {
    safeSend(mainWindow, 'distraction-stop-with-name', name);
  });

  ipcMain.handle('restore-main-window', () => {
    if (miniWindow && !miniWindow.isDestroyed()) miniWindow.close();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  ipcMain.handle('restore-main-window-and-close', () => {
    if (miniWindow && !miniWindow.isDestroyed()) miniWindow.close();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      safeSend(mainWindow, 'before-close');
    }
  });

  ipcMain.handle('resize-mini-window', (_event, width: number, height: number) => {
    try {
      if (miniWindow && !miniWindow.isDestroyed() && Number.isFinite(width) && Number.isFinite(height)) {
        miniWindow.setSize(Math.round(width), Math.round(height));
      }
    } catch (e) { console.warn('[MAIN] resize-mini-window failed:', e); }
  });

  ipcMain.handle('set-mini-max-size', (_event, width: number, height: number) => {
    try {
      if (miniWindow && !miniWindow.isDestroyed() && Number.isFinite(width) && Number.isFinite(height)) {
        const [minW, minH] = miniWindow.getMinimumSize();
        // ✅ Never allow max < min (fatal Electron CHECK on Windows)
        miniWindow.setMaximumSize(Math.max(width, minW), Math.max(height, minH));
      }
    } catch (e) { console.warn('[MAIN] set-mini-max-size failed:', e); }
  });

  ipcMain.handle('set-mini-min-size', (_event, width: number, height: number) => {
    try {
      if (miniWindow && !miniWindow.isDestroyed() && Number.isFinite(width) && Number.isFinite(height)) {
        const [maxW, maxH] = miniWindow.getMaximumSize();
        // ✅ Never allow min > max
        miniWindow.setMinimumSize(Math.min(width, maxW), Math.min(height, maxH));
      }
    } catch (e) { console.warn('[MAIN] set-mini-min-size failed:', e); }
  });

  ipcMain.on('focus-mini-window', () => {
    if (miniWindow && !miniWindow.isDestroyed()) {
      miniWindow.focus();
    }
  });
}

// ===== MINI WINDOW =====
async function createMiniWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.focus();
    return;
  }

  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '..', 'build', 'icon.ico');

  // ✅ Create as a local const first — it can never be null
  const win = new BrowserWindow({
    width: 220,
    height: 200,
    minWidth: 100,
    minHeight: 22,
    maxWidth: 320,
    maxHeight: 350,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    transparent: true,
    backgroundColor: '#00000000',
    show: false,
    roundedCorners: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  miniWindow = win; // assign to the shared variable only once

  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:5173/mini.html');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'mini.html'));
  }

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    win.setPosition(width - 300, height - 260);
    safeSend(mainWindow, 'get-stopwatch-state'); // ✅ Use safeSend
  });

  win.on('blur', () => safeSend(win, 'window-blur'));
  win.on('focus', () => safeSend(win, 'window-focus'));

  // ✅ FIX: Just set miniWindow to null. Do NOT attach mainWindow listeners here!
  win.on('closed', () => {
    miniWindow = null;
  });
}

// ===== MAIN WINDOW =====
function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '..', 'build', 'icon.ico');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'lapwork',
    show: false,
    backgroundColor: '#0f0f0f',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.maximize();

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow!.show();
  });

  mainWindow.on('minimize', () => {
    if (isMinimizingFromMini) {
      isMinimizingFromMini = false;
      return;
    }
    createMiniWindow();
    mainWindow!.hide();
  });

  mainWindow.on('show', () => {
    mainWindow!.maximize();
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      safeSend(mainWindow, 'before-close'); // ✅ Use safeSend instead of raw send
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ===== APP LIFECYCLE =====
app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'icon.ico')
      : path.join(__dirname, '..', 'build', 'icon.ico');
    app.setAppUserModelId('com.lapwork.desktop');    
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      app.dock?.setIcon(icon); 
    }
  }

  await initDatabase();
  setupIpcHandlers();
  createWindow();
  createTray();

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.warn('Update check failed:', err);
    });
    setInterval(() => {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.warn('Update check failed:', err);
      });
    }, 3 * 60 * 60 * 1000);
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  globalShortcut.unregisterAll();
  if (miniWindow && !miniWindow.isDestroyed()) miniWindow.close();
  if (db) db.close();
});