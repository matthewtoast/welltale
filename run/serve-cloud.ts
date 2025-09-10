import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { StoryCartridge } from "lib/StoryTypes";
import { OpenAI } from "openai";
import { Readable } from "stream";
import * as unzipper from "unzipper";
import { z } from "zod";
import { Cache } from "../lib/Cache";
import { S3Cache } from "../lib/S3Cache";
import { BaseServiceProvider } from "../lib/ServiceProvider";
import { compileStory } from "../lib/StoryCompiler";
import {
  advanceStory,
  SessionSchema,
  StoryOptionsSchema,
} from "../lib/StoryEngine";

// TODO: Instead of loadCartridge we need to do loadSources
// Assume the cartridge has already been compiled into an object, with voices
// possibly even allow the thing to be passed in

const RequestSchema = z.object({
  storyId: z.string(),
  session: SessionSchema,
  options: StoryOptionsSchema,
});

const RequiredEnvVars = z.object({
  AWS_BUCKET: z.string(),
  AWS_REGION: z.string().default("us-east-1"),
  OPENROUTER_API_KEY: z.string(),
  OPENROUTER_BASE_URL: z.string(),
  ELEVENLABS_API_KEY: z.string(),
});

interface APIGatewayEvent {
  body: string | null;
  headers: Record<string, string | undefined>;
  httpMethod: string;
  path: string;
  pathParameters: Record<string, string> | null;
  queryStringParameters: Record<string, string> | null;
  requestContext: {
    requestId: string;
    stage: string;
    httpMethod: string;
    path: string;
  };
}

interface APIGatewayResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

class CloudServiceProvider extends BaseServiceProvider {
  private s3: S3Client;
  private bucket: string;

  constructor(
    config: {
      openai: OpenAI;
      eleven: ElevenLabsClient;
      cache: Cache;
    },
    s3: S3Client,
    bucket: string
  ) {
    super(config);
    this.s3 = s3;
    this.bucket = bucket;
  }

  async loadCartridge(storyId: string): Promise<StoryCartridge> {
    const key = `cartridges/${storyId}.zip`;

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3.send(command);
      if (!response.Body) {
        throw new Error("Empty response from S3");
      }

      const cartridge: StoryCartridge = {};
      const bodyStream = response.Body as Readable;

      await new Promise<void>((resolve, reject) => {
        bodyStream
          .pipe(unzipper.Parse())
          .on("entry", async (entry: unzipper.Entry) => {
            const fileName = entry.path;
            const chunks: Buffer[] = [];

            entry.on("data", (chunk: Buffer) => chunks.push(chunk));
            entry.on("end", () => {
              cartridge[fileName] = Buffer.concat(chunks);
            });
          })
          .on("close", resolve)
          .on("error", reject);
      });

      return cartridge;
    } catch (error) {
      throw new Error(
        `Failed to load cartridge '${storyId}' from S3: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}

let serviceProvider: CloudServiceProvider | null = null;

function validateEnvironment() {
  try {
    return RequiredEnvVars.parse(process.env);
  } catch (error) {
    console.error("Missing required environment variables:", error);
    throw new Error("Invalid environment configuration");
  }
}

function getServiceProvider(): CloudServiceProvider {
  if (!serviceProvider) {
    const env = validateEnvironment();

    const openai = new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: env.OPENROUTER_BASE_URL,
    });
    const elevenlabs = new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY });
    const s3 = new S3Client({ region: env.AWS_REGION });
    const cache = new S3Cache(s3, env.AWS_BUCKET);

    serviceProvider = new CloudServiceProvider(
      {
        openai,
        eleven: elevenlabs,
        cache,
      },
      s3,
      env.AWS_BUCKET
    );
  }

  return serviceProvider;
}

export async function handler(
  event: APIGatewayEvent
): Promise<APIGatewayResponse> {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Request body is required" }),
      };
    }

    const body = JSON.parse(event.body);
    const parsed = RequestSchema.parse(body);
    const { storyId, session, options } = parsed;

    const provider = getServiceProvider();
    const cartridge = await provider.loadCartridge(storyId);
    const root = await compileStory(cartridge, {
      doCompileVoices: false,
    });

    const result = await advanceStory(provider, root, session, options);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error("Error processing request:", error);

    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: "Invalid request",
          details: error.errors,
        }),
      };
    }

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
}
