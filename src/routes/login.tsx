import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — Lumen" },
      { name: "description", content: "Enter your private Lumen space." },
      { property: "og:title", content: "Sign In — Lumen" },
      { property: "og:description", content: "Enter your private Lumen space." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-5 text-center">
      <Link to="/" className="font-serif text-3xl text-cream">
        Lumen
      </Link>
      <p className="mt-2 text-sm uppercase tracking-[0.35em] text-cream-muted">
        Cine Vault Gallery
      </p>

      <div className="mt-12 max-w-sm rounded-2xl border border-line bg-panel/70 p-8 ring-1 ring-line">
        <h1 className="font-serif text-2xl text-cream">Enter your space</h1>
        <p className="mt-3 text-sm leading-relaxed text-cream-muted">
          Authentication is coming soon. For now, this is a placeholder for the future sign-in flow.
        </p>
      </div>

      <Link
        to="/"
        className="mt-8 text-sm text-cream-muted transition-colors hover:text-cream"
      >
        Back to home
      </Link>
    </div>
  );
}
