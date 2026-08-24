// electron/preload.cjs
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getAppVersion: () => "1.0.0",
  getPlatform: () => process.platform,
  
  onGlobalShortcut: (callback) => ipcRenderer.on("global-shortcut", (_event, key) => callback(key)),
  removeGlobalShortcutListener: () => ipcRenderer.removeAllListeners("global-shortcut"),
  
  saveSession: (session) => ipcRenderer.invoke("db:save-session", session),
  getSessions: () => ipcRenderer.invoke("db:get-sessions"),
  deleteSession: (id) => ipcRenderer.invoke("db:delete-session", id),
  getSessionsByDate: (date) => ipcRenderer.invoke("db:get-sessions-by-date", date),
  
  updateRunningState: (running, elapsedMs, isDistracted, distractionName, distractionElapsed) => 
    ipcRenderer.send("update-running-state", running, elapsedMs, isDistracted, distractionName, distractionElapsed),
  
  onBeforeClose: (callback) => ipcRenderer.on("before-close", () => callback()),
  removeBeforeCloseListener: () => ipcRenderer.removeAllListeners("before-close"),
  confirmQuit: () => ipcRenderer.invoke("confirm-quit"),
  getIsRunning: () => ipcRenderer.invoke("get-is-running"),
  
  onGetStopwatchState: (callback) => ipcRenderer.on("get-stopwatch-state", () => callback()),
  removeGetStopwatchStateListener: () => ipcRenderer.removeAllListeners("get-stopwatch-state"),
  onStopwatchStateUpdate: (callback) => ipcRenderer.on("stopwatch-state-update", (_event, data) => callback(data)),
  removeStopwatchStateListener: () => ipcRenderer.removeAllListeners("stopwatch-state-update"),
  
  restoreMainWindow: () => ipcRenderer.invoke("restore-main-window"),
  sendStopwatchCommand: (command) => ipcRenderer.send("mini-command", command),
  minimizeToTray: () => ipcRenderer.invoke("minimize-to-tray"),
  sendElapsedToMain: (elapsedMs) => ipcRenderer.send("sync-elapsed-to-main", elapsedMs),
  
  onSyncElapsedFromMini: (callback) => ipcRenderer.on("sync-elapsed-from-mini", (_event, elapsedMs) => callback(elapsedMs)),
  removeSyncElapsedFromMiniListener: () => ipcRenderer.removeAllListeners("sync-elapsed-from-mini"),
  restoreMainWindowAndClose: () => ipcRenderer.invoke("restore-main-window-and-close"),
  resizeMiniWindow: (width, height) => ipcRenderer.invoke("resize-mini-window", width, height),
  
  sendDistractionWithName: (name) => ipcRenderer.send("distraction-stop-with-name", name),
  onDistractionStopWithName: (callback) => ipcRenderer.on("distraction-stop-with-name", (_event, name) => callback(name)),
  removeDistractionStopWithNameListener: () => ipcRenderer.removeAllListeners("distraction-stop-with-name"),
  
  onWindowBlur: (callback) => ipcRenderer.on("window-blur", () => callback()),
  removeWindowBlurListener: () => ipcRenderer.removeAllListeners("window-blur"),
  onWindowFocus: (callback) => ipcRenderer.on("window-focus", () => callback()),
  removeWindowFocusListener: () => ipcRenderer.removeAllListeners("window-focus"),
  focusMiniWindow: () => ipcRenderer.send("focus-mini-window"),
  setMiniMaxSize: (width, height) => ipcRenderer.invoke("set-mini-max-size", width, height),
  setMiniMinSize: (width, height) => ipcRenderer.invoke("set-mini-min-size", width, height),
  
  onUpdateAvailable: (callback) => ipcRenderer.on("update-available", (_event, data) => callback(data)),
  onUpdateProgress: (callback) => ipcRenderer.on("update-progress", (_event, data) => callback(data)),
  onUpdateDownloaded: (callback) => ipcRenderer.on("update-downloaded", (_event, data) => callback(data)),
  installUpdateAndRestart: () => ipcRenderer.send("install-update-and-restart"),
});