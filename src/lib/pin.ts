import { supabase } from "@/integrations/supabase/client";

/**
 * Collection PIN helpers.
 *
 * Every operation runs inside a Postgres SECURITY DEFINER function that:
 *  - verifies the caller owns the collection (auth.uid()),
 *  - stores the PIN only as a bcrypt hash in a table with no Data API policies,
 *  - rate limits wrong PINs (5 tries, then a 5 minute cool-down),
 *  - issues a short lived unlock grant row that the app checks server-side.
 * The browser never sees the hash and cannot bypass the check.
 */

export type LockStatus = {
  ok: boolean;
  has_pin: boolean;
  is_unlocked: boolean;
  locked_until: string | null;
  attempts_remaining: number;
  message?: string;
};

export type PinResult = {
  ok: boolean;
  message?: string;
  locked_until?: string | null;
  attempts_remaining?: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function fetchLockStatus(collectionId: string): Promise<LockStatus> {
  const { data, error } = await supabase.rpc("collection_lock_status", {
    _collection_id: collectionId,
  });
  if (error) throw error;
  const r = asRecord(data);
  return {
    ok: Boolean(r["ok"]),
    has_pin: Boolean(r["has_pin"]),
    is_unlocked: Boolean(r["is_unlocked"]),
    locked_until: (r["locked_until"] as string | null) ?? null,
    attempts_remaining: Number(r["attempts_remaining"] ?? 5),
    message: r["message"] as string | undefined,
  };
}

export async function fetchLockStatuses(
  collectionIds: string[],
): Promise<Record<string, LockStatus>> {
  const entries = await Promise.all(
    collectionIds.map(async (id) => [id, await fetchLockStatus(id)] as const),
  );
  return Object.fromEntries(entries);
}

async function callPin(
  fn: "verify_collection_pin" | "remove_collection_pin",
  collectionId: string,
  pin: string,
): Promise<PinResult> {
  const { data, error } = await supabase.rpc(fn, { _collection_id: collectionId, _pin: pin });
  if (error) return { ok: false, message: "Something went wrong. Please try again." };
  const r = asRecord(data);
  return {
    ok: Boolean(r["ok"]),
    message: r["message"] as string | undefined,
    locked_until: (r["locked_until"] as string | null) ?? null,
    attempts_remaining: r["attempts_remaining"] as number | undefined,
  };
}

export const verifyPin = (collectionId: string, pin: string) =>
  callPin("verify_collection_pin", collectionId, pin);

export const removePin = (collectionId: string, pin: string) =>
  callPin("remove_collection_pin", collectionId, pin);

export async function setPin(
  collectionId: string,
  pin: string,
  currentPin?: string,
): Promise<PinResult> {
  const { data, error } = await supabase.rpc("set_collection_pin", {
    _collection_id: collectionId,
    _pin: pin,
    ...(currentPin ? { _current_pin: currentPin } : {}),
  });
  if (error) return { ok: false, message: "Something went wrong. Please try again." };
  const r = asRecord(data);
  return { ok: Boolean(r["ok"]), message: r["message"] as string | undefined };
}

export async function relockCollection(collectionId: string): Promise<PinResult> {
  const { data, error } = await supabase.rpc("relock_collection", {
    _collection_id: collectionId,
  });
  if (error) return { ok: false, message: "Something went wrong. Please try again." };
  const r = asRecord(data);
  return { ok: Boolean(r["ok"]), message: r["message"] as string | undefined };
}

/** Collections that the app must keep out of the normal gallery/collection lists. */
export async function fetchSecretCollectionIds(): Promise<string[]> {
  const { data, error } = await supabase.from("collections").select("id").eq("is_secret", true);
  if (error) throw error;
  return (data ?? []).map((r) => r.id);
}

export function cooldownMessage(lockedUntil: string | null | undefined): string | null {
  if (!lockedUntil) return null;
  const ms = new Date(lockedUntil).getTime() - Date.now();
  if (ms <= 0) return null;
  const minutes = Math.ceil(ms / 60000);
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
