import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  Heart,
  Lock,
  Play,
  UploadCloud,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/lumen/AppHeader";
import {
  ACCEPT,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  extensionOf,
  formatBytes,
  probe,
  removeObjects,
  uploadWithProgress,
  validate,
  type MediaKind,
} from "@/lib/upload";

type Stage = "checking" | "queued" | "uploading" | "uploaded" | "error" | "cancelled";

type QueueItem = {
  id: string;
  file: File;
  kind: MediaKind;
  previewUrl: string | null;
  thumbnail: Blob | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  progress: number;
  stage: Stage;
  message?: string;
  mediaPath?: string;
  thumbPath?: string;
  title: string;
  collectionId: string;
  tags: string;
  favorite: boolean;
  locked: boolean;
};

export const Route = createFileRoute("/_authenticated/upload")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Upload Media — Lumen Cine Vault" },
      {
        name: "description",
        content:
          "Add photos and videos to your private Lumen vault with secure, owner-only storage.",
      },
      { property: "og:title", content: "Upload Media — Lumen Cine Vault" },
      { property: "og:description", content: "Stage new memories in your private cinema." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UploadPage,
});

function UploadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const controllers = useRef(new Map<string, AbortController>());

  const [items, setItems] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
        userId: auth.user.id,
        name: data?.display_name || data?.username || auth.user.email || null,
        avatar_url: data?.avatar_url ?? null,
      };
    },
  });

  const collections = useQuery({
    queryKey: ["collections", "for-upload"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("id, name, is_locked")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(
    () => () => {
      controllers.current.forEach((c) => c.abort());
      setItems((prev) => {
        prev.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
        return prev;
      });
    },
    [],
  );

  const patch = useCallback((id: string, next: Partial<QueueItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...next } : i)));
  }, []);

  const startUpload = useCallback(
    async (item: QueueItem, userId: string) => {
      const controller = new AbortController();
      controllers.current.set(item.id, controller);
      patch(item.id, { stage: "uploading", progress: 0, message: undefined });

      const folder = `${userId}/${item.id}`;
      const mediaPath = `${folder}/original.${extensionOf(item.file)}`;
      const thumbPath = `${folder}/thumb.jpg`;

      try {
        if (item.thumbnail) {
          await uploadWithProgress({
            path: thumbPath,
            body: item.thumbnail,
            contentType: "image/jpeg",
            signal: controller.signal,
          });
        }
        await uploadWithProgress({
          path: mediaPath,
          body: item.file,
          contentType: item.file.type,
          onProgress: (percent) => patch(item.id, { progress: percent }),
          signal: controller.signal,
        });
        patch(item.id, { stage: "uploaded", progress: 100, mediaPath, thumbPath });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          await removeObjects([mediaPath, thumbPath]);
          patch(item.id, { stage: "cancelled", progress: 0, message: "Cancelled." });
        } else {
          patch(item.id, {
            stage: "error",
            message: error instanceof Error ? error.message : "Upload failed.",
          });
        }
      } finally {
        controllers.current.delete(item.id);
      }
    },
    [patch],
  );

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const userId = profile.data?.userId;
      for (const file of Array.from(files)) {
        const id = crypto.randomUUID();
        const check = validate(file);

        if ("error" in check) {
          setItems((prev) => [
            ...prev,
            {
              ...blank(id, file, "photo"),
              stage: "error",
              message: check.error,
            },
          ]);
          continue;
        }

        setItems((prev) => [...prev, blank(id, file, check.kind)]);

        try {
          const result = await probe(file, check.kind);
          const previewUrl = URL.createObjectURL(result.thumbnail);
          const ready: Partial<QueueItem> = {
            stage: "queued",
            thumbnail: result.thumbnail,
            previewUrl,
            width: result.width,
            height: result.height,
            duration: result.duration,
          };
          patch(id, ready);
          if (userId) {
            const current = { ...blank(id, file, check.kind), ...ready } as QueueItem;
            void startUpload(current, userId);
          }
        } catch (error) {
          patch(id, {
            stage: "error",
            message: error instanceof Error ? error.message : "This file could not be read.",
          });
        }
      }
    },
    [patch, profile.data?.userId, startUpload],
  );

  function cancel(item: QueueItem) {
    const controller = controllers.current.get(item.id);
    if (controller) controller.abort();
    else void discard(item);
  }

  async function discard(item: QueueItem) {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    if (item.mediaPath || item.thumbPath) {
      await removeObjects([item.mediaPath, item.thumbPath].filter(Boolean) as string[]);
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  const uploaded = useMemo(() => items.filter((i) => i.stage === "uploaded"), [items]);
  const busy = items.some((i) => i.stage === "uploading" || i.stage === "checking");

  async function saveToGallery() {
    const userId = profile.data?.userId;
    if (!userId || uploaded.length === 0) return;
    setSaving(true);
    setSaveError(null);

    const rows = uploaded.map((item) => {
      const collection = collections.data?.find((c) => c.id === item.collectionId);
      return {
        user_id: userId,
        collection_id: item.collectionId || null,
        title: item.title.trim() || item.file.name,
        filename: item.file.name,
        media_type: item.kind,
        thumbnail_url: item.thumbPath!,
        media_url: item.mediaPath!,
        duration_seconds: item.duration,
        width: item.width,
        height: item.height,
        tags: item.tags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
        is_favorite: item.favorite,
        is_locked: item.locked || Boolean(collection?.is_locked),
      };
    });

    const { error } = await supabase.from("media_items").insert(rows);
    setSaving(false);
    if (error) {
      setSaveError("We couldn't save these to your gallery. Please try again.");
      return;
    }

    uploaded.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
    setItems((prev) => prev.filter((i) => i.stage !== "uploaded"));
    await queryClient.invalidateQueries({ queryKey: ["media"] });
    await queryClient.invalidateQueries({ queryKey: ["collections"] });
    navigate({ to: "/gallery", search: { filter: "all", q: "" } });
  }

  return (
    <div className="min-h-screen bg-ink">
      <AppHeader
        displayName={profile.data?.name ?? null}
        avatarUrl={profile.data?.avatar_url ?? null}
      />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="font-serif text-4xl text-cream sm:text-5xl">Add to your vault</h1>
        <p className="mt-2 text-sm text-cream-muted">
          Photos and videos are stored privately. Only you can ever open them.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void addFiles(e.dataTransfer.files);
          }}
          className={`mt-8 rounded-2xl border-2 border-dashed p-10 text-center transition-colors sm:p-16 ${
            dragging ? "border-amber bg-amber/5" : "border-line bg-panel/60"
          }`}
        >
          <UploadCloud className="mx-auto size-8 text-amber" />
          <p className="mt-5 font-serif text-2xl text-cream">Drag & drop your media here</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-cream-muted">
            JPEG, PNG, WebP, AVIF, GIF up to {Math.round(MAX_IMAGE_BYTES / 1048576)} MB · MP4, WebM,
            MOV up to {Math.round(MAX_VIDEO_BYTES / 1048576)} MB
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-7 inline-flex rounded-full bg-amber px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-[#e0b47e]"
          >
            Choose files
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {items.length > 0 && (
          <section className="mt-10 space-y-4">
            <h2 className="text-xs uppercase tracking-[0.3em] text-cream-muted">
              {items.length} file{items.length === 1 ? "" : "s"}
            </h2>

            {items.map((item) => (
              <article
                key={item.id}
                className="flex flex-col gap-4 rounded-xl border border-line bg-panel p-4 sm:flex-row"
              >
                <div className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-ink-2">
                  {item.previewUrl ? (
                    <img
                      src={item.previewUrl}
                      alt=""
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      {item.stage === "error" ? (
                        <AlertTriangle className="size-5 text-red-400" />
                      ) : (
                        <span className="size-5 animate-pulse rounded-full bg-line" />
                      )}
                    </div>
                  )}
                  {item.kind === "video" && item.previewUrl && (
                    <span className="absolute bottom-1.5 left-1.5 rounded-full bg-ink/80 p-1">
                      <Play className="size-3 fill-current text-cream" />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-cream">{item.file.name}</p>
                      <p className="text-xs text-cream-muted">
                        {formatBytes(item.file.size)} · {item.kind}
                        {item.duration ? ` · ${item.duration}s` : ""}
                      </p>
                    </div>

                    {item.stage === "uploaded" ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <Check className="size-4" /> Uploaded
                      </span>
                    ) : item.stage === "error" || item.stage === "cancelled" ? (
                      <span className="text-xs text-red-400">{item.message}</span>
                    ) : item.stage === "uploading" ? (
                      <span className="text-xs text-amber">{item.progress}%</span>
                    ) : (
                      <span className="text-xs text-cream-muted">Checking…</span>
                    )}

                    <button
                      type="button"
                      onClick={() => (item.stage === "uploading" ? cancel(item) : void discard(item))}
                      aria-label={item.stage === "uploading" ? "Cancel upload" : "Remove file"}
                      className="rounded-full p-1 text-cream-muted transition-colors hover:text-cream"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  {(item.stage === "uploading" || item.stage === "uploaded") && (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-2">
                      <div
                        className="h-full rounded-full bg-amber transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}

                  {item.stage === "uploaded" && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs text-cream-muted">Title</span>
                        <input
                          value={item.title}
                          onChange={(e) => patch(item.id, { title: e.target.value })}
                          placeholder={item.file.name}
                          className="mt-1 w-full rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-cream placeholder:text-cream-muted focus:border-amber/60 focus:outline-none"
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs text-cream-muted">Collection</span>
                        <select
                          value={item.collectionId}
                          onChange={(e) => patch(item.id, { collectionId: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-cream focus:border-amber/60 focus:outline-none"
                        >
                          <option value="">Unsorted</option>
                          {(collections.data ?? []).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                              {c.is_locked ? " (locked)" : ""}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block sm:col-span-2">
                        <span className="text-xs text-cream-muted">Tags (comma separated)</span>
                        <input
                          value={item.tags}
                          onChange={(e) => patch(item.id, { tags: e.target.value })}
                          placeholder="summer, family, golden hour"
                          className="mt-1 w-full rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-cream placeholder:text-cream-muted focus:border-amber/60 focus:outline-none"
                        />
                      </label>

                      <div className="flex flex-wrap gap-2 sm:col-span-2">
                        <Toggle
                          active={item.favorite}
                          onClick={() => patch(item.id, { favorite: !item.favorite })}
                          icon={<Heart className={`size-4 ${item.favorite ? "fill-current" : ""}`} />}
                          label="Favorite"
                        />
                        <Toggle
                          active={item.locked}
                          onClick={() => patch(item.id, { locked: !item.locked })}
                          icon={<Lock className="size-4" />}
                          label="Locked"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}

            {saveError && <p className="text-sm text-red-400">{saveError}</p>}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                disabled={uploaded.length === 0 || saving || busy}
                onClick={() => void saveToGallery()}
                className="rounded-full bg-amber px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-[#e0b47e] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving…"
                  : `Save ${uploaded.length || ""} to gallery`.replace("  ", " ")}
              </button>
              <Link
                to="/gallery"
                search={{ filter: "all", q: "" }}
                className="text-sm text-cream-muted transition-colors hover:text-cream"
              >
                Back to gallery
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
        active
          ? "border-amber bg-amber/15 text-amber"
          : "border-line bg-ink-2 text-cream-muted hover:text-cream"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function blank(id: string, file: File, kind: MediaKind): QueueItem {
  return {
    id,
    file,
    kind,
    previewUrl: null,
    thumbnail: null,
    width: null,
    height: null,
    duration: null,
    progress: 0,
    stage: "checking",
    title: "",
    collectionId: "",
    tags: "",
    favorite: false,
    locked: false,
  };
}
