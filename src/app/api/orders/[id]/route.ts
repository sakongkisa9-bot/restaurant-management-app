import { and, eq, ne } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/schema";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  const { id } = await params;
  const payload: unknown = await request.json();
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return Response.json({ error: "Service request details are required" }, { status: 400 });
  }

  const restaurantId = "restaurantId" in payload && typeof payload.restaurantId === "string" ? payload.restaurantId : "";
  const action = "action" in payload && payload.action === "bill" ? "bill"
    : "action" in payload && payload.action === "waiter" ? "waiter"
      : null;
  if (!restaurantId || !action) return Response.json({ error: "A restaurant and service request type are required" }, { status: 400 });

  if (action === "bill") {
    const updated = await db.update(orders).set({
      billRequested: true,
      billRequestResolved: false,
      updatedAt: new Date(),
    }).where(and(
      eq(orders.id, id),
      eq(orders.restaurantId, restaurantId),
      ne(orders.status, "completed"),
    )).returning({ id: orders.id });
    if (!updated[0]) return Response.json({ error: "Active order not found" }, { status: 404 });
    return Response.json({ ok: true });
  }

  const reason = "reason" in payload && typeof payload.reason === "string" ? payload.reason.trim() : "";
  const details = "details" in payload && typeof payload.details === "string" ? payload.details.trim() : "";
  const allowedReasons = ["Water", "Assistance", "Utensils", "Other"];
  if (!allowedReasons.includes(reason) || (reason === "Other" && !details) || details.length > 500) {
    return Response.json({ error: "Choose a reason and add a short explanation when selecting Other" }, { status: 400 });
  }
  const updated = await db.update(orders).set({
    waiterCalled: true,
    waiterCallResolved: false,
    waiterCallReason: reason,
    waiterCallDetails: details || null,
    updatedAt: new Date(),
  }).where(and(
    eq(orders.id, id),
    eq(orders.restaurantId, restaurantId),
    ne(orders.status, "completed"),
  )).returning({ id: orders.id });
  if (!updated[0]) return Response.json({ error: "Active order not found" }, { status: 404 });
  return Response.json({ ok: true });
}
