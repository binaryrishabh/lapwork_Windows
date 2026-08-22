import logo from "../assets/logo.png";
import React, { useState, useEffect, useRef } from 'react';
import { IconPlay, IconPause, IconFlag, IconChevronDown, IconChevronUp, IconX } from './icons';

function MiniStopwatch() {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [warning, setWarning] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [showDistractionInput, setShowDistractionInput] = useState(false);
  const [distractionName, setDistractionName] = useState('');
  const [isDistractedMini, setIsDistractedMini] = useState(false);
  const [distractionElapsedMini, setDistractionElapsedMini] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [isFocused, setIsFocused] = useState(true);

  const accumulatedRef = useRef(0);
  const isDistractedMiniRef = useRef(false);
  const isRunningRef = useRef(false);
  const distractionAccumulatedMiniRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const warningTimeoutRef = useRef<number | null>(null);
  const saveMessageTimeoutRef = useRef<number | null>(null);
  const distractionStartRefMini = useRef<number | null>(null);
  const distractionFrameRefMini = useRef<number | null>(null);

  const formatTime = (ms) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const formatDistractionTime = (ms) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const updateDisplay = () => {
    if (startTimeRef.current) {
      const now = performance.now();
      setElapsedMs(accumulatedRef.current + (now - startTimeRef.current));
      animFrameRef.current = requestAnimationFrame(updateDisplay);
    }
  };

  useEffect(() => {
    const handleMouseDown = () => {
      if (window.electronAPI) {
        window.electronAPI.focusMiniWindow();
      }
    };
    window.addEventListener('mousedown', handleMouseDown);
    return () => window.removeEventListener('mousedown', handleMouseDown);
  }, []);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onWindowBlur(() => setIsFocused(false));
      window.electronAPI.onWindowFocus(() => setIsFocused(true));
    }
    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeWindowBlurListener();
        window.electronAPI.removeWindowFocusListener();
      }
    };
  }, []);

  useEffect(() => {
    const handleStateUpdate = (data) => {
      setIsDistractedMini(data.isDistracted || false);
      isDistractedMiniRef.current = data.isDistracted || false;
      setIsRunning(data.isRunning);
      isRunningRef.current = data.isRunning;

      if (data.distractionName) {
        setDistractionName(data.distractionName);
      }

      if (data.isDistracted) {
        distractionAccumulatedMiniRef.current = data.distractionElapsed || 0;
        distractionStartRefMini.current = performance.now();
        if (distractionFrameRefMini.current) cancelAnimationFrame(distractionFrameRefMini.current);
        const tick = () => {
          setDistractionElapsedMini(
            distractionAccumulatedMiniRef.current + (performance.now() - distractionStartRefMini.current)
          );
          distractionFrameRefMini.current = requestAnimationFrame(tick);
        };
        distractionFrameRefMini.current = requestAnimationFrame(tick);
      } else {
        if (distractionFrameRefMini.current) {
          cancelAnimationFrame(distractionFrameRefMini.current);
          distractionFrameRefMini.current = null;
        }
        setDistractionElapsedMini(0);
        distractionAccumulatedMiniRef.current = 0;
      }

      if (data.isRunning) {
        accumulatedRef.current = data.elapsedMs || 0;
        startTimeRef.current = performance.now();
        setIsRunning(true);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = requestAnimationFrame(updateDisplay);
      } else {
        if (startTimeRef.current) {
          accumulatedRef.current += performance.now() - startTimeRef.current;
          startTimeRef.current = null;
        } else {
          accumulatedRef.current = data.elapsedMs || 0;
        }
        setIsRunning(false);
        setElapsedMs(accumulatedRef.current);
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
      }
    };

    if (window.electronAPI) {
      window.electronAPI.onStopwatchStateUpdate(handleStateUpdate);
    }
    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeStopwatchStateListener();
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (distractionFrameRefMini.current) {
        cancelAnimationFrame(distractionFrameRefMini.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (window.electronAPI) {
            window.electronAPI.sendStopwatchCommand('toggle');
          }
          break;
        case 'KeyD':
          e.preventDefault();
          if (!isRunning) break;
          if (!isDistractedMini) {
            if (window.electronAPI) {
              window.electronAPI.sendStopwatchCommand('d');
            }
          } else {
            setShowDistractionInput(true);
            window.setTimeout(() => {
              const input = document.querySelector('.mini-distraction-input') as HTMLInputElement | null;
              if (input) input.focus();
            }, 100);
          }
          break;
        case 'KeyR':
          if (e.ctrlKey) {
            e.preventDefault();
            if (window.electronAPI) {
              window.electronAPI.sendStopwatchCommand('reset');
            }
          }
          break;
        case 'KeyS':
          if (e.ctrlKey) {
            e.preventDefault();
            const currentElapsed = startTimeRef.current
              ? accumulatedRef.current + (performance.now() - startTimeRef.current)
              : accumulatedRef.current;
            if (currentElapsed < 30000) {
              if (warningTimeoutRef.current) {
                window.clearTimeout(warningTimeoutRef.current);
              }
              setWarning('Track at least 30 seconds before saving');
              warningTimeoutRef.current = window.setTimeout(() => {
                setWarning('');
                warningTimeoutRef.current = null;
              }, 2500);
            } else if (window.electronAPI) {
              if (saveMessageTimeoutRef.current) {
                window.clearTimeout(saveMessageTimeoutRef.current);
              }
              setSaveMessage('Session saved!');
              saveMessageTimeoutRef.current = window.setTimeout(() => {
                setSaveMessage('');
                saveMessageTimeoutRef.current = null;
              }, 2000);
              window.electronAPI.sendStopwatchCommand('save');
            }
          }
          break;
        case 'KeyF':
          e.preventDefault();
          restoreMain();
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!collapsed) setCollapsed(true);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (collapsed) {
            setCollapsed(false);
          } else {
            if (window.electronAPI) {
              window.electronAPI.restoreMainWindow();
            }
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, isDistractedMini, showDistractionInput, collapsed]);

  useEffect(() => {
    if (saveMessage && showDistractionInput) {
      setShowDistractionInput(false);
      setDistractionName('');
    }
  }, [saveMessage, showDistractionInput]);

  useEffect(() => {
    if (window.electronAPI) {
      if (collapsed) {
        window.electronAPI.setMiniMinSize(120, 26);
        window.electronAPI.setMiniMaxSize(120, 26);
        window.electronAPI.resizeMiniWindow(120, 26);
      } else {
        window.electronAPI.setMiniMinSize(220, 200);
        window.electronAPI.setMiniMaxSize(320, 350);
        if (showDistractionInput && warning) {
          window.electronAPI.resizeMiniWindow(290, 305);
        } else if (showDistractionInput) {
          window.electronAPI.resizeMiniWindow(225, 269);
        } else if (isDistractedMini && warning) {
          window.electronAPI.resizeMiniWindow(280, 276);
        } else if (warning || saveMessage) {
          window.electronAPI.resizeMiniWindow(280, 245);
        } else if (isDistractedMini) {
          window.electronAPI.resizeMiniWindow(220, 230);
        } else {
          window.electronAPI.resizeMiniWindow(220, 200);
        }
      }
    }
  }, [warning, saveMessage, showDistractionInput, isDistractedMini, collapsed]);

  const restoreMain = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    const currentElapsed = startTimeRef.current
      ? accumulatedRef.current + (performance.now() - startTimeRef.current)
      : accumulatedRef.current;
    accumulatedRef.current = currentElapsed;
    startTimeRef.current = null;
    if (window.electronAPI) {
      window.electronAPI.sendElapsedToMain(Math.round(currentElapsed));
      window.setTimeout(() => {
        window.electronAPI.restoreMainWindow();
      }, 50);
    }
  };

  const closeMiniWindow = () => {
    const currentElapsed = startTimeRef.current
      ? accumulatedRef.current + (performance.now() - startTimeRef.current)
      : accumulatedRef.current;
    if (currentElapsed === 0) {
      if (window.electronAPI) {
        window.electronAPI.confirmQuit();
      }
    } else {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      accumulatedRef.current = currentElapsed;
      startTimeRef.current = null;
      if (window.electronAPI) {
        window.electronAPI.sendElapsedToMain(Math.round(currentElapsed));
        window.setTimeout(() => {
          window.electronAPI.restoreMainWindowAndClose();
        }, 50);
      }
    }
  };

  const minimizeToTray = () => {
    if (window.electronAPI) {
      window.electronAPI.minimizeToTray();
    }
  };

  const toggleStopwatch = () => {
    if (window.electronAPI) {
      window.electronAPI.sendStopwatchCommand('toggle');
    }
  };

  const submitDistraction = () => {
    const input = document.querySelector('.mini-distraction-input') as HTMLInputElement | null;
    const name = input?.value?.trim() || 'Distraction';
    if (window.electronAPI) {
      window.electronAPI.sendDistractionWithName(name);
    }
    setDistractionName('');
    setShowDistractionInput(false);
  };

  return (
    <div className={`mini-container ${!isFocused ? 'unfocused' : ''}`} onMouseDown={() => { if (window.electronAPI) window.electronAPI.focusMiniWindow(); }}>
      {!collapsed && (
        <div className="mini-header">
          <span className="mini-title"><img src={logo} alt="" className="mini-logo" />lapwork</span>
          <div className="mini-header-actions">
            <button className="mini-btn-icon mini-btn-collapse" onClick={() => setCollapsed(true)} title="Collapse">
              <IconChevronDown size={10} />
            </button>
            <button className="mini-btn-icon mini-btn-minimize" onClick={minimizeToTray} title="Minimize to taskbar">
              <svg width="12" height="2" viewBox="0 0 12 2">
                <rect width="12" height="2" rx="1" fill="currentColor"/>
              </svg>
            </button>
            <button className="mini-btn-icon mini-btn-restore-icon" onClick={restoreMain} title="Restore window">
              <svg width="11" height="11" viewBox="0 0 11 11">
                <rect x="3" y="0" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3"/>
                <rect x="0" y="3" width="8" height="8" rx="1.5" fill="var(--bg-elevated)" stroke="currentColor" strokeWidth="1.3"/>
                <rect x="3" y="3" width="5" height="5" fill="var(--bg-elevated)"/>
              </svg>
            </button>
            <button className="mini-btn-icon mini-btn-close-icon" onClick={closeMiniWindow} title="Close">
              <IconX size={10} />
            </button>
          </div>
        </div>
      )}

      {collapsed && (
        <div className="mini-collapsed-strip" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} onMouseDown={() => { if (window.electronAPI) window.electronAPI.focusMiniWindow(); }}>
          <div className="mini-collapsed-left">
            <span className={`mini-collapsed-dot-mini ${isRunning ? 'running' : 'stopped'}`} />
            {isDistractedMini && (
              <span className="mini-collapsed-dot-mini distracted" />
            )}
            <span className="mini-collapsed-time">{formatTime(elapsedMs)}</span>
          </div>
          <button className="mini-btn-icon" onClick={() => setCollapsed(false)} title="Expand" style={{ width: 28, height: 28, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <IconChevronUp size={10} />
          </button>
        </div>
      )}

      {!collapsed && (
        <>
          <div className={`mini-timer ${isRunning ? 'running' : ''}`}>
            <div className="mini-time">{formatTime(elapsedMs)}</div>
            <div className="mini-status">
              <span className={`mini-dot ${isRunning ? 'active' : ''}`} />
              {isRunning ? 'RUNNING' : 'STOPPED'}
            </div>
            {isDistractedMini && (
              <div className={`mini-distracted-badge ${!isRunning ? 'paused' : ''}`}>
                <IconFlag size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                Distracted · {formatDistractionTime(distractionElapsedMini)}
              </div>
            )}
          </div>
          {warning && warning.trim().length > 0 && (
            <div className="mini-warning">{warning}</div>
          )}
          {saveMessage && saveMessage.trim().length > 0 && (
            <div className="mini-save-toast">{saveMessage}</div>
          )}
          {showDistractionInput && (
            <div className="mini-distraction-popup">
              <input
                type="text"
                className="mini-distraction-input"
                placeholder="Distraction name..."
                value={distractionName}
                onChange={(e) => setDistractionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isRunning) {
                    e.preventDefault();
                    submitDistraction();
                  }
                  if (e.key === 'Escape') {
                    setShowDistractionInput(false);
                    setDistractionName('');
                  }
                }}
                autoFocus
                disabled={!isRunning}
              />
              <button
                className="mini-distraction-submit"
                onClick={submitDistraction}
                disabled={!isRunning}
                style={{ opacity: isRunning ? 1 : 0.4 }}
              >
                Save
              </button>
            </div>
          )}
          <div className="mini-controls">
            <button className={`mini-btn mini-btn-toggle ${isRunning ? 'stop' : 'start'}`} onClick={toggleStopwatch}>
              {isRunning ? <><IconPause size={12} /> Pause</> : <><IconPlay size={12} /> Start</>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default MiniStopwatch;