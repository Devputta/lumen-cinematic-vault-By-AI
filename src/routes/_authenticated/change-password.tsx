import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/change-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Change Password — Lumen Cine Vault" },
      { name: "description", content: "Update the password that guards your private gallery." },
      { property: "og:title", content: "Change Password — Lumen Cine Vault" },
      { property: "og:description", content: "Update the password that guards your private gallery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(err.message || "We couldn't update your password. Please try again.");
    setPassword("");
    setConfirm("");
    setDone(true);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="font-serif text-4xl text-cream">Change password</h1>
      <p className="mt-2 text-sm text-cream-muted">Choose a new password for your private gallery.</p>

      {done ? (
        <div className="mt-8 rounded-xl border border-amber/40 bg-panel p-5">
          <p className="text-sm text-cream">Your password has been changed successfully.</p>
          <Link
            to="/gallery"
            className="mt-5 inline-flex rounded-full bg-amber px-5 py-2.5 text-sm font-medium text-ink"
          >
            Back to gallery
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              className="w-full rounded-lg border border-line bg-ink-2 px-4 py-3 pr-11 text-sm text-cream placeholder:text-cream-muted focus:border-amber/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-cream-muted hover:text-cream"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <input
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm new password"
            autoComplete="new-password"
            className="w-full rounded-lg border border-line bg-ink-2 px-4 py-3 text-sm text-cream placeholder:text-cream-muted focus:border-amber/60 focus:outline-none"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-amber py-3 text-sm font-medium text-ink transition-colors hover:bg-[#e0b47e] disabled:opacity-60"
          >
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </div>
  );
}
