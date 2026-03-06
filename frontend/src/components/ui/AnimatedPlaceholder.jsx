import { useState, useEffect, useRef } from 'react';
import './AnimatedPlaceholder.css';

const TYPING_SPEED    = 45;   // ms per character when typing
const ERASING_SPEED   = 18;   // ms per character when erasing
const PAUSE_DURATION  = 2200; // ms to pause after fully typed

const AnimatedPlaceholder = ({ placeholders = [], isActive = true }) => {
  const [displayText, setDisplayText] = useState('');
  const stateRef = useRef({
    phase: 'typing',       // 'typing' | 'pausing' | 'erasing'
    charIndex: 0,
    textIndex: 0,
    timer: null,
  });

  useEffect(() => {
    const s = stateRef.current;

    const clear = () => { if (s.timer) { clearTimeout(s.timer); s.timer = null; } };

    if (!isActive) {
      clear();
      setDisplayText('');
      s.phase     = 'typing';
      s.charIndex = 0;
      return clear;
    }

    const tick = () => {
      const str = placeholders[s.textIndex] || '';

      if (s.phase === 'typing') {
        if (s.charIndex <= str.length) {
          setDisplayText(str.slice(0, s.charIndex));
          s.charIndex += 1;
          s.timer = setTimeout(tick, TYPING_SPEED);
        } else {
          // finished typing → pause
          s.phase = 'pausing';
          s.timer = setTimeout(() => {
            s.phase     = 'erasing';
            s.charIndex = str.length;
            tick();
          }, PAUSE_DURATION);
        }
      } else if (s.phase === 'erasing') {
        if (s.charIndex >= 0) {
          setDisplayText(str.slice(0, s.charIndex));
          s.charIndex -= 1;
          s.timer = setTimeout(tick, ERASING_SPEED);
        } else {
          // move to next string
          s.textIndex = (s.textIndex + 1) % placeholders.length;
          s.phase     = 'typing';
          s.charIndex = 0;
          s.timer = setTimeout(tick, 150); // brief pause before next word
        }
      }
    };

    // kick off
    s.timer = setTimeout(tick, 200);
    return clear;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  if (!isActive) return null;

  return (
    <span className="animated-placeholder" aria-hidden="true">
      {displayText || <span className="animated-placeholder-empty" />}
    </span>
  );
};

export default AnimatedPlaceholder;
