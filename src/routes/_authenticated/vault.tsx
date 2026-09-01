import { createFileRoute, Link } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/lumen/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/vault")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Vault — Lumen Cine Vault" },
      { name: "description", content: "Your locked, private memories behind the curtain." },
      { property: "og:title", content: "Vault — Lumen Cine Vault" },
      { property: "og:description", content: "Your locked, private memories behind the curtain." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Vault"
      blurb="Locked memories stay behind the curtain. Passcode protection arrives in a later chapter."
    >
      <Link
        to="/gallery"
        search={{ filter: "locked" as const, q: "" }}
        className="mt-6 inline-flex rounded-full bg-amber px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-[#e0b47e]"
      >
        Open locked filter
      </Link>
    </PlaceholderPage>
  ),
});
