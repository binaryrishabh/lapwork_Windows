// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electronAPI", {
  getAppVersion: () => "1.0.0",
  getPlatform: () => process.platform,
  onGlobalShortcut: (callback) => {
    import_electron.ipcRenderer.on("global-shortcut", (_event, key) => callback(key));
  },
  removeGlobalShortcutListener: () => {
    import_electron.ipcRenderer.removeAllListeners("global-shortcut");
  },
  saveSession: (session) => import_electron.ipcRenderer.invoke("db:save-session", session),
  getSessions: () => import_electron.ipcRenderer.invoke("db:get-sessions"),
  deleteSession: (id) => import_electron.ipcRenderer.invoke("db:delete-session", id),
  getSessionsByDate: (date) => import_electron.ipcRenderer.invoke("db:get-sessions-by-date", date),
  updateRunningState: (running, elapsedMs, isDistracted, distractionName, distractionElapsed) => import_electron.ipcRenderer.send("update-running-state", running, elapsedMs, isDistracted, distractionName, distractionElapsed),
  onBeforeClose: (callback) => {
    import_electron.ipcRenderer.on("before-close", () => callback());
  },
  removeBeforeCloseListener: () => {
    import_electron.ipcRenderer.removeAllListeners("before-close");
  },
  confirmQuit: () => import_electron.ipcRenderer.invoke("confirm-quit"),
  getIsRunning: () => import_electron.ipcRenderer.invoke("get-is-running"),
  onGetStopwatchState: (callback) => {
    import_electron.ipcRenderer.on("get-stopwatch-state", () => callback());
  },
  removeGetStopwatchStateListener: () => {
    import_electron.ipcRenderer.removeAllListeners("get-stopwatch-state");
  },
  onStopwatchStateUpdate: (callback) => {
    import_electron.ipcRenderer.on("stopwatch-state-update", (_event, data) => callback(data));
  },
  removeStopwatchStateListener: () => {
    import_electron.ipcRenderer.removeAllListeners("stopwatch-state-update");
  },
  restoreMainWindow: () => import_electron.ipcRenderer.invoke("restore-main-window"),
  sendStopwatchCommand: (command) => import_electron.ipcRenderer.send("mini-command", command),
  minimizeToTray: () => import_electron.ipcRenderer.invoke("minimize-to-tray"),
  sendElapsedToMain: (elapsedMs) => import_electron.ipcRenderer.send("sync-elapsed-to-main", elapsedMs),
  onSyncElapsedFromMini: (callback) => {
    import_electron.ipcRenderer.on("sync-elapsed-from-mini", (_event, elapsedMs) => callback(elapsedMs));
  },
  removeSyncElapsedFromMiniListener: () => {
    import_electron.ipcRenderer.removeAllListeners("sync-elapsed-from-mini");
  },
  restoreMainWindowAndClose: () => import_electron.ipcRenderer.invoke("restore-main-window-and-close"),
  resizeMiniWindow: (width, height) => import_electron.ipcRenderer.invoke("resize-mini-window", width, height),
  sendDistractionWithName: (name) => import_electron.ipcRenderer.send("distraction-stop-with-name", name),
  onDistractionStopWithName: (callback) => {
    import_electron.ipcRenderer.on("distraction-stop-with-name", (_event, name) => callback(name));
  },
  removeDistractionStopWithNameListener: () => {
    import_electron.ipcRenderer.removeAllListeners("distraction-stop-with-name");
  },
  onWindowBlur: (callback) => {
    import_electron.ipcRenderer.on("window-blur", () => callback());
  },
  removeWindowBlurListener: () => {
    import_electron.ipcRenderer.removeAllListeners("window-blur");
  },
  onWindowFocus: (callback) => {
    import_electron.ipcRenderer.on("window-focus", () => callback());
  },
  removeWindowFocusListener: () => {
    import_electron.ipcRenderer.removeAllListeners("window-focus");
  },
  focusMiniWindow: () => import_electron.ipcRenderer.send("focus-mini-window"),
  setMiniMaxSize: (width, height) => import_electron.ipcRenderer.invoke("set-mini-max-size", width, height),
  setMiniMinSize: (width, height) => import_electron.ipcRenderer.invoke("set-mini-min-size", width, height)
});
