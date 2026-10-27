import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

export const dbPool = connectionString
  ? new Pool({ connectionString, connectionTimeoutMillis: 10_000 })
  : null;

export const db = dbPool ? drizzle({ client: dbPool }) : null;
