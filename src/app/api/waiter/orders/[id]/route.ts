import { and, eq, isNull, or, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { orders, staffMembers } from "@/lib/schema";
import { getAuthenticatedSession } from "@/lib/session-access";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  const session = await getAuthenticatedSession();
  if (session?.role !== "waiter") {
    return Response.json({ error: "Waiter sign-in required" }, { status: 401 });
  }
  const restaurantId = session.restaurantId;
  const staffId = session.staffId;
  if (typeof restaurantId !== "string" || typeof staffId !== "string") {
    return Response.json({ error: "Waiter sign-in required" }, { status: 401 });
  }
  const waiter = (await db.select({ id: staffMembers.id }).from(staffMembers).where(and(
    eq(staffMembers.id, staffId),
    eq(staffMembers.restaurantId, restaurantId),
    eq(staffMembers.role, "Waiter"),
  )).limit(1))[0];
  if (!waiter) return Response.json({ error: "Waiter account not found" }, { status: 404 });

  const { id } = await params;
  const payload: unknown = await request.json();
  const action = typeof payload === "object" && payload !== null && "action" in payload ? payload.action : null;
  const baseCondition = and(eq(orders.id, id), eq(orders.restaurantId, restaurantId));

  if (action === "approve") {
    const claimed = await db.transaction(async (tx) => {
      const result = await tx.update(orders).set({ assignedWaiterId: staffId, updatedAt: new Date() })
        .where(and(baseCondition, eq(orders.status, "confirmed"), isNull(orders.assignedWaiterId)))
        .returning({ id: orders.id });
      if (result[0]) {
        await tx.update(staffMembers).set({
          ordersTaken: sql`coalesce(${staffMembers.ordersTaken}, 0) + 1`,
          updatedAt: new Date(),
        }).where(and(
          eq(staffMembers.id, staffId),
          eq(staffMembers.restaurantId, restaurantId),
        ));
      }
      return result;
    });
    if (claimed[0]) return Response.json({ ok: true, assignedToMe: true });

    const order = (await db.select({ assignedWaiterId: orders.assignedWaiterId })
      .from(orders).where(baseCondition).limit(1))[0];
    if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
    return Response.json({ ok: true, assignedToMe: order.assignedWaiterId === staffId, assigned: true });
  }

  if (action === "resolve-cancelled") {
    const updated = await db.update(orders).set({
      waiterCancellationResolved: true,
      updatedAt: new Date(),
    }).where(and(
      baseCondition,
      eq(orders.status, "cancelled"),
      eq(orders.waiterCancellationResolved, false),
    )).returning({ id: orders.id });
    return Response.json({ ok: true, resolved: Boolean(updated[0]) });
  }

  if (action === "resolve-call" || action === "resolve-bill") {
    const isCall = action === "resolve-call";
    const updated = await db.update(orders).set({
      ...(isCall ? { waiterCallResolved: true } : { billRequestResolved: true }),
      updatedAt: new Date(),
    }).where(and(
      baseCondition,
      eq(isCall ? orders.waiterCalled : orders.billRequested, true),
      eq(isCall ? orders.waiterCallResolved : orders.billRequestResolved, false),
      or(isNull(orders.assignedWaiterId), eq(orders.assignedWaiterId, staffId)),
    )).returning({ id: orders.id });
    return Response.json({ ok: true, resolved: Boolean(updated[0]) });
  }

  return Response.json({ error: "Unsupported waiter action" }, { status: 400 });
}
