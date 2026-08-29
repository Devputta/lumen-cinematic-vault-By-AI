import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set New Password — Lumen Cine Vault Gallery" },
      {
        name: "description",
        content: "Choose a new password for your Lumen Cine Vault Gallery account.",
      },
      { property: "og:title", content: "Set New Password — Lumen Cine Vault Gallery" },
      { property: "og:description", content: "Choose a new password for your private gallery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(
          "This reset link is invalid or has expired. Please request a new one.",
        );
        return;
      }
      navigate({ to: "/gallery", replace: true });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-5 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(60% 45% at 50% 0%, rgba(211,162,106,0.16), transparent 70%)",
        }}
      />
      <div className="relative w-full max-w-md">
        <div className="text-center">
          <Link to="/" className="font-serif text-4xl tracking-wide text-cream">
            Lumen
          </Link>
          <p className="mt-2 text-[0.65rem] uppercase tracking-[0.4em] text-cream-muted">
            Cine Vault Gallery
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-line bg-panel/70 p-7 shadow-2xl backdrop-blur-sm sm:p-9">
          <h1 className="font-serif text-3xl text-cream sm:text-4xl">Set a new password</h1>
          <p className="mt-2 text-sm text-cream-muted">Then you'll be taken to your gallery.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-[0.7rem] uppercase tracking-[0.2em] text-cream-muted"
              >
                New password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-line bg-ink-2 px-4 py-3 pr-12 text-cream outline-none transition-colors placeholder:text-cream-muted/60 focus:border-amber/70"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-cream-muted transition-colors hover:text-cream"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm"
                className="mb-2 block text-[0.7rem] uppercase tracking-[0.2em] text-cream-muted"
              >
                Confirm password
              </label>
              <input
                id="confirm"
                name="confirm"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-line bg-ink-2 px-4 py-3 text-cream outline-none transition-colors placeholder:text-cream-muted/60 focus:border-amber/70"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-cream px-5 py-3 text-sm font-medium tracking-wide text-ink transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Update password
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-cream-muted">
            <Link to="/forgot-password" className="text-cream transition-colors hover:text-amber">
              Request a new link
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
