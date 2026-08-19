import React from 'react';
import { formatMs } from '../utils/formatTime';
import HelpTooltip from './HelpTooltip';

const getFocusEmoji = (rate, totalMs) => {
  if (totalMs === 0) return { emoji: '😴', label: 'No data', color: '#666' };
  if (rate >= 75) return { emoji: '🔥', label: 'Excellent', color: '#4caf50' };
  if (rate >= 50) return { emoji: '🙂', label: 'Good', color: '#8bc34a' };
  if (rate >= 25) return { emoji: '😐', label: 'Fair', color: '#ff9800' };
  return { emoji: '😢', label: 'Needs work', color: '#f44336' };
};

function StatsCards({ stats, chartType }) {
  if (!stats) {
    return <div className="stats-cards-grid three-cards"><div className="loading-state">Loading stats...</div></div>;
  }

  const safeStats = {
    totalMs: stats.totalMs || 0,
    totalSessions: stats.totalSessions || 0,
    avgSessionMs: stats.avgSessionMs || 0,
    focusRate: stats.focusRate ?? 0,
    totalDistractedMs: stats.totalDistractedMs || 0,
  };

  const totalTimeMs = safeStats.totalMs + safeStats.totalDistractedMs;

  const periodLabel = chartType === 'weekly' ? 'this week' : chartType === 'monthly' ? 'this month' : 'this year';

    const cards = [
    {
      label: 'Total Time',
      labelWithHelp: (
        <>Total Time<HelpTooltip text="Sum of productive time + distraction time for the selected period (week/month/year)." /></>
      ),
      value: formatMs(totalTimeMs),
      sub: `${safeStats.totalSessions} sessions ${periodLabel}`,
      icon: '⏱',
      color: '#64b5f6',
    },
    {
      label: 'Avg Session',
      labelWithHelp: (
        <>Avg Session<HelpTooltip text="Average productive time per session for the selected period." /></>
      ),
      value: formatMs(safeStats.avgSessionMs),
      sub: `productive ${periodLabel}`,
      icon: '📐',
      color: '#26c6da',
    },
        {
      label: 'Focus Rate',
      labelWithHelp: (
        <>Focus Rate<HelpTooltip text="Percentage of total time spent productively (not distracted). Higher is better." /></>
      ),
      value: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{(totalTimeMs > 0 ? safeStats.focusRate : 0) + '%'}</span>
          <span className="focus-emoji" title={getFocusEmoji(totalTimeMs > 0 ? safeStats.focusRate : 0, totalTimeMs).label}>
            {getFocusEmoji(totalTimeMs > 0 ? safeStats.focusRate : 0, totalTimeMs).emoji}
          </span>
        </span>
      ),
      sub: (
        <span>
          {formatMs(safeStats.totalDistractedMs)} distracted {periodLabel}
          <span style={{ display: 'block', fontSize: '10px', color: getFocusEmoji(totalTimeMs > 0 ? safeStats.focusRate : 0, totalTimeMs).color, marginTop: '2px' }}>
            {getFocusEmoji(totalTimeMs > 0 ? safeStats.focusRate : 0, totalTimeMs).label}
          </span>
        </span>
      ),
      icon: '🎯',
      color: totalTimeMs === 0 ? '#666' : (safeStats.focusRate >= 75 ? '#4caf50' : safeStats.focusRate >= 50 ? '#8bc34a' : safeStats.focusRate >= 25 ? '#ff9800' : '#f44336'),
    },
  ];


  return (
    <div className="stats-cards-grid three-cards">
      {cards.map((card, i) => (
        <div key={i} className="stats-card" style={{ borderTop: `3px solid ${card.color}` }}>
          <div className="stats-card-icon">{card.icon}</div>
          <div className="stats-card-content">
            <div className="stats-card-label">{card.labelWithHelp}</div>
            <div className="stats-card-value" style={{ color: card.color }}>
              {card.value}
            </div>
            <div className="stats-card-sub">{card.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default StatsCards;