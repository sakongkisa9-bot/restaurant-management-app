import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { menuItems, orderLines, orders, restaurants, staffMembers } from "@/lib/schema";
import { getAuthenticatedSession } from "@/lib/session-access";

function isMissingWaiterWorkflowMigration(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "42703") return false;
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  return [
    "bill_request_resolved",
    "waiter_call_resolved",
    "waiter_call_reason",
    "waiter_call_details",
    "assigned_waiter_id",
    "customer_session_id",
    "waiter_cancellation_resolved",
    "cook_cancellation_resolved",
  ].some((column) => message.includes(column));
}

async function getWaiterSession() {
  const session = await getAuthenticatedSession();
  return session?.role === "waiter"
    && typeof session.restaurantId === "string"
    && typeof session.staffId === "string"
    ? { restaurantId: session.restaurantId, staffId: session.staffId }
    : null;
}

export async function GET() {
  if (!db) return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  const session = await getWaiterSession();
  if (!session) return Response.json({ error: "Waiter sign-in required" }, { status: 401 });

  let member;
  let restaurant;
  let food;
  let activeOrders;
  try {
    [member, restaurant, food, activeOrders] = await Promise.all([
      db.select({
        id: staffMembers.id,
        name: staffMembers.name,
        phone: staffMembers.phone,
        email: staffMembers.email,
        passportPhoto: staffMembers.passportPhoto,
      }).from(staffMembers).where(and(
        eq(staffMembers.id, session.staffId),
        eq(staffMembers.restaurantId, session.restaurantId),
        eq(staffMembers.role, "Waiter"),
      )).limit(1),
      db.select({ id: restaurants.id, name: restaurants.name, tableCount: restaurants.tableCount })
        .from(restaurants).where(eq(restaurants.id, session.restaurantId)).limit(1),
      db.select({
        id: menuItems.id,
        name: menuItems.name,
        category: menuItems.category,
        price: menuItems.price,
        image: menuItems.image,
      }).from(menuItems).where(and(eq(menuItems.restaurantId, session.restaurantId), eq(menuItems.available, true))).limit(200),
      db.select().from(orders).where(and(eq(orders.restaurantId, session.restaurantId), ne(orders.status, "completed")))
        .orderBy(desc(orders.createdAt)).limit(200),
    ]);
  } catch (error) {
    if (isMissingWaiterWorkflowMigration(error)) {
      return Response.json({
        error: "Waiter service database setup is incomplete. Apply src/lib/migrations/0002_waiter_workflow.sql and src/lib/migrations/0003_customer_order_sessions.sql to the configured PostgreSQL database, then refresh this page.",
        code: "WAITER_MIGRATION_REQUIRED",
      }, { status: 503 });
    }
    throw error;
  }
  if (!member[0] || !restaurant[0]) return Response.json({ error: "Waiter account or restaurant not found" }, { status: 404 });

  const orderIds = activeOrders.map((order) => order.id);
  const lines = orderIds.length ? await db.select().from(orderLines).where(inArray(orderLines.orderId, orderIds)) : [];
  const linesByOrder = new Map<string, typeof lines>();
  for (const line of lines) {
    const existing = linesByOrder.get(line.orderId) ?? [];
    existing.push(line);
    linesByOrder.set(line.orderId, existing);
  }

  const ordersForDashboard = activeOrders.map((order) => ({
    id: order.id,
    tableNumber: order.tableNumber,
    orderNumber: order.orderNumber,
    status: order.status,
    total: order.total,
    createdAt: order.createdAt?.toISOString() ?? new Date().toISOString(),
    billRequested: Boolean(order.billRequested),
    billRequestResolved: order.billRequestResolved,
    waiterCalled: Boolean(order.waiterCalled),
    waiterCallResolved: order.waiterCallResolved,
    waiterCallReason: order.waiterCallReason ?? "",
    waiterCallDetails: order.waiterCallDetails ?? "",
    assignedWaiterId: order.assignedWaiterId,
    waiterCancellationResolved: order.waiterCancellationResolved,
    cookCancellationResolved: order.cookCancellationResolved,
    lines: (linesByOrder.get(order.id) ?? []).map((line) => ({
      name: line.itemName,
      quantity: line.quantity,
    })),
  }));
  const tableCount = Math.max(0, Math.min(restaurant[0].tableCount ?? 12, 200));
  const occupiedTables = new Set(ordersForDashboard
    .filter((order) => order.status !== "cancelled" && order.status !== "completed")
    .map((order) => order.tableNumber));

  return Response.json({
    waiter: member[0],
    restaurant: { id: restaurant[0].id, name: restaurant[0].name },
    availableTables: Array.from({ length: tableCount }, (_, index) => index + 1)
      .filter((tableNumber) => !occupiedTables.has(tableNumber)),
    availableFoods: food,
    orders: ordersForDashboard,
  });
}

export async function PUT(request: Request) {
  if (!db) return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  const session = await getWaiterSession();
  if (!session) return Response.json({ error: "Waiter sign-in required" }, { status: 401 });
  const payload: unknown = await request.json();
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return Response.json({ error: "Profile details are required" }, { status: 400 });
  }

  const name = "name" in payload && typeof payload.name === "string" ? payload.name.trim() : "";
  const phone = "phone" in payload && typeof payload.phone === "string" ? payload.phone.trim() : "";
  const email = "email" in payload && typeof payload.email === "string" ? payload.email.trim() : "";
  const password = "password" in payload && typeof payload.password === "string" ? payload.password : "";
  if (!name || name.length > 120 || phone.length > 40 || email.length > 254 || (password && password.length < 8)) {
    return Response.json({ error: "Enter a valid name and contact details; new passwords must be at least 8 characters" }, { status: 400 });
  }

  const updated = await db.update(staffMembers).set({
    name,
    phone,
    email,
    ...(password ? { passwordHash: await hash(password, 12) } : {}),
    updatedAt: new Date(),
  }).where(and(
    eq(staffMembers.id, session.staffId),
    eq(staffMembers.restaurantId, session.restaurantId),
    eq(staffMembers.role, "Waiter"),
  )).returning({
    id: staffMembers.id,
    name: staffMembers.name,
    phone: staffMembers.phone,
    email: staffMembers.email,
    passportPhoto: staffMembers.passportPhoto,
  });

  if (!updated[0]) return Response.json({ error: "Waiter account not found" }, { status: 404 });
  return Response.json({ waiter: updated[0] });
}
