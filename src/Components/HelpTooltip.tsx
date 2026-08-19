import React, { useState, useRef } from 'react';

interface HelpTooltipProps {
  text: string;
}

function HelpTooltip({ text }: HelpTooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const show = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    setVisible(true);
  };

  const hide = () => {
    timeoutRef.current = window.setTimeout(() => setVisible(false), 150);
  };

  return (
    <span
      className="help-tooltip-wrapper"
      onMouseEnter={show}
      onMouseLeave={hide}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="help-icon">?</span>
      {visible && (
        <span className="help-tooltip-popup">
          <span className="help-tooltip-arrow" />
          {text}
        </span>
      )}
    </span>
  );
}

export default HelpTooltip;