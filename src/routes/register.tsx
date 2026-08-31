import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { checkUsername } from "@/lib/register.functions";

export const Route = createFileRoute("/register")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Create Your Private Space — Lumen Cine Vault Gallery" },
      {
        name: "description",
        content:
          "Create your Lumen account and start building a private, cinematic gallery for your personal collections.",
      },
      { property: "og:title", content: "Create Your Private Space — Lumen Cine Vault Gallery" },
      {
        property: "og:description",
        content: "Start building your personal cinematic gallery with Lumen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegisterPage,
});

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type FieldErrors = {
  fullName?: string;
  username?: string;
  confirmUsername?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

function scorePassword(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const capped = Math.min(score, 4);
  const labels = ["Very weak", "Weak", "Fair", "Strong", "Very strong"];
  return { score: capped, label: labels[capped]! };
}

const inputClass =
  "w-full rounded-lg border border-line bg-ink-2 px-4 py-3 text-cream outline-none transition-colors placeholder:text-cream-muted/60 focus:border-amber/70";
const labelClass = "mb-2 block text-[0.7rem] uppercase tracking-[0.2em] text-cream-muted";

function RegisterPage() {
  const navigate = useNavigate();
  const verifyUsername = useServerFn(checkUsername);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [confirmUsername, setConfirmUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const strength = useMemo(() => scorePassword(password), [password]);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    const name = fullName.trim();
    const user = username.trim();
    const confirmUser = confirmUsername.trim();
    const mail = email.trim();

    if (!name) next.fullName = "Please enter your full name.";
    else if (name.length < 2 || name.length > 80)
      next.fullName = "Full name must be 2–80 characters.";

    if (!user) next.username = "Please enter a username.";
    else if (!USERNAME_RE.test(user))
      next.username = "3–24 characters, using only letters, numbers or underscores.";

    if (!confirmUser) next.confirmUsername = "Please confirm your username.";
    else if (user && confirmUser !== user) next.confirmUsername = "Usernames do not match.";

    if (!mail) next.email = "Please enter your email.";
    else if (!EMAIL_RE.test(mail) || mail.length > 255)
      next.email = "Please enter a valid email address.";

    if (!password) next.password = "Please enter a password.";
    else if (password.length < 8) next.password = "Password must be at least 8 characters.";
    else if (strength.score < 2)
      next.password = "Password too weak. Add uppercase letters, numbers or symbols.";

    if (!confirmPassword) next.confirmPassword = "Please confirm your password.";
    else if (password && confirmPassword !== password)
      next.confirmPassword = "Passwords do not match.";

    return next;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const user = username.trim();
    const mail = email.trim();

    setLoading(true);
    try {
      const { available } = await verifyUsername({ data: { username: user } });
      if (!available) {
        setErrors({ username: "That username is already taken. Please choose another." });
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: mail,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { username: user, display_name: fullName.trim(), full_name: fullName.trim() },
        },
      });

      if (error) {
        const message = error.message.toLowerCase();
        if (message.includes("already registered") || message.includes("already been registered")) {
          setErrors({ email: "An account with this email already exists. Try signing in." });
        } else if (message.includes("password")) {
          setErrors({ password: "That password isn't strong enough. Please choose another." });
        } else if (message.includes("email")) {
          setErrors({ email: "Please enter a valid email address." });
        } else {
          setFormError("We couldn't create your account. Please try again.");
        }
        return;
      }

      if (data.user && data.user.identities?.length === 0) {
        setErrors({ email: "An account with this email already exists. Try signing in." });
        return;
      }

      if (!data.session) {
        setNotice(
          "Almost there — check your inbox to confirm your email address, then sign in to enter your gallery.",
        );
        return;
      }

      navigate({ to: "/gallery", replace: true });
    } catch {
      setFormError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setFormError(null);
    setNotice(null);
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setFormError("Google sign-up failed. Please try again.");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/gallery", replace: true });
    } catch {
      setFormError("Google sign-up failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-5 py-14 sm:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(60% 45% at 50% 0%, rgba(211,162,106,0.16), transparent 70%), radial-gradient(50% 40% at 50% 100%, rgba(211,162,106,0.07), transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-lg">
        <div className="text-center">
          <Link to="/" className="font-serif text-4xl tracking-wide text-cream">
            Lumen
          </Link>
          <p className="mt-2 text-[0.65rem] uppercase tracking-[0.4em] text-cream-muted">
            Cine Vault Gallery
          </p>
        </div>

        <div className="mt-9 rounded-2xl border border-line bg-panel/70 p-6 shadow-2xl backdrop-blur-sm sm:p-9">
          <h1 className="font-serif text-3xl text-cream sm:text-4xl">Create your private space</h1>
          <p className="mt-2 text-sm text-cream-muted">
            Start building your personal cinematic gallery.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <div>
              <label htmlFor="fullName" className={labelClass}>
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-invalid={Boolean(errors.fullName)}
                className={inputClass}
                placeholder="Ada Lovelace"
              />
              {errors.fullName && <p className="mt-2 text-xs text-red-400">{errors.fullName}</p>}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="username" className={labelClass}>
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  aria-invalid={Boolean(errors.username)}
                  className={inputClass}
                  placeholder="cinephile"
                />
                {errors.username && <p className="mt-2 text-xs text-red-400">{errors.username}</p>}
              </div>

              <div>
                <label htmlFor="confirmUsername" className={labelClass}>
                  Confirm Username
                </label>
                <input
                  id="confirmUsername"
                  name="confirmUsername"
                  type="text"
                  autoComplete="off"
                  value={confirmUsername}
                  onChange={(e) => setConfirmUsername(e.target.value)}
                  aria-invalid={Boolean(errors.confirmUsername)}
                  className={inputClass}
                  placeholder="cinephile"
                />
                {errors.confirmUsername && (
                  <p className="mt-2 text-xs text-red-400">{errors.confirmUsername}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="email" className={labelClass}>
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(errors.email)}
                className={inputClass}
                placeholder="you@example.com"
              />
              {errors.email && <p className="mt-2 text-xs text-red-400">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className={labelClass}>
                Password
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
                  className={`${inputClass} pr-12`}
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
                  <div className="flex gap-1.5" aria-hidden>
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i < strength.score ? "bg-amber" : "bg-line"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-cream-muted" aria-live="polite">
                    Password strength: <span className="text-cream">{strength.label}</span>
                    {strength.score < 3 && " — mix upper and lower case, numbers and symbols."}
                  </p>
                </div>
              )}
              {errors.password && <p className="mt-2 text-xs text-red-400">{errors.password}</p>}
            </div>

            <div>
              <label htmlFor="confirmPassword" className={labelClass}>
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  aria-invalid={Boolean(errors.confirmPassword)}
                  className={`${inputClass} pr-12`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-cream-muted transition-colors hover:text-cream"
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-2 text-xs text-red-400">{errors.confirmPassword}</p>
              )}
            </div>

            {formError && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              >
                {formError}
              </div>
            )}
            {notice && (
              <div className="rounded-lg border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-cream">
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-cream px-5 py-3 text-sm font-medium tracking-wide text-ink transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Create Account
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
            Already have an account?{" "}
            <Link to="/login" className="text-cream transition-colors hover:text-amber">
              Sign In
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
