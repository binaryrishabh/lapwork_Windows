var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};

// electron/main.ts
var import_electron = require("electron");
var import_path = __toESM(require("path"));
var import_fs = __toESM(require("fs"));
var import_electron_updater = require("electron-updater");
var __dirname = "C:\\Users\\Rishabh\\Documents\\2_lapwork_Widnows\\electron";
process.on("uncaughtException", (error) => {
  console.error("[MAIN] Uncaught exception (app kept alive):", error);
});
process.on("unhandledRejection", (reason) => {
  console.error("[MAIN] Unhandled rejection (app kept alive):", reason);
});
var gotTheLock = import_electron.app.requestSingleInstanceLock();
if (!gotTheLock) {
  import_electron.app.quit();
} else {
  import_electron.app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized())
        mainWindow.restore();
      mainWindow.focus();
    }
  });
}
import_electron.app.on("web-contents-created", (_event, contents) => {
  contents.on("before-input-event", (event, input) => {
    if (input.key === "F12" || input.control && input.shift && input.key === "I") {
      event.preventDefault();
    }
  });
});
var mainWindow = null;
var miniWindow = null;
var tray = null;
var db = null;
var SQL = null;
var isRunning = false;
var isMinimizingFromMini = false;
function safeSend(win, channel, ...args) {
  try {
    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  } catch (e) {}
}
async function initDatabase() {
  const sqlModule = await import("sql.js");
  const initSqlJs = sqlModule.default || sqlModule;
  SQL = await initSqlJs();
  const dbPath = getDbPath();
  if (import_fs.default.existsSync(dbPath)) {
    const buffer = import_fs.default.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database;
  }
  db.run("PRAGMA foreign_keys = ON");
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
function getDbPath() {
  return import_electron.app.isPackaged ? import_path.default.join(import_electron.app.getPath("userData"), "lapwork.db") : import_path.default.join(import_electron.app.getPath("userData"), "lapwork-dev.db");
}
function saveDatabase() {
  if (!db)
    return;
  const data = db.export();
  import_fs.default.writeFileSync(getDbPath(), Buffer.from(data));
}
function createTray() {
  try {
    const iconPath = import_electron.app.isPackaged ? import_path.default.join(process.resourcesPath, "icon.ico") : import_path.default.join(__dirname, "..", "build", "icon.ico");
    if (!import_fs.default.existsSync(iconPath)) {
      console.warn("Tray icon not found:", iconPath);
      return;
    }
    const icon = import_electron.nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    if (icon.isEmpty()) {
      console.warn("Tray icon is empty:", iconPath);
      return;
    }
    tray = new import_electron.Tray(icon);
    updateTrayMenu();
    tray.setToolTip("lapwork");
    tray.on("click", () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (error) {
    console.error("Tray creation failed:", error);
  }
}
function updateTrayMenu() {
  if (!tray)
    return;
  const contextMenu = import_electron.Menu.buildFromTemplate([
    { label: isRunning ? "⏸ Stop Stopwatch" : "▶ Start Stopwatch", click: () => safeSend(mainWindow, "global-shortcut", "space") },
    { label: "\uD83C\uDFC1 Add Lap", click: () => safeSend(mainWindow, "global-shortcut", "l") },
    { type: "separator" },
    { label: "Show Window", click: () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    } },
    { type: "separator" },
    { label: "Quit", click: () => {
      import_electron.app.isQuitting = true;
      import_electron.app.quit();
    } }
  ]);
  tray.setContextMenu(contextMenu);
}
function setupIpcHandlers() {
  import_electron.ipcMain.handle("db:save-session", async (_event, session) => {
    if (!db)
      return { success: false, error: "Database not initialized" };
    try {
      db.run("DELETE FROM laps WHERE session_id = ?", [session.id]);
      db.run("DELETE FROM distractions WHERE session_id = ?", [session.id]);
      db.run(`INSERT OR REPLACE INTO sessions (id, name, date, total_ms, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, [session.id, session.name || "Untitled Session", session.date, Math.round(session.totalMs || 0), session.note || "", session.createdAt, new Date().toISOString()]);
      for (const lap of session.laps || []) {
        db.run(`INSERT OR REPLACE INTO laps (id, session_id, number, lap_time_ms, split_ms, note, flagged, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [lap.id, session.id, lap.number, Math.round(lap.time || 0), Math.round(lap.split || 0), lap.note || "", lap.flagged ? 1 : 0, lap.timestamp]);
      }
      for (const d of session.distractions || []) {
        db.run(`INSERT OR REPLACE INTO distractions (id, session_id, name, start_ms, duration_ms, note, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`, [d.id, session.id, d.name || "", Math.round(d.startMs || 0), Math.round(d.durationMs || 0), d.note || "", d.timestamp]);
      }
      saveDatabase();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  import_electron.ipcMain.handle("db:get-sessions", () => {
    if (!db)
      return [];
    const sessions = [];
    const stmt = db.prepare("SELECT * FROM sessions ORDER BY date DESC");
    while (stmt.step()) {
      const s = stmt.getAsObject();
      const session = { ...s, totalMs: s.total_ms, laps: [], distractions: [] };
      const lstmt = db.prepare("SELECT * FROM laps WHERE session_id = ? ORDER BY number ASC");
      lstmt.bind([session.id]);
      while (lstmt.step()) {
        const l = lstmt.getAsObject();
        session.laps.push({ ...l, time: l.lap_time_ms, split: l.split_ms, flagged: l.flagged === 1 });
      }
      lstmt.free();
      const dstmt = db.prepare("SELECT * FROM distractions WHERE session_id = ? ORDER BY start_ms ASC");
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
  import_electron.ipcMain.handle("db:get-sessions-by-date", (_event, date) => {
    if (!db)
      return [];
    const sessions = [];
    const stmt = db.prepare("SELECT * FROM sessions WHERE date LIKE ? ORDER BY created_at DESC");
    stmt.bind([date + "%"]);
    while (stmt.step()) {
      const s = stmt.getAsObject();
      sessions.push({ ...s, totalMs: s.total_ms, laps: [], distractions: [] });
    }
    stmt.free();
    return sessions;
  });
  import_electron.ipcMain.handle("get-is-running", () => isRunning);
  import_electron.ipcMain.handle("db:delete-session", (_event, id) => {
    if (!db)
      return { success: false, error: "Database not initialized" };
    try {
      db.run("DELETE FROM laps WHERE session_id = ?", [id]);
      db.run("DELETE FROM distractions WHERE session_id = ?", [id]);
      db.run("DELETE FROM sessions WHERE id = ?", [id]);
      saveDatabase();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  import_electron.ipcMain.handle("update-running-state", (_event, running, elapsedMs, isDistracted, distractionName, distractionElapsed) => {
    const newRunning = !!running;
    if (newRunning !== isRunning) {
      isRunning = newRunning;
      updateTrayMenu();
    }
    safeSend(miniWindow, "stopwatch-state-update", {
      isRunning: newRunning,
      elapsedMs: Number.isFinite(elapsedMs) ? elapsedMs : 0,
      isDistracted: !!isDistracted,
      distractionName: distractionName || "",
      distractionElapsed: Number.isFinite(distractionElapsed) ? distractionElapsed : 0
    });
  });
  import_electron.ipcMain.handle("confirm-quit", () => {
    import_electron.app.isQuitting = true;
    import_electron.app.quit();
  });
  import_electron.ipcMain.on("mini-command", (_event, command) => {
    safeSend(mainWindow, "global-shortcut", command === "toggle" ? "space" : command === "d" ? "d" : command === "reset" ? "ctrl+r" : command === "save" ? "ctrl+s" : command);
  });
  import_electron.ipcMain.handle("minimize-to-tray", () => {
    if (miniWindow && !miniWindow.isDestroyed())
      miniWindow.close();
    if (mainWindow && !mainWindow.isDestroyed()) {
      isMinimizingFromMini = true;
      mainWindow.show();
      mainWindow.minimize();
    }
  });
  import_electron.ipcMain.on("sync-elapsed-to-main", (_event, elapsedMs) => {
    safeSend(mainWindow, "sync-elapsed-from-mini", Number.isFinite(elapsedMs) ? elapsedMs : 0);
  });
  import_electron.ipcMain.on("distraction-stop-with-name", (_event, name) => {
    safeSend(mainWindow, "distraction-stop-with-name", name);
  });
  import_electron.ipcMain.handle("restore-main-window", () => {
    if (miniWindow && !miniWindow.isDestroyed())
      miniWindow.close();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  import_electron.ipcMain.handle("restore-main-window-and-close", () => {
    if (miniWindow && !miniWindow.isDestroyed())
      miniWindow.close();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      safeSend(mainWindow, "before-close");
    }
  });
  import_electron.ipcMain.handle("resize-mini-window", (_event, width, height) => {
    try {
      if (miniWindow && !miniWindow.isDestroyed() && Number.isFinite(width) && Number.isFinite(height)) {
        miniWindow.setSize(Math.round(width), Math.round(height));
      }
    } catch (e) {
      console.warn("[MAIN] resize-mini-window failed:", e);
    }
  });
  import_electron.ipcMain.handle("set-mini-max-size", (_event, width, height) => {
    try {
      if (miniWindow && !miniWindow.isDestroyed() && Number.isFinite(width) && Number.isFinite(height)) {
        const [minW, minH] = miniWindow.getMinimumSize();
        miniWindow.setMaximumSize(Math.max(width, minW), Math.max(height, minH));
      }
    } catch (e) {
      console.warn("[MAIN] set-mini-max-size failed:", e);
    }
  });
  import_electron.ipcMain.handle("set-mini-min-size", (_event, width, height) => {
    try {
      if (miniWindow && !miniWindow.isDestroyed() && Number.isFinite(width) && Number.isFinite(height)) {
        const [maxW, maxH] = miniWindow.getMaximumSize();
        miniWindow.setMinimumSize(Math.min(width, maxW), Math.min(height, maxH));
      }
    } catch (e) {
      console.warn("[MAIN] set-mini-min-size failed:", e);
    }
  });
  import_electron.ipcMain.on("focus-mini-window", () => {
    if (miniWindow && !miniWindow.isDestroyed()) {
      miniWindow.focus();
    }
  });
}
async function createMiniWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.focus();
    return;
  }
  const iconPath = import_electron.app.isPackaged ? import_path.default.join(process.resourcesPath, "icon.ico") : import_path.default.join(__dirname, "..", "build", "icon.ico");
  const win = new import_electron.BrowserWindow({
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
    backgroundColor: "#00000000",
    show: false,
    roundedCorners: true,
    icon: iconPath,
    webPreferences: {
      preload: import_path.default.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  miniWindow = win;
  const isDev = !import_electron.app.isPackaged;
  if (isDev) {
    win.loadURL("http://localhost:5173/mini.html");
  } else {
    win.loadFile(import_path.default.join(__dirname, "..", "dist", "mini.html"));
  }
  win.once("ready-to-show", () => {
    win.show();
    win.focus();
    const { width, height } = import_electron.screen.getPrimaryDisplay().workAreaSize;
    win.setPosition(width - 300, height - 260);
    safeSend(mainWindow, "get-stopwatch-state");
  });
  win.on("blur", () => safeSend(win, "window-blur"));
  win.on("focus", () => safeSend(win, "window-focus"));
  win.on("closed", () => {
    miniWindow = null;
  });
}
function createWindow() {
  const iconPath = import_electron.app.isPackaged ? import_path.default.join(process.resourcesPath, "icon.ico") : import_path.default.join(__dirname, "..", "build", "icon.ico");
  mainWindow = new import_electron.BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "lapwork",
    show: false,
    backgroundColor: "#0f0f0f",
    icon: iconPath,
    webPreferences: {
      preload: import_path.default.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.maximize();
  const isDev = !import_electron.app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(import_path.default.join(__dirname, "..", "dist", "index.html"));
  }
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.on("minimize", () => {
    if (isMinimizingFromMini) {
      isMinimizingFromMini = false;
      return;
    }
    createMiniWindow();
    mainWindow.hide();
  });
  mainWindow.on("show", () => {
    mainWindow.maximize();
  });
  mainWindow.on("close", (event) => {
    if (!import_electron.app.isQuitting) {
      event.preventDefault();
      safeSend(mainWindow, "before-close");
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
import_electron.app.whenReady().then(async () => {
  if (process.platform === "win32") {
    const iconPath = import_electron.app.isPackaged ? import_path.default.join(process.resourcesPath, "icon.ico") : import_path.default.join(__dirname, "..", "build", "icon.ico");
    import_electron.app.setAppUserModelId("com.lapwork.desktop");
    const icon = import_electron.nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      import_electron.app.dock?.setIcon(icon);
    }
  }
  await initDatabase();
  setupIpcHandlers();
  createWindow();
  createTray();
  if (import_electron.app.isPackaged) {
    import_electron_updater.autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.warn("Update check failed:", err);
    });
    setInterval(() => {
      import_electron_updater.autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.warn("Update check failed:", err);
      });
    }, 10800000);
  }
});
import_electron.app.on("before-quit", () => {
  import_electron.app.isQuitting = true;
  import_electron.globalShortcut.unregisterAll();
  if (miniWindow && !miniWindow.isDestroyed())
    miniWindow.close();
  if (db)
    db.close();
});
