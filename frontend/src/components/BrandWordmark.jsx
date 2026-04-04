import React from "react";

/**
 * Product name + tagline shown consistently across the app.
 * @param {{ variant?: "landing" | "panel"; className?: string }} props
 */
export default function BrandWordmark({ variant = "panel", className = "" }) {
  const isLanding = variant === "landing";
  return (
    <div className={`leading-tight ${className}`}>
      <p
        className={
          isLanding
            ? "text-sm font-bold tracking-tight text-white"
            : "text-sm font-bold tracking-tight text-slate-900 dark:text-emerald-50"
        }
      >
        Aero-WhatsApp
      </p>
      <p
        className={
          isLanding
            ? "text-[10px] font-medium uppercase tracking-widest text-white/50"
            : "text-[10px] font-medium uppercase tracking-widest text-slate-500 dark:text-wa-muted"
        }
      >
        Emotion AI
      </p>
    </div>
  );
}
