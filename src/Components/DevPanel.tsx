import React, { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { IconX } from "./icons";

function DevPanel({ onSessionsChanged }) {
  const [visible, setVisible] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [addDays, setAddDays] = useState(3);
  const [hoursPerDay, setHoursPerDay] = useState(2);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.code === "KeyD") {
        e.preventDefault();
        setVisible((prev) => !prev);
        if (!visible) loadSessions();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible]);

  const loadSessions = async () => {
    try {
      const data = await window.electronAPI.getSessions();
      setSessions(data);
    } catch (e) {
      console.error(e);
    }
  };

  const generatePastSessions = async () => {
    setStatus("Generating...");
    const today = new Date();
    const distractionNames = [
      "Phone",
      "Social Media",
      "YouTube",
      "Snacks",
      "Chatting",
      "Email",
      "News",
      "Gaming",
      "Netflix",
      "Random browsing",
    ];

    for (let i = addDays - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      date.setHours(9, 0, 0, 0);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      const exists = sessions.some(
        (s) => (s.date || "").split("T")[0] === dateStr,
      );
      if (exists) continue;

      const totalMs = hoursPerDay * 3600000;
      const numDistractions = Math.floor(Math.random() * 4);
      const distractions = [];
      let totalDistractedMs = 0;

      for (let d = 0; d < numDistractions; d++) {
        const durationMs = (5 + Math.floor(Math.random() * 40)) * 60000;
        const startMs =
          totalDistractedMs +
          Math.floor(
            Math.random() * (totalMs - totalDistractedMs - durationMs),
          );
        distractions.push({
          id: uuidv4(),
          name: distractionNames[
            Math.floor(Math.random() * distractionNames.length)
          ],
          startMs: Math.max(0, startMs),
          durationMs,
          note: "",
          timestamp: new Date(date.getTime() + startMs).toISOString(),
        });
        totalDistractedMs += durationMs;
        if (totalDistractedMs >= totalMs * 0.6) break;
      }

      const productiveMs = Math.max(0, totalMs - totalDistractedMs);

      const session = {
        id: uuidv4(),
        name: `Test - ${dateStr}`,
        date: date.toISOString(),
        totalMs: productiveMs,
        laps: [],
        note: `Test session for ${dateStr}`,
        distractions,
        createdAt: new Date().toISOString(),
      };

      await window.electronAPI.saveSession(session);
    }

    setStatus(`Added ${addDays} days with random distractions!`);
    await loadSessions();
    if (onSessionsChanged) onSessionsChanged();
  };

  const clearAll = async () => {
    if (!confirm("Delete ALL sessions? This cannot be undone.")) return;
    setStatus("Clearing...");
    for (const s of sessions) {
      await window.electronAPI.deleteSession(s.id);
    }
    setStatus("All sessions cleared!");
    setSessions([]);
    if (onSessionsChanged) onSessionsChanged();
  };

  const sessionDates = sessions
    .map((s) => (s.date || "").split("T")[0])
    .filter(Boolean)
    .sort()
    .reverse();

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        width: 380,
        maxHeight: "70vh",
        overflow: "auto",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-strong)",
        borderRadius: 12,
        padding: 20,
        zIndex: 9999,
        fontSize: 13,
        color: "var(--text-primary)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 15 }}>Dev Panel</h3>
        <button
          onClick={() => setVisible(false)}
          title="Close"
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            padding: 4,
            borderRadius: 6,
          }}
        >
          <IconX size={16} />
        </button>
      </div>

      <div
        style={{
          marginBottom: 16,
          padding: 12,
          background: "var(--bg-surface)",
          borderRadius: 8,
        }}
      >
        <div
          style={{
            fontWeight: 600,
            marginBottom: 10,
            color: "var(--text-primary)",
          }}
        >
          Generate Test Data
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 8,
            alignItems: "center",
          }}
        >
          <label style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            Days back:
          </label>
          <input
            type="number"
            min={1}
            max={365}
            value={addDays}
            onChange={(e) => setAddDays(parseInt(e.target.value) || 1)}
            style={{
              width: 60,
              background: "var(--bg-base)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 6,
              padding: "4px 8px",
              color: "var(--text-primary)",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 12,
            alignItems: "center",
          }}
        >
          <label style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            Hours/day:
          </label>
          <input
            type="number"
            min={0.5}
            max={12}
            step={0.5}
            value={hoursPerDay}
            onChange={(e) => setHoursPerDay(parseFloat(e.target.value) || 1)}
            style={{
              width: 60,
              background: "var(--bg-base)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 6,
              padding: "4px 8px",
              color: "var(--text-primary)",
            }}
          />
        </div>
        <button
          onClick={generatePastSessions}
          style={{
            width: "100%",
            padding: "8px 0",
            background: "var(--primary)",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Generate {addDays} Days of Sessions
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <button
          onClick={clearAll}
          style={{
            width: "100%",
            padding: "8px 0",
            background: "transparent",
            border: "1px solid rgba(248, 113, 113, 0.4)",
            borderRadius: 8,
            color: "var(--error)",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Clear ALL Sessions
        </button>
      </div>

      {status && (
        <div
          style={{
            padding: "8px 12px",
            background: "var(--bg-surface)",
            borderRadius: 6,
            marginBottom: 12,
            color: "var(--success)",
            fontSize: 12,
          }}
        >
          {status}
        </div>
      )}

      <div>
        <div
          style={{
            fontWeight: 600,
            marginBottom: 8,
            color: "var(--text-muted)",
            fontSize: 12,
          }}
        >
          Database ({sessions.length} sessions):
        </div>
        <div style={{ maxHeight: 200, overflow: "auto", fontSize: 11 }}>
          {sessionDates.length === 0 ? (
            <div style={{ color: "var(--text-muted)" }}>
              No sessions in database
            </div>
          ) : (
            sessionDates.map((date) => {
              const daySessions = sessions.filter(
                (s) => (s.date || "").split("T")[0] === date,
              );
              const totalMs = daySessions.reduce(
                (sum, s) => sum + (s.totalMs || s.total_ms || 0),
                0,
              );
              const h = Math.floor(totalMs / 3600000);
              const m = Math.floor((totalMs % 3600000) / 60000);
              return (
                <div
                  key={date}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "3px 0",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>{date}</span>
                  <span
                    style={{
                      color: "var(--primary-glow)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {h}h {m}m · {daySessions.length} session
                    {daySessions.length !== 1 ? "s" : ""}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default DevPanel;
