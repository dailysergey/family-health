"use client";

export function TypingIndicator() {
  return (
    <div className="flex gap-2 items-center py-1 animate-fade-in">
      <span
        className="w-7 h-7 rounded-full inline-flex items-center justify-center shrink-0"
        style={{ background: "var(--color-brand)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/><path d="M19 3v4"/><path d="M21 5h-4"/>
        </svg>
      </span>
      <div
        className="inline-flex gap-1 items-center px-3 py-2 rounded-2xl"
        style={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-separator)" }}
      >
        {[0, 160, 320].map((delay) => (
          <span
            key={delay}
            className="block rounded-full"
            style={{
              width: 6,
              height: 6,
              background: "var(--color-text-tertiary)",
              animation: `typingDot 1.4s ease infinite`,
              animationDelay: `${delay}ms`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes typingDot {
          0%, 60%, 100% { opacity: 0.2; transform: scale(0.85); }
          30% { opacity: 0.9; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
