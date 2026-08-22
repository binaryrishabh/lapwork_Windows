import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

interface FlagIconProps extends IconProps {
  filled?: boolean;
}

const defaults = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const IconTimer: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2 2" />
    <path d="M9 2h6" />
  </svg>
);

export const IconHistory: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </svg>
);

export const IconChart: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <path d="M3 3v18h18" />
    <rect x="7" y="10" width="3" height="8" rx="1" />
    <rect x="12" y="6" width="3" height="12" rx="1" />
    <rect x="17" y="3" width="3" height="15" rx="1" />
  </svg>
);

export const IconSettings: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);

export const IconPlay: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

export const IconPause: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

export const IconFlag: React.FC<FlagIconProps> = ({ size = 16, className, style, filled }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style} fill={filled ? 'currentColor' : 'none'}>
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

export const IconSave: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

export const IconTrash: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

export const IconPencil: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

export const IconX: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const IconPlus: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const IconSun: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

export const IconMoon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

export const IconArchive: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <polyline points="21 8 21 21 3 21 3 8" />
    <rect x="1" y="3" width="22" height="5" />
    <line x1="10" y1="12" x2="14" y2="12" />
  </svg>
);

export const IconChevronDown: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const IconChevronUp: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

export const IconChevronLeft: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

export const IconChevronRight: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export const IconAlert: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export const IconCheck: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const IconInfo: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

export const IconInbox: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

export const IconTarget: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

export const IconReset: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

export const IconCalendar: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} {...defaults} className={className} style={style}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);