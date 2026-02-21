import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logger from "../lib/logger";

export default function ResetPasswordPage() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    logger.info("auth_reset_password_attempt");

    const { error: authError } = await supabase.auth.updateUser({
      password,
    });

    if (authError) {
      logger.warn("auth_reset_password_error", { message: authError.message });
      setError(authError.message);
      setLoading(false);
      return;
    }

    logger.info("auth_reset_password_success");
    navigate("/login", { replace: true });
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
          <p className="mt-1 text-sm text-text-muted">Set a new password</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-sm bg-warn-light px-4 py-3 text-sm text-warn">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-500 text-text">
              New password
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

          <div>
            <label htmlFor="confirm-password" className="mb-1 block text-sm font-500 text-text">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-sm border border-card-border bg-card px-3 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-primary px-4 py-2.5 text-sm font-600 text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {loading ? "Resetting..." : "Reset password"}
          </button>
        </form>
      </div>
    </div>
  );
}
