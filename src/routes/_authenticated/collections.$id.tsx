import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Images, Lock, LockOpen, Play, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/lumen/AppHeader";
import { StorageImage } from "@/components/lumen/StorageImage";

type MediaRow = {
  id: string;
  title: string;
  filename: string;
  media_type: "photo" | "video";
  thumbnail_url: string;
  duration_seconds: number | null;
  is_locked: boolean;
  collection_id: string | null;
};

export const Route = createFileRoute("/_authenticated/collections/$id")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { add?: boolean } => ({
    add: search['add'] === true || search['add'] === "true",
  }),
  head: () => ({
    meta: [
      { title: "Collection — Lumen Cine Vault" },
      { name: "description", content: "Open a private Lumen collection and curate its media." },
      { property: "og:title", content: "Collection — Lumen Cine Vault" },
      { property: "og:description", content: "Curate the media inside your collection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CollectionDetailPage,
});

function CollectionDetailPage() {
  const { id } = Route.useParams();
  const { add } = Route.useSearch();
  const navigate = useNavigate({ from: "/collections/$id" });
  const queryClient = useQueryClient();
  const [unlocked, setUnlocked] = useState(false);

  const profile = useQuery({
    queryKey: ["profile", "me"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", auth.user.id)
        .maybeSingle();
      return {
        name: data?.display_name || data?.username || auth.user.email || null,
        avatar_url: data?.avatar_url ?? null,
      };
    },
  });

  const collection = useQuery({
    queryKey: ["collection", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("id, name, description, cover_url, is_locked, is_hidden, created_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const items = useQuery({
    queryKey: ["collection-media", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_items")
        .select("id, title, filename, media_type, thumbnail_url, duration_seconds, is_locked, collection_id")
        .eq("collection_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MediaRow[];
    },
  });

  const unsorted = useQuery({
    queryKey: ["media-unsorted"],
    enabled: Boolean(add),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_items")
        .select("id, title, filename, media_type, thumbnail_url, duration_seconds, is_locked, collection_id")
        .is("collection_id", null)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as MediaRow[];
    },
  });

  const setMembership = useMutation({
    mutationFn: async ({ mediaId, collectionId }: { mediaId: string; collectionId: string | null }) => {
      const { error } = await supabase
        .from("media_items")
        .update({ collection_id: collectionId })
        .eq("id", mediaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collection-media", id] });
      queryClient.invalidateQueries({ queryKey: ["media-unsorted"] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["media"] });
    },
  });

  const toggleLock = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase.from("collections").update({ is_locked: next }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collection", id] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  const locked = Boolean(collection.data?.is_locked) && !unlocked;
  const created = useMemo(
    () =>
      collection.data
        ? new Date(collection.data.created_at).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "",
    [collection.data],
  );

  return (
    <div className="min-h-screen bg-ink">
      <AppHeader displayName={profile.data?.name ?? null} avatarUrl={profile.data?.avatar_url ?? null} />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <Link
          to="/collections"
          className="inline-flex items-center gap-2 text-sm text-cream-muted transition-colors hover:text-cream"
        >
          <ArrowLeft className="size-4" />
          All collections
        </Link>

        {collection.isLoading ? (
          <div className="mt-8 h-24 animate-pulse rounded-2xl border border-line bg-panel" />
        ) : !collection.data ? (
          <div className="mt-16 rounded-2xl border border-line bg-panel/70 p-10 text-center">
            <p className="font-serif text-2xl text-cream">Collection not found</p>
            <p className="mt-2 text-sm text-cream-muted">
              It may have been deleted, or it isn't yours.
            </p>
          </div>
        ) : (
          <>
            <section className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-serif text-4xl text-cream sm:text-5xl">{collection.data.name}</h1>
                {collection.data.description && (
                  <p className="mt-2 max-w-xl text-sm text-cream-muted">
                    {collection.data.description}
                  </p>
                )}
                <p className="mt-3 text-xs text-cream-muted">
                  {items.data?.length ?? 0} items · Created {created}
                  {collection.data.is_locked ? " · Locked" : ""}
                  {collection.data.is_hidden ? " · Hidden" : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => toggleLock.mutate(!collection.data?.is_locked)}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-ink-2 px-4 py-2.5 text-sm text-cream-muted transition-colors hover:text-cream"
                >
                  {collection.data.is_locked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
                  {collection.data.is_locked ? "Unlock" : "Lock"}
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ search: { add: true } })}
                  className="inline-flex items-center gap-2 rounded-full bg-amber px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-[#e0b47e]"
                >
                  <Plus className="size-4" />
                  Add media
                </button>
              </div>
            </section>

            {locked ? (
              <div className="mt-12 rounded-2xl border border-line bg-panel/70 p-10 text-center sm:p-16">
                <Lock className="mx-auto size-8 text-amber" />
                <p className="mt-5 font-serif text-3xl text-cream">This collection is locked.</p>
                <p className="mx-auto mt-3 max-w-sm text-sm text-cream-muted">
                  Reveal its contents for this session, or unlock it permanently.
                </p>
                <button
                  type="button"
                  onClick={() => setUnlocked(true)}
                  className="mt-8 inline-flex rounded-full border border-amber px-6 py-3 text-sm text-amber transition-colors hover:bg-amber hover:text-ink"
                >
                  Reveal contents
                </button>
              </div>
            ) : items.isLoading ? (
              <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-[3/4] animate-pulse rounded-xl border border-line bg-panel" />
                ))}
              </div>
            ) : (items.data?.length ?? 0) === 0 ? (
              <div className="mt-12 rounded-2xl border border-line bg-panel/70 p-10 text-center sm:p-16">
                <Images className="mx-auto size-8 text-amber" />
                <p className="mt-5 font-serif text-3xl text-cream">Nothing here yet.</p>
                <p className="mx-auto mt-3 max-w-sm text-sm text-cream-muted">
                  Add media from your gallery to start staging this collection.
                </p>
              </div>
            ) : (
              <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {items.data!.map((m) => (
                  <figure
                    key={m.id}
                    className="group relative overflow-hidden rounded-xl border border-line bg-panel"
                  >
                    <div className="relative aspect-[3/4]">
                      {m.is_locked ? (
                        <div className="flex size-full items-center justify-center bg-ink-2">
                          <Lock className="size-5 text-amber" />
                        </div>
                      ) : (
                        <StorageImage
                          path={m.thumbnail_url}
                          alt={m.title || m.filename}
                          className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                        />
                      )}
                      {m.media_type === "video" && (
                        <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-ink/80 px-2.5 py-1 text-[0.7rem] text-cream backdrop-blur">
                          <Play className="size-3 fill-current" />
                          {formatDuration(m.duration_seconds)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setMembership.mutate({ mediaId: m.id, collectionId: null })}
                        aria-label={`Remove ${m.title || m.filename} from collection`}
                        className="absolute right-3 top-3 rounded-full bg-ink/75 p-2 text-cream backdrop-blur transition-colors hover:bg-red-500"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <figcaption className="truncate p-3 text-xs text-cream-muted">
                      {m.title || m.filename}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {add && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 p-4 backdrop-blur-sm sm:items-center">
          <div
            className="absolute inset-0"
            onClick={() => navigate({ search: {} })}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add media to collection"
            className="relative z-10 max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-line bg-panel p-6 shadow-2xl sm:p-8"
          >
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="font-serif text-2xl text-cream">Add media</h2>
              <button
                type="button"
                onClick={() => navigate({ search: {} })}
                aria-label="Close"
                className="rounded-full border border-line p-2 text-cream-muted transition-colors hover:text-cream"
              >
                <X className="size-4" />
              </button>
            </div>

            {unsorted.isLoading ? (
              <p className="text-sm text-cream-muted">Loading your unsorted media…</p>
            ) : (unsorted.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-cream-muted">
                Every item already belongs to a collection. Remove one from its collection to move it
                here.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {unsorted.data!.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMembership.mutate({ mediaId: m.id, collectionId: id })}
                    className="group relative overflow-hidden rounded-xl border border-line bg-ink-2 text-left"
                  >
                    <div className="relative aspect-square">
                      {m.is_locked ? (
                        <div className="flex size-full items-center justify-center">
                          <Lock className="size-5 text-amber" />
                        </div>
                      ) : (
                        <StorageImage
                          path={m.thumbnail_url}
                          alt={m.title || m.filename}
                          className="size-full object-cover"
                        />
                      )}
                      <span className="absolute inset-0 flex items-center justify-center bg-ink/70 opacity-0 transition-opacity group-hover:opacity-100">
                        <Check className="size-6 text-amber" />
                      </span>
                    </div>
                    <span className="block truncate p-2 text-xs text-cream-muted">
                      {m.title || m.filename}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number | null) {
  if (!seconds || seconds < 0) return "Video";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
