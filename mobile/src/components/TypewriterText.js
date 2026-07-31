import React, { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';

/**
 * Types out `text` character-by-character. Calls `onDone` once when finished.
 * Remount with a new `key` (or change `text`) to restart.
 */
export default function TypewriterText({
  text = '',
  style,
  speed = 28,
  startDelay = 200,
  showCursor = true,
  cursorChar = '|',
  onDone,
}) {
  const [visible, setVisible] = useState('');
  const [done, setDone] = useState(false);
  const [cursorOn, setCursorOn] = useState(true);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let cancelled = false;
    let intervalId = null;
    let startTimer = null;
    setVisible('');
    setDone(false);

    startTimer = setTimeout(() => {
      if (cancelled) return;
      let i = 0;
      intervalId = setInterval(() => {
        if (cancelled) return;
        i += 1;
        setVisible(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(intervalId);
          intervalId = null;
          setDone(true);
          onDoneRef.current?.();
        }
      }, Math.max(8, speed));
    }, Math.max(0, startDelay));

    return () => {
      cancelled = true;
      if (startTimer) clearTimeout(startTimer);
      if (intervalId) clearInterval(intervalId);
    };
  }, [text, speed, startDelay]);

  useEffect(() => {
    if (!showCursor || done) return undefined;
    const blink = setInterval(() => setCursorOn((v) => !v), 480);
    return () => clearInterval(blink);
  }, [showCursor, done]);

  return (
    <Text style={style}>
      {visible}
      {showCursor && !done && cursorOn ? cursorChar : ''}
    </Text>
  );
}
