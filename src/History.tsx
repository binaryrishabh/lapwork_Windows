import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ContributionGraph from './Components/ContributionGraph';

// ===== Helpers =====
const getLocalToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatMs = (ms) => {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const formatMsCompact = (ms) => {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return '0m';
};

const formatDate = (isoString) => {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
};

const formatDateFull = (isoString) => {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const formatDateDayMonth = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

const formatTimeWithSeconds = (isoString) => {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatClockTime = (isoString, offsetMs) => {
  const sessionStart = new Date(isoString).getTime();
  const absoluteTime = new Date(sessionStart + offsetMs);
  return absoluteTime.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });
};

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface DayData {
  sessions: any[];
  totalMs: number;
}

type MonthData = Record<string, DayData>;          // dateStr -> DayData
type YearData = Record<number, MonthData>;         // monthIndex -> MonthData
type ArchiveTree = Record<number, YearData>;       // year -> YearData

// ===== SessionCard Component (reused in Today + Archive day views) =====
function SessionCard({ session, isExpanded, onToggle, onDelete, deleteConfirm, onDeleteConfirm, onDeleteCancel }) {
  return (
    <div className={`session-card ${isExpanded ? 'expanded' : ''}`}>
      <div className="session-card-header" onClick={onToggle}>
        <div className="session-info">
          <div className="session-name">{session.name}</div>
          <div className="session-meta">
            <span>{formatDate(session.date)}</span>
            <span>•</span>
            <span>{formatTimeWithSeconds(session.date)}</span>
            <span>→</span>
            <span>{formatTimeWithSeconds(session.updated_at || session.created_at)}</span>
            <span>•</span>
            <span className="session-duration">{formatMs(session.total_ms || session.totalMs)}</span>
          </div>
        </div>
        <div className="session-actions">
          <button
            className="btn-delete"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteConfirm(session.id);
            }}
          >
            🗑
          </button>
          <span className="expand-icon">{isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {deleteConfirm === session.id && (
        <div className="delete-confirm">
          <span>Delete this session?</span>
          <button className="btn-confirm-yes" onClick={() => onDelete(session.id)}>Yes</button>
          <button className="btn-confirm-no" onClick={onDeleteCancel}>No</button>
        </div>
      )}

      {isExpanded && (
        <div className="session-details">
          {session.note && (
            <div className="detail-section">
              <div className="detail-label">Notes</div>
              <div className="detail-content">{session.note}</div>
            </div>
          )}

          {session.distractions && session.distractions.length > 0 && (
            <div className="detail-section">
              <div className="detail-label">🚩 Distractions ({session.distractions.length})</div>
              <div className="detail-distractions">
                {[...session.distractions]
                  .sort((a, b) => (a.startMs || a.start_ms) - (b.startMs || b.start_ms))
                  .map((d, i) => {
                    const startMs = d.startMs || d.start_ms || 0;
                    const durationMs = d.durationMs || d.duration_ms || 0;
                    const endMs = startMs + durationMs;
                    return (
                      <div key={d.id} className="detail-distraction-row">
                        <span className="detail-distraction-num">#{i + 1}</span>
                        <div className="detail-distraction-main">
                          <span className="detail-distraction-name">{d.name || 'Distraction'}</span>
                          <span className="detail-distraction-time-range">
                            {formatClockTime(session.date, startMs)} → {formatClockTime(session.date, endMs)}
                          </span>
                        </div>
                        <span className="detail-distraction-duration">{formatMs(durationMs)}</span>
                        {d.note && <span className="detail-distraction-note">{d.note}</span>}
                      </div>
                    );
                  })}
                <div className="detail-distraction-total">
                  Total distracted: {formatMs(session.distractions.reduce((sum, d) => sum + (d.durationMs || d.duration_ms), 0))}
                </div>
              </div>
            </div>
          )}

          {session.laps && session.laps.length > 0 && (
            <div className="detail-section">
              <div className="detail-label">Laps ({session.laps.length})</div>
              <div className="detail-laps">
                {session.laps.map((lap) => (
                  <div key={lap.id} className={`detail-lap-row ${lap.flagged ? 'flagged' : ''}`}>
                    <span className="detail-lap-num">#{lap.number}</span>
                    <span className="detail-lap-time">{formatMs(lap.time)}</span>
                    <span className="detail-lap-split">(split: {formatMs(lap.split)})</span>
                    {lap.flagged && <span className="detail-lap-flag">🚩</span>}
                    {lap.note && <span className="detail-lap-note">{lap.note}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Main History Component =====
function History() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<string>('today');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pastYearView, setPastYearView] = useState<number | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const todayStr = getLocalToday();
  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth();

  // ===== Load Sessions =====
  const loadSessions = useCallback(async () => {
    try {
      const data = await window.electronAPI.getSessions();
      const normalized = data.map(s => ({
        ...s,
        totalMs: Number(s.totalMs || s.total_ms || 0),
        date: s.date,
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

  // ===== Delete Handler =====
  const handleDelete = async (id) => {
    try {
      await window.electronAPI.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setDeleteConfirm(null);
      if (expandedSession === id) setExpandedSession(null);
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  // ===== Build Archive Tree (excludes today) =====
  const archiveTree = useMemo<ArchiveTree>(() => {
    const tree: ArchiveTree = {};
    sessions.forEach((s: any) => {
      const dateStr = (s.date || '').split('T')[0];
      if (!dateStr || dateStr === todayStr) {
        return;
      }

      const parts = dateStr.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;

      
      if (!tree[year]) tree[year] = {};
      if (!tree[year][month]) tree[year][month] = {};
      if (!tree[year][month][dateStr]) {
        tree[year][month][dateStr] = { sessions: [], totalMs: 0 };
      }

      tree[year][month][dateStr].sessions.push(s);
      tree[year][month][dateStr].totalMs += s.totalMs;
    });
    return tree;
  }, [sessions, todayStr]);

  // ===== Today's Sessions (latest first) =====
  const todaySessions = useMemo(() => {
    return sessions
      .filter(s => (s.date || '').split('T')[0] === todayStr)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sessions, todayStr]);

  // ===== Year Summaries =====
  const yearSummaries = useMemo(() => {
    return Object.entries(archiveTree)
      .map(([year, months]) => {
        let totalMs = 0;
        let totalSessions = 0;
        const yearNum = parseInt(year, 10);
        const isCurrentYear = yearNum === currentYear;

        const monthEntries = Object.entries(months).map(([monthIdx, days]) => {
          const monthTotalMs = Object.values(days).reduce((s, d) => s + d.totalMs, 0);
          const monthSessions = Object.values(days).reduce((s, d) => s + d.sessions.length, 0);
          totalMs += monthTotalMs;
          totalSessions += monthSessions;
          return {
            month: parseInt(monthIdx, 10),
            totalMs: monthTotalMs,
            totalSessions: monthSessions,
          };
        });

        // Current year: Dec→Jan (newest first), Past years: Jan→Dec
        if (isCurrentYear) {
          monthEntries.sort((a, b) => b.month - a.month);
        } else {
          monthEntries.sort((a, b) => a.month - b.month);
        }

        return {
          year: yearNum,
          totalMs,
          totalSessions,
          months: monthEntries,
          isCurrentYear,
        };
      })
      .sort((a, b) => b.year - a.year); // Newest year at top
  }, [archiveTree, currentYear]);

  // ===== Month Summary =====
  const monthSummary = useMemo(() => {
  if (selectedYear === null || selectedMonth === null) return null;
  const monthData = archiveTree[selectedYear]?.[selectedMonth];
  if (!monthData) {
    return { days: [] as (DayData & { dateStr: string })[], totalMs: 0, totalSessions: 0, isCurrentMonth: false };
  }
  const isCurrentYear = selectedYear === currentYear;
  const isCurrentMonth = isCurrentYear && selectedMonth === currentMonthIndex;
  const days = Object.entries(monthData)
    .map(([dateStr, data]) => ({ dateStr, ...data }));
  if (isCurrentMonth) {
    days.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  } else {
    days.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }
  const totalMs = days.reduce((sum, d) => sum + d.totalMs, 0);
  const totalSessions = days.reduce((sum, d) => sum + d.sessions.length, 0);
  return { days, totalMs, totalSessions, isCurrentMonth };
}, [archiveTree, selectedYear, selectedMonth, currentYear, currentMonthIndex]);

const selectedDaySessions = useMemo(() => {
  if (!selectedDate || selectedYear === null || selectedMonth === null) return [] as any[];
  const dayData = archiveTree[selectedYear]?.[selectedMonth]?.[selectedDate];
  return dayData
    ? dayData.sessions.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];
}, [archiveTree, selectedYear, selectedMonth, selectedDate]);

  // ===== Navigation =====
  const goToArchive = () => { setView('archive'); setExpandedSession(null); setDeleteConfirm(null); };
  const goToToday = () => { setView('today'); setExpandedSession(null); setDeleteConfirm(null); };

  const goToPastYear = (year) => {
    setPastYearView(year);
    setView('past-year');
    setExpandedSession(null);
    setDeleteConfirm(null);
  };

  const goToMonth = (year, month) => {
    setSelectedYear(year);
    setSelectedMonth(month);
    setView('month');
    setExpandedSession(null);
    setDeleteConfirm(null);
  };

  const goToDay = (dateStr) => {
    setSelectedDate(dateStr);
    setView('day');
    setExpandedSession(null);
    setDeleteConfirm(null);
  };

  const goBack = () => {
    if (view === 'day') {
      setView('month');
      setSelectedDate(null);
    } else if (view === 'month') {
      if (selectedYear !== currentYear) {
        setView('past-year');
        setSelectedYear(null);
        setSelectedMonth(null);
      } else {
        setView('archive');
        setSelectedYear(null);
        setSelectedMonth(null);
      }
    } else if (view === 'past-year') {
      setView('archive');
      setPastYearView(null);
    } else if (view === 'archive') {
      goToToday();
    }
    setExpandedSession(null);
    setDeleteConfirm(null);
  };

  // ===== Loading State =====
  if (loading) {
    return (
      <div className="history-container">
        <div className="loading-state">Loading sessions...</div>
      </div>
    );
  }

  // ===== RENDER: Today View =====
  if (view === 'today') {
    return (
      <div className="history-container">
        <ContributionGraph sessions={sessions} />

        <div className="today-section">
          <h2 className="section-title">
            Today
            <span className="section-date-subtitle">{formatDateFull(todayStr)}</span>
          </h2>

          {todaySessions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <p>No sessions tracked today</p>
              <p className="empty-hint">Start the stopwatch and save a session to see it here.</p>
            </div>
          ) : (
            <div className="sessions-list">
              {todaySessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isExpanded={expandedSession === session.id}
                  onToggle={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                  onDelete={handleDelete}
                  deleteConfirm={deleteConfirm}
                  onDeleteConfirm={setDeleteConfirm}
                  onDeleteCancel={() => setDeleteConfirm(null)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Archive Button */}
        <button className="archive-entry-btn" onClick={goToArchive}>
          <span className="archive-btn-icon">📦</span>
          <span className="archive-btn-text">
            <span className="archive-btn-title">Open Archive</span>
            <span className="archive-btn-subtitle">Browse past sessions by year, month & day</span>
          </span>
          <span className="archive-btn-arrow">→</span>
        </button>
      </div>
    );
  }

  // ===== RENDER: Archive View (Year List) =====
  if (view === 'archive') {
    return (
      <div className="history-container">
        <button className="back-btn" onClick={goBack}>
          ← Back to Today
        </button>

        <h2 className="section-title">📦 Archive</h2>

        {yearSummaries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <p>No archived sessions yet</p>
            <p className="empty-hint">Sessions from previous days will appear here.</p>
          </div>
        ) : (
          <div className="archive-year-list">
            {yearSummaries.map((ys) => (
              <div key={ys.year} className={`archive-year-group ${ys.isCurrentYear ? 'current' : 'past'}`}>
                {ys.isCurrentYear ? (
                  <>
                    <div className="archive-year-header">
                      <span className="archive-year-label">{ys.year}</span>
                      <span className="archive-year-stats">
                        {formatMsCompact(ys.totalMs)} · {ys.totalSessions} session{ys.totalSessions !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="archive-month-list">
                      {ys.months.map((m) => (
                        <div
                          key={m.month}
                          className="archive-month-row"
                          onClick={() => goToMonth(ys.year, m.month)}
                        >
                          <span className="archive-month-name">{monthNames[m.month]}</span>
                          <span className="archive-month-stats">
                            {formatMsCompact(m.totalMs)} · {m.totalSessions} session{m.totalSessions !== 1 ? 's' : ''}
                          </span>
                          <span className="archive-month-arrow">▸</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div
                    className="archive-past-year-btn"
                    onClick={() => goToPastYear(ys.year)}
                  >
                    <div className="archive-past-year-left">
                      <span className="archive-year-label">{ys.year}</span>
                      <span className="archive-past-year-months-count">
                        {ys.months.length} month{ys.months.length !== 1 ? 's' : ''} with activity
                      </span>
                    </div>
                    <div className="archive-past-year-right">
                      <span className="archive-year-stats">
                        {formatMsCompact(ys.totalMs)} · {ys.totalSessions} session{ys.totalSessions !== 1 ? 's' : ''}
                      </span>
                      <span className="archive-month-arrow">→</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ===== RENDER: Past Year Month View =====
  if (view === 'past-year' && pastYearView !== null) {
    const pySummaries = yearSummaries.find(ys => ys.year === pastYearView);

    return (
      <div className="history-container">
        <button className="back-btn" onClick={goBack}>
          ← Back to Archive
        </button>

        <h2 className="section-title">
          {pastYearView}
          {pySummaries && (
            <span className="section-summary-badge">
              {formatMsCompact(pySummaries.totalMs)} · {pySummaries.totalSessions} session{pySummaries.totalSessions !== 1 ? 's' : ''}
            </span>
          )}
        </h2>

        {!pySummaries || pySummaries.months.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <p>No sessions this year</p>
          </div>
        ) : (
          <div className="archive-month-list">
            {pySummaries.months.map((m) => (
              <div
                key={m.month}
                className="archive-month-row"
                onClick={() => goToMonth(pastYearView, m.month)}
              >
                <span className="archive-month-name">{monthNames[m.month]}</span>
                <span className="archive-month-stats">
                  {formatMsCompact(m.totalMs)} · {m.totalSessions} session{m.totalSessions !== 1 ? 's' : ''}
                </span>
                <span className="archive-month-arrow">▸</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ===== RENDER: Month View (Day List) =====
  if (view === 'month' && selectedYear !== null && selectedMonth !== null) {
    return (
      <div className="history-container">
        <button className="back-btn" onClick={goBack}>
          ← Back to {selectedYear !== currentYear ? String(selectedYear) : 'Archive'}
        </button>

        <h2 className="section-title">
          {monthNames[selectedMonth]} {selectedYear}
          {monthSummary && (
            <span className="section-summary-badge">
              {formatMsCompact(monthSummary.totalMs)} · {monthSummary.totalSessions} session{monthSummary.totalSessions !== 1 ? 's' : ''}
            </span>
          )}
        </h2>

        {!monthSummary || monthSummary.days.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <p>No sessions this month</p>
          </div>
        ) : (
          <div className="archive-day-list">
            {monthSummary.days.map((day) => (
              <div
                key={day.dateStr}
                className="archive-day-row"
                onClick={() => goToDay(day.dateStr)}
              >
                <span className="archive-day-date">{formatDateDayMonth(day.dateStr)}</span>
                <span className="archive-day-stats">
                  {formatMsCompact(day.totalMs)} · {day.sessions.length} session{day.sessions.length !== 1 ? 's' : ''}
                </span>
                <span className="archive-day-arrow">▸</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ===== RENDER: Day View (Session List) =====
  if (view === 'day' && selectedDate) {
    return (
      <div className="history-container">
        <button className="back-btn" onClick={goBack}>
          ← Back to {monthNames[selectedMonth]} {selectedYear}
        </button>

        <h2 className="section-title">
          {formatDateFull(selectedDate)}
          {selectedDaySessions.length > 0 && (
            <span className="section-summary-badge">
              {formatMsCompact(selectedDaySessions.reduce((s, sess) => s + (sess.totalMs || sess.total_ms || 0), 0))} · {selectedDaySessions.length} session{selectedDaySessions.length !== 1 ? 's' : ''}
            </span>
          )}
        </h2>

        {selectedDaySessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p>No sessions for this day</p>
          </div>
        ) : (
          <div className="sessions-list">
            {selectedDaySessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                isExpanded={expandedSession === session.id}
                onToggle={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                onDelete={handleDelete}
                deleteConfirm={deleteConfirm}
                onDeleteConfirm={setDeleteConfirm}
                onDeleteCancel={() => setDeleteConfirm(null)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default History;