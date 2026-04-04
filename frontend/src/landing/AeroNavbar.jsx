import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, MessageCircle } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

function formatSignedInName(user) {
  if (!user) return "";
  const u = user.username != null ? String(user.username).trim() : "";
  if (!u) return "User";
  return u.length === 1 ? u.toUpperCase() : u.charAt(0).toUpperCase() + u.slice(1);
}

export default function AeroNavbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const signedInAs = user ? formatSignedInName(user) : "";

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/30 px-4 py-3 backdrop-blur-md md:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-[#075E54] shadow-lg ring-2 ring-white/20">
            <MessageCircle className="h-5 w-5 text-white" strokeWidth={2} aria-hidden />
            <motion.span
              className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#25D366] text-[#075E54]"
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden
            >
              <Heart className="h-2.5 w-2.5 fill-current text-[#075E54]" strokeWidth={0} />
            </motion.span>
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight text-white">Aero-WhatsApp</p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-white/50">Emotion AI</p>
          </div>
        </Link>

        <nav className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
          {user ? (
            <p
              className="text-right text-[11px] leading-snug text-white/80 sm:text-sm"
              title={user.username ? `Logged in as ${user.username}` : "Logged in"}
            >
              <span className="text-white/65">Signed in as </span>
              <span className="font-semibold text-[#25D366]">{signedInAs}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-[#075E54] shadow-md transition hover:brightness-110"
              >
                Log out
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-full border border-white/25 bg-white/5 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
                  style={{
                    backgroundColor: "#128C7E",
                    boxShadow: "0 4px 20px rgba(18, 140, 126, 0.45)",
                  }}
                >
                  New chat
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
