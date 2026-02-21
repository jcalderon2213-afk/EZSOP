import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logger from "../lib/logger";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const signupSuccess = (location.state as { signupSuccess?: boolean })?.signupSuccess;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    logger.info("auth_login_attempt", { email });

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      logger.warn("auth_login_error", { email, message: authError.message });
      setError(authError.message);
      setLoading(false);
      return;
    }

    logger.info("auth_login_success", { email });
    navigate("/dashboard", { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-[420px] rounded bg-card border border-card-border shadow p-8">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-700 tracking-tight">
            <span className="text-text">EZ</span>
            <span className="text-primary">SOP</span>
          </h1>
          <p className="mt-1 text-sm text-text-muted">Sign in to your account</p>
        </div>

        {/* Signup success message */}
        {signupSuccess && (
          <div className="mb-4 rounded-sm bg-accent-light px-4 py-3 text-sm text-accent">
            Account created successfully. Please log in.
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-sm bg-warn-light px-4 py-3 text-sm text-warn">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-500 text-text">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-sm border border-card-border bg-card px-3 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-500 text-text">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-sm border border-card-border bg-card px-3 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-primary px-4 py-2.5 text-sm font-600 text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <div className="mt-6 space-y-2 text-center text-sm">
          <p>
            <Link to="/forgot-password" className="text-text-muted hover:text-text transition-colors">
              Forgot password?
            </Link>
          </p>
          <p className="text-text-muted">
            Don't have an account?{" "}
            <Link to="/signup" className="font-500 text-primary hover:text-primary-hover transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
