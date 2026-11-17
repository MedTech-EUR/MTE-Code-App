import React, { useEffect, useRef, useState } from 'react';
import { AppIcon } from './AppIcons';
import { copyTextToClipboard } from '../utils/clipboardUtils';

/**
 * "Copy summary": puts a result's summary (utils/resultSummary.js) on the clipboard and says
 * so for a moment. `getText` builds the text when the button is pressed, so it is current.
 */
export const CopySummaryButton = ({ getText, className = '', iconSize = 14 }) => {
  const [state, setState] = useState('idle');
  const timer = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);

  const copy = async () => {
    let next = 'copied';
    try {
      await copyTextToClipboard(getText());
    } catch {
      next = 'failed';
    }
    if (!mounted.current) return;
    setState(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 2500);
  };

  const label = state === 'copied' ? 'Copied' : state === 'failed' ? 'Could not copy' : 'Copy summary';
  return (
    <button type="button" onClick={copy} className={`no-print ${className}`}>
      <AppIcon name={state === 'copied' ? 'Check' : state === 'failed' ? 'AlertCircle' : 'Copy'} size={iconSize} />
      <span aria-live="polite">{label}</span>
    </button>
  );
};
