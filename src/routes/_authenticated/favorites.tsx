import { createFileRoute, Link } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/lumen/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/favorites")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Favorites — Lumen Cine Vault" },
      { name: "description", content: "The memories you keep coming back to." },
      { property: "og:title", content: "Favorites — Lumen Cine Vault" },
      { property: "og:description", content: "The memories you keep coming back to." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Favorites"
      blurb="Everything you have starred lives here. For now, use the Favorites filter in your gallery."
    >
      <Link
        to="/gallery"
        search={{ filter: "favorites", q: "" }}
        className="mt-6 inline-flex rounded-full bg-amber px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-[#e0b47e]"
      >
        Open favorites filter
      </Link>
    </PlaceholderPage>
  ),
});
