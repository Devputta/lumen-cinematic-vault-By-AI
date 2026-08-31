import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const checkUsername = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        username: z
          .string()
          .trim()
          .min(3)
          .max(24)
          .regex(/^[a-zA-Z0-9_]+$/),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { isUsernameAvailable } = await import("./register.server");
    return { available: await isUsernameAvailable(data.username) };
  });
