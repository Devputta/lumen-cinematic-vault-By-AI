import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import heroBg from "../assets/hero-bg.jpg";
import privacyCurtain from "../assets/privacy-curtain.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lumen — Cine Vault Gallery" },
      {
        name: "description",
        content:
          "Your memories, staged like cinema. A premium private space for photos and videos. Beautiful collections, locked moments, and a vault only you can see.",
      },
      { property: "og:title", content: "Lumen — Cine Vault Gallery" },
      {
        property: "og:description",
        content:
          "Your memories, staged like cinema. A premium private space for photos and videos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-ink font-sans text-cream antialiased">
      <Header
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />
      <main>
        <HeroSection />
        <FeaturesSection />
        <PrivacySection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}

function Header({
  mobileMenuOpen,
  setMobileMenuOpen,
}: {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line/60 bg-ink/60 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4 sm:px-8">
        <Link to="/" className="font-serif text-2xl leading-none tracking-tight text-cream">
          Lumen
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-cream-muted md:flex">
          <Link to="/" className="transition-colors hover:text-cream">
            Home
          </Link>
          <a href="#features" className="transition-colors hover:text-cream">
            Features
          </a>
          <a href="#privacy" className="transition-colors hover:text-cream">
            Privacy
          </a>
          <Link to="/login" className="transition-colors hover:text-cream">
            Sign In
          </Link>
        </nav>

        <div className="flex items-center gap-5">
          <Link
            to="/login"
            className="hidden text-sm text-cream-muted transition-colors hover:text-cream md:block"
          >
            Sign In
          </Link>
          <Link
            to="/login"
            className="rounded-full bg-amber px-5 py-2 text-sm font-medium text-ink transition-colors hover:bg-[#e0b47e]"
          >
            Enter your space
          </Link>
          <button
            type="button"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex size-10 flex-col items-center justify-center gap-1.5 rounded-md text-cream md:hidden"
          >
            <span
              className={`block h-0.5 w-5 bg-current transition-transform ${
                mobileMenuOpen ? "translate-y-2 rotate-45" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 bg-current transition-opacity ${
                mobileMenuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 bg-current transition-transform ${
                mobileMenuOpen ? "-translate-y-2 -rotate-45" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-b border-line/60 bg-ink px-5 py-5 md:hidden">
          <nav className="flex flex-col gap-4 text-sm text-cream-muted">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="transition-colors hover:text-cream"
            >
              Home
            </Link>
            <Link
              hash="features"
              onClick={() => setMobileMenuOpen(false)}
              className="transition-colors hover:text-cream"
            >
              Features
            </Link>
            <Link
              hash="privacy"
              onClick={() => setMobileMenuOpen(false)}
              className="transition-colors hover:text-cream"
            >
              Privacy
            </Link>
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="transition-colors hover:text-cream"
            >
              Sign In
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden bg-ink pt-20">
      <div className="absolute inset-0">
        <img
          src={heroBg}
          alt=""
          width={1920}
          height={1080}
          className="h-full w-full object-cover object-center opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink/40" />
      </div>

      <div className="relative mx-auto w-full max-w-[1200px] px-5 py-28 sm:px-8">
        <div className="max-w-[40ch]">
          <p className="animate-fade-up animate-fade-up-1 mb-6 text-xs font-medium uppercase tracking-[0.35em] text-amber">
            Cine Vault Gallery
          </p>
          <h1 className="animate-fade-up animate-fade-up-2 font-serif text-5xl leading-[1.05] text-cream sm:text-6xl">
            Your memories, staged like cinema.
          </h1>
          <p className="animate-fade-up animate-fade-up-2 mt-6 max-w-[48ch] text-base leading-relaxed text-cream-muted">
            A premium private space for photos and videos. Beautiful collections,
            locked moments, and a vault only you can see.
          </p>
          <div className="animate-fade-up animate-fade-up-3 mt-9 flex flex-wrap items-center gap-4">
            <Link
              to="/login"
              className="rounded-full bg-amber px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-[#e0b47e]"
            >
              Enter your space
            </Link>
            <Link
              hash="features"
              className="rounded-full px-6 py-3 text-sm font-medium text-cream ring-1 ring-line transition-colors hover:ring-cream/40"
            >
              Explore features
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      title: "Cinematic Gallery",
      description:
        "View your photos and videos in an immersive fullscreen experience.",
      icon: GalleryIcon,
    },
    {
      title: "Locked Collections",
      description:
        "Protect private memories with PIN-protected collections and blurred previews.",
      icon: LockIcon,
    },
    {
      title: "Secret Spaces",
      description:
        "Keep special memories hidden inside private secret spaces.",
      icon: ShieldIcon,
    },
  ];

  return (
    <section id="features" className="bg-ink py-24 sm:py-32">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="max-w-[48ch]">
          <p className="text-xs font-medium uppercase tracking-[0.35em] text-amber">
            The experience
          </p>
          <h2 className="mt-4 font-serif text-4xl leading-[1.1] text-cream">
            A room built for looking back.
          </h2>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-[14px] bg-panel/70 p-7 ring-1 ring-line transition-transform duration-300 hover:-translate-y-1"
            >
              <div className="mb-6 flex size-11 items-center justify-center rounded-full bg-amber/10 text-amber">
                <feature.icon className="size-5" />
              </div>
              <h3 className="font-serif text-2xl text-cream">{feature.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-cream-muted">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PrivacySection() {
  return (
    <section id="privacy" className="relative overflow-hidden bg-ink-2 py-24 sm:py-32">
      <div className="absolute -right-40 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-amber/10 blur-3xl" />
      <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-5 sm:px-8 lg:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.35em] text-amber">
            Privacy
          </p>
          <h2 className="mt-4 font-serif text-4xl leading-[1.1] text-cream sm:text-5xl">
            Private by design.
          </h2>
          <p className="mt-6 max-w-[44ch] text-base leading-relaxed text-cream-muted">
            Every photo and video belongs to you — the authenticated owner of your
            vault. Lumen is built so your memories stay yours, encrypted and
            accessible only to you. Nothing is shared, indexed, or surfaced to
            anyone else.
          </p>
          <ul className="mt-8 space-y-4 text-sm text-cream">
            <li className="flex items-center gap-3">
              <span className="size-1.5 shrink-0 rounded-full bg-amber" />
              Your files, your vault — always
            </li>
            <li className="flex items-center gap-3">
              <span className="size-1.5 shrink-0 rounded-full bg-amber" />
              Blurred previews on locked moments
            </li>
            <li className="flex items-center gap-3">
              <span className="size-1.5 shrink-0 rounded-full bg-amber" />
              Access gated by your sign in
            </li>
          </ul>
        </div>
        <div className="overflow-hidden rounded-[14px] bg-panel ring-1 ring-line">
          <img
            src={privacyCurtain}
            alt="A dark velvet curtain half drawn with warm spotlight pooling on the floor"
            width={1024}
            height={1280}
            loading="lazy"
            className="aspect-[4/5] w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="bg-ink py-24 sm:py-32">
      <div className="mx-auto max-w-[1200px] px-5 text-center sm:px-8">
        <h2 className="mx-auto max-w-[30ch] font-serif text-4xl leading-[1.05] text-cream sm:text-5xl">
          Your private cinema awaits.
        </h2>
        <p className="mx-auto mt-5 max-w-[44ch] text-base leading-relaxed text-cream-muted">
          Step behind the curtain and take your seat.
        </p>
        <Link
          to="/login"
          className="mt-9 inline-block rounded-full bg-amber px-7 py-3 text-sm font-medium text-ink transition-colors hover:bg-[#e0b47e]"
        >
          Enter your space
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-ink">
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link to="/" className="font-serif text-2xl text-cream">
              Lumen
            </Link>
            <p className="mt-2 text-sm text-cream-muted">Cine Vault Gallery</p>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-cream-muted">
            <Link hash="privacy" className="transition-colors hover:text-cream">
              Privacy
            </Link>
            <Link to="/login" className="transition-colors hover:text-cream">
              Terms
            </Link>
            <Link to="/login" className="transition-colors hover:text-cream">
              Sign In
            </Link>
          </nav>
        </div>
        <p className="mt-10 text-xs text-cream-muted/70">
          Your memories, staged like cinema.
        </p>
      </div>
    </footer>
  );
}

function GalleryIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9h18M7 5v14" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3 4 6v6c0 4.5 3.2 7.7 8 9 4.8-1.3 8-4.5 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
