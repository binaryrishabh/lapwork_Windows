import { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { autoUpdater } from 'electron-updater';
// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// SINGLE INSTANCE LOCK
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}
else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
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
let mainWindow = null;
let miniWindow = null;
let tray = null;
let db = null;
let SQL = null;
let isRunning = false;
let isMinimizingFromMini = false;
// ===== DATABASE FUNCTIONS =====
async function initDatabase() {
    SQL = await import('sql.js');
    const dbPath = getDbPath();
    if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        db = new SQL.Database(buffer);
    }
    else {
        db = new SQL.Database();
    }
    db.run('PRAGMA foreign_keys = ON');
    db.run(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, name TEXT NOT NULL, date TEXT NOT NULL, total_ms INTEGER NOT NULL DEFAULT 0, note TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS laps (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, number INTEGER NOT NULL, lap_time_ms INTEGER NOT NULL, split_ms INTEGER NOT NULL, note TEXT DEFAULT '', flagged INTEGER DEFAULT 0, timestamp TEXT NOT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS distractions (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, name TEXT DEFAULT '', start_ms INTEGER NOT NULL, duration_ms INTEGER NOT NULL DEFAULT 0, note TEXT DEFAULT '', timestamp TEXT NOT NULL)`);
    saveDatabase();
}
function getDbPath() {
    return app.isPackaged
        ? path.join(app.getPath('userData'), 'daily-tracker.db')
        : path.join(app.getPath('userData'), 'daily-tracker-dev.db');
}
function saveDatabase() {
    if (!db)
        return;
    const data = db.export();
    fs.writeFileSync(getDbPath(), Buffer.from(data));
}
// ===== TRAY =====
function createTray() {
    const iconPath = app.isPackaged
        ? path.join(process.resourcesPath, 'icon.ico')
        : path.join(__dirname, '..', 'build', 'icon.ico');
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    updateTrayMenu();
    tray.setToolTip('DailyTracker');
    tray.on('click', () => { if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
    } });
}
function updateTrayMenu() {
    const contextMenu = Menu.buildFromTemplate([
        { label: isRunning ? '⏸ Stop Stopwatch' : '▶ Start Stopwatch', click: () => mainWindow?.webContents.send('global-shortcut', 'space') },
        { label: '🏁 Add Lap', click: () => mainWindow?.webContents.send('global-shortcut', 'l') },
        { type: 'separator' },
        { label: 'Show Window', click: () => { if (mainWindow) {
                mainWindow.show();
                mainWindow.focus();
            } } },
        { type: 'separator' },
        { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
    ]);
    tray.setContextMenu(contextMenu);
}
// ===== IPC HANDLERS =====
function setupIpcHandlers() {
    ipcMain.handle('db:save-session', async (_event, session) => {
        try {
            db.run('DELETE FROM laps WHERE session_id = ?', [session.id]);
            db.run('DELETE FROM distractions WHERE session_id = ?', [session.id]);
            db.run(`INSERT OR REPLACE INTO sessions (id, name, date, total_ms, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, [session.id, session.name, session.date, session.totalMs, session.note || '', session.createdAt, new Date().toISOString()]);
            for (const lap of session.laps)
                db.run(`INSERT OR REPLACE INTO laps (id, session_id, number, lap_time_ms, split_ms, note, flagged, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [lap.id, session.id, lap.number, Math.round(lap.time), Math.round(lap.split), lap.note || '', lap.flagged ? 1 : 0, lap.timestamp]);
            for (const d of session.distractions || [])
                db.run(`INSERT OR REPLACE INTO distractions (id, session_id, name, start_ms, duration_ms, note, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`, [d.id, session.id, d.name || '', Math.round(d.startMs), Math.round(d.durationMs), d.note || '', d.timestamp]);
            saveDatabase();
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    ipcMain.handle('db:get-sessions', () => {
        const sessions = [];
        let stmt = db.prepare('SELECT * FROM sessions ORDER BY date DESC');
        while (stmt.step()) {
            const s = stmt.getAsObject();
            const session = { ...s, totalMs: s.total_ms, laps: [], distractions: [] };
            let lstmt = db.prepare('SELECT * FROM laps WHERE session_id = ? ORDER BY number ASC');
            lstmt.bind([session.id]);
            while (lstmt.step()) {
                const l = lstmt.getAsObject();
                session.laps.push({ ...l, time: l.lap_time_ms, split: l.split_ms, flagged: l.flagged === 1 });
            }
            lstmt.free();
            let dstmt = db.prepare('SELECT * FROM distractions WHERE session_id = ? ORDER BY start_ms ASC');
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
    ipcMain.handle('db:delete-session', (_event, id) => {
        try {
            db.run('DELETE FROM laps WHERE session_id = ?', [id]);
            db.run('DELETE FROM distractions WHERE session_id = ?', [id]);
            db.run('DELETE FROM sessions WHERE id = ?', [id]);
            saveDatabase();
            return { success: true };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    ipcMain.handle('update-running-state', (_event, running, elapsedMs, isDistracted, distractionName, distractionElapsed) => {
        isRunning = running;
        updateTrayMenu();
        if (miniWindow && !miniWindow.isDestroyed())
            miniWindow.webContents.send('stopwatch-state-update', { isRunning: running, elapsedMs: elapsedMs || 0, isDistracted: isDistracted || false, distractionName: distractionName || '', distractionElapsed: distractionElapsed || 0 });
    });
    ipcMain.handle('confirm-quit', () => { app.isQuitting = true; app.quit(); });
    ipcMain.on('mini-command', (_event, command) => { if (mainWindow)
        mainWindow.webContents.send('global-shortcut', command === 'toggle' ? 'space' : command === 'd' ? 'd' : command === 'reset' ? 'ctrl+r' : command === 'save' ? 'ctrl+s' : command); });
    ipcMain.handle('minimize-to-tray', () => { if (miniWindow && !miniWindow.isDestroyed())
        miniWindow.close(); if (mainWindow) {
        isMinimizingFromMini = true;
        mainWindow.show();
        mainWindow.minimize();
    } });
    ipcMain.on('sync-elapsed-to-main', (_event, elapsedMs) => { if (mainWindow)
        mainWindow.webContents.send('sync-elapsed-from-mini', elapsedMs); });
    ipcMain.on('distraction-stop-with-name', (_event, name) => { if (mainWindow)
        mainWindow.webContents.send('distraction-stop-with-name', name); });
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
    miniWindow = new BrowserWindow({
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
            nodeIntegration: false
        }
    });
    const isDev = !app.isPackaged;
    if (isDev) {
        await miniWindow.loadURL('http://localhost:5173/mini.html');
    }
    else {
        await miniWindow.loadFile(path.join(__dirname, '..', 'dist', 'mini.html'));
    }
    miniWindow.once('ready-to-show', () => {
        miniWindow.show();
        miniWindow.focus();
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        miniWindow.setPosition(width - 300, height - 260);
        if (mainWindow)
            mainWindow.webContents.send('get-stopwatch-state');
    });
    miniWindow.on('closed', () => { miniWindow = null; });
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
        title: 'DailyTracker',
        show: false,
        backgroundColor: '#0f0f0f',
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    mainWindow.maximize();
    const isDev = !app.isPackaged;
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    }
    mainWindow.once('ready-to-show', () => { mainWindow.show(); });
    mainWindow.on('minimize', (event) => {
        if (isMinimizingFromMini) {
            isMinimizingFromMini = false;
            return;
        }
        event.preventDefault();
        createMiniWindow();
        mainWindow.hide();
    });
    mainWindow.on('show', () => { mainWindow.maximize(); });
    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.webContents.send('before-close');
        }
    });
    mainWindow.on('closed', () => { mainWindow = null; });
}
// ===== APP LIFECYCLE =====
app.whenReady().then(async () => {
    // Set Windows app icon
    if (process.platform === 'win32') {
        const iconPath = app.isPackaged
            ? path.join(process.resourcesPath, 'icon.ico')
            : path.join(__dirname, '..', 'build', 'icon.ico');
        app.setAppUserModelId('com.DailyTracker.desktop');
        const icon = nativeImage.createFromPath(iconPath);
        if (!icon.isEmpty() && app.dock) {
            app.dock.setIcon(icon); // macOS only, safe to call
        }
    }
    await initDatabase();
    setupIpcHandlers();
    createWindow();
    createTray();
    // Setup auto updater
    autoUpdater.checkForUpdatesAndNotify();
    setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 3 * 60 * 60 * 1000);
});
app.on('before-quit', () => {
    app.isQuitting = true;
    globalShortcut.unregisterAll();
    if (miniWindow && !miniWindow.isDestroyed())
        miniWindow.close();
    if (db)
        db.close();
});
// Handle window-all-closed
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
