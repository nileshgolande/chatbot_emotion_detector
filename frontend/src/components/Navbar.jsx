import React from "react";
import { MessageCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import BrandWordmark from "./BrandWordmark";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-wa-bar dark:bg-wa-header dark:text-emerald-50">
      <Link to="/" className="flex items-center gap-2.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#075E54] text-white shadow-sm ring-1 ring-slate-200/80 dark:ring-wa-bar">
          <MessageCircle className="h-4 w-4" strokeWidth={2} aria-hidden />
        </span>
        <BrandWordmark variant="panel" />
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
