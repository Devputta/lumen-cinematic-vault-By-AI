/**
 * Server-only helpers for registration.
 * Returns only a boolean availability flag — never account details.
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("username", username.trim())
    .maybeSingle();

  if (error) throw new Error("We couldn't verify that username. Please try again.");
  return !data;
}
