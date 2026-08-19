import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { formatMs } from '../utils/formatTime';

function TimeChart({ sessions, chartType, setChartType, stats }) {
  const [tooltip, setTooltip] = useState(null); // { x, y, data } or null

  const chartScrollRef = useRef(null);
  const tooltipRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(800);

  useEffect(() => {
    const updateWidth = () => {
      if (chartScrollRef.current) {
        setChartWidth(chartScrollRef.current.clientWidth);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    if (chartScrollRef.current) {
      observer.observe(chartScrollRef.current);
    }
    window.addEventListener('resize', updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  const views = [
    { key: 'weekly', label: 'Week' },
    { key: 'monthly', label: 'Month' },
    { key: 'yearly', label: 'Year' },
  ];

  const { bars, displayTotalMs } = useMemo(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const todayStr = now.toISOString().split('T')[0];

    const normalizedSessions = [];
    sessions.forEach(s => {
      let dateStr = null;
      if (s.date) {
        if (s.date.includes('T')) dateStr = s.date.split('T')[0];
        else if (s.date.includes(' ')) dateStr = s.date.split(' ')[0];
        else dateStr = s.date;
      }
      if (dateStr && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        normalizedSessions.push({
          dateStr,
          totalMs: Number(s.totalMs || s.total_ms || 0),
          distractions: (s.distractions || []).map(d => ({
            durationMs: Number(d.durationMs || d.duration_ms || 0),
          })),
        });
      }
    });

    if (chartType === 'weekly') {
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      monday.setHours(0, 0, 0, 0);

      const bars = [];
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      let weekTotalMs = 0;

      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        let dayProductiveMs = 0;
        let dayDistractedMs = 0;
        let daySessions = 0;

        normalizedSessions.forEach(s => {
          if (s.dateStr === dateStr) {
            dayProductiveMs += s.totalMs;
            dayDistractedMs += s.distractions.reduce((sum, d) => sum + d.durationMs, 0);
            daySessions++;
          }
        });

        if (!(date > now)) {
          weekTotalMs += dayProductiveMs;
        }

        const dayTotalMs = dayProductiveMs + dayDistractedMs;
        const dayFocusRate = dayTotalMs > 0 ? Math.round((dayProductiveMs / dayTotalMs) * 100) : 0;
        const dayAvgSession = daySessions > 0 ? dayProductiveMs / daySessions : 0;

        bars.push({
          label: dayNames[i],
          sublabel: `${dd} ${monthNames[date.getMonth()]}`,
          ms: dayProductiveMs,
          hours: Math.round((dayProductiveMs / 3600000) * 100) / 100,
          isToday: dateStr === todayStr,
          isFuture: date > now,
          // Tooltip data
          tooltipData: {
            dateLabel: `${dayNames[i]}, ${dd} ${monthNames[date.getMonth()]}`,
            totalMs: dayTotalMs,
            productiveMs: dayProductiveMs,
            distractedMs: dayDistractedMs,
            avgSessionMs: dayAvgSession,
            focusRate: dayFocusRate,
            sessions: daySessions,
          },
        });
      }

      return { bars, displayTotalMs: weekTotalMs };
    }

    if (chartType === 'monthly') {
      const year = now.getFullYear();
      const month = now.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      const bars = [];
      let monthTotalMs = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const mm = String(month + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        const dateStr = `${year}-${mm}-${dd}`;
        const date = new Date(year, month, day);

        let dayProductiveMs = 0;
        let dayDistractedMs = 0;
        let daySessions = 0;

        normalizedSessions.forEach(s => {
          if (s.dateStr === dateStr) {
            dayProductiveMs += s.totalMs;
            dayDistractedMs += s.distractions.reduce((sum, d) => sum + d.durationMs, 0);
            daySessions++;
          }
        });

        if (!(date > now)) {
          monthTotalMs += dayProductiveMs;
        }

        const dayTotalMs = dayProductiveMs + dayDistractedMs;
        const dayFocusRate = dayTotalMs > 0 ? Math.round((dayProductiveMs / dayTotalMs) * 100) : 0;
        const dayAvgSession = daySessions > 0 ? dayProductiveMs / daySessions : 0;

        bars.push({
          label: String(day),
          sublabel: dayNames[date.getDay()],
          ms: dayProductiveMs,
          hours: Math.round((dayProductiveMs / 3600000) * 100) / 100,
          isToday: dateStr === todayStr,
          isFuture: date > now,
          tooltipData: {
            dateLabel: `${dayNames[date.getDay()]}, ${dd} ${monthNames[month]}`,
            totalMs: dayTotalMs,
            productiveMs: dayProductiveMs,
            distractedMs: dayDistractedMs,
            avgSessionMs: dayAvgSession,
            focusRate: dayFocusRate,
            sessions: daySessions,
          },
        });
      }

      return { bars, displayTotalMs: monthTotalMs };
    }

    if (chartType === 'yearly') {
      const year = now.getFullYear();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentMonth = now.getMonth();

      const bars = [];
      let yearTotalMs = 0;

      for (let month = 0; month < 12; month++) {
        let monthProductiveMs = 0;
        let monthDistractedMs = 0;
        let monthSessions = 0;

        normalizedSessions.forEach(s => {
          const parts = s.dateStr.split('-');
          if (parts.length === 3) {
            if (parseInt(parts[0], 10) === year && parseInt(parts[1], 10) - 1 === month) {
              monthProductiveMs += s.totalMs;
              monthDistractedMs += s.distractions.reduce((sum, d) => sum + d.durationMs, 0);
              monthSessions++;
            }
          }
        });

        if (month <= currentMonth) {
          yearTotalMs += monthProductiveMs;
        }

        const monthTotalMs = monthProductiveMs + monthDistractedMs;
        const monthFocusRate = monthTotalMs > 0 ? Math.round((monthProductiveMs / monthTotalMs) * 100) : 0;
        const monthAvgSession = monthSessions > 0 ? monthProductiveMs / monthSessions : 0;

        bars.push({
          label: monthNames[month],
          ms: monthProductiveMs,
          hours: Math.round((monthProductiveMs / 3600000) * 100) / 100,
          isCurrent: month === currentMonth,
          isFuture: month > currentMonth,
          tooltipData: {
            dateLabel: monthNames[month] + ' ' + year,
            totalMs: monthTotalMs,
            productiveMs: monthProductiveMs,
            distractedMs: monthDistractedMs,
            avgSessionMs: monthAvgSession,
            focusRate: monthFocusRate,
            sessions: monthSessions,
          },
        });
      }

      return { bars, displayTotalMs: yearTotalMs };
    }

    return { bars: [], displayTotalMs: 0 };
  }, [sessions, chartType]);

  // Bar hover handlers
  const handleBarEnter = useCallback((e, bar) => {
    const rect = e.currentTarget.closest('.chart-scroll').getBoundingClientRect();
    setTooltip({
      x: e.clientX - rect.left + 16,
      y: e.clientY - rect.top - 10,
      data: bar.tooltipData,
    });
  }, []);

  const handleBarMove = useCallback((e) => {
    if (!tooltip) return;
    const container = e.currentTarget.closest('.chart-scroll');
    const containerRect = container.getBoundingClientRect();
    
    const tooltipHeight = tooltipRef.current ? tooltipRef.current.offsetHeight : 100;
    const tooltipWidth = tooltipRef.current ? tooltipRef.current.offsetWidth : 180;
    const mouseY = e.clientY - containerRect.top;
    const containerHeight = containerRect.height;
    
    const gap = 10; // gap between cursor and tooltip
    
    let tooltipY;
    let flipped = false;
    
    // Check if showing above cursor would overflow top
    if (mouseY - tooltipHeight - gap < 0) {
      // Show below cursor
      tooltipY = mouseY + gap;
      flipped = true;
      
      // But if showing below overflows bottom, clamp to bottom
      if (tooltipY + tooltipHeight > containerHeight - 4) {
        tooltipY = containerHeight - tooltipHeight - 4;
      }
    } else {
      // Show above cursor
      tooltipY = mouseY - gap;
      flipped = false;
      
      // Clamp to top if needed
      if (tooltipY < 4) {
        tooltipY = 4;
      }
    }
    
    // Horizontal: always show to the right of cursor
    let tooltipX = e.clientX - containerRect.left + gap;
    
    // If tooltip overflows right edge, flip to left side of cursor
    if (tooltipX + tooltipWidth > containerRect.width - 4) {
      tooltipX = e.clientX - containerRect.left - tooltipWidth - gap;
    }
    
    // Clamp to left edge
    if (tooltipX < 4) {
      tooltipX = 4;
    }
    
    setTooltip(prev => ({
      ...prev,
      x: tooltipX,
      y: tooltipY,
      flipped,
    }));
  }, [tooltip]);

  const handleBarLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  // Chart dimensions
  const chartHeight = 180;
  const containerPadding = 40;
  const paddingX = 50;
  const paddingBottom = 40;
  const paddingTop = 24;
  const svgHeight = chartHeight + paddingBottom + paddingTop;

  const plotWidth = Math.max(chartWidth - paddingX - containerPadding, 200);
  const totalBars = bars.length;
  const totalGaps = totalBars - 1;

  let barWidth, barGap;
  if (chartType === 'monthly') {
    barGap = 2;
    barWidth = Math.max(6, Math.floor((plotWidth - totalGaps * barGap) / totalBars));
  } else if (chartType === 'yearly') {
    barGap = 24;
    barWidth = Math.max(20, Math.floor((plotWidth - totalGaps * barGap) / totalBars));
  } else {
    barGap = 16;
    barWidth = Math.max(30, Math.floor((plotWidth - totalGaps * barGap) / totalBars));
  }

  const totalWidth = totalBars * barWidth + totalGaps * barGap + paddingX + containerPadding;

  // Y-axis
  const maxHours = Math.max(...bars.filter(b => !b.isFuture).map(b => b.hours), 0.1);
  const yLabels = [];
  if (maxHours <= 0.5) {
    for (let i = 0; i <= 4; i++) {
      yLabels.push(Math.round((maxHours / 4) * i * 60));
    }
  } else {
    for (let i = 0; i <= 4; i++) {
      yLabels.push(Math.round((maxHours / 4) * i * 10) / 10);
    }
  }

  const formatYLabel = (val) => maxHours <= 0.5 ? val + 'm' : val + 'h';

  const getXLabel = (bar, i) => {
    if (chartType === 'weekly') return bar.label;
    if (chartType === 'yearly') return bar.label;
    if (chartType === 'monthly') return bar.label;
    return '';
  };

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h3 className="chart-title">
          {chartType === 'weekly' ? 'This Week' : chartType === 'monthly' ? 'This Month' : 'This Year'}
          <span className="chart-total-badge">{formatMs(displayTotalMs)}</span>
        </h3>
        <div className="chart-toggle-group">
          {views.map(v => (
            <button
              key={v.key}
              className={`chart-toggle-btn ${chartType === v.key ? 'active' : ''}`}
              onClick={() => { setChartType(v.key); setTooltip(null); }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-scroll" ref={chartScrollRef}>
        <svg width="100%" height={svgHeight} viewBox={`0 0 ${totalWidth} ${svgHeight}`} preserveAspectRatio="xMidYMid meet" className="timechart-svg">
          {yLabels.map((val, i) => {
            const ratio = maxHours <= 0.5 ? (val / 60) / maxHours : val / maxHours;
            const y = chartHeight - (ratio * chartHeight) + paddingTop;
            return (
              <g key={i}>
                <line x1={paddingX - 10} y1={y} x2={totalWidth - 20} y2={y} stroke="#1e1e1e" strokeDasharray="4 4" />
                <text x={paddingX - 14} y={y + 4} className="chart-axis-label" textAnchor="end">{formatYLabel(val)}</text>
              </g>
            );
          })}
          <line x1={paddingX - 10} y1={chartHeight + paddingTop} x2={totalWidth - 20} y2={chartHeight + paddingTop} stroke="#252525" />

          {bars.map((bar, i) => {
            const x = i * (barWidth + barGap) + paddingX;
            let barH;
            if (bar.isFuture) barH = 0;
            else if (bar.hours <= 0) barH = 0;
            else barH = Math.max((bar.hours / maxHours) * chartHeight, 4);
            const y = chartHeight - barH + paddingTop;
            const isHighlighted = bar.isToday || bar.isCurrent;
            const showValue = bar.hours > 0 && !(chartType === 'monthly' && barWidth < 12);
            const xLabel = getXLabel(bar, i);

            return (
              <g key={i}>
                {bar.isFuture ? (
                  <rect x={x} y={chartHeight + paddingTop - 1} width={barWidth} height={1} rx={0} fill="#1a1a1a" />
                ) : (
                  <rect
                    x={x} y={y} width={barWidth} height={barH}
                    rx={chartType === 'monthly' ? 1 : 4} ry={chartType === 'monthly' ? 1 : 4}
                    fill={bar.hours > 0 ? (isHighlighted ? '#64b5f6' : '#1e3a5f') : '#151515'}
                    className="chart-bar"
                    onMouseEnter={(e) => bar.tooltipData && bar.tooltipData.totalMs > 0 && handleBarEnter(e, bar)}
                    onMouseMove={(e) => tooltip && handleBarMove(e)}
                    onMouseLeave={handleBarLeave}
                    style={{ cursor: bar.tooltipData && bar.tooltipData.totalMs > 0 ? 'pointer' : 'default' }}
                  />
                )}
                {xLabel !== '' && (
                  <text x={x + barWidth / 2} y={chartHeight + paddingTop + 16}
                    className={`chart-bar-label ${isHighlighted ? 'highlighted' : ''}`} textAnchor="middle">
                    {xLabel}
                  </text>
                )}
                {chartType === 'monthly' && bar.isToday && (
                  <text x={x + barWidth / 2} y={chartHeight + paddingTop + 28} className="chart-bar-sublabel" textAnchor="middle">
                    {bar.sublabel}
                  </text>
                )}
                {showValue && (
                  <text x={x + barWidth / 2} y={y - 6} className="chart-bar-value" textAnchor="middle"
                    fill={isHighlighted ? '#64b5f6' : '#666'} fontSize={chartType === 'monthly' ? '8' : '10'}>
                    {formatMs(bar.ms)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {tooltip && tooltip.data && (
          <div
            className={`chart-tooltip-floating ${tooltip.flipped ? 'flipped' : ''}`}
            ref={tooltipRef}
            style={{
            left: tooltip.x + 'px',
            top: tooltip.y + 'px',
            transform: tooltip.flipped ? 'translateY(0)' : 'translateY(-100%)',
            }}
          >
            <div className="tooltip-date-header">{tooltip.data.dateLabel}</div>
            <div className="tooltip-stats">
              <div className="tooltip-stat-row">
                <span className="tooltip-stat-label">⏱ Total</span>
                <span className="tooltip-stat-value">{formatMs(tooltip.data.totalMs)}</span>
              </div>
              <div className="tooltip-stat-row">
                <span className="tooltip-stat-label">📐 Avg Session</span>
                <span className="tooltip-stat-value">{formatMs(tooltip.data.avgSessionMs)}</span>
              </div>
              <div className="tooltip-stat-row">
                <span className="tooltip-stat-label">🎯 Focus</span>
                <span className="tooltip-stat-value" style={{
                  color: tooltip.data.focusRate >= 80 ? '#4caf50' : tooltip.data.focusRate >= 60 ? '#ff9800' : '#f44336'
                }}>
                  {tooltip.data.focusRate}%
                </span>
              </div>
            </div>
            {tooltip.data.sessions > 0 && (
              <div className="tooltip-sessions">{tooltip.data.sessions} session{tooltip.data.sessions !== 1 ? 's' : ''}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TimeChart;