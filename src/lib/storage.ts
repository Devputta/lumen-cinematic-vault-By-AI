import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const MEDIA_BUCKET = "media";
const SIGN_TTL_SECONDS = 60 * 60;

type CacheEntry = { url: string; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string | null>>();

/** Absolute/blob/data URLs are used as-is; everything else is a private storage path. */
export function isStoragePath(value: string | null | undefined): value is string {
  return Boolean(value) && !/^(https?:|data:|blob:)/i.test(value as string);
}

export async function signedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (!isStoragePath(path)) return path;

  const hit = cache.get(path);
  if (hit && hit.expiresAt > Date.now() + 30_000) return hit.url;

  const pending = inflight.get(path);
  if (pending) return pending;

  const promise = (async () => {
    const { data, error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(path, SIGN_TTL_SECONDS);
    inflight.delete(path);
    if (error || !data?.signedUrl) return null;
    cache.set(path, { url: data.signedUrl, expiresAt: Date.now() + SIGN_TTL_SECONDS * 1000 });
    return data.signedUrl;
  })();

  inflight.set(path, promise);
  return promise;
}

/** Resolves a stored thumbnail/media reference into a temporary, owner-only URL. */
export function useSignedUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() =>
    path && !isStoragePath(path) ? path : (cache.get(path ?? "")?.url ?? null),
  );

  useEffect(() => {
    let active = true;
    if (!path) {
      setUrl(null);
      return;
    }
    if (!isStoragePath(path)) {
      setUrl(path);
      return;
    }
    signedUrl(path).then((resolved) => {
      if (active) setUrl(resolved);
    });
    return () => {
      active = false;
    };
  }, [path]);

  return url;
}
