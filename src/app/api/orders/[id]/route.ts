import { and, eq, isNull, ne } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/schema";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  const { id } = await params;
  const restaurantId = request.nextUrl.searchParams.get("restaurantId") ?? "";
  const customerSessionId = request.nextUrl.searchParams.get("customerSessionId") ?? "";
  if (!uuidPattern.test(id) || !uuidPattern.test(restaurantId) || !uuidPattern.test(customerSessionId)) {
    return Response.json({ error: "A valid customer order session is required" }, { status: 400 });
  }
  const order = (await db.select({
    status: orders.status,
    assignedWaiterId: orders.assignedWaiterId,
    billRequested: orders.billRequested,
    waiterCalled: orders.waiterCalled,
  }).from(orders).where(and(
    eq(orders.id, id),
    eq(orders.restaurantId, restaurantId),
    eq(orders.customerSessionId, customerSessionId),
  )).limit(1))[0];
  if (!order) return Response.json({ error: "Order not found for this customer session" }, { status: 404 });
  return Response.json({ order });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  const { id } = await params;
  const payload: unknown = await request.json();
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return Response.json({ error: "Service request details are required" }, { status: 400 });
  }

  const restaurantId = "restaurantId" in payload && typeof payload.restaurantId === "string" ? payload.restaurantId : "";
  const customerSessionId = "customerSessionId" in payload && typeof payload.customerSessionId === "string"
    ? payload.customerSessionId
    : "";
  const action = "action" in payload && payload.action === "cancel" ? "cancel"
    : "action" in payload && payload.action === "bill" ? "bill"
    : "action" in payload && payload.action === "waiter" ? "waiter"
      : null;
  if (!uuidPattern.test(id) || !uuidPattern.test(restaurantId) || !action) {
    return Response.json({ error: "A restaurant and valid order action are required" }, { status: 400 });
  }

  if (action === "cancel") {
    if (!uuidPattern.test(customerSessionId)) {
      return Response.json({ error: "A valid customer order session is required" }, { status: 400 });
    }
    const updated = await db.update(orders).set({
      status: "cancelled",
      waiterCancellationResolved: false,
      cookCancellationResolved: false,
      updatedAt: new Date(),
    }).where(and(
      eq(orders.id, id),
      eq(orders.restaurantId, restaurantId),
      eq(orders.customerSessionId, customerSessionId),
      eq(orders.status, "confirmed"),
      isNull(orders.assignedWaiterId),
    )).returning({ id: orders.id });
    if (updated[0]) return Response.json({ ok: true, cancelled: true });

    const existing = (await db.select({
      status: orders.status,
      assignedWaiterId: orders.assignedWaiterId,
    }).from(orders).where(and(
      eq(orders.id, id),
      eq(orders.restaurantId, restaurantId),
      eq(orders.customerSessionId, customerSessionId),
    )).limit(1))[0];
    if (!existing) return Response.json({ error: "Order not found for this customer session" }, { status: 404 });
    return Response.json({
      error: existing.status === "confirmed" && existing.assignedWaiterId
        ? "A waiter has already approved this order, so it can no longer be cancelled."
        : "This order is no longer waiting for approval and cannot be cancelled.",
    }, { status: 409 });
  }

  if (action === "bill") {
    const updated = await db.update(orders).set({
      billRequested: true,
      billRequestResolved: false,
      updatedAt: new Date(),
    }).where(and(
      eq(orders.id, id),
      eq(orders.restaurantId, restaurantId),
      ne(orders.status, "completed"),
      ne(orders.status, "cancelled"),
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
    ne(orders.status, "cancelled"),
  )).returning({ id: orders.id });
  if (!updated[0]) return Response.json({ error: "Active order not found" }, { status: 404 });
  return Response.json({ ok: true });
}
