import React, { useState } from "react";
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import BrandWordmark from "../components/BrandWordmark";

const iconBtnClass =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E9ECEF] text-[#00A87E] shadow-sm transition hover:bg-[#dee2e6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00A87E]/30 dark:border dark:border-wa-bar dark:bg-wa-header dark:text-emerald-400 dark:hover:bg-wa-bar";

function HomeIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M4 10v10h6v-6h4v6h6V10" />
    </svg>
  );
}

export default function Login({
  embedded = false,
  onAuthenticated,
  onSwitchToRegister,
  onBack,
} = {}) {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/chat";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!embedded && !loading && user) {
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      if (onAuthenticated) {
        onAuthenticated();
        return;
      }
      navigate(from, { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        "Login failed.";
      setError(typeof msg === "string" ? msg : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (!embedded) navigate(-1);
  };

  const fieldClass =
    "w-full rounded-xl border-0 bg-[#E9ECEF] px-4 py-3 text-sm text-[#1A202C] outline-none ring-0 placeholder:text-slate-400 focus:ring-2 focus:ring-[#00A87E]/35 dark:bg-wa-bar dark:text-emerald-50";

  const form = (
    <form
      onSubmit={onSubmit}
      className="relative w-full max-w-md space-y-5 rounded-2xl bg-white p-8 pt-[4.25rem] shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:border dark:border-wa-bar dark:bg-wa-panel dark:shadow-xl"
    >
      <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          className={iconBtnClass}
          aria-label={embedded ? "Close" : "Back"}
          title={embedded ? "Close" : "Back"}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <Link to="/" className={iconBtnClass} aria-label="Home" title="Home">
          <HomeIcon />
        </Link>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-[#1A202C] dark:text-emerald-50">Log in</h1>
      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[#718096] dark:text-wa-muted">Username</label>
        <input
          className={fieldClass}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[#718096] dark:text-wa-muted">Password</label>
        <input
          type="password"
          className={fieldClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-[#00A87E] py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00916d] disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-xs text-[#718096] dark:text-wa-muted">
        No account?{" "}
        {onSwitchToRegister ? (
          <button
            type="button"
            className="font-semibold text-[#00A87E] hover:underline dark:text-emerald-400"
            onClick={onSwitchToRegister}
          >
            Register
          </button>
        ) : (
          <Link className="font-semibold text-[#00A87E] hover:underline dark:text-emerald-400" to="/register">
            Register
          </Link>
        )}
      </p>
    </form>
  );

  if (embedded) {
    return form;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#e8ecef] px-4 pb-8 pt-6 dark:bg-wa-bg">
      <Link to="/" className="mb-6 flex items-center gap-2.5">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#075E54] text-sm font-bold text-white shadow-md ring-1 ring-slate-200/60">
          E
        </span>
        <BrandWordmark variant="panel" />
      </Link>
      {form}
    </div>
  );
}
