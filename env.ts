import { config } from "dotenv";
import { z } from "zod";

// Load environment variables from .env file
config();

const ZEnvSchema = z.object({});

export type Env = z.infer<typeof ZEnvSchema>;

const loadEnv = (): Env => {
  try {
    return ZEnvSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map((err) => err.path.join("."))
        .join(", ");
      throw new Error(
        `Missing or invalid environment variables: ${missingVars}`
      );
    }
    throw error;
  }
};
