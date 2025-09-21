import { config } from "dotenv";
import { ZSstEnvSchema } from "env/env-sst";
import { join } from "path";
import { z } from "zod";

config({ path: join(__dirname, ".env.app") });

export const ZAppEnvSchema = z.intersection(
  ZSstEnvSchema,
  z.object({
    // Note: These are *not* defined in the env file;
    // they are intended to be created by SST and passed in
    CACHE_BUCKET: z.string(),
    JOBS_QUEUE_URL: z.string(),
    STORIES_BUCKET: z.string(),
    STORIES_TABLE: z.string(),
    USERS_TABLE: z.string(),
  })
);

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
