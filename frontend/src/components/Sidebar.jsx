import React from "react";
import { NavLink } from "react-router-dom";

function Item({ to, label, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex h-11 w-11 items-center justify-center rounded-2xl text-lg transition ${
          isActive
            ? "bg-emerald-600 text-white"
            : "text-slate-600 hover:bg-slate-100 dark:text-wa-muted dark:hover:bg-wa-bar/60"
        }`
      }
      title={label}
    >
      {children}
    </NavLink>
  );
}

export default function Sidebar() {
  return (
    <aside className="hidden w-[72px] shrink-0 flex-col items-center gap-2 self-stretch overflow-y-auto border-r border-slate-200 bg-white py-3 dark:border-wa-bar dark:bg-wa-panel md:flex">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-sm font-bold text-white">
        E
      </div>
      <div className="my-1 h-px w-10 bg-slate-200 dark:bg-wa-bar" />
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
