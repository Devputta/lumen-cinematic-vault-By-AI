import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset Password — Lumen Cine Vault Gallery" },
      {
        name: "description",
        content: "Request a password reset link for your Lumen Cine Vault Gallery account.",
      },
      { property: "og:title", content: "Reset Password — Lumen Cine Vault Gallery" },
      { property: "og:description", content: "Recover access to your private gallery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setSent(true);
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
          <h1 className="font-serif text-3xl text-cream sm:text-4xl">Forgot password</h1>
          <p className="mt-2 text-sm text-cream-muted">
            We'll email you a secure link to set a new password.
          </p>

          {sent ? (
            <div className="mt-8 rounded-lg border border-amber/30 bg-amber/10 px-4 py-4 text-sm text-cream">
              If an account exists for that email, a reset link is on its way.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-[0.7rem] uppercase tracking-[0.2em] text-cream-muted"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={Boolean(error)}
                  className="w-full rounded-lg border border-line bg-ink-2 px-4 py-3 text-cream outline-none transition-colors placeholder:text-cream-muted/60 focus:border-amber/70"
                  placeholder="you@example.com"
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
                Send reset link
              </button>
            </form>
          )}

          <p className="mt-7 text-center text-sm text-cream-muted">
            <Link to="/login" className="text-cream transition-colors hover:text-amber">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
