import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { customerFeedback } from "@/lib/schema";

export async function GET(request: NextRequest) {
  if (!db) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const restaurantId = request.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) {
    return Response.json({ error: "restaurantId is required" }, { status: 400 });
  }

  const rows = await db.select().from(customerFeedback).where(eq(customerFeedback.restaurantId, restaurantId)).limit(200);
  return Response.json({ feedback: rows });
}

export async function POST(request: NextRequest) {
  if (!db) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const payload = await request.json();
  const restaurantId = String(payload.restaurantId ?? "").trim();
  const type = String(payload.type ?? "recommendation").trim();
  const message = String(payload.message ?? "").trim();

  if (!restaurantId || !message) {
    return Response.json({ error: "restaurantId and message are required" }, { status: 400 });
  }

  const created = await db.insert(customerFeedback).values({
    restaurantId,
    type,
    message,
    orderNumber: String(payload.orderNumber ?? "") || null,
  }).returning();

  return Response.json({ feedback: created[0] }, { status: 201 });
}
