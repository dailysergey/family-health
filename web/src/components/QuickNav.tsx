"use client";

interface NavTag {
  href: string;
  label: string;
}

export function QuickNav({ tags }: { tags: NavTag[] }) {
  if (!tags.length) return null;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const id = href.replace("#", "");
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <nav className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none mt-3 mb-6">
      {tags.map((t) => (
        <a
          key={t.href}
          href={t.href}
          onClick={(e) => handleClick(e, t.href)}
          className="shrink-0 text-footnote font-medium px-3 py-1 rounded-full opacity-80 hover:opacity-100 transition-opacity"
          style={{
            background: "var(--accent, #C05A39)",
            color: "#fff",
            textDecoration: "none",
          }}
        >
          #{t.label}
        </a>
      ))}
    </nav>
  );
}
