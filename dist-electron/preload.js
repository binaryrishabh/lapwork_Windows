import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('electronAPI', {
    saveSession: (session) => ipcRenderer.invoke('db:save-session', session),
    getSessions: () => ipcRenderer.invoke('db:get-sessions'),
    deleteSession: (id) => ipcRenderer.invoke('db:delete-session', id),
    updateRunningState: (running, elapsedMs, isDistracted, distractionName, distractionElapsed) => ipcRenderer.invoke('update-running-state', running, elapsedMs, isDistracted, distractionName, distractionElapsed),
    confirmQuit: () => ipcRenderer.invoke('confirm-quit'),
    minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
    onGlobalShortcut: (callback) => {
        ipcRenderer.on('global-shortcut', (_event, command) => callback(command));
    },
    onStopwatchStateUpdate: (callback) => {
        ipcRenderer.on('stopwatch-state-update', (_event, state) => callback(state));
    },
    onSyncElapsedFromMini: (callback) => {
        ipcRenderer.on('sync-elapsed-from-mini', (_event, elapsedMs) => callback(elapsedMs));
    },
    onDistractionStopWithName: (callback) => {
        ipcRenderer.on('distraction-stop-with-name', (_event, name) => callback(name));
    },
    onBeforeClose: (callback) => {
        ipcRenderer.on('before-close', () => callback());
    },
    sendMiniCommand: (command) => {
        ipcRenderer.send('mini-command', command);
    },
    syncElapsedToMain: (elapsedMs) => {
        ipcRenderer.send('sync-elapsed-to-main', elapsedMs);
    },
    distractionStopWithName: (name) => {
        ipcRenderer.send('distraction-stop-with-name', name);
    }
});
