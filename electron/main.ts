import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  screen,
  dialog,
} from "electron";
import path from "path";
import fs from "fs";
import { autoUpdater } from "electron-updater";

declare global {
  namespace Electron {
    interface App {
      isQuitting?: boolean;
    }
  }
}

// ===== CRASH LOGGING =====
function writeCrashLog(message: string) {
  try {
    const logDir = app.isReady() ? app.getPath("userData") : process.cwd();
    const logPath = path.join(logDir, "crash.log");
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    /* ignore */
  }
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

app.disableHardwareAcceleration();

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.on("web-contents-created", (_event, contents) => {
  if (app.isPackaged) {
    contents.on("before-input-event", (event, input) => {
      if (
        input.key === "F12" ||
        (input.control && input.shift && input.key === "I")
      ) {
        event.preventDefault();
      }
    });
  }
});

let mainWindow: BrowserWindow | null = null;
let miniWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let db: any = null;
let SQL: any = null;
let isRunning = false;
let isMinimizingFromMini = false;
let updateInterval: NodeJS.Timeout | null = null;

function safeSend(
  win: BrowserWindow | null | undefined,
  channel: string,
  ...args: any[]
) {
  try {
    if (
      win &&
      !win.isDestroyed() &&
      win.webContents &&
      !win.webContents.isDestroyed()
    ) {
      win.webContents.send(channel, ...args);
    }
  } catch (e) {
    /* ignore */
  }
}

function getIconPath(): string {
  const ext = process.platform === "win32" ? "ico" : "png";
  const iconName = `icon.${ext}`;

  if (app.isPackaged) {
    // Check multiple locations
    const locations = [
      path.join(process.resourcesPath, iconName),
      path.join(process.resourcesPath, "app.asar.unpacked", "build", iconName),
      path.join(path.dirname(app.getPath("exe")), "resources", iconName),
    ];
    for (const loc of locations) {
      if (fs.existsSync(loc)) return loc;
    }
    // Fallback to resources root
    return path.join(process.resourcesPath, iconName);
  }
  return path.join(__dirname, "..", "build", iconName);
}

// ===== DATABASE FUNCTIONS =====
async function initDatabase() {
  // Windows: Set proper working directory
  if (process.platform === "win32" && app.isPackaged) {
    try {
      process.chdir(path.dirname(app.getPath("exe")));
    } catch {}
  }

  const sqlModule: any = await import("sql.js");
  const initSqlJs = sqlModule.default || sqlModule;

  // Try multiple WASM locations
  let wasmBinary: Uint8Array | null = null;
  let wasmFound = false;

  const candidates = app.isPackaged
  ? [
      // PRIMARY: where extraResources puts it
      path.join(path.dirname(app.getPath("exe")), "resources", "sql-wasm.wasm"),
      
      // FALLBACKS
      path.join(process.resourcesPath, "sql-wasm.wasm"),
      path.join(
        process.resourcesPath,
        "app.asar.unpacked",
        "node_modules",
        "sql.js",
        "dist",
        "sql-wasm.wasm",
      ),
      path.join(
        process.resourcesPath,
        "app",
        "node_modules",
        "sql.js",
        "dist",
        "sql-wasm.wasm",
      ),
    ]
  : [
      path.join(
        __dirname,
        "..",
        "node_modules",
        "sql.js",
        "dist",
        "sql-wasm.wasm",
      ),
    ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        wasmBinary = fs.readFileSync(p);
        wasmFound = true;
        console.log("[DB] WASM found at:", p);
        break;
      }
    } catch {}
  }

  if (!wasmFound) {
    console.warn("[DB] WASM not found, using in-memory fallback");
    // Use in-memory SQLite without WASM file
    SQL = await initSqlJs({
      locateFile: () => {
        // Try one more time with bundled path
        return path.join(process.resourcesPath, "sql-wasm.wasm");
      },
    });
  } else {
    // Initialize with WASM binary
    SQL = await initSqlJs({ wasmBinary });
  }

  const dbPath = getDbPath();

  try {
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }
  } catch (err) {
    writeCrashLog(
      `DB unreadable, starting fresh: ${err instanceof Error ? err.stack : String(err)}`,
    );
    try {
      if (fs.existsSync(dbPath)) {
        fs.renameSync(dbPath, `${dbPath}.corrupt-${Date.now()}`);
      }
    } catch {}
    db = new SQL.Database();
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

function getDbPath(): string {
  try {
    const userData = app.getPath("userData");
    if (!fs.existsSync(userData)) {
      fs.mkdirSync(userData, { recursive: true });
    }
    return app.isPackaged
      ? path.join(userData, "lapwork.db")
      : path.join(userData, "lapwork-dev.db");
  } catch (err) {
    // Fallback to temp directory if userData fails
    return path.join(app.getPath("temp"), "lapwork.db");
  }
}

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const dbPath = getDbPath();
  const tempPath = dbPath + ".tmp";
  fs.writeFileSync(tempPath, Buffer.from(data));
  fs.renameSync(tempPath, dbPath);
}

