import { config } from "dotenv";
import { z } from "zod";

config({ path: ".env" });
config({ path: ".env.app" });

export const ZAppEnvSchema = z.object({
  APPLE_AUDIENCE: z.string(),
  AUTH_SECRET: z.string(),
  CACHE_BUCKET: z.string(),
  DEV_API_KEYS: z.string(),
  ELEVENLABS_API_KEY: z.string(),
  JOBS_QUEUE_URL: z.string(),
  OPENROUTER_API_KEY: z.string(),
  OPENROUTER_BASE_URL: z.string(),
  STORIES_BUCKET: z.string(),
  STORIES_TABLE: z.string(),
  USERS_TABLE: z.string(),
});

export type AppEnv = z.infer<typeof ZAppEnvSchema>;

export const loadAppEnv = (): AppEnv => {
  try {
    return ZAppEnvSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map((err) => err.path.join("."))
        .join(", ");
      throw new Error(
        `Missing or invalid APP environment variables: ${missingVars}`
      );
    }
    throw error;
  }
};
