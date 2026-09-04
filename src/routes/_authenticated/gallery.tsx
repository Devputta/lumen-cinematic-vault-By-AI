import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, ImagePlus, Lock, Play, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/lumen/AppHeader";
import { MediaViewer, useViewer } from "@/components/lumen/MediaViewer";

const FILTERS = ["all", "photos", "videos", "favorites", "locked"] as const;
type Filter = (typeof FILTERS)[number];
const PAGE_SIZE = 24;

type MediaRow = {
  id: string;
  title: string;
  filename: string;
  media_type: "photo" | "video";
  thumbnail_url: string;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  media_url: string | null;
  tags: string[];
  is_favorite: boolean;
  is_locked: boolean;
  created_at: string;
  collections: { name: string } | null;
};

export const Route = createFileRoute("/_authenticated/gallery")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { filter?: Filter; q?: string } => ({
    filter: (FILTERS as readonly string[]).includes(String(search['filter']))
      ? (search['filter'] as Filter)
      : ("all" as Filter),
    q: typeof search['q'] === "string" ? (search['q'] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "Your Gallery — Lumen Cine Vault" },
      {
        name: "description",
        content: "Your private Lumen gallery — photos and videos, staged like cinema.",
      },
      { property: "og:title", content: "Your Gallery — Lumen Cine Vault" },
      { property: "og:description", content: "Your memories, staged like cinema." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  const search_ = Route.useSearch();
  const filter: Filter = search_.filter ?? "all";
  const q = search_.q ?? "";
  const navigate = useNavigate({ from: "/gallery" });
  const queryClient = useQueryClient();
  const [term, setTerm] = useState(q);

  useEffect(() => setTerm(q), [q]);

  // Debounce search into the URL
  useEffect(() => {
    if (term === q) return;
    const t = setTimeout(() => {
      navigate({ search: (prev) => ({ ...prev, q: term }), replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [term, q, navigate]);

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
        username: data?.username ?? null,
        avatar_url: data?.avatar_url ?? null,
      };
    },
  });

  const media = useInfiniteQuery({
    queryKey: ["media", filter, q],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from("media_items")
        .select(
          "id, title, filename, media_type, thumbnail_url, media_url, duration_seconds, width, height, tags, is_favorite, is_locked, created_at, collections(name)",
        )
        .order("created_at", { ascending: false })
        .range(pageParam * PAGE_SIZE, pageParam * PAGE_SIZE + PAGE_SIZE - 1);

      if (filter === "photos") query = query.eq("media_type", "photo");
      if (filter === "videos") query = query.eq("media_type", "video");
      if (filter === "favorites") query = query.eq("is_favorite", true);
      if (filter === "locked") query = query.eq("is_locked", true);

      const search = q.trim();
      if (search) {
        const like = `%${search}%`;
        query = query.or(
          `filename.ilike.${like},title.ilike.${like},tags.cs.{${search.toLowerCase()}}`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as MediaRow[];
    },
    getNextPageParam: (last, pages) => (last.length === PAGE_SIZE ? pages.length : undefined),
  });

  const items = useMemo(() => media.data?.pages.flat() ?? [], [media.data]);

  // Collection name search is applied client-side over loaded rows
  const visible = useMemo(() => {
    const search = q.trim().toLowerCase();
    if (!search) return items;
    return items.filter(
      (m) =>
        m.filename.toLowerCase().includes(search) ||
        m.title.toLowerCase().includes(search) ||
        (m.collections?.name ?? "").toLowerCase().includes(search) ||
        m.tags.some((t) => t.toLowerCase().includes(search)),
    );
  }, [items, q]);

  const viewer = useViewer(visible);

  const toggleFavorite = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      const { error } = await supabase.from("media_items").update({ is_favorite: next }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["media"] }),
  });

  const sentinel = useRef<HTMLDivElement | null>(null);
  const loadMore = useCallback(() => {
    if (media.hasNextPage && !media.isFetchingNextPage) media.fetchNextPage();
  }, [media]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && loadMore(),
      { rootMargin: "600px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  const isEmptyLibrary =
    !media.isLoading && items.length === 0 && filter === "all" && q.trim() === "";

  return (
    <div className="min-h-screen bg-ink">
      <AppHeader displayName={profile.data?.name ?? null} avatarUrl={profile.data?.avatar_url ?? null} />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <section>
          <h1 className="font-serif text-4xl text-cream sm:text-5xl">
            Welcome back{profile.data?.name ? `, ${profile.data.name}` : ""}.
          </h1>
          <p className="mt-2 text-sm text-cream-muted">Your memories, staged like cinema.</p>
        </section>

        {!isEmptyLibrary && (
          <section className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => navigate({ search: (prev) => ({ ...prev, filter: f }) })}
                  className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm capitalize transition-colors ${
                    filter === f
                      ? "border-amber bg-amber text-ink"
                      : "border-line bg-ink-2 text-cream-muted hover:border-amber/50 hover:text-cream"
                  }`}
                >
                  {f === "all" ? "All" : f}
                </button>
              ))}
            </div>

            <div className="relative lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cream-muted" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search filename, collection or tag"
                className="w-full rounded-full border border-line bg-ink-2 py-2.5 pl-10 pr-9 text-sm text-cream placeholder:text-cream-muted focus:border-amber/60 focus:outline-none"
              />
              {term && (
                <button
                  type="button"
                  onClick={() => setTerm("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-cream-muted hover:text-cream"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </section>
        )}

        {media.isLoading ? (
          <div className="mt-10 columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-line bg-panel"
                style={{ height: 140 + ((i * 47) % 130) }}
              />
            ))}
          </div>
        ) : media.isError ? (
          <p className="mt-10 text-sm text-red-400">
            We couldn't load your gallery. Please check your connection and try again.
          </p>
        ) : isEmptyLibrary ? (
          <EmptyLibrary />
        ) : visible.length === 0 ? (
          <div className="mt-16 rounded-2xl border border-line bg-panel/70 p-10 text-center">
            <p className="font-serif text-2xl text-cream">No results</p>
            <p className="mt-2 text-sm text-cream-muted">
              Nothing matches this filter or search. Try a different word.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-10 columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4">
              {visible.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  onOpen={() => viewer.open(item.id)}
                  onToggleFavorite={() =>
                    toggleFavorite.mutate({ id: item.id, next: !item.is_favorite })
                  }
                />
              ))}
            </div>
            <div ref={sentinel} className="h-10" />
            {media.isFetchingNextPage && (
              <p className="pb-6 text-center text-xs uppercase tracking-[0.3em] text-cream-muted">
                Loading more
              </p>
            )}
          </>
        )}
      </main>

      {viewer.isOpen && (
        <MediaViewer
          items={visible}
          index={viewer.index}
          onIndexChange={viewer.setIndex}
          onClose={viewer.close}
          onToggleFavorite={(m) =>
            toggleFavorite.mutate({ id: m.id, next: !m.is_favorite })
          }
        />
      )}
    </div>
  );
}

function MediaCard({
  item,
  onOpen,
  onToggleFavorite,
}: {
  item: MediaRow;
  onOpen: () => void;
  onToggleFavorite: () => void;
}) {
  const ratio =
    item.width && item.height ? `${item.width} / ${item.height}` : item.media_type === "video" ? "16 / 9" : "3 / 4";

  return (
    <figure className="group relative break-inside-avoid overflow-hidden rounded-xl border border-line bg-panel">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${item.title || item.filename}`}
        className="relative block w-full cursor-zoom-in text-left"
        style={{ aspectRatio: ratio }}
      >
        {item.is_locked ? (
          <div className="flex size-full flex-col items-center justify-center gap-2 bg-ink-2">
            <Lock className="size-6 text-amber" />
            <span className="text-[0.65rem] uppercase tracking-[0.3em] text-cream-muted">Locked</span>
          </div>
        ) : (
          <img
            src={item.thumbnail_url}
            alt={item.title || item.filename}
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        )}

        {item.media_type === "video" && !item.is_locked && (
          <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-ink/80 px-2.5 py-1 text-[0.7rem] text-cream backdrop-blur">
            <Play className="size-3 fill-current" />
            {formatDuration(item.duration_seconds)}
          </span>
        )}

        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={item.is_favorite ? "Remove from favorites" : "Add to favorites"}
          className="absolute right-3 top-3 rounded-full bg-ink/70 p-2 backdrop-blur transition-colors hover:bg-ink"
        >
          <Heart
            className={`size-4 ${item.is_favorite ? "fill-amber text-amber" : "text-cream"}`}
          />
        </button>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-ink via-ink/70 to-transparent p-3 pt-10 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
          <p className="truncate text-sm text-cream">{item.title || item.filename}</p>
          <p className="truncate text-xs text-cream-muted">
            {item.collections?.name ?? "Unsorted"}
          </p>
        </div>
      </button>
    </figure>
  );
}

function EmptyLibrary() {
  return (
    <div className="mt-16 rounded-2xl border border-line bg-panel/70 p-10 text-center backdrop-blur-sm sm:p-16">
      <ImagePlus className="mx-auto size-8 text-amber" />
      <p className="mt-5 font-serif text-3xl text-cream">Your gallery is empty.</p>
      <p className="mx-auto mt-3 max-w-sm text-sm text-cream-muted">
        Add your first photo or video and Lumen will stage it like cinema.
      </p>
      <Link
        to="/collections"
        className="mt-8 inline-flex rounded-full bg-amber px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-[#e0b47e]"
      >
        Upload your first memory
      </Link>
    </div>
  );
}

function formatDuration(seconds: number | null) {
  if (!seconds || seconds < 0) return "Video";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
