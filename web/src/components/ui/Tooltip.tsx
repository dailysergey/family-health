"use client";

import { ReactNode, useRef, useState } from "react";

type TooltipSide = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  side?: TooltipSide;
}

export function Tooltip({ children, content, side = "top" }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const offsetMap: Record<TooltipSide, React.CSSProperties> = {
    top: { bottom: "calc(100% + 8px)", left: "50%", transform: visible ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(4px)" },
    bottom: { top: "calc(100% + 8px)", left: "50%", transform: visible ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(-4px)" },
    left: { right: "calc(100% + 8px)", top: "50%", transform: visible ? "translateY(-50%) translateX(0)" : "translateY(-50%) translateX(4px)" },
    right: { left: "calc(100% + 8px)", top: "50%", transform: visible ? "translateY(-50%) translateX(0)" : "translateY(-50%) translateX(-4px)" },
  };

  return (
    <div
      ref={wrapperRef}
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}

      <div
        role="tooltip"
        style={{
          position: "absolute",
          zIndex: 50,
          pointerEvents: "none",
          maxWidth: 220,
          background: "#1c1c1e",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10,
          padding: "10px 14px",
          fontSize: 12,
          lineHeight: 1.45,
          color: "rgba(255,255,255,0.9)",
          whiteSpace: "pre-line",
          boxShadow: "0 4px 20px rgba(0,0,0,0.45)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.15s ease, transform 0.15s ease",
          ...offsetMap[side],
        }}
      >
        {content}
      </div>
    </div>
  );
}
