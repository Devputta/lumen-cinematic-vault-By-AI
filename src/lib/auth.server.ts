import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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

/**
 * Resolves a username to its account email using the privileged client.
 * The email is never returned to the browser — it is only used to sign in.
 */
async function resolveEmail(identifier: string): Promise<string | null> {
  if (identifier.includes("@")) return identifier;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("username", identifier)
    .maybeSingle();

  if (!profile) return null;

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(profile.id);
  if (error || !data.user?.email) return null;
  return data.user.email;
}

export type SignInResult =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; message: string };

export async function signInWithIdentifier(
  identifier: string,
  password: string,
): Promise<SignInResult> {
  const generic = "Invalid username/email or password.";
  const email = await resolveEmail(identifier.trim());
  if (!email) return { ok: false, message: generic };

  const { data, error } = await publicClient().auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    if (error?.message?.toLowerCase().includes("email not confirmed")) {
      return { ok: false, message: "Please confirm your email address before signing in." };
    }
    return { ok: false, message: generic };
  }

  return {
    ok: true,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}
