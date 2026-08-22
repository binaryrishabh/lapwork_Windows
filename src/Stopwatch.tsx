import React from "react";
import {
  IconPlay,
  IconPause,
  IconFlag,
  IconReset,
  IconSave,
  IconX,
} from "./Components/icons";

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

interface StopwatchProps {
  isRunning: boolean;
  elapsedMs: number;
  laps: Lap[];
  currentNote: string;
  sessionName: string;
  setCurrentNote: (note: string) => void;
  setSessionName: (name: string) => void;
  toggleStopwatch: () => void;
  addLap: (flagged?: boolean) => void;
  toggleFlag: (id: string) => void;
  updateLapNote: (id: string, note: string) => void;
  resetStopwatch: () => void;
  saveSession: () => void;
  isDistracted: boolean;
  distractionElapsed: number;
  distractions: Distraction[];
  currentDistractionName: string;
  setCurrentDistractionName: (name: string) => void;
  toggleDistraction: (nameOverride?: string) => void;
  removeDistraction: (id: string) => void;
  productiveMs: number;
}

function Stopwatch({
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
}: StopwatchProps) {
  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const formatShort = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const formatLapTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const totalDistractedMs =
    distractions.reduce((sum, d) => sum + d.durationMs, 0) +
    (isDistracted ? distractionElapsed : 0);

  return (
    <div className="stopwatch-main">
      {/* Main Timer */}
      <div className={`stopwatch-display ${isRunning ? "running" : ""}`}>
        <div className="stopwatch-time">{formatTime(elapsedMs)}</div>
        <div className="stopwatch-status">
          <span
            className={`status-dot ${isDistracted ? "distracted" : isRunning ? "active" : ""}`}
          />
          {isDistracted ? "DISTRACTED" : isRunning ? "FOCUSING" : "STOPPED"}
        </div>
      </div>

      {/* Distraction Section */}
      <div className={`distraction-section ${isDistracted ? "active" : ""}`}>
        <div className="distraction-header">
          <div className="distraction-info">
            {isDistracted ? (
              <>
                <span className="distraction-label">Distraction running</span>
                <span className="distraction-timer">
                  {formatTime(distractionElapsed)}
                </span>
              </>
            ) : totalDistractedMs > 0 ? (
              <>
                <span className="distraction-label">Distractions</span>
                <span className="distraction-timer">
                  {formatShort(totalDistractedMs)} total
                </span>
              </>
            ) : (
              <span className="distraction-label">No distractions yet</span>
            )}
          </div>
          <button
            className={`btn btn-distraction ${isDistracted ? "btn-distraction-stop" : "btn-distraction-start"}`}
            onClick={() => toggleDistraction()}
            disabled={!isRunning}
          >
            {isDistracted ? "Stop" : "Start Distraction"}
          </button>
        </div>
        {isDistracted && (
          <input
            type="text"
            className="distraction-name-input"
            placeholder="What's the distraction? (e.g. Phone call)"
            value={currentDistractionName}
            onChange={(e) => setCurrentDistractionName(e.target.value)}
            autoFocus
          />
        )}
        {elapsedMs > 0 && (
          <div className="productive-preview">
            <span className="productive-label">Productive time:</span>
            <span className="productive-time">{formatTime(productiveMs)}</span>
          </div>
        )}
      </div>

      {/* Distractions List */}
      {distractions.length > 0 && (
        <div className="distractions-list">
          {distractions.map((d, i) => (
            <div key={d.id} className="distraction-row">
              <span className="distraction-num">#{i + 1}</span>
              <span className="distraction-name">
                {d.name || "Distraction"}
              </span>
              <span className="distraction-duration">
                {formatShort(d.durationMs)}
              </span>
              <button
                className="distraction-remove"
                onClick={() => removeDistraction(d.id)}
              >
                <IconX size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Session Name */}
      <input
        type="text"
        className="session-name-input"
        placeholder="Session name (optional)"
        value={sessionName}
        onChange={(e) => setSessionName(e.target.value)}
        disabled={isRunning}
      />

      {/* Controls */}
      <div className="stopwatch-controls">
        <button
          className={`btn btn-primary ${isRunning ? "btn-stop" : "btn-start"}`}
          onClick={() => toggleStopwatch()}
        >
          {isRunning ? (
            <>
              <IconPause size={14} /> Pause
            </>
          ) : (
            <>
              <IconPlay size={14} /> Start
            </>
          )}
        </button>
        <button
          className="btn"
          onClick={() => addLap(false)}
          disabled={!isRunning}
        >
          <IconFlag size={14} /> Lap
        </button>
        <button
          className="btn btn-danger"
          onClick={() => resetStopwatch()}
          disabled={elapsedMs === 0 && laps.length === 0}
        >
          <IconReset size={14} /> Reset
        </button>
        <button
          className="btn btn-success"
          onClick={() => saveSession()}
          disabled={elapsedMs < 30000 && laps.length === 0}
        >
          <IconSave size={14} /> Save
        </button>
      </div>

      {/* Note */}
      <div className="note-section">
        <textarea
          className="note-input"
          placeholder="Session notes..."
          value={currentNote}
          onChange={(e) => setCurrentNote(e.target.value)}
          rows={2}
        />
      </div>

      {/* Laps */}
      {laps.length > 0 && (
        <div className="laps-container">
          <h3 className="laps-title">Laps</h3>
          <div className="laps-table">
            <div className="laps-header">
              <span>#</span>
              <span>Lap Time</span>
              <span>Split</span>
              <span>Note</span>
              <span>Flag</span>
            </div>
            {laps.map((lap) => (
              <div
                key={lap.id}
                className={`lap-row ${lap.flagged ? "flagged" : ""}`}
              >
                <span className="lap-number">{lap.number}</span>
                <span className="lap-time">{formatLapTime(lap.time)}</span>
                <span className="lap-split">{formatLapTime(lap.split)}</span>
                <input
                  type="text"
                  className="lap-note-input"
                  placeholder="Note"
                  value={lap.note}
                  onChange={(e) => updateLapNote(lap.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  className={`flag-btn ${lap.flagged ? "active" : ""}`}
                  onClick={() => toggleFlag(lap.id)}
                >
                  <IconFlag size={14} filled={lap.flagged} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shortcuts */}
      <div className="shortcuts-help">
        <span>
          <kbd>Space</kbd> Start/Stop
        </span>
        <span>
          <kbd>L</kbd> Lap
        </span>
        <span>
          <kbd>D</kbd> Distraction
        </span>
        <span>
          <kbd>Ctrl+R</kbd> Reset
        </span>
        <span>
          <kbd>Ctrl+S</kbd> Save
        </span>
      </div>
    </div>
  );
}

export default Stopwatch;
