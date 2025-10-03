import { SSTConfig } from "sst";
import { Bucket, NextjsSite, Queue, Table } from "sst/constructs";

// Whomever invokes this should export or pass these env vars!
const REQUIRED_ENV_VARS = [
  "APPLE_AUDIENCE",
  "AUTH_SECRET",
  "AWS_PROFILE",
  "DEV_API_KEYS",
  "ELEVENLABS_API_KEY",
  "NODE_ENV",
  "OPENROUTER_API_KEY",
  "OPENROUTER_BASE_URL",
];
const env: Record<string, string> = {};
REQUIRED_ENV_VARS.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`process.env.${key} not found`);
  }
  env[key] = process.env[key];
});
const region =
  process.env.AWS_REGION ??
  process.env.AWS_DEFAULT_REGION ??
  process.env.SST_REGION ??
  "us-east-1";
if (!process.env.AWS_REGION) process.env.AWS_REGION = region;

export default {
  config() {
    return { name: "welltale-web", region };
  },
  stacks(app) {
    app.stack(function Site({ stack }) {
      const bucket = new Bucket(stack, "Stories", {
        cors: [
          {
            allowedMethods: ["GET", "HEAD", "PUT"],
            allowedOrigins: ["*"],
            allowedHeaders: ["*"],
            exposedHeaders: ["ETag"],
            maxAge: "1 day",
          },
        ],
      });
      const cacheBucket = new Bucket(stack, "Cache");
      const table = new Table(stack, "StoriesTable", {
        fields: {
          id: "string",
          title: "string",
          author: "string",
          description: "string",
          publish: "string",
          compile: "string",
          createdAt: "number",
          updatedAt: "number",
        },
        primaryIndex: { partitionKey: "id" },
      });
      const users = new Table(stack, "UsersTable", {
        fields: {
          id: "string",
          provider: "string",
          providerUserId: "string",
          email: "string",
          roles: "string",
          sessionVersion: "number",
          createdAt: "number",
          updatedAt: "number",
        },
        primaryIndex: { partitionKey: "id" },
      });
      const queue = new Queue(stack, "Jobs", {
        consumer: {
          function: {
            handler: "jobs/worker.handler",
            copyFiles: [
              {
                from: "node_modules/@jitl/quickjs-ng-wasmfile-release-sync/dist/emscripten-module.wasm",
                to: ".",
              },
            ],
            nodejs: {
              esbuild: {
                external: ["@jitl/quickjs-ng-wasmfile-release-sync"],
              },
            },
            environment: {
              ...omit(env, "AWS_PROFILE"),
              CACHE_BUCKET: cacheBucket.bucketName,
              JOBS_QUEUE_URL: "fake-queue-url-not-actually-used-in-this-env",
              STORIES_BUCKET: bucket.bucketName,
              STORIES_TABLE: table.tableName,
              USERS_TABLE: users.tableName,
            },
            permissions: [bucket, table, cacheBucket],
          },
        },
      });
      const site = new NextjsSite(stack, "Site", {
        // customDomain: "",
        path: "web",
        permissions: [bucket, table, users],
        environment: {
          ...omit(env, "AWS_PROFILE"),
          CACHE_BUCKET: cacheBucket.bucketName,
          JOBS_QUEUE_URL: queue.queueUrl,
          STORIES_BUCKET: bucket.bucketName,
          STORIES_TABLE: table.tableName,
          USERS_TABLE: users.tableName,
        },
      });
      stack.addOutputs({
        SiteUrl: site.url,
        JobsQueueUrl: queue.queueUrl,
        StoriesBucket: bucket.bucketName,
        StoriesTable: table.tableName,
        UsersTable: users.tableName,
        CacheBucket: cacheBucket.bucketName,
      });
    });
  },
} satisfies SSTConfig;

function omit<T extends Record<string, any>>(obj: T, ...keys: string[]): T {
  const res = {} as T;
  Object.keys(obj).forEach((k) => {
    if (!keys.includes(k)) {
      res[k as keyof T] = obj[k];
    }
  });
  return res;
}
