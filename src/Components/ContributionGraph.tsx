import React, { useMemo, useRef, useEffect } from 'react';
import { formatMs } from '../utils/formatTime';
import HelpTooltip from './HelpTooltip';

// ===== TypeScript Interfaces =====
interface Session {
  date?: string;
  totalMs?: number;
  total_ms?: number;
}

interface ContributionGraphProps {
  sessions: Session[];
}

interface DayData {
  date: string;
  ms: number;
  hours: number;
  dayOfWeek: number;
  month: number;
  year: number;
  isToday: boolean;
}

const getColor = (hours: number, maxHours: number): string => {
  if (hours === 0) return '#1a1a1a';
  const ratio = hours / maxHours;
  if (ratio < 0.25) return '#0e4429';
  if (ratio < 0.50) return '#006d32';
  if (ratio < 0.75) return '#26a641';
  return '#39d353';
};

const getLocalDateStr = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function ContributionGraph({ sessions }: ContributionGraphProps) {
  // ✅ Typed ref
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to today on mount (Removed duplicate useEffect)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, []);

  // Convert vertical mouse scroll to horizontal scroll
  useEffect(() => {
    const wrapper = scrollRef.current;
    if (!wrapper) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      wrapper.scrollLeft += e.deltaY;
    };

    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => wrapper.removeEventListener('wheel', handleWheel);
  }, []);

  const { columns, monthLabels, maxHours, totalHours, totalMs, totalDays, currentStreak, maxStreak, svgWidth } = useMemo(() => {
    // ✅ Explicitly type the map so Object.values() returns number[] instead of unknown[]
    const sessionsMap: Record<string, number> = {};
    sessions.forEach((session) => {
      const dateStr = session.date ? session.date.split('T')[0] : null;
      if (!dateStr) return;
      const ms = Number(session.totalMs || session.total_ms || 0);
      sessionsMap[dateStr] = (sessionsMap[dateStr] || 0) + ms;
    });

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const todayStr = getLocalDateStr(today);

    const endSunday = new Date(today);
    endSunday.setDate(today.getDate() - today.getDay());
    endSunday.setHours(0, 0, 0, 0);
    const startDate = new Date(endSunday);
    startDate.setDate(endSunday.getDate() - 52 * 7);

    const allDays: DayData[] = [];
    const d = new Date(startDate);
    while (d <= today) {
      const dateStr = getLocalDateStr(d);
      const ms = sessionsMap[dateStr] || 0;
      allDays.push({
        date: dateStr,
        ms,
        hours: Math.round((ms / 3600000) * 100) / 100,
        dayOfWeek: d.getDay(),
        month: d.getMonth(),
        year: d.getFullYear(),
        isToday: dateStr === todayStr,
      });
      d.setDate(d.getDate() + 1);
    }

    // Group into columns by month
    const columns: (DayData | null)[][] = [];
    let i = 0;
    while (i < allDays.length) {
      const day = allDays[i];
      const colMonth = day.month;
      const colYear = day.year;
      const colStartDow = day.dayOfWeek;

      const column: (DayData | null)[] = new Array(7).fill(null);
      for (let row = colStartDow; row < 7; row++) {
        if (i >= allDays.length) break;
        const nextDay = allDays[i];
        if (nextDay.month !== colMonth || nextDay.year !== colYear) break;
        if (nextDay.dayOfWeek !== row) break;
        column[row] = nextDay;
        i++;
      }
      columns.push(column);
    }

    // Build month labels with start/end columns
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthRanges: { startCol: number; endCol: number; label: string }[] = [];
    let currentMY = '';

    
    columns.forEach((col, idx) => {
      const day = col.find(d => d !== null);
      if (!day) return;
      const my = `${day.year}-${day.month}`;
      if (my !== currentMY) {
        if (currentMY !== '') {
          monthRanges[monthRanges.length - 1].endCol = idx - 1;
        }
        monthRanges.push({ startCol: idx, endCol: idx, label: months[day.month] });
        currentMY = my;
      } else {
        monthRanges[monthRanges.length - 1].endCol = idx;
      }
    });

    const monthLabelsArr = monthRanges.map(mr => ({
      startCol: mr.startCol,
      endCol: mr.endCol,
      label: mr.label,
    }));

    // Stats
    const allMsVals = Object.values(sessionsMap);
    const maxMs = Math.max(1, ...allMsVals, 1000);
    const totalMs = allMsVals.reduce((s, v) => s + v, 0);
    const totalDaysCount = allMsVals.length;
    
    // Streak: count consecutive days backwards from yesterday

    let streakCount = 0;
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const todayStr2 = getLocalDateStr(todayDate);

    const hasToday = sessionsMap[todayStr2] && sessionsMap[todayStr2] > 0;

    const checkDate = new Date();
    checkDate.setHours(0, 0, 0, 0);
    if (!hasToday) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    while (true) {
      const ds = getLocalDateStr(checkDate);
      if (sessionsMap[ds] && sessionsMap[ds] > 0) {
        streakCount++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Max streak: find the longest consecutive streak in the data
    let maxStreak = 0;
    let currentRun = 0;
    const allDates = Object.keys(sessionsMap).sort();
    
    for (let i = 0; i < allDates.length; i++) {
      if (i === 0) {
        currentRun = 1;
      } else {
        const prevDate = new Date(allDates[i - 1] + 'T00:00:00');
        const currDate = new Date(allDates[i] + 'T00:00:00');
        // ✅ FIX: Use .getTime() to subtract Dates as numbers
        const diffDays = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (diffDays === 1) {
          currentRun++;
        } else {
          currentRun = 1;
        }
      }
      if (currentRun > maxStreak) {
        maxStreak = currentRun;
      }
    }

    // Sizing
    const cellSizeLocal = 14;
    const cellGapLocal = 3;
    const monthGapLocal = 10;
    const totalCellLocal = cellSizeLocal + cellGapLocal;
    const numGaps = Math.max(0, monthRanges.length - 1);
    const width = columns.length * totalCellLocal + numGaps * monthGapLocal + 40;

    return {
      columns,
      monthLabels: monthLabelsArr,
      maxHours: maxMs / 3600000,
      totalHours: totalMs / 3600000,
      totalMs: totalMs,
      totalDays: totalDaysCount,
      currentStreak: streakCount,
      maxStreak,
      svgWidth: width,
      monthStartColumns: monthRanges.map(m => m.startCol),
    };
  }, [sessions]);

  // ✅ Typed state
  const [hoveredCell, setHoveredCell] = React.useState<DayData | null>(null);

  const cellSize = 14;
  const cellGap = 3;
  const monthGap = 10;
  const totalCell = cellSize + cellGap;
  const graphHeight = 7 * totalCell;
  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  // Calculate X position: column * cellWidth + gaps before this column
  const getX = (colIndex: number) => {
    let gapsBefore = 0;
    for (let j = 1; j < columns.length; j++) {
      if (j > colIndex) break;
      const prevCol = columns[j - 1];
      const currCol = columns[j];
      const prevDay = prevCol ? prevCol.find(d => d !== null) : null;
      const currDay = currCol ? currCol.find(d => d !== null) : null;
      if (prevDay && currDay && (prevDay.month !== currDay.month || prevDay.year !== currDay.year)) {
        gapsBefore++;
      }
    }
    return colIndex * totalCell + gapsBefore * monthGap + 28;
  };

  const formatDateDisplay = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="contribution-container">
      <div className="contribution-header">
        <h3 className="contribution-title">Activity</h3>
        <HelpTooltip text="Shows your daily tracked time over the past year. Each square is one day. Darker green = more time tracked." />
      </div>
      <div className="contribution-stats">
        <div className="contribution-stat">
          <span className="stat-value">{formatMs(totalMs)}</span>
          <span className="stat-label">
            Hours tracked
            <HelpTooltip text="Total productive time across all saved sessions. Does not include distraction time." />
          </span>
        </div>
        <div className="contribution-stat">
          <span className="stat-value">{totalDays}</span>
          <span className="stat-label">
            Active days
            <HelpTooltip text="Total number of unique days that have at least one tracked session. Multiple sessions on the same day count as one active day." />
          </span>
        </div>
        <div className="contribution-stat">
          <span className="stat-value">{currentStreak}</span>
          <span className="stat-label">
            Day streak 🔥
            <HelpTooltip text="Number of consecutive days (including today if tracked) with at least one session. Resets to 0 if you miss a day." />
          </span>
        </div>
        <div className="contribution-stat">
          <span className="stat-value">{maxStreak}</span>
          <span className="stat-label">
            Max streak 🏆
            <HelpTooltip text="Your longest streak of consecutive tracked days across all time. This is your personal best." />
          </span>
        </div>
      </div>

      <div className="contribution-graph-wrapper" ref={scrollRef}>
        <div className="graph-scroll-inner">
          <svg width={svgWidth} height={graphHeight + 30} className="contribution-svg">
            {monthLabels.map((ml, i) => {
              const xStart = getX(ml.startCol);
              const xEnd = getX(ml.endCol) + cellSize;
              const xCenter = (xStart + xEnd) / 2;
              return (
                <text key={i} x={xCenter} y={10} className="graph-month-label" textAnchor="middle">{ml.label}</text>
              );
            })}
            {dayLabels.map((label, i) => (
              <text key={i} x={0} y={i * totalCell + 28 + cellSize / 2} className="graph-day-label">{label}</text>
            ))}
            {columns.map((col, colIndex) =>
              col.map((day, rowIndex) => {
                if (day === null) return null;
                const x = getX(colIndex);
                const y = rowIndex * totalCell + 18;
                return (
                  <rect
                    key={day.date}
                    x={x}
                    y={y}
                    width={cellSize}
                    height={cellSize}
                    rx={3}
                    ry={3}
                    fill={getColor(day.hours, maxHours)}
                    className="graph-cell"
                    stroke={day.isToday ? '#64b5f6' : '#0f0f0f'}
                    strokeWidth={day.isToday ? 2 : 1}
                    onMouseEnter={() => setHoveredCell(day)}
                    onMouseLeave={() => setHoveredCell(null)}
                  />
                );
              })
            )}
          </svg>
        </div>
      </div>

      {hoveredCell && (
        <div className="graph-tooltip">
          <div className="tooltip-date">
            {formatDateDisplay(hoveredCell.date)}
            {hoveredCell.isToday && <span className="tooltip-today-badge">Today</span>}
          </div>
          <div className="tooltip-hours">{formatMs(hoveredCell.ms)}</div>
        </div>
      )}

      <div className="graph-legend">
        <span className="legend-label">Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
          <div key={i} className="legend-cell" style={{ backgroundColor: ratio === 0 ? '#1a1a1a' : getColor(ratio * maxHours, maxHours) }} />
        ))}
        <span className="legend-label">More</span>
      </div>
    </div>
  );
}

export default ContributionGraph;