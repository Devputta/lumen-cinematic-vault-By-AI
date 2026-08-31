import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Forgot Password — Lumen Cine Vault Gallery" },
      {
        name: "description",
        content: "Request a secure password reset link for your Lumen Cine Vault Gallery account.",
      },
      { property: "og:title", content: "Forgot Password — Lumen Cine Vault Gallery" },
      { property: "og:description", content: "Recover access to your private gallery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForgotPasswordPage,
});

const GENERIC_SUCCESS =
  "If an account exists for this email, we've sent a password reset link.";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const value = email.trim();
    if (!value) {
      setError("Please enter your email address.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(value) || value.length > 255) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(value, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      // Rate limiting is the only case worth surfacing; anything else stays generic
      // so we never reveal whether the address is registered.
      if (resetError && resetError.status === 429) {
        setError("Too many attempts. Please wait a few minutes and try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
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
          <h1 className="font-serif text-3xl text-cream sm:text-4xl">Forgot your password?</h1>
          <p className="mt-2 text-sm text-cream-muted">
            Enter your email and we'll help you get back into your private gallery.
          </p>

          {sent ? (
            <div className="mt-8 space-y-5">
              <div className="flex items-start gap-3 rounded-lg border border-amber/30 bg-amber/10 px-4 py-4 text-sm text-cream">
                <MailCheck className="mt-0.5 size-4 shrink-0 text-amber" />
                <p>{GENERIC_SUCCESS}</p>
              </div>
              <p className="text-xs text-cream-muted">
                The link expires shortly and can only be used once. Didn't get it?{" "}
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="text-cream underline transition-colors hover:text-amber"
                >
                  Try another email
                </button>
                .
              </p>
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
                Send Reset Link
              </button>
            </form>
          )}

          <p className="mt-7 text-center text-sm text-cream-muted">
            <Link to="/login" className="text-cream transition-colors hover:text-amber">
              Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
