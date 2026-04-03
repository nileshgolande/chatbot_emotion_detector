import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

/**
 * @param {boolean} [embedded]
 * @param {() => void} [onRegistered]
 * @param {() => void} [onSwitchToLogin]
 */
export default function Register({ embedded = false, onRegistered, onSwitchToLogin } = {}) {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    password_confirm: "",
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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

  const registerForm = (
    <form
      onSubmit={onSubmit}
      className="relative w-full max-w-md space-y-3 rounded-xl border border-wa-bar bg-wa-panel p-6 pt-14 shadow-xl"
    >
      <div className="absolute left-3 right-3 top-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => (onSwitchToLogin ? onSwitchToLogin() : navigate("/login"))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-wa-bar bg-wa-header text-emerald-500 dark:text-emerald-400"
          aria-label="Back to login"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {!embedded && (
          <Link
            to="/"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-wa-bar bg-wa-header text-emerald-500 dark:text-emerald-400"
            aria-label="Home"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M4 10v10h6v-6h4v6h6V10" />
            </svg>
          </Link>
        )}
      </div>

      <h1 className="text-xl font-semibold text-slate-900 dark:text-emerald-50">Create account</h1>
      {error && <p className="break-words text-sm text-red-400">{error}</p>}
      <div>
        <label className="mb-1 block text-xs text-wa-muted">Username</label>
        <input
          name="username"
          className="w-full rounded-md bg-wa-bar px-3 py-2 text-sm text-slate-900 outline-none ring-wa-accent focus:ring dark:text-emerald-50"
            value={form.username}
          onChange={onChange}
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-wa-muted">Email (optional)</label>
        <input
          name="email"
          type="email"
          className="w-full rounded-md bg-wa-bar px-3 py-2 text-sm text-slate-900 outline-none ring-wa-accent focus:ring dark:text-emerald-50"
            value={form.email}
          onChange={onChange}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-wa-muted">Password</label>
        <input
          name="password"
          type="password"
          className="w-full rounded-md bg-wa-bar px-3 py-2 text-sm text-slate-900 outline-none ring-wa-accent focus:ring dark:text-emerald-50"
            value={form.password}
          onChange={onChange}
          required
          minLength={8}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-wa-muted">Confirm password</label>
        <input
          name="password_confirm"
          type="password"
          className="w-full rounded-md bg-wa-bar px-3 py-2 text-sm text-slate-900 outline-none ring-wa-accent focus:ring dark:text-emerald-50"
          value={form.password_confirm}
          onChange={onChange}
          required
          minLength={8}
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-wa-accent py-2 text-sm font-medium text-emerald-950 disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Register"}
      </button>
      <p className="text-center text-xs text-wa-muted">
        Already have an account?{" "}
        {onSwitchToLogin ? (
          <button type="button" className="text-emerald-400 hover:underline" onClick={onSwitchToLogin}>
            Log in
          </button>
        ) : (
          <Link className="text-emerald-400 hover:underline" to="/login">
            Log in
          </Link>
        )}
      </p>
    </form>
  );

  if (embedded) {
    return registerForm;
  }

  return <div className="flex min-h-screen items-center justify-center bg-wa-bg px-4 py-10">{registerForm}</div>;
}
