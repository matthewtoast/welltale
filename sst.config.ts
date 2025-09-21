import { SSTConfig } from "sst";
import { Bucket, NextjsSite, Queue, Table } from "sst/constructs";

// Whomever invokes this should export or pass these env vars!
const REQUIRED_ENV_VARS = [
  "OPENROUTER_API_KEY",
  "OPENROUTER_BASE_URL",
  "ELEVENLABS_API_KEY",
  "AUTH_SECRET",
  "DEV_API_KEYS",
  "APPLE_AUDIENCE",
];
REQUIRED_ENV_VARS.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`process.env.${key} not found`);
  }
});

export default {
  config() {
    return { name: "welltale-web", region: "us-east-1" };
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
            environment: {
              STORIES_BUCKET: bucket.bucketName,
              STORIES_TABLE: table.tableName,
              CACHE_BUCKET: cacheBucket.bucketName,
              USERS_TABLE: users.tableName,
              OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY!,
              OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL!,
              ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY!,
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
          JOBS_QUEUE_URL: queue.queueUrl,
          STORIES_BUCKET: bucket.bucketName,
          STORIES_TABLE: table.tableName,
          CACHE_BUCKET: cacheBucket.bucketName,
          USERS_TABLE: users.tableName,
          AUTH_SECRET: process.env.AUTH_SECRET!,
          DEV_API_KEYS: process.env.DEV_API_KEYS!,
          APPLE_AUDIENCE: process.env.APPLE_AUDIENCE!,
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
