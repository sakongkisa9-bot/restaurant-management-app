import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { menuItems } from "@/lib/schema";
import { isRestaurantAdminSession } from "@/lib/session-access";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });

  const payload: unknown = await request.json();
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return Response.json({ error: "Menu item details are required" }, { status: 400 });
  }
  const restaurantId = "restaurantId" in payload && typeof payload.restaurantId === "string" ? payload.restaurantId : "";
  const name = "name" in payload && typeof payload.name === "string" ? payload.name.trim() : "";
  const description = "description" in payload && typeof payload.description === "string" ? payload.description : "";
  const image = "image" in payload && typeof payload.image === "string" ? payload.image : "";
  const images = "images" in payload ? payload.images : [];
  const specifications = "specifications" in payload ? payload.specifications : [];
  const category = "category" in payload && typeof payload.category === "string" ? payload.category.trim() : "";
  const mealPeriod = "mealPeriod" in payload && typeof payload.mealPeriod === "string" ? payload.mealPeriod.trim() : "";
  const price = "price" in payload ? payload.price : Number.NaN;

  if (!(await isRestaurantAdminSession(restaurantId))) {
    return Response.json({ error: "Restaurant admin sign-in required" }, { status: 401 });
  }
  if (!name || !category || !mealPeriod || typeof price !== "number" || !Number.isFinite(price) || price <= 0
    || !isStringArray(images) || !isStringArray(specifications)) {
    return Response.json({ error: "Enter a name, category, meal period, valid price, and valid options" }, { status: 400 });
  }

  const { id } = await params;
  const updated = await db.update(menuItems).set({
    name,
    description,
    image,
    images,
    specifications,
    category,
    mealPeriod,
    price,
    updatedAt: new Date(),
  }).where(and(eq(menuItems.id, id), eq(menuItems.restaurantId, restaurantId))).returning();

  if (!updated[0]) return Response.json({ error: "Menu item not found" }, { status: 404 });
  return Response.json({ item: updated[0] });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });

  const payload: unknown = await request.json();
  const restaurantId = typeof payload === "object" && payload !== null && !Array.isArray(payload)
    && "restaurantId" in payload && typeof payload.restaurantId === "string"
    ? payload.restaurantId
    : "";
  if (!(await isRestaurantAdminSession(restaurantId))) {
    return Response.json({ error: "Restaurant admin sign-in required" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await db.delete(menuItems)
    .where(and(eq(menuItems.id, id), eq(menuItems.restaurantId, restaurantId)))
    .returning({ id: menuItems.id });
  if (!deleted[0]) return Response.json({ error: "Menu item not found" }, { status: 404 });
  return Response.json({ ok: true });
}
