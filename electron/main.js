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
function writeCrashLog(message) {
  try {
    const logDir = import_electron.app.isReady() ? import_electron.app.getPath("userData") : process.cwd();
    const logPath = import_path.default.join(logDir, "crash.log");
    import_fs.default.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}
`);
  } catch {}
}
process.on("uncaughtException", (error) => {
  const msg = `Uncaught exception: ${error?.stack || String(error)}`;
  console.error("[MAIN]", msg);
  writeCrashLog(msg);
});
process.on("unhandledRejection", (reason) => {
  const msg = `Unhandled rejection: ${reason instanceof Error ? reason.stack : String(reason)}`;
  console.error("[MAIN]", msg);
  writeCrashLog(msg);
});
import_electron.app.disableHardwareAcceleration();
var gotTheLock = import_electron.app.requestSingleInstanceLock();
if (!gotTheLock) {
  import_electron.app.quit();
} else {
  import_electron.app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized())
        mainWindow.restore();
      if (!mainWindow.isVisible())
        mainWindow.show();
      mainWindow.focus();
    }
  });
}
import_electron.app.on("web-contents-created", (_event, contents) => {
  if (import_electron.app.isPackaged) {
    contents.on("before-input-event", (event, input) => {
      if (input.key === "F12" || input.control && input.shift && input.key === "I") {
        event.preventDefault();
      }
    });
  }
});
var mainWindow = null;
var miniWindow = null;
var tray = null;
var db = null;
var SQL = null;
var isRunning = false;
var isMinimizingFromMini = false;
var updateInterval = null;
function safeSend(win, channel, ...args) {
  try {
    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  } catch (e) {}
}
function getIconPath() {
  const ext = process.platform === "win32" ? "ico" : process.platform === "darwin" ? "icns" : "png";
  const iconName = `icon.${ext}`;
  return import_electron.app.isPackaged ? import_path.default.join(process.resourcesPath, iconName) : import_path.default.join(__dirname, "..", "build", iconName);
}
async function initDatabase() {
  const sqlModule = await import("sql.js");
  const initSqlJs = sqlModule.default || sqlModule;
  const candidates = import_electron.app.isPackaged ? [
    import_path.default.join(process.resourcesPath, "app.asar.unpacked", "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
    import_path.default.join(import_electron.app.getAppPath(), "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
    import_path.default.join(process.resourcesPath, "app", "node_modules", "sql.js", "dist", "sql-wasm.wasm")
  ] : [
    import_path.default.join(__dirname, "..", "node_modules", "sql.js", "dist", "sql-wasm.wasm")
  ];
  const wasmPath = candidates.find((p) => {
    try {
      return import_fs.default.existsSync(p);
    } catch {
      return false;
    }
  });
  if (!wasmPath) {
    throw new Error("sql-wasm.wasm not found in: " + candidates.join(" | "));
  }
  const wasmBinary = import_fs.default.readFileSync(wasmPath);
  SQL = await initSqlJs({ wasmBinary });
  const dbPath = getDbPath();
  try {
    if (import_fs.default.existsSync(dbPath)) {
      const buffer = import_fs.default.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database;
    }
  } catch (err) {
    writeCrashLog(`DB unreadable, starting fresh: ${err instanceof Error ? err.stack : String(err)}`);
    try {
      import_fs.default.renameSync(dbPath, `${dbPath}.corrupt-${Date.now()}`);
    } catch {}
    db = new SQL.Database;
  }
  db.run("PRAGMA foreign_keys = ON");
  db.run(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, date TEXT NOT NULL, total_ms INTEGER NOT NULL DEFAULT 0,
      note TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`);
  db.run(`CREATE TABLE IF NOT EXISTS laps (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL, number INTEGER NOT NULL, lap_time_ms INTEGER NOT NULL,
      split_ms INTEGER NOT NULL, note TEXT DEFAULT '', flagged INTEGER DEFAULT 0, timestamp TEXT NOT NULL
    )`);
  db.run(`CREATE TABLE IF NOT EXISTS distractions (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL, name TEXT DEFAULT '', start_ms INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL DEFAULT 0, note TEXT DEFAULT '', timestamp TEXT NOT NULL
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
  const dbPath = getDbPath();
  const tempPath = dbPath + ".tmp";
  import_fs.default.writeFileSync(tempPath, Buffer.from(data));
  import_fs.default.renameSync(tempPath, dbPath);
}
function createTray() {
  try {
    const iconPath = getIconPath();
    if (!import_fs.default.existsSync(iconPath))
      return;
    const icon = import_electron.nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    if (icon.isEmpty())
      return;
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
    {
      label: isRunning ? "Stop Stopwatch" : "Start Stopwatch",
      click: () => safeSend(mainWindow, "global-shortcut", "space")
    },
    {
      label: "Add Lap",
      click: () => safeSend(mainWindow, "global-shortcut", "l")
    },
    { type: "separator" },
    {
      label: "Show Window",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        import_electron.app.isQuitting = true;
        import_electron.app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
}
function setupIpcHandlers() {
  import_electron.ipcMain.handle("db:save-session", async (_event, session) => {
    if (!db)
      return { success: false, error: "Database not initialized" };
    try {
      db.run("BEGIN TRANSACTION");
      db.run("DELETE FROM laps WHERE session_id = ?", [session.id]);
      db.run("DELETE FROM distractions WHERE session_id = ?", [session.id]);
      db.run(`INSERT OR REPLACE INTO sessions (id, name, date, total_ms, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
        session.id,
        session.name || "Untitled Session",
        session.date,
        Math.round(session.totalMs || 0),
        session.note || "",
        session.createdAt,
        new Date().toISOString()
      ]);
      for (const lap of session.laps || []) {
        db.run(`INSERT OR REPLACE INTO laps (id, session_id, number, lap_time_ms, split_ms, note, flagged, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
          lap.id,
          session.id,
          lap.number,
          Math.round(lap.time || 0),
          Math.round(lap.split || 0),
          lap.note || "",
          lap.flagged ? 1 : 0,
          lap.timestamp
        ]);
      }
      for (const d of session.distractions || []) {
        db.run(`INSERT OR REPLACE INTO distractions (id, session_id, name, start_ms, duration_ms, note, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
          d.id,
          session.id,
          d.name || "",
          Math.round(d.startMs || 0),
          Math.round(d.durationMs || 0),
          d.note || "",
          d.timestamp
        ]);
      }
      db.run("COMMIT");
      saveDatabase();
      return { success: true };
    } catch (error) {
      try {
        db.run("ROLLBACK");
      } catch {}
      return { success: false, error: error.message };
    }
  });
  import_electron.ipcMain.handle("db:get-sessions", () => {
    if (!db)
      return [];
    let stmt = null;
    try {
      const sessions = [];
      stmt = db.prepare("SELECT * FROM sessions ORDER BY date DESC");
      while (stmt.step()) {
        const s = stmt.getAsObject();
        const session = {
          ...s,
          totalMs: s.total_ms,
          laps: [],
          distractions: []
        };
        let lstmt = null, dstmt = null;
        try {
          lstmt = db.prepare("SELECT * FROM laps WHERE session_id = ? ORDER BY number ASC");
          lstmt.bind([session.id]);
          while (lstmt.step()) {
            const l = lstmt.getAsObject();
            session.laps.push({
              ...l,
              time: l.lap_time_ms,
              split: l.split_ms,
              flagged: l.flagged === 1
            });
          }
          dstmt = db.prepare("SELECT * FROM distractions WHERE session_id = ? ORDER BY start_ms ASC");
          dstmt.bind([session.id]);
          while (dstmt.step()) {
            const d = dstmt.getAsObject();
            session.distractions.push({
              ...d,
              startMs: d.start_ms,
              durationMs: d.duration_ms
            });
          }
        } finally {
          if (lstmt)
            lstmt.free();
          if (dstmt)
            dstmt.free();
        }
        sessions.push(session);
      }
      return sessions;
    } catch (error) {
      writeCrashLog(`db:get-sessions failed: ${error.stack}`);
      return [];
    } finally {
      if (stmt)
        stmt.free();
    }
  });
  import_electron.ipcMain.handle("db:get-sessions-by-date", (_event, date) => {
    if (!db)
      return [];
    const sessions = [];
    let stmt = null;
    try {
      stmt = db.prepare("SELECT * FROM sessions WHERE date LIKE ? ORDER BY created_at DESC");
      stmt.bind([date + "%"]);
      while (stmt.step()) {
        const s = stmt.getAsObject();
        sessions.push({
          ...s,
          totalMs: s.total_ms,
          laps: [],
          distractions: []
        });
      }
    } catch (error) {
      writeCrashLog(`db:get-sessions-by-date failed: ${error.stack}`);
    } finally {
      if (stmt)
        stmt.free();
    }
    return sessions;
  });
  import_electron.ipcMain.handle("get-is-running", () => isRunning);
  import_electron.ipcMain.handle("db:delete-session", (_event, id) => {
    if (!db)
      return { success: false, error: "Database not initialized" };
    try {
      db.run("BEGIN TRANSACTION");
      db.run("DELETE FROM laps WHERE session_id = ?", [id]);
      db.run("DELETE FROM distractions WHERE session_id = ?", [id]);
      db.run("DELETE FROM sessions WHERE id = ?", [id]);
      db.run("COMMIT");
      saveDatabase();
      return { success: true };
    } catch (e) {
      try {
        db.run("ROLLBACK");
      } catch {}
      return { success: false, error: e.message };
    }
  });
  import_electron.ipcMain.on("update-running-state", (_event, running, elapsedMs, isDistracted, distractionName, distractionElapsed) => {
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
      mainWindow.minimize();
      mainWindow.hide();
    }
  });
  import_electron.ipcMain.on("sync-elapsed-to-main", (_event, elapsedMs) => safeSend(mainWindow, "sync-elapsed-from-mini", Number.isFinite(elapsedMs) ? elapsedMs : 0));
  import_electron.ipcMain.on("distraction-stop-with-name", (_event, name) => safeSend(mainWindow, "distraction-stop-with-name", name));
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
  import_electron.ipcMain.handle("resize-mini-window", (_event, w, h) => {
    try {
      if (miniWindow && !miniWindow.isDestroyed() && Number.isFinite(w) && Number.isFinite(h))
        miniWindow.setSize(Math.round(w), Math.round(h));
    } catch (e) {}
  });
  import_electron.ipcMain.handle("set-mini-max-size", (_event, w, h) => {
    try {
      if (miniWindow && !miniWindow.isDestroyed() && Number.isFinite(w) && Number.isFinite(h)) {
        const [minW, minH] = miniWindow.getMinimumSize();
        miniWindow.setMaximumSize(Math.max(w, minW), Math.max(h, minH));
      }
    } catch (e) {}
  });
  import_electron.ipcMain.handle("set-mini-min-size", (_event, w, h) => {
    try {
      if (miniWindow && !miniWindow.isDestroyed() && Number.isFinite(w) && Number.isFinite(h)) {
        const [maxW, maxH] = miniWindow.getMaximumSize();
        miniWindow.setMinimumSize(Math.min(w, maxW), Math.min(h, maxH));
      }
    } catch (e) {}
  });
  import_electron.ipcMain.on("focus-mini-window", () => {
    if (miniWindow && !miniWindow.isDestroyed())
      miniWindow.focus();
  });
  import_electron.ipcMain.on("install-update-and-restart", () => {
    import_electron_updater.autoUpdater.quitAndInstall(false, true);
  });
}
function attachRenderGuards(win) {
  let failures = 0;
  const MAX_FAILURES = 5;
  const handleFailure = () => {
    failures++;
    if (failures > MAX_FAILURES) {
      import_electron.dialog.showErrorBox("lapwork", "The app's interface keeps failing to load. Please reinstall the app.");
      return;
    }
    if (!win.isDestroyed())
      win.reload();
  };
  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    if (errorCode === -3)
      return;
    writeCrashLog(`Window failed to load: ${errorCode} - ${errorDescription}`);
    handleFailure();
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    writeCrashLog(`Render process gone: ${details.reason}`);
    handleFailure();
  });
  win.webContents.on("did-finish-load", () => {
    failures = 0;
  });
}
async function createMiniWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.focus();
    return;
  }
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
    icon: getIconPath(),
    webPreferences: {
      preload: import_path.default.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });
  miniWindow = win;
  attachRenderGuards(win);
  const isDev = !import_electron.app.isPackaged;
  if (isDev)
    win.loadURL("http://localhost:5173/mini.html");
  else
    win.loadFile(import_path.default.join(__dirname, "..", "dist", "mini.html"));
  win.once("ready-to-show", () => {
    const display = import_electron.screen.getDisplayNearestPoint(import_electron.screen.getCursorScreenPoint());
    const { x, y, width, height } = display.workArea;
    win.setPosition(x + width - 300, y + height - 260);
    win.show();
    win.focus();
    safeSend(mainWindow, "get-stopwatch-state");
  });
  win.on("blur", () => safeSend(win, "window-blur"));
  win.on("focus", () => safeSend(win, "window-focus"));
  win.on("closed", () => {
    miniWindow = null;
  });
}
function createWindow() {
  mainWindow = new import_electron.BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "lapwork",
    show: false,
    backgroundColor: "#0f0f0f",
    icon: getIconPath(),
    webPreferences: {
      preload: import_path.default.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  attachRenderGuards(mainWindow);
  const isDev = !import_electron.app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else
    mainWindow.loadFile(import_path.default.join(__dirname, "..", "dist", "index.html"));
  mainWindow.once("ready-to-show", () => {
    mainWindow?.maximize();
    mainWindow?.show();
  });
  mainWindow.on("minimize", () => {
    if (isMinimizingFromMini) {
      isMinimizingFromMini = false;
      return;
    }
    createMiniWindow();
    mainWindow?.hide();
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
  try {
    if (process.platform === "win32") {
      import_electron.app.setAppUserModelId("com.lapwork.app");
    } else if (process.platform === "darwin") {
      const icon = import_electron.nativeImage.createFromPath(getIconPath());
      if (!icon.isEmpty() && import_electron.app.dock)
        import_electron.app.dock.setIcon(icon);
    }
    try {
      await initDatabase();
    } catch (err) {
      writeCrashLog(`DB init failed completely: ${err instanceof Error ? err.stack : String(err)}`);
      import_electron.dialog.showErrorBox("lapwork", "Couldn't set up local storage — opening without saved history.");
    }
    setupIpcHandlers();
    createWindow();
    createTray();
    if (import_electron.app.isPackaged) {
      import_electron_updater.autoUpdater.autoDownload = true;
      import_electron_updater.autoUpdater.autoInstallOnAppQuit = true;
      import_electron_updater.autoUpdater.on("checking-for-update", () => {
        console.log("[UPDATER] Checking for updates...");
      });
      import_electron_updater.autoUpdater.on("update-available", (info) => {
        console.log("[UPDATER] Update available:", info.version);
        safeSend(mainWindow, "update-available", { version: info.version });
      });
      import_electron_updater.autoUpdater.on("download-progress", (progress) => {
        safeSend(mainWindow, "update-progress", {
          percent: Math.round(progress.percent)
        });
      });
      import_electron_updater.autoUpdater.on("update-downloaded", (info) => {
        console.log("[UPDATER] Update downloaded:", info.version);
        safeSend(mainWindow, "update-downloaded", { version: info.version });
      });
      import_electron_updater.autoUpdater.on("update-not-available", () => {
        console.log("[UPDATER] Already on latest version.");
      });
      import_electron_updater.autoUpdater.on("error", (err) => {
        console.warn("[UPDATER] Error:", err);
        writeCrashLog(`Updater error: ${err}`);
      });
      import_electron_updater.autoUpdater.checkForUpdates().catch((err) => {
        console.warn("Update check failed:", err);
      });
      updateInterval = setInterval(() => {
        import_electron_updater.autoUpdater.checkForUpdates().catch((err) => {
          console.warn("Update check failed:", err);
        });
      }, 10800000);
    }
  } catch (err) {
    const msg = `Startup failed: ${err instanceof Error ? err.stack : String(err)}`;
    console.error("[MAIN]", msg);
    writeCrashLog(msg);
  }
});
import_electron.app.on("before-quit", () => {
  import_electron.app.isQuitting = true;
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  if (miniWindow && !miniWindow.isDestroyed())
    miniWindow.close();
  try {
    saveDatabase();
  } catch (err) {
    writeCrashLog(`Final save on quit failed: ${err instanceof Error ? err.stack : String(err)}`);
  }
  if (db) {
    try {
      db.close();
    } catch {}
  }
});
