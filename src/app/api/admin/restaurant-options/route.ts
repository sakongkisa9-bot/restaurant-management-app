import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { restaurants } from "@/lib/schema";

export async function GET() {
  if (!db) return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });

  const rows = await db.select({
    name: restaurants.name,
    slug: restaurants.slug,
  }).from(restaurants).orderBy(asc(restaurants.name));

  return Response.json({ restaurants: rows });
}
