"use client";

import { useRef, useCallback, useEffect } from "react";

/** Auto-scroll: scrolls to bottom unless user has scrolled up manually. */
export function useAutoScroll(containerRef: React.RefObject<HTMLElement | null>) {
  const autoScrollRef = useRef(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [containerRef]);

  const scrollDown = useCallback(
    (smooth?: boolean) => {
      if (!autoScrollRef.current) return;
      const el = containerRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "instant" });
    },
    [containerRef],
  );

  return scrollDown;
}
