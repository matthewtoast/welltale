import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

export type UserRecord = {
  id: string;
  provider: string;
  providerUserId: string;
  email: string | null;
  roles: string[];
  sessionVersion: number;
  createdAt: number;
  updatedAt: number;
};

function client(): DynamoDBClient {
  return new DynamoDBClient({});
}

function table(): string {
  return process.env.USERS_TABLE || "";
}

export async function getUser(id: string): Promise<UserRecord | null> {
  const c = client();
  const t = table();
  const res = await c.send(
    new GetItemCommand({ TableName: t, Key: marshall({ id }) })
  );
  if (!res.Item) return null;
  return unmarshall(res.Item) as UserRecord;
}

export async function saveUser(u: UserRecord): Promise<UserRecord> {
  const c = client();
  const t = table();
  await c.send(
    new PutItemCommand({
      TableName: t,
      Item: marshall(u, { removeUndefinedValues: true }),
    })
  );
  return u;
}

export async function findUserByProvider(
  provider: string,
  providerUserId: string
): Promise<UserRecord | null> {
  const c = client();
  const t = table();
  const res = await c.send(
    new ScanCommand({
      TableName: t,
      FilterExpression: "#provider = :provider AND providerUserId = :pid",
      ExpressionAttributeNames: { "#provider": "provider" },
      ExpressionAttributeValues: marshall({
        ":provider": provider,
        ":pid": providerUserId,
      }),
      Limit: 1,
    })
  );
  const items = res.Items || [];
  if (!items[0]) return null;
  return unmarshall(items[0]) as UserRecord;
}
