import { supabase } from "@/integrations/supabase/client";
import { MEDIA_BUCKET } from "./storage";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/ogg"];
export const ACCEPT = [...IMAGE_TYPES, ...VIDEO_TYPES].join(",");

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB

const THUMB_MAX_EDGE = 900;

export type MediaKind = "photo" | "video";

export type Probe = {
  kind: MediaKind;
  width: number | null;
  height: number | null;
  duration: number | null;
  thumbnail: Blob;
};

export function kindOf(file: File): MediaKind | null {
  if (IMAGE_TYPES.includes(file.type)) return "photo";
  if (VIDEO_TYPES.includes(file.type)) return "video";
  return null;
}

export function validate(file: File): { kind: MediaKind } | { error: string } {
  const kind = kindOf(file);
  if (!kind) return { error: "Unsupported file type." };
  if (file.size === 0) return { error: "File is empty or corrupted." };
  const limit = kind === "photo" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > limit) {
    return { error: `Too large — max ${Math.round(limit / (1024 * 1024))} MB for ${kind}s.` };
  }
  return { kind };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function scaled(w: number, h: number) {
  const ratio = Math.min(1, THUMB_MAX_EDGE / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * ratio)), h: Math.max(1, Math.round(h * ratio)) };
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82),
  );
  if (!blob) throw new Error("Could not create a thumbnail.");
  return blob;
}

async function probeImage(file: File): Promise<Probe> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This image is corrupted or unreadable.");
  }
  const { w, h } = scaled(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create a thumbnail.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const thumbnail = await canvasToBlob(canvas);
  const result: Probe = {
    kind: "photo",
    width: bitmap.width,
    height: bitmap.height,
    duration: null,
    thumbnail,
  };
  bitmap.close();
  return result;
}

async function probeVideo(file: File): Promise<Probe> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      const fail = () => reject(new Error("This video is corrupted or unsupported."));
      video.onerror = fail;
      video.onloadedmetadata = () => resolve();
      setTimeout(fail, 20_000);
    });

    const duration = Number.isFinite(video.duration) ? video.duration : null;
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("Could not read this video."));
      video.currentTime = Math.min(duration ? duration / 2 : 0.1, 1);
    });

    const { w, h } = scaled(video.videoWidth || 1280, video.videoHeight || 720);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create a poster image.");
    ctx.drawImage(video, 0, 0, w, h);

    return {
      kind: "video",
      width: video.videoWidth || null,
      height: video.videoHeight || null,
      duration: duration ? Math.round(duration) : null,
      thumbnail: await canvasToBlob(canvas),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Decodes the file to prove it is readable and builds a small poster/thumbnail. */
export function probe(file: File, kind: MediaKind): Promise<Probe> {
  return kind === "photo" ? probeImage(file) : probeVideo(file);
}

export function extensionOf(file: File) {
  const fromName = file.name.includes(".") ? file.name.split(".").pop()! : "";
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return file.type.split("/")[1] ?? "bin";
}

/**
 * Uploads directly to private storage with real progress and cancellation.
 * Storage RLS only accepts objects inside the signed-in user's own folder.
 */
export async function uploadWithProgress(options: {
  path: string;
  body: Blob;
  contentType: string;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session expired. Please sign in again.");

  const base = import.meta.env['VITE_SUPABASE_URL'];
  const apikey = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'];

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base}/storage/v1/object/${MEDIA_BUCKET}/${options.path}`);
    xhr.setRequestHeader("apikey", apikey);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.setRequestHeader("cache-control", "3600");
    xhr.setRequestHeader("content-type", options.contentType);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));

    options.signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(options.body);
  });
}

export async function removeObjects(paths: string[]) {
  if (paths.length === 0) return;
  await supabase.storage.from(MEDIA_BUCKET).remove(paths);
}
