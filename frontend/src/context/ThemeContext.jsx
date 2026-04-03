import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);

function applyMode(mode) {
  const root = document.documentElement;
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.removeAttribute("data-palette");
}

/**
 * WhatsApp-style appearance only: `light` | `dark`.
 * Persists to localStorage key `theme`.
 */
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return "dark";
  });

  useEffect(() => {
    applyMode(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export default ThemeContext;
