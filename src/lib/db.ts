import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";

const connectionString = process.env.DATABASE_URL;

export const db = connectionString
  ? drizzle({ client: new Client({ connectionString }) })
  : null;

export async function getDbClient() {
  if (!db) return null;

  const client = db.$client as Client | undefined;
  if (client && typeof client.connect === "function") {
    try {
      await client.connect();
    } catch {
      // The client is already connected or the connection is available.
    }
  }

  return client ?? null;
}
