import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Login({
  embedded = false,
  onAuthenticated,
  onSwitchToRegister,
  onBack,
} = {}) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/chat";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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

  const handleForward = () => {
    if (onSwitchToRegister) onSwitchToRegister();
    else navigate("/register");
  };

  const form = (
    <form
      onSubmit={onSubmit}
      className={`relative w-full max-w-md space-y-4 rounded-xl border border-wa-bar bg-wa-panel shadow-xl ${
        embedded ? "p-6 pt-14" : "p-6 pt-14"
      }`}
    >
      <div className="absolute left-3 right-3 top-3 flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-wa-bar bg-wa-header text-emerald-500 transition hover:opacity-90 dark:text-emerald-400"
          aria-label={embedded ? "Close" : "Back"}
          title={embedded ? "Close" : "Back"}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={handleForward}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-wa-bar bg-wa-header text-emerald-500 transition hover:opacity-90 dark:text-emerald-400"
          aria-label="Go to sign up"
          title="Sign up"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-emerald-50">Log in</h1>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div>
        <label className="mb-1 block text-xs text-wa-muted">Username</label>
        <input
          className="w-full rounded-md border border-transparent bg-wa-bar px-3 py-2 text-sm text-slate-900 outline-none ring-wa-accent focus:ring dark:text-emerald-50"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-wa-muted">Password</label>
        <input
          type="password"
          className="w-full rounded-md border border-transparent bg-wa-bar px-3 py-2 text-sm text-slate-900 outline-none ring-wa-accent focus:ring dark:text-emerald-50"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-wa-accent py-2 text-sm font-medium text-emerald-950 disabled:opacity-50"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-xs text-wa-muted">
        No account?{" "}
        {onSwitchToRegister ? (
          <button type="button" className="text-emerald-400 hover:underline" onClick={onSwitchToRegister}>
            Register
          </button>
        ) : (
          <Link className="text-emerald-400 hover:underline" to="/register">
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
    <div className="flex min-h-screen items-center justify-center bg-wa-bg px-4">
      {form}
    </div>
  );
}
