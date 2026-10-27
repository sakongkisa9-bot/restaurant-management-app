import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { orderLines, orders, restaurants } from "@/lib/schema";
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
  if (!(await isRestaurantAdminSession(restaurantId))) {
    return Response.json({ error: "Restaurant admin sign-in required" }, { status: 401 });
  }

  const rows = await db.select().from(orders).where(eq(orders.restaurantId, restaurantId)).limit(200);
  return Response.json({ orders: rows });
}

export async function POST(request: NextRequest) {
  if (!db) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const payload = await request.json();
  const restaurantId = String(payload.restaurantId ?? "").trim();
  const tableNumber = Number(payload.tableNumber ?? 0);

  if (!restaurantId || !tableNumber) {
    return Response.json({ error: "restaurantId and tableNumber are required" }, { status: 400 });
  }
  const restaurant = (await db.select({
    installationFee: restaurants.installationFee,
    monthlyFee: restaurants.monthlyFee,
    installationPaid: restaurants.installationPaid,
    monthlyPaid: restaurants.monthlyPaid,
    autoSuspendIfUnpaid: restaurants.autoSuspendIfUnpaid,
  }).from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1))[0];
  if (!restaurant) return Response.json({ error: "Restaurant not found" }, { status: 404 });
  if (!isRestaurantOperating(restaurant)) {
    return Response.json({ error: "This restaurant is temporarily unavailable", code: "RESTAURANT_SUSPENDED" }, { status: 403 });
  }

  const orderNumber = `RH-${Date.now().toString().slice(-6)}`;
  const created = await db.insert(orders).values({
    restaurantId,
    tableNumber,
    orderNumber,
    status: String(payload.status ?? "confirmed"),
    total: Number(payload.total ?? 0),
    billRequested: Boolean(payload.billRequested),
    waiterCalled: Boolean(payload.waiterCalled),
    paymentStatus: String(payload.paymentStatus ?? "unpaid"),
    invoiceNumber: String(payload.invoiceNumber ?? "") || null,
  }).returning();

  const orderId = created[0]?.id;
  if (orderId && Array.isArray(payload.lines)) {
    await db.insert(orderLines).values(payload.lines.map((line: Record<string, unknown>) => ({
      orderId,
      itemName: String(line.name ?? ""),
      quantity: Number(line.quantity ?? 1),
      price: Number(line.price ?? 0),
      specification: String(line.specification ?? ""),
      itemId: line.itemId ? String(line.itemId) : null,
    })));
  }

  return Response.json({ order: created[0] }, { status: 201 });
}
