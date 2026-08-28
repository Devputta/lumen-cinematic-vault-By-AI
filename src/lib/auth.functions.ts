import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { signInWithIdentifier } from "./auth.server";

export const signIn = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        identifier: z.string().trim().min(1).max(255),
        password: z.string().min(1).max(200),
      })
      .parse(data),
  )
  .handler(async ({ data }) => signInWithIdentifier(data.identifier, data.password));
