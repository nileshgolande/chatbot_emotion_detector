import React from "react";

/** Single WhatsApp-inspired palette — no alternate themes. */
export const AERO_THEME = {
  accent: "#25D366",
  accentDark: "#128C7E",
  deep: "#075E54",
};

export function AeroAccentProvider({ children }) {
  return (
    <div
      className="min-h-[100dvh] text-white"
      style={
        {
          "--aero-accent": AERO_THEME.accent,
          "--aero-accent-dark": AERO_THEME.accentDark,
          "--aero-deep": AERO_THEME.deep,
        }
      }
    >
      {children}
    </div>
  );
}
