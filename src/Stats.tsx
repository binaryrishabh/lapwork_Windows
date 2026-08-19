import React, { useState, useEffect, useMemo, useCallback } from 'react';
import StatsCards from './Components/StatsCards';
import TimeChart from './Components/TimeChart';
import DistractionBreakdown from './Components/DistractionBreakdown';

// Helper: get local date string YYYY-MM-DD
function getLocalDateStr(date) {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function Stats() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState('weekly');

  const loadSessions = useCallback(async () => {
    try {
      const data = await window.electronAPI.getSessions();
      const normalized = data.map(s => ({
        ...s,
        totalMs: Number(s.totalMs || s.total_ms || 0),
        date: s.date,
        distractions: (s.distractions || []).map(d => ({
          ...d,
          durationMs: Number(d.durationMs || d.duration_ms || 0),
        })),
      }));
      setSessions(normalized);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    const handleFocus = () => loadSessions();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadSessions]);

  // Stats that change based on chartType toggle
  const stats = useMemo(() => {
    const defaults = {
      totalMs: 0,
      totalDistractedMs: 0,
      totalSessions: 0,
      avgSessionMs: 0,
      focusRate: 100,
    };

    if (!sessions || sessions.length === 0) return defaults;

    const now = new Date();
    const todayStr = getLocalDateStr(now);

    // Filter sessions based on chartType
    let filteredSessions = [];

    if (chartType === 'weekly') {
      // Monday to today of current week
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      const mondayStr = getLocalDateStr(monday);

      filteredSessions = sessions.filter(s => {
        const sessionDate = (s.date || '').split('T')[0];
        return sessionDate >= mondayStr && sessionDate <= todayStr;
      });
    } else if (chartType === 'monthly') {
      // 1st to today of current month
      const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

      filteredSessions = sessions.filter(s => {
        const sessionDate = (s.date || '').split('T')[0];
        return sessionDate >= firstOfMonth && sessionDate <= todayStr;
      });
    } else if (chartType === 'yearly') {
      // Jan 1 to today of current year
      const firstOfYear = `${now.getFullYear()}-01-01`;

      filteredSessions = sessions.filter(s => {
        const sessionDate = (s.date || '').split('T')[0];
        return sessionDate >= firstOfYear && sessionDate <= todayStr;
      });
    }

    if (filteredSessions.length === 0) return defaults;

    let totalProductiveMs = 0;
    let totalDistractedMs = 0;

    filteredSessions.forEach(s => {
      totalProductiveMs += Number(s.totalMs || 0);
      const dMs = (s.distractions || []).reduce((sum, d) => sum + (Number(d.durationMs) || 0), 0);
      totalDistractedMs += dMs;
    });

    const totalSessions = filteredSessions.length;
    const avgSessionMs = totalSessions > 0 ? totalProductiveMs / totalSessions : 0;
    const totalTimeMs = totalProductiveMs + totalDistractedMs;
    const focusRate = totalTimeMs > 0
      ? Math.round((totalProductiveMs / totalTimeMs) * 100)
      : 0;
      
    return {
      totalMs: totalProductiveMs,
      totalDistractedMs,
      totalSessions,
      avgSessionMs,
      focusRate,
    };
  }, [sessions, chartType]);

  if (loading) {
    return (
      <div className="stats-container">
        <div className="loading-state">Crunching numbers...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="stats-container">
        <div className="loading-state">No stats available</div>
      </div>
    );
  }

    return (
    <div className="stats-container">
      <StatsCards stats={stats} chartType={chartType} />
      <TimeChart
        sessions={sessions}
        chartType={chartType}
        setChartType={setChartType}
        stats={stats}
      />
      <DistractionBreakdown
        sessions={sessions}
      />
    </div>
  );
}

export default Stats;