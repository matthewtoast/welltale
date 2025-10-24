import { z } from "zod";
import { loadEnvFile } from "./load-env";

loadEnvFile(import.meta.url, ".env.base");

export const ZBaseEnvSchema = z.object({
  AWS_ACCOUNT_ID: z.string(),
  NODE_ENV: z.union([
    z.literal("development"),
    z.literal("production"),
    z.literal("test"),
  ]),
  DEV_API_KEYS: z.string(),
  AWS_REGION: z.string(),
});

export type BaseEnv = z.infer<typeof ZBaseEnvSchema>;

export const loadBaseEnv = (): BaseEnv => {
  try {
    return ZBaseEnvSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map((err) => err.path.join("."))
        .join(", ");
      throw new Error(
        `Missing or invalid BASE environment variables: ${missingVars}`
      );
    }
    throw error;
  }
};
