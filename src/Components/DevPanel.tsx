import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

function DevPanel({ onSessionsChanged }) {
  const [visible, setVisible] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [addDays, setAddDays] = useState(3);
  const [hoursPerDay, setHoursPerDay] = useState(2);
  const [status, setStatus] = useState('');

  // Toggle with Ctrl+Shift+D
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') {
        e.preventDefault();
        setVisible(prev => !prev);
        if (!visible) loadSessions();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible]);

  const loadSessions = async () => {
    try {
      const data = await window.electronAPI.getSessions();
      setSessions(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Generate fake sessions for the last N days (including today)
  // Generate sessions for specific date range (for testing boundaries)
  // Generate sessions for specific date range
  const generatePastSessions = async () => {
    setStatus('Generating...');
    const today = new Date();
    
    // Distraction name pool
    const distractionNames = [
      'Phone', 'Social Media', 'YouTube', 'Snacks', 'Chatting',
      'Email', 'News', 'Gaming', 'Netflix', 'Random browsing',
    ];
    
    for (let i = addDays - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      date.setHours(9, 0, 0, 0);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      const exists = sessions.some(s => (s.date || '').split('T')[0] === dateStr);
      if (exists) continue;

      const totalMs = hoursPerDay * 3600000;
      
      // Generate 0-3 random distractions
      const numDistractions = Math.floor(Math.random() * 4); // 0, 1, 2, or 3
      const distractions = [];
      let totalDistractedMs = 0;
      
      for (let d = 0; d < numDistractions; d++) {
        // Random distraction between 5-45 minutes
        const durationMs = (5 + Math.floor(Math.random() * 40)) * 60000;
        const startMs = totalDistractedMs + Math.floor(Math.random() * (totalMs - totalDistractedMs - durationMs));
        
        distractions.push({
          id: uuidv4(),
          name: distractionNames[Math.floor(Math.random() * distractionNames.length)],
          startMs: Math.max(0, startMs),
          durationMs,
          note: '',
          timestamp: new Date(date.getTime() + startMs).toISOString(),
        });
        
        totalDistractedMs += durationMs;
        if (totalDistractedMs >= totalMs * 0.6) break; // Cap at 60% distracted
      }
      
      // Productive time = total - distracted
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

  // Clear ALL sessions
  const clearAll = async () => {
    if (!confirm('Delete ALL sessions? This cannot be undone.')) return;
    setStatus('Clearing...');
    for (const s of sessions) {
      await window.electronAPI.deleteSession(s.id);
    }
    setStatus('All sessions cleared!');
    setSessions([]);
    if (onSessionsChanged) onSessionsChanged();
  };

  // Show all session dates
  const sessionDates = sessions
    .map(s => (s.date || '').split('T')[0])
    .filter(Boolean)
    .sort()
    .reverse();

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      width: 380,
      maxHeight: '70vh',
      overflow: 'auto',
      background: '#1a1a1a',
      border: '1px solid #ff9800',
      borderRadius: 12,
      padding: 20,
      zIndex: 9999,
      boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
      fontSize: 13,
      color: '#ccc',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: '#ff9800', fontSize: 15 }}>🛠 Dev Panel</h3>
        <button
          onClick={() => setVisible(false)}
          style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 18 }}
        >✕</button>
      </div>

      {/* Generate test data */}
      <div style={{ marginBottom: 16, padding: 12, background: '#111', borderRadius: 8 }}>
        <div style={{ fontWeight: 600, marginBottom: 10, color: '#ff9800' }}>Generate Test Data</div>
        
        <div style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'center' }}>
          <label style={{ color: '#888', whiteSpace: 'nowrap' }}>Days back:</label>
          <input
            type="number"
            min={1}
            max={365}
            value={addDays}
            onChange={e => setAddDays(parseInt(e.target.value) || 1)}
            style={{
              width: 60,
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: 4,
              padding: '4px 8px',
              color: '#ccc',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
          <label style={{ color: '#888', whiteSpace: 'nowrap' }}>Hours/day:</label>
          <input
            type="number"
            min={0.5}
            max={12}
            step={0.5}
            value={hoursPerDay}
            onChange={e => setHoursPerDay(parseFloat(e.target.value) || 1)}
            style={{
              width: 60,
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: 4,
              padding: '4px 8px',
              color: '#ccc',
            }}
          />
        </div>

        <button
          onClick={generatePastSessions}
          style={{
            width: '100%',
            padding: '8px 0',
            background: '#e65100',
            border: 'none',
            borderRadius: 6,
            color: '#ffcc80',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Generate {addDays} Days of Sessions
        </button>
      </div>

      {/* Clear all */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={clearAll}
          style={{
            width: '100%',
            padding: '8px 0',
            background: '#b71c1c',
            border: 'none',
            borderRadius: 6,
            color: '#ef9a9a',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          🗑 Clear ALL Sessions
        </button>
      </div>

      {/* Status */}
      {status && (
        <div style={{
          padding: '8px 12px',
          background: '#111',
          borderRadius: 6,
          marginBottom: 12,
          color: '#4caf50',
          fontSize: 12,
        }}>
          {status}
        </div>
      )}

      {/* Session list */}
      <div>
        <div style={{ fontWeight: 600, marginBottom: 8, color: '#888', fontSize: 12 }}>
          Database ({sessions.length} sessions):
        </div>
        <div style={{ maxHeight: 200, overflow: 'auto', fontSize: 11 }}>
          {sessionDates.length === 0 ? (
            <div style={{ color: '#555' }}>No sessions in database</div>
          ) : (
            sessionDates.map(date => {
              const daySessions = sessions.filter(s => (s.date || '').split('T')[0] === date);
              const totalMs = daySessions.reduce((sum, s) => sum + (s.totalMs || s.total_ms || 0), 0);
              const h = Math.floor(totalMs / 3600000);
              const m = Math.floor((totalMs % 3600000) / 60000);
              return (
                <div key={date} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '3px 0',
                  borderBottom: '1px solid #1a1a1a',
                }}>
                  <span style={{ color: '#aaa' }}>{date}</span>
                  <span style={{ color: '#64b5f6', fontFamily: 'monospace' }}>
                    {h}h {m}m · {daySessions.length} session{daySessions.length !== 1 ? 's' : ''}
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