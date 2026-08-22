import React, { useMemo, useState } from 'react';
import { formatMs } from '../utils/formatTime';
import HelpTooltip from './HelpTooltip';
import { IconTarget } from './icons';

interface Distraction {
  name?: string;
  durationMs?: number;
  duration_ms?: number;
}

interface Session {
  date?: string;
  totalMs?: number;
  total_ms?: number;
  distractions?: Distraction[];
}

interface DistractionBreakdownProps {
  sessions: Session[];
}

interface Category {
  name: string;
  totalMs: number;
  count: number;
}

interface Segment extends Category {
  percent: number;
  color: string;
  offset: number;
}

function DistractionBreakdown({ sessions }: DistractionBreakdownProps) {
  const [rangeType, setRangeType] = useState<'daily' | 'weekly'>('daily');
  const now = new Date();
  const isMonday = now.getDay() === 1;

  const dailyBtnClass = `chart-toggle-btn ${rangeType === 'daily' ? 'active' : ''}`;
  const weeklyBtnClass = `chart-toggle-btn ${rangeType === 'weekly' ? 'active' : ''}`;

  const breakdown = useMemo(() => {
    if (!sessions || sessions.length === 0) return null;

    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let filteredSessions: Session[] = [];

    if (rangeType === 'daily') {
      filteredSessions = sessions.filter(s => {
        const d = (s.date || '').split('T')[0];
        return d === todayStr;
      });
    } else {
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      const mondayStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      filteredSessions = sessions.filter(s => {
        const d = (s.date || '').split('T')[0];
        return d >= mondayStr && d <= todayStr;
      });
    }

    const distractionMap: Record<string, Category> = {};
    let totalProductiveMs = 0;
    let totalDistractedMs = 0;

    filteredSessions.forEach(s => {
      totalProductiveMs += Number(s.totalMs || s.total_ms || 0);
      (s.distractions || []).forEach(d => {
        const name = (d.name || 'Unnamed').trim();
        const durationMs = Number(d.durationMs || d.duration_ms || 0);
        if (!name) return;
        totalDistractedMs += durationMs;
        if (!distractionMap[name]) {
          distractionMap[name] = { name, totalMs: 0, count: 0 };
        }
        distractionMap[name].totalMs += durationMs;
        distractionMap[name].count++;
      });
    });

    const categories = Object.values(distractionMap).sort((a, b) => b.totalMs - a.totalMs);
    const totalTime = totalProductiveMs + totalDistractedMs;

    return {
      categories,
      totalProductiveMs,
      totalDistractedMs,
      totalTime,
      hasData: categories.length > 0,
    };
  }, [sessions, rangeType]);

  if (rangeType === 'weekly' && isMonday) {
    return (
      <div className="chart-container">
        <div className="chart-header">
          <h3 className="chart-title">Distraction Breakdown</h3>
          <div className="chart-toggle-group">
            <button className={dailyBtnClass} onClick={() => setRangeType('daily')}>Today</button>
            <button className={weeklyBtnClass} onClick={() => setRangeType('weekly')}>This Week</button>
          </div>
        </div>
        <div className="distraction-empty">
          <div className="distraction-empty-icon"><IconTarget size={20} /></div>
          <p>It's Monday!</p>
          <p className="distraction-empty-hint">This Week is the same as Today. Switch to Today view or check back later in the week.</p>
        </div>
      </div>
    );
  }

  if (!breakdown || !breakdown.hasData) {
    return (
      <div className="chart-container">
        <div className="chart-header">
          <h3 className="chart-title">Distraction Breakdown</h3>
          <div className="chart-toggle-group">
            <button className={`chart-toggle-btn ${rangeType === 'daily' ? 'active' : ''}`} onClick={() => setRangeType('daily')}>Today</button>
            <button className={`chart-toggle-btn ${rangeType === 'weekly' ? 'active' : ''}`} onClick={() => setRangeType('weekly')}>This Week</button>
          </div>
        </div>
        <div className="distraction-empty">
          <div className="distraction-empty-icon"><IconTarget size={20} /></div>
          <p>No distractions tracked {rangeType === 'daily' ? 'today' : 'this week'}</p>
          <p className="distraction-empty-hint">Use the distraction timer during sessions to see data here.</p>
        </div>
      </div>
    );
  }

  const { categories, totalProductiveMs, totalDistractedMs, totalTime } = breakdown;

  const size = 180;
  const strokeWidth = 32;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const sliceColors: string[] = [
    '#8A85A0', '#6B6585', '#55507A', '#3D3854', '#A8A3C0', '#4A4463',
  ];

  let cumulativePercent = 0;
  const segments: Segment[] = categories.map((cat, i) => {
    const percent = totalTime > 0 ? cat.totalMs / totalTime : 0;
    const segment: Segment = {
      ...cat,
      percent,
      color: sliceColors[i % sliceColors.length],
      offset: cumulativePercent,
    };
    cumulativePercent += percent;
    return segment;
  });

  const productivePercent = totalTime > 0 ? totalProductiveMs / totalTime : 1;
  segments.push({
    name: 'Productive',
    totalMs: totalProductiveMs,
    count: 0,
    percent: productivePercent,
    color: 'var(--primary-glow)',
    offset: cumulativePercent,
  });

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h3 className="chart-title">
          Distraction Breakdown
          <HelpTooltip text={`Shows how your ${rangeType === 'daily' ? "today's" : "this week's"} time is split between productive work and each distraction category.`} />
        </h3>
        <div className="chart-toggle-group">
          <button className={`chart-toggle-btn ${rangeType === 'daily' ? 'active' : ''}`} onClick={() => setRangeType('daily')}>Today</button>
          <button className={`chart-toggle-btn ${rangeType === 'weekly' ? 'active' : ''}`} onClick={() => setRangeType('weekly')}>This Week</button>
        </div>
      </div>
      <div className="distraction-layout">
        <div className="distraction-donut-wrapper">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="distraction-donut">
            {segments.map((seg, i) => {
              const dashArray = (seg.percent * circumference);
              const dashOffset = -(seg.offset * circumference);
              return (
                <circle
                  key={i}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dashArray} ${circumference - dashArray}`}
                  strokeDashoffset={dashOffset}
                  transform={`rotate(-90 ${center} ${center})`}
                  className="donut-segment"
                  style={{ transition: 'all 0.5s ease' }}
                />
              );
            })}
            <text x={center} y={center - 8} textAnchor="middle" className="donut-center-label">
              {Math.round(productivePercent * 100)}%
            </text>
            <text x={center} y={center + 14} textAnchor="middle" className="donut-center-sub">
              productive
            </text>
          </svg>
        </div>
        <div className="distraction-legend">
          {segments.map((seg, i) => (
            <div key={i} className={`distraction-legend-item ${seg.name === 'Productive' ? 'productive' : ''}`}>
              <div className="distraction-legend-left">
                <span className="distraction-legend-dot" style={{ backgroundColor: seg.color }} />
                <div className="distraction-legend-info">
                  <span className="distraction-legend-name">{seg.name}</span>
                  {seg.count > 0 && (
                    <span className="distraction-legend-count">{seg.count} time{seg.count !== 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
              <div className="distraction-legend-right">
                <span className="distraction-legend-time">{formatMs(seg.totalMs)}</span>
                <span className="distraction-legend-percent">{Math.round(seg.percent * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="distraction-total-bar">
        <div className="distraction-total-label">Total time: {formatMs(totalTime)}</div>
        <div className="distraction-total-track">
          <div
            className="distraction-total-productive"
            style={{ width: `${productivePercent * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default DistractionBreakdown;