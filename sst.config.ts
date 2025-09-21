import { loadSstEnv } from "env/env-sst";
import { SSTConfig } from "sst";
import { Bucket, NextjsSite, Queue, Table } from "sst/constructs";

/*
AWS credentials
- Uses standard AWS SDK chain: env vars -> AWS_PROFILE (SSO/keys) -> role assumption.
- Run with a profile: `AWS_PROFILE=myprofile yarn dev|deploy`.

Site URL
- After deploy, CloudFormation Outputs includes `SiteUrl` (CloudFront domain).
- Also printed in the deploy logs.

Custom domain
- Set on NextjsSite: `customDomain: "www.example.com"` (Route53) or
  `{ domainName: "www.example.com", isExternalDomain: true }` for external DNS.
- Deploy will handle ACM cert + DNS (Route53) or output CNAME/validation records (external).
*/

const sst = loadSstEnv();

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
              ...sst,
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
          USERS_TABLE: users.tableName,
          ...sst,
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
