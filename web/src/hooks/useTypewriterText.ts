"use client";

import { useRef, useState, useCallback, useEffect } from "react";

/**
 * Typewriter effect: takes a growing target string and returns
 * a displayed string that animates character-by-character with
 * variable speed (fast catch-up when lagging, slow at the end).
 */
export function useTypewriterText(): {
  displayedText: string;
  update: (text: string) => void;
  finish: () => void;
  reset: () => void;
} {
  const [displayedText, setDisplayedText] = useState("");

  const targetRef = useRef("");
  const displayedLenRef = useRef(0);
  const rafRef = useRef<number>(0);
  const doneRef = useRef(false);

  const tick = useCallback(() => {
    rafRef.current = 0;
    if (doneRef.current) return;

    const t = targetRef.current;
    const remaining = t.length - displayedLenRef.current;
    if (remaining <= 0) return;

    // Variable speed: fast when far behind, slow at the frontier
    const speed =
      remaining > 500 ? 60
      : remaining > 200 ? 30
      : remaining > 80  ? 12
      : remaining > 20  ? 5
      :                   2;

    displayedLenRef.current = Math.min(displayedLenRef.current + speed, t.length);
    setDisplayedText(t.slice(0, displayedLenRef.current));

    if (displayedLenRef.current < t.length) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, []);

  const update = useCallback(
    (text: string) => {
      doneRef.current = false;
      targetRef.current = text;
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    },
    [tick],
  );

  const finish = useCallback(() => {
    doneRef.current = true;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const final = targetRef.current;
    setDisplayedText(final);
  }, []);

  const reset = useCallback(() => {
    doneRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    targetRef.current = "";
    displayedLenRef.current = 0;
    setDisplayedText("");
  }, []);

  useEffect(() => () => { cancelAnimationFrame(rafRef.current); }, []);

  return { displayedText, update, finish, reset };
}
