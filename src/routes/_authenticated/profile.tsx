import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/lumen/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Profile — Lumen Cine Vault" },
      { name: "description", content: "Your Lumen profile details." },
      { property: "og:title", content: "Profile — Lumen Cine Vault" },
      { property: "og:description", content: "Your Lumen profile details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Profile"
      blurb="Name, username and avatar editing arrives in a later chapter."
    />
  ),
});
