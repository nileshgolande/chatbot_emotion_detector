import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
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

/**
 * @param {boolean} [embedded]
 * @param {() => void} [onRegistered]
 * @param {() => void} [onSwitchToLogin]
 */
export default function Register({ embedded = false, onRegistered, onSwitchToLogin } = {}) {
  const { register, user, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    password_confirm: "",
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!embedded && !loading && user) {
    return <Navigate to="/chat" replace />;
  }

  const onChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(form);
      if (onRegistered) {
        onRegistered();
        return;
      }
      navigate("/chat", { replace: true });
    } catch (err) {
      const data = err.response?.data;
      const msg =
        (typeof data === "object" &&
          data &&
          (data.detail ||
            data.username?.[0] ||
            data.password?.[0] ||
            data.password_confirm?.[0] ||
            (typeof data.non_field_errors?.[0] === "string" && data.non_field_errors[0]))) ||
        "Registration failed.";
      setError(typeof msg === "string" ? msg : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    "w-full rounded-xl border-0 bg-[#E9ECEF] px-4 py-3 text-sm text-[#1A202C] outline-none ring-0 focus:ring-2 focus:ring-[#00A87E]/35 dark:bg-wa-bar dark:text-emerald-50";

  const registerForm = (
    <form
      onSubmit={onSubmit}
      className="relative w-full max-w-md space-y-4 rounded-2xl bg-white p-8 pt-[4.25rem] shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:border dark:border-wa-bar dark:bg-wa-panel dark:shadow-xl"
    >
      <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => (onSwitchToLogin ? onSwitchToLogin() : navigate("/login"))}
          className={iconBtnClass}
          aria-label="Back to login"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <Link to="/" className={iconBtnClass} aria-label="Home" title="Home">
          <HomeIcon />
        </Link>
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-[#1A202C] dark:text-emerald-50">Create account</h1>
      {error && <p className="break-words text-sm text-red-500 dark:text-red-400">{error}</p>}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[#718096] dark:text-wa-muted">Username</label>
        <input
          name="username"
          className={fieldClass}
          value={form.username}
          onChange={onChange}
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[#718096] dark:text-wa-muted">Email (optional)</label>
        <input name="email" type="email" className={fieldClass} value={form.email} onChange={onChange} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[#718096] dark:text-wa-muted">Password</label>
        <input
          name="password"
          type="password"
          className={fieldClass}
          value={form.password}
          onChange={onChange}
          required
          minLength={8}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[#718096] dark:text-wa-muted">Confirm password</label>
        <input
          name="password_confirm"
          type="password"
          className={fieldClass}
          value={form.password_confirm}
          onChange={onChange}
          required
          minLength={8}
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-[#00A87E] py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00916d] disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
      >
        {submitting ? "Creating…" : "Register"}
      </button>
      <p className="text-center text-xs text-[#718096] dark:text-wa-muted">
        Already have an account?{" "}
        {onSwitchToLogin ? (
          <button
            type="button"
            className="font-semibold text-[#00A87E] hover:underline dark:text-emerald-400"
            onClick={onSwitchToLogin}
          >
            Log in
          </button>
        ) : (
          <Link className="font-semibold text-[#00A87E] hover:underline dark:text-emerald-400" to="/login">
            Log in
          </Link>
        )}
      </p>
    </form>
  );

  if (embedded) {
    return registerForm;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#e8ecef] px-4 py-10 pb-12 dark:bg-wa-bg">
      <Link to="/" className="mb-6 flex items-center gap-2.5">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#075E54] text-sm font-bold text-white shadow-md ring-1 ring-slate-200/60">
          E
        </span>
        <BrandWordmark variant="panel" />
      </Link>
      {registerForm}
    </div>
  );
}
