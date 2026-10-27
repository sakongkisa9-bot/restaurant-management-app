import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { setSessionToken, signSession } from "@/lib/auth";
import { restaurants } from "@/lib/schema";

const client = process.env.DATABASE_URL ? new Client({ connectionString: process.env.DATABASE_URL }) : null;
const db = client ? drizzle({ client }) : null;

export async function POST(request: NextRequest) {
  if (!db) return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });

  const payload: unknown = await request.json();
  if (typeof payload !== "object" || payload === null) {
    return Response.json({ error: "Restaurant and password are required" }, { status: 400 });
  }

  const slug = "slug" in payload && typeof payload.slug === "string" ? payload.slug.trim() : "";
  const password = "password" in payload && typeof payload.password === "string" ? payload.password : "";
  if (!slug || !password) return Response.json({ error: "Restaurant and password are required" }, { status: 400 });

  const restaurant = (await db.select().from(restaurants).where(eq(restaurants.slug, slug)).limit(1))[0];
  if (!restaurant?.adminPasswordHash || !(await compare(password, restaurant.adminPasswordHash))) {
    return Response.json({ error: "Invalid restaurant password" }, { status: 401 });
  }

  const token = await signSession({ role: "admin", restaurantId: restaurant.id, slug: restaurant.slug });
  await setSessionToken(token);
  return Response.json({ ok: true });
}
