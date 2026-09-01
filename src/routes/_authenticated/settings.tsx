import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/lumen/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Settings — Lumen Cine Vault" },
      { name: "description", content: "Preferences for your private Lumen gallery." },
      { property: "og:title", content: "Settings — Lumen Cine Vault" },
      { property: "og:description", content: "Preferences for your private Lumen gallery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Settings"
      blurb="Gallery preferences and privacy controls arrive in a later chapter."
    />
  ),
});
