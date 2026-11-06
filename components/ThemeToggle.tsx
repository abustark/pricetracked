"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icons";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(current);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("pricetracked-theme", next);
    setTheme(next);
  }

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      className="theme-switch"
      type="button"
      onClick={toggleTheme}
      role="switch"
      aria-checked={theme === "dark"}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      <span className="theme-icon" aria-hidden="true"><Icon name={theme === "dark" ? "sun" : "moon"} size={17} /></span>
      <span className="theme-text">{theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
}
