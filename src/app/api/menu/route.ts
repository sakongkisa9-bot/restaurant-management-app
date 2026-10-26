import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { menuItems } from "@/lib/schema";

const client = process.env.DATABASE_URL ? new Client({ connectionString: process.env.DATABASE_URL }) : null;
const db = client ? drizzle({ client }) : null;

export async function GET(request: NextRequest) {
  if (!db) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const restaurantId = request.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) {
    return Response.json({ error: "restaurantId is required" }, { status: 400 });
  }

  const rows = await db.select().from(menuItems).where(eq(menuItems.restaurantId, restaurantId)).limit(200);
  return Response.json({ menu: rows });
}

export async function POST(request: NextRequest) {
  if (!db) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const payload = await request.json();
  const restaurantId = String(payload.restaurantId ?? "").trim();
  const name = String(payload.name ?? "").trim();
  const price = Number(payload.price ?? 0);

  if (!restaurantId || !name || !Number.isFinite(price) || price <= 0) {
    return Response.json({ error: "restaurantId, item name, and valid price are required" }, { status: 400 });
  }

  const created = await db.insert(menuItems).values({
    restaurantId,
    name,
    description: String(payload.description ?? ""),
    image: String(payload.image ?? ""),
    images: Array.isArray(payload.images) ? payload.images : [],
    specifications: Array.isArray(payload.specifications) ? payload.specifications : [],
    category: String(payload.category ?? "Other"),
    mealPeriod: String(payload.mealPeriod ?? "Lunch"),
    price,
    available: payload.available !== false,
    orderCount: Number(payload.orderCount ?? 0),
  }).returning();

  return Response.json({ item: created[0] }, { status: 201 });
}
