import React, { useEffect, useRef, useState } from 'react';
import './SplitText.css';

/**
 * SplitText — Splits text into individual characters, animates them in
 * with a stagger when the element enters the viewport.
 *
 * Props:
 *  - text       {string}   The text to display
 *  - className  {string}   Extra class(es) for the outer wrapper
 *  - tag        {string}   HTML tag for the wrapper (default: 'span')
 *  - delay      {number}   Base delay in ms before animation starts (default: 0)
 *  - stagger    {number}   Delay between each character in ms (default: 40)
 *  - once       {boolean}  If true, only animates once (default: true)
 */
const SplitText = ({
  text,
  className = '',
  tag: Tag = 'span',
  delay = 0,
  stagger = 40,
  once = true
}) => {
  const ref = useRef(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimated(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setAnimated(false);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [once]);

  const chars = text ? text.split('') : [];

  return (
    <Tag ref={ref} className={`split-text-wrapper ${className}`} aria-label={text}>
      {chars.map((char, i) => (
        <span
          key={i}
          className={`split-char ${animated ? 'animated' : ''}`}
          style={{
            transitionDelay: `${delay + i * stagger}ms`,
            // Preserve spaces
            whiteSpace: char === ' ' ? 'pre' : 'normal'
          }}
          aria-hidden="true"
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </Tag>
  );
};

export default SplitText;
