import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  FolderPlus,
  Images,
  Lock,
  LockOpen,
  MoreVertical,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/lumen/AppHeader";

type CollectionRow = {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  is_locked: boolean;
  is_hidden: boolean;
  created_at: string;
  media_items: { count: number }[];
};

export const Route = createFileRoute("/_authenticated/collections/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Collections — Lumen Cine Vault" },
      {
        name: "description",
        content: "Create, rename, lock and curate your private Lumen collections.",
      },
      { property: "og:title", content: "Collections — Lumen Cine Vault" },
      { property: "og:description", content: "Group your memories into cinematic collections." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CollectionsPage,
});

function CollectionsPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<CollectionRow | null>(null);
  const [covering, setCovering] = useState<CollectionRow | null>(null);
  const [deleting, setDeleting] = useState<CollectionRow | null>(null);
  const [showHidden, setShowHidden] = useState(false);

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

  const collections = useQuery({
    queryKey: ["collections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select(
          "id, name, description, cover_url, is_locked, is_hidden, created_at, media_items(count)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CollectionRow[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["collections"] });

  const createCollection = useMutation({
    mutationFn: async (input: { name: string; description: string; cover_url: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("You are signed out.");
      const { error } = await supabase.from("collections").insert({
        user_id: auth.user.id,
        name: input.name.trim(),
        description: input.description.trim() || null,
        cover_url: input.cover_url.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setCreating(false);
      invalidate();
    },
  });

  const updateCollection = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<CollectionRow, "name" | "description" | "cover_url" | "is_locked" | "is_hidden">>;
    }) => {
      const { error } = await supabase.from("collections").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setRenaming(null);
      setCovering(null);
      invalidate();
    },
  });

  const deleteCollection = useMutation({
    mutationFn: async (id: string) => {
      // Detach media first so items are never deleted with the collection.
      const { error: detachError } = await supabase
        .from("media_items")
        .update({ collection_id: null })
        .eq("collection_id", id);
      if (detachError) throw detachError;
      const { error } = await supabase.from("collections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setDeleting(null);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["media"] });
    },
  });

  const visible = useMemo(
    () => (collections.data ?? []).filter((c) => showHidden || !c.is_hidden),
    [collections.data, showHidden],
  );
  const hiddenCount = (collections.data ?? []).filter((c) => c.is_hidden).length;

  return (
    <div className="min-h-screen bg-ink">
      <AppHeader displayName={profile.data?.name ?? null} avatarUrl={profile.data?.avatar_url ?? null} />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-4xl text-cream sm:text-5xl">Collections</h1>
            <p className="mt-2 text-sm text-cream-muted">
              Curated sets of your memories — private to you.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowHidden((v) => !v)}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-ink-2 px-4 py-2.5 text-sm text-cream-muted transition-colors hover:text-cream"
              >
                {showHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                {showHidden ? "Hide hidden" : `Show hidden (${hiddenCount})`}
              </button>
            )}
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 rounded-full bg-amber px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-[#e0b47e]"
            >
              <FolderPlus className="size-4" />
              New Collection
            </button>
          </div>
        </section>

        {collections.isLoading ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl border border-line bg-panel" />
            ))}
          </div>
        ) : collections.isError ? (
          <p className="mt-10 text-sm text-red-400">
            We couldn't load your collections. Please try again.
          </p>
        ) : visible.length === 0 ? (
          <div className="mt-16 rounded-2xl border border-line bg-panel/70 p-10 text-center sm:p-16">
            <Images className="mx-auto size-8 text-amber" />
            <p className="mt-5 font-serif text-3xl text-cream">No collections yet.</p>
            <p className="mx-auto mt-3 max-w-sm text-sm text-cream-muted">
              Group your photos and videos into cinematic sets you can revisit any time.
            </p>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-8 inline-flex rounded-full bg-amber px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-[#e0b47e]"
            >
              Create your first collection
            </button>
          </div>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((c) => (
              <CollectionCard
                key={c.id}
                collection={c}
                onRename={() => setRenaming(c)}
                onChangeCover={() => setCovering(c)}
                onDelete={() => setDeleting(c)}
                onToggleLock={() =>
                  updateCollection.mutate({ id: c.id, patch: { is_locked: !c.is_locked } })
                }
                onToggleHidden={() =>
                  updateCollection.mutate({ id: c.id, patch: { is_hidden: !c.is_hidden } })
                }
              />
            ))}
          </div>
        )}
      </main>

      {creating && (
        <CollectionForm
          title="New collection"
          submitLabel="Create"
          pending={createCollection.isPending}
          error={createCollection.error ? "Could not create the collection." : null}
          onClose={() => setCreating(false)}
          onSubmit={(v) => createCollection.mutate(v)}
        />
      )}

      {renaming && (
        <CollectionForm
          title="Rename collection"
          submitLabel="Save"
          initial={{
            name: renaming.name,
            description: renaming.description ?? "",
            cover_url: renaming.cover_url ?? "",
          }}
          hideCover
          pending={updateCollection.isPending}
          error={updateCollection.error ? "Could not save changes." : null}
          onClose={() => setRenaming(null)}
          onSubmit={(v) =>
            updateCollection.mutate({
              id: renaming.id,
              patch: { name: v.name.trim(), description: v.description.trim() || null },
            })
          }
        />
      )}

      {covering && (
        <CollectionForm
          title="Change cover"
          submitLabel="Save cover"
          initial={{
            name: covering.name,
            description: covering.description ?? "",
            cover_url: covering.cover_url ?? "",
          }}
          coverOnly
          pending={updateCollection.isPending}
          error={updateCollection.error ? "Could not save the cover." : null}
          onClose={() => setCovering(null)}
          onSubmit={(v) =>
            updateCollection.mutate({
              id: covering.id,
              patch: { cover_url: v.cover_url.trim() || null },
            })
          }
        />
      )}

      {deleting && (
        <Modal title="Delete this collection?" onClose={() => setDeleting(null)}>
          <p className="text-sm text-cream-muted">
            “{deleting.name}” will be removed. Media inside it stays in your gallery and becomes
            unsorted.
          </p>
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setDeleting(null)}
              className="rounded-full border border-line px-5 py-2.5 text-sm text-cream transition-colors hover:bg-ink-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => deleteCollection.mutate(deleting.id)}
              disabled={deleteCollection.isPending}
              className="rounded-full bg-red-500/90 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-60"
            >
              {deleteCollection.isPending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CollectionCard({
  collection,
  onRename,
  onChangeCover,
  onDelete,
  onToggleLock,
  onToggleHidden,
}: {
  collection: CollectionRow;
  onRename: () => void;
  onChangeCover: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
  onToggleHidden: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();
  const count = collection.media_items?.[0]?.count ?? 0;

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="relative aspect-[4/3] overflow-hidden bg-ink-2">
        {collection.is_locked ? (
          <div className="flex size-full flex-col items-center justify-center gap-2">
            <Lock className="size-6 text-amber" />
            <span className="text-[0.65rem] uppercase tracking-[0.3em] text-cream-muted">
              Locked
            </span>
          </div>
        ) : collection.cover_url ? (
          <img
            src={collection.cover_url}
            alt={collection.name}
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Images className="size-7 text-cream-muted" />
          </div>
        )}

        <div className="absolute left-3 top-3 flex gap-2">
          {collection.is_hidden && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink/80 px-2.5 py-1 text-[0.65rem] uppercase tracking-widest text-cream-muted backdrop-blur">
              <EyeOff className="size-3" /> Hidden
            </span>
          )}
          {collection.is_locked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink/80 px-2.5 py-1 text-[0.65rem] uppercase tracking-widest text-amber backdrop-blur">
              <Lock className="size-3" /> Locked
            </span>
          )}
        </div>

        <div className="absolute right-3 top-3">
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            aria-label={`Actions for ${collection.name}`}
            aria-haspopup="menu"
            aria-expanded={menu}
            className="rounded-full bg-ink/75 p-2 text-cream backdrop-blur transition-colors hover:bg-ink"
          >
            <MoreVertical className="size-4" />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} aria-hidden="true" />
              <div
                role="menu"
                className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
              >
                <MenuButton
                  icon={<Images className="size-4" />}
                  label="Open"
                  onClick={() => {
                    setMenu(false);
                    navigate({ to: "/collections/$id", params: { id: collection.id } });
                  }}
                />
                <MenuButton
                  icon={<Pencil className="size-4" />}
                  label="Rename"
                  onClick={() => {
                    setMenu(false);
                    onRename();
                  }}
                />
                <MenuButton
                  icon={<Images className="size-4" />}
                  label="Change cover"
                  onClick={() => {
                    setMenu(false);
                    onChangeCover();
                  }}
                />
                <MenuButton
                  icon={collection.is_locked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
                  label={collection.is_locked ? "Unlock" : "Lock"}
                  onClick={() => {
                    setMenu(false);
                    onToggleLock();
                  }}
                />
                <MenuButton
                  icon={collection.is_hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  label={collection.is_hidden ? "Unhide" : "Hide"}
                  onClick={() => {
                    setMenu(false);
                    onToggleHidden();
                  }}
                />
                <MenuButton
                  icon={<Trash2 className="size-4" />}
                  label="Delete"
                  destructive
                  onClick={() => {
                    setMenu(false);
                    onDelete();
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="p-5">
        <h2 className="truncate font-serif text-xl text-cream">{collection.name}</h2>
        {collection.description && (
          <p className="mt-1 line-clamp-2 text-sm text-cream-muted">{collection.description}</p>
        )}
        <p className="mt-3 text-xs text-cream-muted">
          {count} {count === 1 ? "item" : "items"} ·{" "}
          {new Date(collection.created_at).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
        <div className="mt-5 flex gap-2">
          <Link
            to="/collections/$id"
            params={{ id: collection.id }}
            className="rounded-full border border-line px-4 py-2 text-sm text-cream transition-colors hover:border-amber/60"
          >
            Open
          </Link>
          <Link
            to="/collections/$id"
            params={{ id: collection.id }}
            search={{ add: true }}
            className="rounded-full border border-line px-4 py-2 text-sm text-cream-muted transition-colors hover:text-cream"
          >
            Add media
          </Link>
        </div>
      </div>
    </article>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-ink-2 ${
        destructive ? "border-t border-line text-red-400" : "text-cream"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function CollectionForm({
  title,
  submitLabel,
  initial,
  hideCover,
  coverOnly,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  initial?: { name: string; description: string; cover_url: string };
  hideCover?: boolean;
  coverOnly?: boolean;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (v: { name: string; description: string; cover_url: string }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [coverUrl, setCoverUrl] = useState(initial?.cover_url ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!coverOnly && name.trim().length < 2) {
      setLocalError("Please enter a collection name of at least 2 characters.");
      return;
    }
    setLocalError(null);
    onSubmit({ name, description, cover_url: coverUrl });
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        {!coverOnly && (
          <div>
            <label htmlFor="c-name" className="block text-xs uppercase tracking-widest text-cream-muted">
              Collection name
            </label>
            <input
              id="c-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Summer in Kerala"
              className="mt-2 w-full rounded-xl border border-line bg-ink-2 px-4 py-3 text-sm text-cream placeholder:text-cream-muted focus:border-amber/60 focus:outline-none"
            />
          </div>
        )}

        {!coverOnly && (
          <div>
            <label
              htmlFor="c-desc"
              className="block text-xs uppercase tracking-widest text-cream-muted"
            >
              Description
            </label>
            <textarea
              id="c-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional — what ties these frames together?"
              className="mt-2 w-full resize-none rounded-xl border border-line bg-ink-2 px-4 py-3 text-sm text-cream placeholder:text-cream-muted focus:border-amber/60 focus:outline-none"
            />
          </div>
        )}

        {!hideCover && (
          <div>
            <label
              htmlFor="c-cover"
              className="block text-xs uppercase tracking-widest text-cream-muted"
            >
              Cover image URL
            </label>
            <input
              id="c-cover"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://…"
              className="mt-2 w-full rounded-xl border border-line bg-ink-2 px-4 py-3 text-sm text-cream placeholder:text-cream-muted focus:border-amber/60 focus:outline-none"
            />
            {coverUrl.trim() && (
              <img
                src={coverUrl}
                alt=""
                className="mt-3 h-32 w-full rounded-xl border border-line object-cover"
              />
            )}
          </div>
        )}

        {(localError || error) && <p className="text-sm text-red-400">{localError || error}</p>}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-5 py-2.5 text-sm text-cream transition-colors hover:bg-ink-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-amber px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-[#e0b47e] disabled:opacity-60"
          >
            {pending ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 p-4 backdrop-blur-sm sm:items-center">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-line bg-panel p-6 shadow-2xl sm:p-8"
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="font-serif text-2xl text-cream">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full border border-line p-2 text-cream-muted transition-colors hover:text-cream"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
