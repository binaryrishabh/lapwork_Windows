import logo from "./assets/logo.png";
import { useState, useEffect, useRef, useCallback } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import Stopwatch from "./Stopwatch";
import History from "./History";
import Stats from "./Stats";
import "./App.css";
import ToastContainer from "./Components/Toast";
import { showToast } from "./Components/Toast";
import { useTheme } from "./hooks/useTheme";
import ThemeToggle from "./Components/ThemeToggle";
import {
  IconTimer,
  IconHistory,
  IconChart,
  IconSettings,
  IconAlert,
  IconSave,
  IconTrash,
  IconX,
} from "./Components/icons";

import DevPanel from "./Components/DevPanel";

interface Lap {
  id: string;
  number: number;
  time: number;
  split: number;
  note: string;
  flagged: boolean;
  timestamp: string;
}

interface Distraction {
  id: string;
  name: string;
  startMs: number;
  durationMs: number;
  note: string;
  timestamp: string;
}

interface Session {
  id: string;
  name: string;
  date: string;
  totalMs: number;
  laps: Lap[];
  note: string;
  distractions: Distraction[];
  createdAt: string;
}

function getLocalISOString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}`;
}

function App() {
  const { theme, toggleTheme } = useTheme();

  const [isRunning, setIsRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [currentNote, setCurrentNote] = useState("");
  const [sessionStart, setSessionStart] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState("");
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const [isDistracted, setIsDistracted] = useState(false);
  const [distractionElapsed, setDistractionElapsed] = useState(0);
  const [distractions, setDistractions] = useState<Distraction[]>([]);
  const [currentDistractionName, setCurrentDistractionName] = useState("");
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [updateBanner, setUpdateBanner] = useState<{
    status: "downloading" | "ready";
    version?: string;
    percent?: number;
  } | null>(null);

  const startTimeRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);
  const distractionStartRef = useRef<number | null>(null);
  const distractionAccumulatedRef = useRef(0);
  const distractionFrameRef = useRef<number | null>(null);
  const currentDistractionStartMs = useRef(0);
  const elapsedMsRef = useRef(0);
  const isRunningRefForClose = useRef(false);

  const lastSyncTimeRef = useRef(0);
  const lastSyncStateRef = useRef({
    running: false,
    distracted: false,
    name: "",
  });

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onUpdateAvailable((data) => {
        setUpdateBanner({
          status: "downloading",
          version: data.version,
          percent: 0,
        });
      });
      window.electronAPI.onUpdateProgress((data) => {
        setUpdateBanner((prev) =>
          prev
            ? { ...prev, status: "downloading", percent: data.percent }
            : { status: "downloading", percent: data.percent },
        );
      });
      window.electronAPI.onUpdateDownloaded((data) => {
        setUpdateBanner({ status: "ready", version: data.version });
      });
    }
  }, []);

  // Ambient background state driver
  useEffect(() => {
    if (isDistracted) {
      document.documentElement.dataset.state = "distracted";
    } else if (isRunning) {
      document.documentElement.dataset.state = "focusing";
    } else {
      document.documentElement.dataset.state = "idle";
    }
  }, [isRunning, isDistracted]);

  useEffect(() => {
    const stateChanged =
      lastSyncStateRef.current.running !== isRunning ||
      lastSyncStateRef.current.distracted !== isDistracted ||
      lastSyncStateRef.current.name !== currentDistractionName;

    const now = Date.now();
    if (!stateChanged && now - lastSyncTimeRef.current < 250) return;

    lastSyncTimeRef.current = now;
    lastSyncStateRef.current = {
      running: isRunning,
      distracted: isDistracted,
      name: currentDistractionName,
    };

    const realElapsed = startTimeRef.current
      ? accumulatedRef.current + (performance.now() - startTimeRef.current)
      : accumulatedRef.current;

    const realDistractionElapsed = distractionStartRef.current
      ? distractionAccumulatedRef.current +
        (performance.now() - distractionStartRef.current)
      : distractionAccumulatedRef.current;

    if (window.electronAPI) {
      window.electronAPI.updateRunningState(
        isRunning,
        Math.round(realElapsed) || 0,
        isDistracted,
        currentDistractionName,
        Math.round(realDistractionElapsed) || 0,
      );
    }
  }, [
    isRunning,
    elapsedMs,
    isDistracted,
    distractionElapsed,
    currentDistractionName,
  ]);

  useEffect(() => {
    elapsedMsRef.current = elapsedMs;
  }, [elapsedMs]);
  useEffect(() => {
    isRunningRefForClose.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onBeforeClose(async () => {
        const running = isRunningRefForClose.current;
        const time = elapsedMsRef.current;
        if (running || time > 0) {
          setShowCloseDialog(true);
        } else {
          window.electronAPI.confirmQuit();
        }
      });
    }
    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeBeforeCloseListener();
      }
    };
  }, []);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  const updateDisplay = useCallback(() => {
    if (startTimeRef.current) {
      const now = performance.now();
      setElapsedMs(accumulatedRef.current + (now - startTimeRef.current));
      animationFrameRef.current = requestAnimationFrame(updateDisplay);
    }
  }, []);

  const updateDistractionDisplay = useCallback(() => {
    if (distractionStartRef.current) {
      const now = performance.now();
      setDistractionElapsed(
        distractionAccumulatedRef.current + (now - distractionStartRef.current),
      );
      distractionFrameRef.current = requestAnimationFrame(
        updateDistractionDisplay,
      );
    }
  }, []);

  const startStopwatch = useCallback(() => {
    if (!isRunningRef.current) {
      startTimeRef.current = performance.now();
      if (!sessionStart) setSessionStart(getLocalISOString());
      setIsRunning(true);
      isRunningRef.current = true;
      animationFrameRef.current = requestAnimationFrame(updateDisplay);
    }
  }, [sessionStart, updateDisplay]);

  const stopStopwatch = useCallback(() => {
    if (isRunningRef.current) {
      accumulatedRef.current += performance.now() - startTimeRef.current;
      startTimeRef.current = null;
      setIsRunning(false);
      isRunningRef.current = false;
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  const toggleStopwatch = useCallback(() => {
    if (isRunningRef.current) stopStopwatch();
    else startStopwatch();
  }, [startStopwatch, stopStopwatch]);

  const startDistraction = useCallback(() => {
    if (!isDistracted && isRunning) {
      distractionStartRef.current = performance.now();
      currentDistractionStartMs.current = elapsedMs;
      setIsDistracted(true);
      distractionFrameRef.current = requestAnimationFrame(
        updateDistractionDisplay,
      );
    }
  }, [isDistracted, isRunning, elapsedMs, updateDistractionDisplay]);

  const stopDistraction = useCallback(
    (distractionNameOverride?: string) => {
      if (isDistracted) {
        if (distractionStartRef.current === null) {
          setIsDistracted(false);
          setDistractionElapsed(0);
          distractionAccumulatedRef.current = 0;
          return;
        }

        distractionAccumulatedRef.current +=
          performance.now() - distractionStartRef.current;

        const totalDistractionMs = distractionAccumulatedRef.current;
        const nameToUse =
          distractionNameOverride || currentDistractionName || "Distraction";

        const newDistraction = {
          id: uuidv4(),
          name: nameToUse,
          startMs: currentDistractionStartMs.current,
          durationMs: Math.round(totalDistractionMs),
          note: "",
          timestamp: getLocalISOString(),
        };

        setDistractions((prev) => [...prev, newDistraction]);
        distractionStartRef.current = null;
        distractionAccumulatedRef.current = 0;
        setDistractionElapsed(0);
        setCurrentDistractionName("");
        setIsDistracted(false);

        if (distractionFrameRef.current)
          cancelAnimationFrame(distractionFrameRef.current);
      }
    },
    [isDistracted, currentDistractionName, elapsedMs, updateDistractionDisplay],
  );

  const toggleDistraction = useCallback(
    (distractionNameOverride?: string) => {
      if (isDistracted) stopDistraction(distractionNameOverride);
      else startDistraction();
    },
    [isDistracted, startDistraction, stopDistraction],
  );

  useEffect(() => {
    const handleDistractionStopWithName = (name) => {
      toggleDistraction(name);
    };

    if (window.electronAPI) {
      window.electronAPI.onDistractionStopWithName(
        handleDistractionStopWithName,
      );
    }
    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeDistractionStopWithNameListener();
      }
    };
  }, [toggleDistraction]);

  const addLap = useCallback((flagged = false) => {
    const lapTime = startTimeRef.current
      ? accumulatedRef.current + (performance.now() - startTimeRef.current)
      : accumulatedRef.current;

    setLaps((prev) => {
      const newLap = {
        id: uuidv4(),
        number: prev.length + 1,
        time: lapTime,
        split: prev.length > 0 ? lapTime - prev[prev.length - 1].time : lapTime,
        note: "",
        flagged,
        timestamp: getLocalISOString(),
      };
      return [...prev, newLap];
    });
  }, []);

  const toggleFlag = useCallback((lapId) => {
    setLaps((prev) =>
      prev.map((lap) =>
        lap.id === lapId ? { ...lap, flagged: !lap.flagged } : lap,
      ),
    );
  }, []);

  const updateLapNote = useCallback((lapId, note) => {
    setLaps((prev) =>
      prev.map((lap) => (lap.id === lapId ? { ...lap, note } : lap)),
    );
  }, []);

  const removeDistraction = useCallback((id) => {
    setDistractions((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const resetStopwatch = useCallback(() => {
    if (isRunningRef.current) stopStopwatch();
    if (isDistracted) {
      if (distractionFrameRef.current)
        cancelAnimationFrame(distractionFrameRef.current);
      distractionStartRef.current = null;
      distractionAccumulatedRef.current = 0;
      setDistractionElapsed(0);
      setIsDistracted(false);
    }
    accumulatedRef.current = 0;
    setElapsedMs(0);
    setLaps([]);
    setCurrentNote("");
    setSessionStart(null);
    setSessionName("");
    setDistractions([]);
    setCurrentDistractionName("");
  }, [stopStopwatch, isDistracted]);

  const getProductiveMs = useCallback(() => {
    const totalDistracted = distractions.reduce(
      (sum, d) => sum + d.durationMs,
      0,
    );
    const currentDistractionMs = isDistracted ? distractionElapsed : 0;
    return Math.max(0, elapsedMs - totalDistracted - currentDistractionMs);
  }, [elapsedMs, distractions, isDistracted, distractionElapsed]);

  const saveSession = useCallback(async () => {
    const realElapsed = startTimeRef.current
      ? accumulatedRef.current + (performance.now() - startTimeRef.current)
      : accumulatedRef.current;

    if (realElapsed < 30000) {
      showToast("Track at least 30 seconds before saving.", "error");
      return;
    }

    const sessionId = uuidv4();

    let finalDistractions = [...distractions];
    if (isDistracted) {
      const totalMs =
        distractionAccumulatedRef.current +
        (performance.now() - distractionStartRef.current);
      finalDistractions = [
        ...distractions,
        {
          id: uuidv4(),
          name: currentDistractionName || "Distraction",
          startMs: currentDistractionStartMs.current,
          durationMs: Math.round(totalMs),
          note: "",
          timestamp: new Date().toISOString(),
        },
      ];
    }

    const totalDistractedMs = finalDistractions.reduce(
      (sum, d) => sum + d.durationMs,
      0,
    );
    const productiveMs = Math.max(0, realElapsed - totalDistractedMs);

    const session = {
      id: sessionId,
      name: sessionName || "Untitled Session",
      date: sessionStart || getLocalISOString(),
      totalMs: Math.round(productiveMs),
      laps: laps.map((lap) => ({ ...lap })),
      note: currentNote,
      distractions: finalDistractions,
      createdAt: new Date().toISOString(),
    };

    try {
      const result = await window.electronAPI.saveSession(session);
      if (result.success) {
        showToast(`${session.name || "Session"} saved!`, "success");
        resetStopwatch();
        setHistoryRefreshKey((prev) => prev + 1);

        setTimeout(() => {
          if (window.electronAPI) {
            window.electronAPI.updateRunningState(false, 0, false, "");
          }
        }, 100);
      } else {
        showToast("Failed to save: " + result.error, "error");
      }
    } catch (error) {
      console.error("Save error:", error);
      alert("Error saving session: " + error.message);
    }
  }, [
    sessionName,
    sessionStart,
    elapsedMs,
    laps,
    currentNote,
    distractions,
    isDistracted,
    currentDistractionName,
    distractionAccumulatedRef,
    resetStopwatch,
  ]);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onGlobalShortcut((key) => {
        switch (key) {
          case "space":
            toggleStopwatch();
            break;
          case "l":
            if (isRunningRef.current) addLap(false);
            break;
          case "f":
            if (isRunningRef.current) addLap(true);
            break;
          case "d":
            toggleDistraction();
            break;
          case "ctrl+r":
            resetStopwatch();
            break;
          case "ctrl+s":
            saveSession();
            break;
          default:
            break;
        }
      });
    }
    return () => {
      if (window.electronAPI) window.electronAPI.removeGlobalShortcutListener();
    };
  }, [toggleStopwatch, addLap, toggleDistraction, resetStopwatch, saveSession]);

  useEffect(() => {
    const handleStateRequest = () => {
      const realElapsed = startTimeRef.current
        ? accumulatedRef.current + (performance.now() - startTimeRef.current)
        : accumulatedRef.current;

      const realDistractionElapsed = distractionStartRef.current
        ? distractionAccumulatedRef.current +
          (performance.now() - distractionStartRef.current)
        : distractionAccumulatedRef.current;

      if (window.electronAPI) {
        window.electronAPI.updateRunningState(
          isRunning,
          Math.round(realElapsed) || 0,
          isDistracted,
          currentDistractionName,
          Math.round(realDistractionElapsed) || 0,
        );
      }
    };

    if (window.electronAPI) {
      window.electronAPI.onGetStopwatchState(handleStateRequest);
    }
    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeGetStopwatchStateListener();
      }
    };
  }, [isRunning, elapsedMs]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          toggleStopwatch();
          break;
        case "KeyL":
          if (isRunningRef.current) addLap(false);
          break;
        case "KeyF":
          if (isRunningRef.current) addLap(true);
          break;
        case "KeyD":
          toggleDistraction();
          break;
        case "KeyR":
          if (e.ctrlKey) {
            e.preventDefault();
            resetStopwatch();
          }
          break;
        case "KeyS":
          if (e.ctrlKey) {
            e.preventDefault();
            saveSession();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleStopwatch, addLap, resetStopwatch, saveSession, toggleDistraction]);

  useEffect(() => {
    const handleSyncElapsed = (syncedMs) => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      accumulatedRef.current = syncedMs;
      startTimeRef.current = null;
      setElapsedMs(syncedMs);

      if (isRunningRef.current) {
        startTimeRef.current = performance.now();
        animationFrameRef.current = requestAnimationFrame(updateDisplay);
      }
    };

    if (window.electronAPI) {
      window.electronAPI.onSyncElapsedFromMini(handleSyncElapsed);
    }
    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeSyncElapsedFromMiniListener();
      }
    };
  }, [updateDisplay]);

  const productiveMs = getProductiveMs();

  const stopwatchProps = {
    isRunning,
    elapsedMs,
    laps,
    currentNote,
    sessionName,
    setCurrentNote,
    setSessionName,
    toggleStopwatch,
    addLap,
    toggleFlag,
    updateLapNote,
    resetStopwatch,
    saveSession,
    isDistracted,
    distractionElapsed,
    distractions,
    currentDistractionName,
    setCurrentDistractionName,
    toggleDistraction,
    removeDistraction,
    productiveMs,
  };

  return (
    <div className="app-container">
      {/* Left Rail */}
      <aside className="app-rail">
        <img src={logo} alt="lapwork" className="rail-logo" />
        <nav className="rail-nav">
          <NavLink
            to="/stopwatch"
            className={({ isActive }) =>
              isActive ? "rail-btn active" : "rail-btn"
            }
            title="Stopwatch"
          >
            <IconTimer size={20} />
          </NavLink>
          <NavLink
            to="/history"
            className={({ isActive }) =>
              isActive ? "rail-btn active" : "rail-btn"
            }
            title="History"
          >
            <IconHistory size={20} />
          </NavLink>
          <NavLink
            to="/stats"
            className={({ isActive }) =>
              isActive ? "rail-btn active" : "rail-btn"
            }
            title="Stats"
          >
            <IconChart size={20} />
          </NavLink>
        </nav>
        <div className="rail-spacer" />
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <button className="rail-btn" title="Settings">
          <IconSettings size={20} />
        </button>
      </aside>

      <main className="app-main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/stopwatch" replace />} />
          <Route
            path="/stopwatch"
            element={<Stopwatch {...stopwatchProps} />}
          />
          <Route
            path="/history"
            element={<History key={historyRefreshKey} />}
          />
          <Route path="/stats" element={<Stats />} />
        </Routes>
      </main>

      <ToastContainer />

      {/* Update Banner */}
      {updateBanner && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--primary-glow)",
            borderRadius: "var(--radius-card)",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            zIndex: 10001,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          {updateBanner.status === "downloading" ? (
            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              Downloading v{updateBanner.version}... {updateBanner.percent}%
            </span>
          ) : (
            <>
              <span style={{ color: "var(--text-primary)", fontSize: 13 }}>
                v{updateBanner.version} is ready!
              </span>
              <button
                className="btn btn-primary"
                style={{ height: 32, padding: "0 16px", fontSize: 13 }}
                onClick={() => window.electronAPI.installUpdateAndRestart()}
              >
                Restart & Install
              </button>
            </>
          )}
        </div>
      )}

      {/* Close Confirmation Dialog */}
      {showCloseDialog && (
        <div
          className="dialog-overlay"
          onClick={() => setShowCloseDialog(false)}
        >
          <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
            <IconAlert
              size={20}
              className="dialog-icon"
              style={{ color: "var(--warning)" }}
            />
            <h2 className="dialog-title">Stopwatch is running</h2>
            <p className="dialog-message">
              You have an active session with tracked time. What would you like
              to do?
            </p>

            {elapsedMs < 30000 && (
              <div className="dialog-warning">
                Session is less than 30 seconds — Save & Quit is disabled.
              </div>
            )}

            <div className="dialog-actions">
              <button
                className={`btn dialog-btn-save ${elapsedMs < 30000 ? "disabled" : ""}`}
                disabled={elapsedMs < 30000}
                title={
                  elapsedMs < 30000
                    ? "Track at least 30 seconds before saving"
                    : ""
                }
                onClick={async () => {
                  if (elapsedMs < 30000) return;
                  setShowCloseDialog(false);

                  let finalDistractions = [...distractions];
                  if (isDistracted) {
                    const totalMs =
                      distractionAccumulatedRef.current +
                      (performance.now() - distractionStartRef.current);
                    finalDistractions = [
                      ...distractions,
                      {
                        id: uuidv4(),
                        name: currentDistractionName || "Distraction",
                        startMs: currentDistractionStartMs.current,
                        durationMs: Math.round(totalMs),
                        note: "",
                        timestamp: new Date().toISOString(),
                      },
                    ];
                  }

                  const totalDistractedMs = finalDistractions.reduce(
                    (sum, d) => sum + d.durationMs,
                    0,
                  );
                  const productiveMs = Math.max(
                    0,
                    elapsedMs - totalDistractedMs,
                  );

                  const session = {
                    id: uuidv4(),
                    name: sessionName || "Untitled Session",
                    date: sessionStart || getLocalISOString(),
                    totalMs: Math.round(productiveMs),
                    laps: laps.map((lap) => ({ ...lap })),
                    note: currentNote,
                    distractions: finalDistractions,
                    createdAt: new Date().toISOString(),
                  };

                  try {
                    const result =
                      await window.electronAPI.saveSession(session);
                    if (result.success) {
                      // Session saved on quit
                    } else {
                      console.error("Save on quit failed:", result.error);
                    }
                  } catch (e) {
                    console.error("Save on quit error:", e);
                  }

                  setTimeout(() => {
                    window.electronAPI.confirmQuit();
                  }, 200);
                }}
              >
                <IconSave size={14} /> Save & Quit
              </button>
              <button
                className="btn dialog-btn-discard"
                onClick={() => {
                  setShowCloseDialog(false);
                  window.electronAPI.confirmQuit();
                }}
              >
                <IconTrash size={14} /> Don't Save
              </button>
              <button
                className="btn dialog-btn-cancel"
                onClick={() => setShowCloseDialog(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {import.meta.env.DEV && (
        <DevPanel
          onSessionsChanged={() => setHistoryRefreshKey((prev) => prev + 1)}
        />
      )}
    </div>
  );
}

export default App;