// ===== TRAY =====
function createTray() {
  try {
    const iconPath = getIconPath();
    if (!fs.existsSync(iconPath)) return;

    const icon = nativeImage
      .createFromPath(iconPath)
      .resize({ width: 16, height: 16 });
    if (icon.isEmpty()) return;

    tray = new Tray(icon);
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
  if (!tray) return;
  const contextMenu = Menu.buildFromTemplate([
    {
      label: isRunning ? "Stop Stopwatch" : "Start Stopwatch",
      click: () => safeSend(mainWindow, "global-shortcut", "space"),
    },
    {
      label: "Add Lap",
      click: () => safeSend(mainWindow, "global-shortcut", "l"),
    },
    { type: "separator" },
    {
      label: "Show Window",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
}

// ===== IPC HANDLERS =====
function setupIpcHandlers() {
  ipcMain.handle("db:save-session", async (_event, session: any) => {
    if (!db) return { success: false, error: "Database not initialized" };
    try {
      db.run("BEGIN TRANSACTION");
      db.run("DELETE FROM laps WHERE session_id = ?", [session.id]);
      db.run("DELETE FROM distractions WHERE session_id = ?", [session.id]);
      db.run(
        `INSERT OR REPLACE INTO sessions (id, name, date, total_ms, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          session.id,
          session.name || "Untitled Session",
          session.date,
          Math.round(session.totalMs || 0),
          session.note || "",
          session.createdAt,
          new Date().toISOString(),
        ],
      );

      for (const lap of session.laps || []) {
        db.run(
          `INSERT OR REPLACE INTO laps (id, session_id, number, lap_time_ms, split_ms, note, flagged, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            lap.id,
            session.id,
            lap.number,
            Math.round(lap.time || 0),
            Math.round(lap.split || 0),
            lap.note || "",
            lap.flagged ? 1 : 0,
            lap.timestamp,
          ],
        );
      }
      for (const d of session.distractions || []) {
        db.run(
          `INSERT OR REPLACE INTO distractions (id, session_id, name, start_ms, duration_ms, note, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            d.id,
            session.id,
            d.name || "",
            Math.round(d.startMs || 0),
            Math.round(d.durationMs || 0),
            d.note || "",
            d.timestamp,
          ],
        );
      }
      db.run("COMMIT");
      saveDatabase();
      return { success: true };
    } catch (error: any) {
      try {
        db.run("ROLLBACK");
      } catch {}
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("db:get-sessions", () => {
    if (!db) return [];
    let stmt: any = null;
    try {
      const sessions: any[] = [];
      stmt = db.prepare("SELECT * FROM sessions ORDER BY date DESC");
      while (stmt.step()) {
        const s = stmt.getAsObject();
        const session = {
          ...s,
          totalMs: s.total_ms,
          laps: [],
          distractions: [],
        };
        let lstmt: any = null,
          dstmt: any = null;
        try {
          lstmt = db.prepare(
            "SELECT * FROM laps WHERE session_id = ? ORDER BY number ASC",
          );
          lstmt.bind([session.id]);
          while (lstmt.step()) {
            const l = lstmt.getAsObject();
            session.laps.push({
              ...l,
              time: l.lap_time_ms,
              split: l.split_ms,
              flagged: l.flagged === 1,
            });
          }
          dstmt = db.prepare(
            "SELECT * FROM distractions WHERE session_id = ? ORDER BY start_ms ASC",
          );
          dstmt.bind([session.id]);
          while (dstmt.step()) {
            const d = dstmt.getAsObject();
            session.distractions.push({
              ...d,
              startMs: d.start_ms,
              durationMs: d.duration_ms,
            });
          }
        } finally {
          if (lstmt) lstmt.free();
          if (dstmt) dstmt.free();
        }
        sessions.push(session);
      }
      return sessions;
    } catch (error: any) {
      writeCrashLog(`db:get-sessions failed: ${error.stack}`);
      return [];
    } finally {
      if (stmt) stmt.free();
    }
  });

  ipcMain.handle("db:get-sessions-by-date", (_event, date: string) => {
    if (!db) return [];
    const sessions: any[] = [];
    let stmt: any = null;
    try {
      stmt = db.prepare(
        "SELECT * FROM sessions WHERE date LIKE ? ORDER BY created_at DESC",
      );
      stmt.bind([date + "%"]);
      while (stmt.step()) {
        const s = stmt.getAsObject();
        sessions.push({
          ...s,
          totalMs: s.total_ms,
          laps: [],
          distractions: [],
        });
      }
    } catch (error: any) {
      writeCrashLog(`db:get-sessions-by-date failed: ${error.stack}`);
    } finally {
      if (stmt) stmt.free();
    }
    return sessions;
  });

  ipcMain.handle("get-is-running", () => isRunning);

  ipcMain.handle("db:delete-session", (_event, id: string) => {
    if (!db) return { success: false, error: "Database not initialized" };
    try {
      db.run("BEGIN TRANSACTION");
      db.run("DELETE FROM laps WHERE session_id = ?", [id]);
      db.run("DELETE FROM distractions WHERE session_id = ?", [id]);
      db.run("DELETE FROM sessions WHERE id = ?", [id]);
      db.run("COMMIT");
      saveDatabase();
      return { success: true };
    } catch (e: any) {
      try {
        db.run("ROLLBACK");
      } catch {}
      return { success: false, error: e.message };
    }
  });

  ipcMain.on(
    "update-running-state",
    (
      _event,
      running: boolean,
      elapsedMs: number,
      isDistracted: boolean,
      distractionName: string,
      distractionElapsed: number,
    ) => {
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
        distractionElapsed: Number.isFinite(distractionElapsed)
          ? distractionElapsed
          : 0,
      });
    },
  );

  ipcMain.handle("confirm-quit", () => {
    app.isQuitting = true;
    app.quit();
  });

  ipcMain.on("mini-command", (_event, command: string) => {
    safeSend(
      mainWindow,
      "global-shortcut",
      command === "toggle"
        ? "space"
        : command === "d"
          ? "d"
          : command === "reset"
            ? "ctrl+r"
            : command === "save"
              ? "ctrl+s"
              : command,
    );
  });

  ipcMain.handle("minimize-to-tray", () => {
    if (miniWindow && !miniWindow.isDestroyed()) miniWindow.close();
    if (mainWindow && !mainWindow.isDestroyed()) {
      isMinimizingFromMini = true;

      mainWindow.minimize();
      mainWindow.hide();
    }
  });

  ipcMain.on("sync-elapsed-to-main", (_event, elapsedMs: number) =>
    safeSend(
      mainWindow,
      "sync-elapsed-from-mini",
      Number.isFinite(elapsedMs) ? elapsedMs : 0,
    ),
  );
  ipcMain.on("distraction-stop-with-name", (_event, name: string) =>
    safeSend(mainWindow, "distraction-stop-with-name", name),
  );

  ipcMain.handle("restore-main-window", () => {
    if (miniWindow && !miniWindow.isDestroyed()) miniWindow.close();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  ipcMain.handle("restore-main-window-and-close", () => {
    if (miniWindow && !miniWindow.isDestroyed()) miniWindow.close();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      safeSend(mainWindow, "before-close");
    }
  });

  ipcMain.handle("resize-mini-window", (_event, w: number, h: number) => {
    try {
      if (
        miniWindow &&
        !miniWindow.isDestroyed() &&
        Number.isFinite(w) &&
        Number.isFinite(h)
      )
        miniWindow.setSize(Math.round(w), Math.round(h));
    } catch (e) {}
  });
  ipcMain.handle("set-mini-max-size", (_event, w: number, h: number) => {
    try {
      if (
        miniWindow &&
        !miniWindow.isDestroyed() &&
        Number.isFinite(w) &&
        Number.isFinite(h)
      ) {
        const [minW, minH] = miniWindow.getMinimumSize();
        miniWindow.setMaximumSize(Math.max(w, minW), Math.max(h, minH));
      }
    } catch (e) {}
  });
  ipcMain.handle("set-mini-min-size", (_event, w: number, h: number) => {
    try {
      if (
        miniWindow &&
        !miniWindow.isDestroyed() &&
        Number.isFinite(w) &&
        Number.isFinite(h)
      ) {
        const [maxW, maxH] = miniWindow.getMaximumSize();
        miniWindow.setMinimumSize(Math.min(w, maxW), Math.min(h, maxH));
      }
    } catch (e) {}
  });
  ipcMain.on("focus-mini-window", () => {
    if (miniWindow && !miniWindow.isDestroyed()) miniWindow.focus();
  });

  ipcMain.on("install-update-and-restart", () => {
    autoUpdater.quitAndInstall(false, true);
  });
}

function attachRenderGuards(win: BrowserWindow) {
  let failures = 0;
  const MAX_FAILURES = 5;

  const handleFailure = () => {
    failures++;
    if (failures > MAX_FAILURES) {
      dialog.showErrorBox(
        "lapwork",
        "The app's interface keeps failing to load. Please reinstall the app.",
      );
      return;
    }
    if (!win.isDestroyed()) win.reload();
  };

  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    if (errorCode === -3) return; // aborted nav, not a real failure
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

// ===== MINI WINDOW =====
async function createMiniWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.focus();
    return;
  }

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
    backgroundColor: "#00000000",
    show: false,
    roundedCorners: true,
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  miniWindow = win;
  attachRenderGuards(win);

  const isDev = !app.isPackaged;
  if (isDev) win.loadURL("http://localhost:5173/mini.html");
  else win.loadFile(path.join(__dirname, "..", "dist", "mini.html"));

  win.once("ready-to-show", () => {
    const display = screen.getDisplayNearestPoint(
      screen.getCursorScreenPoint(),
    );
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

// ===== MAIN WINDOW =====
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "lapwork",
    show: false,
    backgroundColor: "#0f0f0f",
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  attachRenderGuards(mainWindow);

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));

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
    if (!app.isQuitting) {
      event.preventDefault();
      safeSend(mainWindow, "before-close");
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ===== APP LIFECYCLE =====
app.whenReady().then(async () => {
  try {
    if (process.platform === "win32") {
      app.setAppUserModelId("com.lapwork.app");
    } else if (process.platform === "darwin") {
      const icon = nativeImage.createFromPath(getIconPath());
      if (!icon.isEmpty() && app.dock) app.dock.setIcon(icon);
    }

    try {
      await initDatabase();
    } catch (err) {
      writeCrashLog(
        `DB init failed completely: ${err instanceof Error ? err.stack : String(err)}`,
      );
      dialog.showErrorBox(
        "lapwork",
        "Couldn't set up local storage — opening without saved history.",
      );
    }

    setupIpcHandlers();
    createWindow();
    createTray();

    if (app.isPackaged) {
      // ===== BULLETPROOF AUTO-UPDATER =====
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;

      autoUpdater.on("checking-for-update", () => {
        console.log("[UPDATER] Checking for updates...");
      });

      autoUpdater.on("update-available", (info) => {
        console.log("[UPDATER] Update available:", info.version);
        safeSend(mainWindow, "update-available", { version: info.version });
      });

      autoUpdater.on("download-progress", (progress) => {
        safeSend(mainWindow, "update-progress", {
          percent: Math.round(progress.percent),
        });
      });

      autoUpdater.on("update-downloaded", (info) => {
        console.log("[UPDATER] Update downloaded:", info.version);
        safeSend(mainWindow, "update-downloaded", { version: info.version });
      });

      autoUpdater.on("update-not-available", () => {
        console.log("[UPDATER] Already on latest version.");
      });

      autoUpdater.on("error", (err) => {
        console.warn("[UPDATER] Error:", err);
        writeCrashLog(`Updater error: ${err}`);
      });

      // Initial check on launch
      autoUpdater.checkForUpdates().catch((err) => {
        console.warn("Update check failed:", err);
      });

      // Re-check every 3 hours (so ignored prompts come back)
      updateInterval = setInterval(
        () => {
          autoUpdater.checkForUpdates().catch((err) => {
            console.warn("Update check failed:", err);
          });
        },
        3 * 60 * 60 * 1000,
      );
    }
  } catch (err) {
    const msg = `Startup failed: ${err instanceof Error ? err.stack : String(err)}`;
    console.error("[MAIN]", msg);
    writeCrashLog(msg);
  }
});

app.on("before-quit", () => {
  app.isQuitting = true;
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  if (miniWindow && !miniWindow.isDestroyed()) miniWindow.close();

  try {
    saveDatabase();
  } catch (err) {
    writeCrashLog(
      `Final save on quit failed: ${err instanceof Error ? err.stack : String(err)}`,
    );
  }

  if (db) {
    try {
      db.close();
    } catch {}
  }
});
