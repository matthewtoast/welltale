import { z } from "zod";
import { loadBaseEnv, ZBaseEnvSchema } from "./env-base";
import { loadEnvFile } from "./load-env";

loadEnvFile(import.meta.url, ".env.dev");

export const ZDevEnvSchema = z.intersection(
  ZBaseEnvSchema,
  z.object({
    WELLTALE_API_BASE: z.string(),
    WELLTALE_API_PROTO: z.string(),
  })
);

export type DevEnv = z.infer<typeof ZDevEnvSchema>;

export const loadDevEnv = (): DevEnv => {
  try {
    return ZDevEnvSchema.parse({
      ...loadBaseEnv(),
      ...process.env,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map((err) => err.path.join("."))
        .join(", ");
      throw new Error(
        `Missing or invalid DEV environment variables: ${missingVars}`
      );
    }
    throw error;
  }
};
