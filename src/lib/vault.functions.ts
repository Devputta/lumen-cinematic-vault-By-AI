import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const unlockMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        mediaId: z.string().uuid(),
        password: z.string().max(200).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { authorizeLockedMedia } = await import("./vault.server");
    return authorizeLockedMedia(
      context.supabase,
      context.userId,
      data.mediaId,
      data.password ?? null,
    );
  });

export const lockedPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { lockedMediaPolicy } = await import("./vault.server");
    return lockedMediaPolicy(context.userId);
  });
