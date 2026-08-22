import React from 'react';
import { formatMs } from '../utils/formatTime';
import HelpTooltip from './HelpTooltip';
import { IconTimer, IconChart, IconTarget } from './icons';

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

  const getFocusColor = (rate, total) => {
    if (total === 0) return 'var(--text-muted)';
    if (rate >= 75) return 'var(--success)';
    if (rate >= 50) return 'var(--warning)';
    return 'var(--error)';
  };

  const getFocusLabel = (rate, total) => {
    if (total === 0) return 'No data';
    if (rate >= 75) return 'Excellent';
    if (rate >= 50) return 'Good';
    if (rate >= 25) return 'Fair';
    return 'Needs work';
  };

  const focusColor = getFocusColor(totalTimeMs > 0 ? safeStats.focusRate : 0, totalTimeMs);
  const focusLabel = getFocusLabel(totalTimeMs > 0 ? safeStats.focusRate : 0, totalTimeMs);

  const cards = [
    {
      label: 'Total Time',
      labelWithHelp: (
        <>Total Time<HelpTooltip text="Sum of productive time + distraction time for the selected period (week/month/year)." /></>
      ),
      value: formatMs(totalTimeMs),
      sub: `${safeStats.totalSessions} sessions ${periodLabel}`,
      icon: <IconTimer size={18} />,
    },
    {
      label: 'Avg Session',
      labelWithHelp: (
        <>Avg Session<HelpTooltip text="Average productive time per session for the selected period." /></>
      ),
      value: formatMs(safeStats.avgSessionMs),
      sub: `productive ${periodLabel}`,
      icon: <IconChart size={18} />,
    },
    {
      label: 'Focus Rate',
      labelWithHelp: (
        <>Focus Rate<HelpTooltip text="Percentage of total time spent productively (not distracted). Higher is better." /></>
      ),
      value: (
        <span className="focus-rate-ring">
          <span>{(totalTimeMs > 0 ? safeStats.focusRate : 0) + '%'}</span>
          <svg width="24" height="24" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="none" stroke="var(--border-subtle)" strokeWidth="3" />
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke={focusColor}
              strokeWidth="3"
              strokeDasharray={`${(safeStats.focusRate / 100) * 62.83} 62.83`}
              strokeLinecap="round"
              transform="rotate(-90 12 12)"
            />
          </svg>
        </span>
      ),
      sub: (
        <span>
          {formatMs(safeStats.totalDistractedMs)} distracted {periodLabel}
          <span style={{ display: 'block', fontSize: '10px', color: focusColor, marginTop: '2px' }}>
            {focusLabel}
          </span>
        </span>
      ),
      icon: <IconTarget size={18} />,
    },
  ];

  return (
    <div className="stats-cards-grid three-cards">
      {cards.map((card, i) => (
        <div key={i} className="stats-card">
          <div className="stats-card-icon">{card.icon}</div>
          <div className="stats-card-content">
            <div className="stats-card-label">{card.labelWithHelp}</div>
            <div className="stats-card-value">{card.value}</div>
            <div className="stats-card-sub">{card.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default StatsCards;