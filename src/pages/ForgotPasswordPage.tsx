import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logger from "../lib/logger";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    logger.info("auth_forgot_password_attempt", { email });

    const { error: authError } = await supabase.auth.resetPasswordForEmail(email);

    if (authError) {
      logger.warn("auth_forgot_password_error", { email, message: authError.message });
      setError(authError.message);
      setLoading(false);
      return;
    }

    logger.info("auth_forgot_password_success", { email });
    setSuccess(true);
    setLoading(false);
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
          <p className="mt-1 text-sm text-text-muted">Reset your password</p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="rounded-sm bg-accent-light px-4 py-3 text-sm text-accent">
              Check your email for a reset link.
            </div>
            <div className="text-center text-sm">
              <Link to="/login" className="font-500 text-primary hover:text-primary-hover transition-colors">
                Back to login
              </Link>
            </div>
          </div>
        ) : (
          <>
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

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-sm bg-primary px-4 py-2.5 text-sm font-600 text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>

            <div className="mt-6 text-center text-sm">
              <Link to="/login" className="text-text-muted hover:text-text transition-colors">
                Back to login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
