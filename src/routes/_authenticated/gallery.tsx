import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/gallery")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your Gallery — Lumen Cine Vault" },
      {
        name: "description",
        content: "Your private Lumen gallery — a calm, cinematic space for your collections.",
      },
      { property: "og:title", content: "Your Gallery — Lumen Cine Vault" },
      { property: "og:description", content: "Your private cinematic gallery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active || !data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", data.user.id)
        .maybeSingle();
      if (active) setName(profile?.display_name || profile?.username || data.user.email || null);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <main className="min-h-screen bg-ink px-5 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <div>
            <p className="font-serif text-3xl text-cream">Lumen</p>
            <p className="mt-1 text-[0.65rem] uppercase tracking-[0.4em] text-cream-muted">
              Cine Vault Gallery
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-lg border border-line bg-ink-2 px-4 py-2 text-sm text-cream transition-colors hover:border-amber/60"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </header>

        <section className="mt-16 rounded-2xl border border-line bg-panel/70 p-8 backdrop-blur-sm">
          <h1 className="font-serif text-4xl text-cream">
            Welcome{name ? `, ${name}` : ""}.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-cream-muted">
            Your private gallery is ready. Collections, uploads, and secret spaces arrive next.
          </p>
        </section>
      </div>
    </main>
  );
}
