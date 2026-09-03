import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function publicClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Backend is not configured.");
  return createClient<Database>(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export type UnlockResult =
  | { ok: true; mediaUrl: string | null; thumbnailUrl: string; passwordRequired: boolean }
  | { ok: false; message: string; passwordRequired: boolean };

/**
 * Authorizes access to a locked media item.
 * Ownership is enforced by RLS through the caller's own Supabase client.
 * When the account has a password identity, the password must be re-entered.
 */
export async function authorizeLockedMedia(
  userClient: SupabaseClient<Database>,
  userId: string,
  mediaId: string,
  password: string | null,
): Promise<UnlockResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = userData?.user?.email ?? null;
  const hasPassword = Boolean(
    userData?.user?.identities?.some((i) => i.provider === "email") && email,
  );

  if (hasPassword) {
    if (!password) return { ok: false, message: "Enter your password.", passwordRequired: true };
    const { error } = await publicClient().auth.signInWithPassword({
      email: email as string,
      password,
    });
    if (error) return { ok: false, message: "Incorrect password.", passwordRequired: true };
  }

  const { data, error } = await userClient
    .from("media_items")
    .select("media_url, thumbnail_url")
    .eq("id", mediaId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, message: "This memory is unavailable.", passwordRequired: hasPassword };
  }

  return {
    ok: true,
    mediaUrl: data.media_url,
    thumbnailUrl: data.thumbnail_url,
    passwordRequired: hasPassword,
  };
}

export async function lockedMediaPolicy(userId: string): Promise<{ passwordRequired: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  return {
    passwordRequired: Boolean(
      data?.user?.identities?.some((i) => i.provider === "email") && data?.user?.email,
    ),
  };
}
