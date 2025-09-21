import { config } from "dotenv";
import { join } from "path";
import { z } from "zod";
import { ZBaseEnvSchema } from "./env-base";

config({ path: join(__dirname, ".env.dev") });

export const ZDevEnvSchema = z.intersection(
  ZBaseEnvSchema,
  z.object({
    AWS_ACCOUNT_ID: z.string(),
    AWS_PROFILE: z.string(),
    AWS_REGION: z.string(),
    WELLTALE_API_BASE: z.string(),
  })
);

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
