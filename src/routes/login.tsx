import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { signIn } from "@/lib/auth.functions";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign In — Lumen Cine Vault Gallery" },
      {
        name: "description",
        content: "Sign in to Lumen with your username or email to enter your private cinematic gallery.",
      },
      { property: "og:title", content: "Sign In — Lumen Cine Vault Gallery" },
      { property: "og:description", content: "Enter your private cinematic gallery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const submitSignIn = useServerFn(signIn);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const nextErrors: { identifier?: string; password?: string } = {};
    if (!identifier.trim()) nextErrors.identifier = "Please enter your username or email.";
    if (!password) nextErrors.password = "Please enter your password.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const result = await submitSignIn({ data: { identifier, password } });
      if (!result.ok) {
        setFormError(result.message);
        return;
      }
      const { error } = await supabase.auth.setSession({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      });
      if (error) {
        setFormError("We couldn't start your session. Please try again.");
        return;
      }
      navigate({ to: "/gallery", replace: true });
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setFormError(null);
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setFormError("Google sign-in failed. Please try again.");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/gallery", replace: true });
    } catch {
      setFormError("Google sign-in failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-5 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(60% 45% at 50% 0%, rgba(211,162,106,0.16), transparent 70%), radial-gradient(50% 40% at 50% 100%, rgba(211,162,106,0.07), transparent 70%)",
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
          <h1 className="font-serif text-3xl text-cream sm:text-4xl">Welcome back</h1>
          <p className="mt-2 text-sm text-cream-muted">Enter your private gallery.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <div>
              <label
                htmlFor="identifier"
                className="mb-2 block text-[0.7rem] uppercase tracking-[0.2em] text-cream-muted"
              >
                Username or Email
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                aria-invalid={Boolean(errors.identifier)}
                className="w-full rounded-lg border border-line bg-ink-2 px-4 py-3 text-cream outline-none transition-colors placeholder:text-cream-muted/60 focus:border-amber/70"
                placeholder="you@example.com"
              />
              {errors.identifier && (
                <p className="mt-2 text-xs text-red-400">{errors.identifier}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-[0.7rem] uppercase tracking-[0.2em] text-cream-muted"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={Boolean(errors.password)}
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
              {errors.password && <p className="mt-2 text-xs text-red-400">{errors.password}</p>}
            </div>

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-xs text-cream-muted transition-colors hover:text-amber"
              >
                Forgot password?
              </Link>
            </div>

            {formError && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              >
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-cream px-5 py-3 text-sm font-medium tracking-wide text-ink transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Sign In
            </button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[0.65rem] uppercase tracking-[0.3em] text-cream-muted">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-line bg-ink-2 px-5 py-3 text-sm text-cream transition-colors hover:border-amber/60 disabled:opacity-60"
          >
            {googleLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.2h6.6c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7c2-1.9 3.9-4.7 3.9-8.6z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.2 0 5.9-1.1 7.6-2.9l-3.6-2.8c-1 .7-2.3 1.2-4 1.2-3.1 0-5.8-2.1-6.7-5l-.1.1-3.6 2.8C3.3 21.3 7.3 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.3 14.5c-.3-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L5.2 9.4 1.6 6.6C.6 8.2 0 10 0 12s.6 3.8 1.6 5.4l3.7-2.9z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.7c2.2 0 3.7.9 4.5 1.7l3.2-3.1C17.9 1.5 15.2 0 12 0 7.3 0 3.3 2.7 1.6 6.6l3.7 2.9C6.2 6.8 8.9 4.7 12 4.7z"
                />
              </svg>
            )}
            Continue with Google
          </button>

          <p className="mt-7 text-center text-sm text-cream-muted">
            New to Lumen?{" "}
            <Link to="/register" className="text-cream transition-colors hover:text-amber">
              Create an account
            </Link>
          </p>
        </div>

        <p className="mt-8 text-center">
          <Link to="/" className="text-xs text-cream-muted transition-colors hover:text-cream">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
