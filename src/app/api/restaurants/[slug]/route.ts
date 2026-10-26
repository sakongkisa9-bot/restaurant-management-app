import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { restaurants } from "@/lib/schema";

const client = process.env.DATABASE_URL ? new Client({ connectionString: process.env.DATABASE_URL }) : null;
const db = client ? drizzle({ client }) : null;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!db) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const { slug } = await params;
  const rows = await db.select().from(restaurants).where(eq(restaurants.slug, slug)).limit(1);
  if (!rows[0]) return Response.json({ error: "Restaurant not found" }, { status: 404 });
  return Response.json({ restaurant: rows[0] });
}
