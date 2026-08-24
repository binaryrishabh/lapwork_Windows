import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getAppVersion: () => "1.0.0",

  // Global shortcuts
  onGlobalShortcut: (callback: (key: string) => void) => {
    ipcRenderer.on("global-shortcut", (_event, key) => callback(key));
  },
  removeGlobalShortcutListener: () => {
    ipcRenderer.removeAllListeners("global-shortcut");
  },

  // Database
  saveSession: (session: any) => ipcRenderer.invoke("db:save-session", session),
  getSessions: () => ipcRenderer.invoke("db:get-sessions"),
  deleteSession: (id: string) => ipcRenderer.invoke("db:delete-session", id),
  getSessionsByDate: (date: string) =>
    ipcRenderer.invoke("db:get-sessions-by-date", date),

  // Tray state
  updateRunningState: (
    running: boolean,
    elapsedMs: number,
    isDistracted: boolean,
    distractionName: string,
    distractionElapsed: number,
  ) =>
    ipcRenderer.send(
      "update-running-state",
      running,
      elapsedMs,
      isDistracted,
      distractionName,
      distractionElapsed,
    ),

  // Close confirmation
  onBeforeClose: (callback: () => void) => {
    ipcRenderer.on("before-close", () => callback());
  },

  removeBeforeCloseListener: () => {
    ipcRenderer.removeAllListeners("before-close");
  },
  confirmQuit: () => ipcRenderer.invoke("confirm-quit"),
  getIsRunning: () => ipcRenderer.invoke("get-is-running"),

  // Main window: respond when mini window requests current stopwatch state
  onGetStopwatchState: (callback: () => void) => {
    ipcRenderer.on("get-stopwatch-state", () => callback());
  },

  removeGetStopwatchStateListener: () => {
    ipcRenderer.removeAllListeners("get-stopwatch-state");
  },

  // Mini window: receive stopwatch state updates from main process
  onStopwatchStateUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on("stopwatch-state-update", (_event, data) => callback(data));
  },

  removeStopwatchStateListener: () => {
    ipcRenderer.removeAllListeners("stopwatch-state-update");
  },

  // Mini window: restore main window
  restoreMainWindow: () => ipcRenderer.invoke("restore-main-window"),

  // Mini window: send stopwatch command to main window
  sendStopwatchCommand: (command: string) =>
    ipcRenderer.send("mini-command", command),

  // Mini window: minimize to tray
  minimizeToTray: () => ipcRenderer.invoke("minimize-to-tray"),

  // Mini window: send current elapsed time to main window
  sendElapsedToMain: (elapsedMs: number) =>
    ipcRenderer.send("sync-elapsed-to-main", elapsedMs),

  // Main window: receive synced elapsed time from mini window
  onSyncElapsedFromMini: (callback: (elapsedMs: number) => void) => {
    ipcRenderer.on("sync-elapsed-from-mini", (_event, elapsedMs) =>
      callback(elapsedMs),
    );
  },

  removeSyncElapsedFromMiniListener: () => {
    ipcRenderer.removeAllListeners("sync-elapsed-from-mini");
  },

  // Mini window: restore main window and trigger close confirmation
  restoreMainWindowAndClose: () =>
    ipcRenderer.invoke("restore-main-window-and-close"),

  resizeMiniWindow: (width: number, height: number) =>
    ipcRenderer.invoke("resize-mini-window", width, height),

  // Mini window: send distraction name + stop command
  sendDistractionWithName: (name: string) =>
    ipcRenderer.send("distraction-stop-with-name", name),

  // Main window: receive distraction name + auto-stop
  onDistractionStopWithName: (callback: (name: string) => void) => {
    ipcRenderer.on("distraction-stop-with-name", (_event, name) =>
      callback(name),
    );
  },

  removeDistractionStopWithNameListener: () => {
    ipcRenderer.removeAllListeners("distraction-stop-with-name");
  },

  // Mini window: focus/blur translucency
  onWindowBlur: (callback: () => void) => {
    ipcRenderer.on("window-blur", () => callback());
  },
  removeWindowBlurListener: () => {
    ipcRenderer.removeAllListeners("window-blur");
  },
  onWindowFocus: (callback: () => void) => {
    ipcRenderer.on("window-focus", () => callback());
  },
  removeWindowFocusListener: () => {
    ipcRenderer.removeAllListeners("window-focus");
  },
  focusMiniWindow: () => ipcRenderer.send("focus-mini-window"),
  setMiniMaxSize: (width: number, height: number) =>
    ipcRenderer.invoke("set-mini-max-size", width, height),
  setMiniMinSize: (width: number, height: number) =>
    ipcRenderer.invoke("set-mini-min-size", width, height),

  // Auto-updater events
  onUpdateAvailable: (callback: (data: { version: string }) => void) => {
    ipcRenderer.on("update-available", (_event, data) => callback(data));
  },
  onUpdateProgress: (callback: (data: { percent: number }) => void) => {
    ipcRenderer.on("update-progress", (_event, data) => callback(data));
  },
  onUpdateDownloaded: (callback: (data: { version: string }) => void) => {
    ipcRenderer.on("update-downloaded", (_event, data) => callback(data));
  },
  installUpdateAndRestart: () => {
    ipcRenderer.send("install-update-and-restart");
  },
});
