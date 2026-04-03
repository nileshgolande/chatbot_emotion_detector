import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-wa-bar dark:bg-wa-header dark:text-emerald-50">
      <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
          E
        </span>
        <span>Emotion Chat</span>
      </Link>
      <nav className="flex items-center gap-3 text-sm">
        {user && (
          <>
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs hover:bg-slate-100 dark:border-wa-bar dark:bg-wa-bar dark:hover:bg-slate-700"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <span className="hidden text-slate-500 dark:text-wa-muted sm:inline">{user.username}</span>
            <button
              type="button"
              className="rounded-full bg-slate-900 px-3 py-1 text-xs text-white hover:opacity-90 dark:bg-wa-bar"
              onClick={() => {
                logout();
                localStorage.removeItem("chat_demo");
                navigate("/login");
              }}
            >
              Log out
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
