import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { customerFeedback, restaurants } from "@/lib/schema";
import { isRestaurantAdminSession } from "@/lib/session-access";

export async function GET(request: NextRequest) {
  if (!db) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const restaurantId = request.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) {
    return Response.json({ error: "restaurantId is required" }, { status: 400 });
  }
  if (!(await isRestaurantAdminSession(restaurantId))) {
    return Response.json({ error: "Restaurant admin sign-in required" }, { status: 401 });
  }

  const rows = await db.select().from(customerFeedback).where(eq(customerFeedback.restaurantId, restaurantId)).limit(200);
  return Response.json({ feedback: rows });
}

export async function POST(request: NextRequest) {
  if (!db) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const payload: unknown = await request.json();
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return Response.json({ error: "Feedback details are required" }, { status: 400 });
  }
  const restaurantId = "restaurantId" in payload && typeof payload.restaurantId === "string" ? payload.restaurantId.trim() : "";
  const type = "type" in payload && typeof payload.type === "string" ? payload.type.trim() : "";
  const message = "message" in payload && typeof payload.message === "string" ? payload.message.trim() : "";
  const orderNumber = "orderNumber" in payload && typeof payload.orderNumber === "string" ? payload.orderNumber.trim() : "";

  if (!restaurantId || !message || message.length > 2000 || !["recommendation", "complaint"].includes(type)) {
    return Response.json({ error: "Enter a restaurant, valid feedback type, and message up to 2,000 characters" }, { status: 400 });
  }
  const restaurant = (await db.select({ id: restaurants.id }).from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1))[0];
  if (!restaurant) return Response.json({ error: "Restaurant not found" }, { status: 404 });

  const created = await db.insert(customerFeedback).values({
    restaurantId,
    type,
    message,
    orderNumber: orderNumber || null,
  }).returning();

  return Response.json({ feedback: created[0] }, { status: 201 });
}
