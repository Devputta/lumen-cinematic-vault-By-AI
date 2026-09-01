import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/lumen/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/collections")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Collections — Lumen Cine Vault" },
      { name: "description", content: "Group your photos and videos into cinematic collections." },
      { property: "og:title", content: "Collections — Lumen Cine Vault" },
      { property: "og:description", content: "Group your memories into cinematic collections." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Collections"
      blurb="Curated sets of your memories. Collection editing arrives in a later chapter."
    />
  ),
});
