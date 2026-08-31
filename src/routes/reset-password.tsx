import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a New Password — Lumen Cine Vault Gallery" },
      {
        name: "description",
        content: "Choose a new password for your Lumen Cine Vault Gallery account.",
      },
      { property: "og:title", content: "Set a New Password — Lumen Cine Vault Gallery" },
      { property: "og:description", content: "Choose a new password for your private gallery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function scorePassword(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const capped = Math.min(score, 4);
  const labels = ["Very weak", "Weak", "Fair", "Strong", "Excellent"];
  return { score: capped, label: labels[capped]! };
}

type LinkState = "checking" | "ready" | "invalid";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [linkMessage, setLinkMessage] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const strength = useMemo(() => scorePassword(password), [password]);

  // Validate the recovery link: Supabase consumes the token from the URL and
  // establishes a short-lived recovery session. No session -> invalid/expired/used link.
  useEffect(() => {
    let active = true;

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const search = new URLSearchParams(window.location.search);
    const urlError = hash.get("error_code") ?? search.get("error_code");
    const urlErrorDesc = hash.get("error_description") ?? search.get("error_description");

    if (urlError) {
      setLinkState("invalid");
      setLinkMessage(
        urlError.includes("expired")
          ? "This reset link has expired. Please request a new one."
          : (urlErrorDesc ?? "This reset link is invalid or has already been used."),
      );
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setLinkState("ready");
    });

    (async () => {
      // Give the client a moment to process the token in the URL.
      for (let attempt = 0; attempt < 12; attempt++) {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (data.session) {
          setLinkState("ready");
          return;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      if (!active) return;
      setLinkState("invalid");
      setLinkMessage(
        "This reset link is invalid, has expired, or has already been used. Please request a new one.",
      );
    })();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};

    if (!password) next.password = "Please enter a new password.";
    else if (password.length < 8) next.password = "Use at least 8 characters.";
    else if (strength.score < 2)
      next.password = "Choose a stronger password — mix letters, numbers and symbols.";

    if (!confirm) next.confirm = "Please confirm your new password.";
    else if (password !== confirm) next.confirm = "Passwords do not match.";

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setErrors({
          form:
            updateError.status === 422
              ? "That password can't be used. Please choose a different one."
              : "This reset link is invalid or has expired. Please request a new one.",
        });
        return;
      }
      // Consume the recovery session so the link cannot be reused.
      await supabase.auth.signOut();
      setDone(true);
    } catch {
      setErrors({ form: "We couldn't reach the server. Check your connection and try again." });
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
          {done ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto size-8 text-amber" />
              <h1 className="mt-4 font-serif text-3xl text-cream">Password changed</h1>
              <p className="mt-2 text-sm text-cream-muted">
                Your password has been changed successfully.
              </p>
              <button
                type="button"
                onClick={() => navigate({ to: "/login", replace: true })}
                className="mt-7 w-full rounded-lg bg-cream px-5 py-3 text-sm font-medium tracking-wide text-ink transition-opacity hover:opacity-90"
              >
                Sign In
              </button>
            </div>
          ) : linkState === "checking" ? (
            <div className="flex items-center gap-3 py-6 text-sm text-cream-muted">
              <Loader2 className="size-4 animate-spin" />
              Verifying your reset link…
            </div>
          ) : linkState === "invalid" ? (
            <div>
              <h1 className="font-serif text-3xl text-cream sm:text-4xl">Link unavailable</h1>
              <div
                role="alert"
                className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              >
                {linkMessage}
              </div>
              <Link
                to="/forgot-password"
                className="mt-7 block w-full rounded-lg bg-cream px-5 py-3 text-center text-sm font-medium tracking-wide text-ink transition-opacity hover:opacity-90"
              >
                Request a new link
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-serif text-3xl text-cream sm:text-4xl">Set a new password</h1>
              <p className="mt-2 text-sm text-cream-muted">
                Choose a strong password you haven't used before.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-[0.7rem] uppercase tracking-[0.2em] text-cream-muted"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
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
                  {password && (
                    <div className="mt-3">
                      <div className="flex gap-1.5">
                        {[0, 1, 2, 3].map((i) => (
                          <span
                            key={i}
                            className={`h-1 flex-1 rounded-full ${
                              i < strength.score ? "bg-amber" : "bg-line"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-cream-muted">
                        Password strength: <span className="text-cream">{strength.label}</span>
                        {strength.score < 3 &&
                          " — mix upper and lower case, numbers and symbols."}
                      </p>
                    </div>
                  )}
                  {errors.password && (
                    <p className="mt-2 text-sm text-red-300">{errors.password}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="confirm"
                    className="mb-2 block text-[0.7rem] uppercase tracking-[0.2em] text-cream-muted"
                  >
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirm"
                      name="confirm"
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      aria-invalid={Boolean(errors.confirm)}
                      className="w-full rounded-lg border border-line bg-ink-2 px-4 py-3 pr-12 text-cream outline-none transition-colors placeholder:text-cream-muted/60 focus:border-amber/70"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-cream-muted transition-colors hover:text-cream"
                    >
                      {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {errors.confirm && <p className="mt-2 text-sm text-red-300">{errors.confirm}</p>}
                </div>

                {errors.form && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                  >
                    {errors.form}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-cream px-5 py-3 text-sm font-medium tracking-wide text-ink transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  Update Password
                </button>
              </form>

              <p className="mt-7 text-center text-sm text-cream-muted">
                <Link to="/login" className="text-cream transition-colors hover:text-amber">
                  Back to Sign In
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
