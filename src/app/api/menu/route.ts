import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { menuItems, restaurants } from "@/lib/schema";
import { isRestaurantOperating } from "@/lib/restaurant-access";
import { isRestaurantAdminSession } from "@/lib/session-access";

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

  const restaurant = (await db.select({
    installationFee: restaurants.installationFee,
    monthlyFee: restaurants.monthlyFee,
    installationPaid: restaurants.installationPaid,
    monthlyPaid: restaurants.monthlyPaid,
    autoSuspendIfUnpaid: restaurants.autoSuspendIfUnpaid,
  }).from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1))[0];
  if (!restaurant) return Response.json({ error: "Restaurant not found" }, { status: 404 });
  if (!isRestaurantOperating(restaurant) && !(await isRestaurantAdminSession(restaurantId))) {
    return Response.json({ error: "This restaurant is temporarily unavailable", code: "RESTAURANT_SUSPENDED" }, { status: 403 });
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
  if (!(await isRestaurantAdminSession(restaurantId))) {
    return Response.json({ error: "Restaurant admin sign-in required" }, { status: 401 });
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
