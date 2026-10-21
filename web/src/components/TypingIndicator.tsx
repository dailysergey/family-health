"use client";

export function TypingIndicator() {
  return (
    <div className="flex gap-2 items-center py-1 animate-fade-in">
      <div
        className="inline-flex gap-1 items-center px-3.5 py-3"
        style={{ background: "var(--color-neutral-200)", borderRadius: "18px 18px 18px 6px" }}
      >
        {[0, 160, 320].map((delay) => (
          <span
            key={delay}
            className="block rounded-full"
            style={{
              width: 6,
              height: 6,
              background: "var(--color-neutral-600)",
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
