"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export type Theme = "dark" | "light";

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.cookie = `rc_theme=${theme}; path=/; max-age=31536000; samesite=lax`;
  try {
    localStorage.setItem("rc_theme", theme);
  } catch {}
}

export function ThemeToggle({ initial, compact = false }: { initial: Theme; compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    // The cookie wins (it's what the server rendered with); localStorage is a fallback for first visits.
    if (document.cookie.includes("rc_theme=")) return;
    let saved: Theme | null = null;
    try {
      saved = localStorage.getItem("rc_theme") as Theme | null;
    } catch {}
    if (saved && saved !== initial) {
      apply(saved);
      queueMicrotask(() => setTheme(saved as Theme));
    }
  }, [initial]);

  const next: Theme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={() => {
        setTheme(next);
        apply(next);
      }}
      className={compact ? "btn btn-ghost !px-2" : "btn btn-ghost w-full justify-center"}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      <Icon size={15} />
      {!compact && <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}
