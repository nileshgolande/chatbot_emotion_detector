import React from "react";
import { NavLink } from "react-router-dom";

function Item({ to, label, children }) {
  return (
    <NavLink
      to={to}
      end
      title={label}
      className={({ isActive }) =>
        [
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg transition-all duration-150",
          isActive
            ? "bg-emerald-600 text-white shadow-[0_4px_14px_rgba(5,150,105,0.45)] ring-2 ring-emerald-400/70 ring-offset-2 ring-offset-white dark:ring-offset-wa-panel"
            : "text-slate-600 hover:scale-105 hover:bg-slate-100 dark:text-wa-muted dark:hover:bg-wa-bar/60",
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  );
}

/**
 * Left rail: stays full height next to scrolling main content (used inside a flex row with min-h-0).
 */
export default function Sidebar() {
  return (
    <aside className="hidden h-full min-h-0 shrink-0 flex-col items-center gap-2 self-stretch border-r border-slate-200 bg-white py-3 dark:border-wa-bar dark:bg-wa-panel md:flex md:w-[72px]">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-sm font-bold text-white">
        E
      </div>
      <div className="my-1 h-px w-10 shrink-0 bg-slate-200 dark:bg-wa-bar" />
      <Item to="/chat" label="Chats">
        💬
      </Item>
      <Item to="/journal" label="Journal">
        📓
      </Item>
      <Item to="/dashboard" label="Dashboard">
        📊
      </Item>
    </aside>
  );
}
