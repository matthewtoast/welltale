import { config } from "dotenv";
import { z } from "zod";

config({ path: ".env" });
config({ path: ".env.dev" });

export const ZDevEnvSchema = z.object({
  AWS_ACCOUNT_ID: z.string(),
  AWS_PROFILE: z.string(),
  AWS_REGION: z.string(),
  DEV_API_KEYS: z.string(),
  NODE_ENV: z.union([
    z.literal("development"),
    z.literal("production"),
    z.literal("test"),
  ]),
  WELLTALE_API_BASE: z.string(),
});

export type DevEnv = z.infer<typeof ZDevEnvSchema>;

export const loadDevEnv = (): DevEnv => {
  try {
    return ZDevEnvSchema.parse(process.env);
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
