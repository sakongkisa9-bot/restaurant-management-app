import { and, eq, inArray } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { menuItems, orderLines, orders, restaurants } from "@/lib/schema";
import { isRestaurantOperating } from "@/lib/restaurant-access";
import { isRestaurantAdminSession } from "@/lib/session-access";

type OrderLineInput = { itemId: string; quantity: number; specification: string };

function parseOrderLine(value: unknown): OrderLineInput | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || !("itemId" in value) || typeof value.itemId !== "string"
    || !("quantity" in value) || typeof value.quantity !== "number" || !Number.isInteger(value.quantity) || value.quantity < 1
    || !("specification" in value) || typeof value.specification !== "string") return null;
  return { itemId: value.itemId, quantity: value.quantity, specification: value.specification.slice(0, 300) };
}

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

  const payload: unknown = await request.json();
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return Response.json({ error: "Order details are required" }, { status: 400 });
  }
  const restaurantId = "restaurantId" in payload && typeof payload.restaurantId === "string" ? payload.restaurantId.trim() : "";
  const tableNumber = "tableNumber" in payload ? Number(payload.tableNumber) : 0;
  const rawLines = "lines" in payload && Array.isArray(payload.lines) ? payload.lines : [];
  const lines = rawLines.map(parseOrderLine).filter((line): line is OrderLineInput => line !== null);
  if (!restaurantId || !Number.isInteger(tableNumber) || tableNumber < 1 || lines.length === 0 || lines.length !== rawLines.length) {
    return Response.json({ error: "A valid table number and at least one valid order item are required" }, { status: 400 });
  }
  const restaurant = (await db.select({
    tableCount: restaurants.tableCount,
    installationFee: restaurants.installationFee,
    monthlyFee: restaurants.monthlyFee,
    installationPaid: restaurants.installationPaid,
    monthlyPaid: restaurants.monthlyPaid,
    autoSuspendIfUnpaid: restaurants.autoSuspendIfUnpaid,
  }).from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1))[0];
  if (!restaurant) return Response.json({ error: "Restaurant not found" }, { status: 404 });
  if (tableNumber > (restaurant.tableCount ?? 12)) {
    return Response.json({ error: "That table number is not configured for this restaurant" }, { status: 400 });
  }
  if (!isRestaurantOperating(restaurant)) {
    return Response.json({ error: "This restaurant is temporarily unavailable", code: "RESTAURANT_SUSPENDED" }, { status: 403 });
  }

  const catalogRows = await db.select({
    id: menuItems.id,
    name: menuItems.name,
    price: menuItems.price,
    specifications: menuItems.specifications,
  }).from(menuItems).where(and(
    eq(menuItems.restaurantId, restaurantId),
    eq(menuItems.available, true),
    inArray(menuItems.id, [...new Set(lines.map((line) => line.itemId))]),
  ));
  const catalog = new Map(catalogRows.map((item) => [item.id, item]));
  if (lines.some((line) => !catalog.has(line.itemId))) {
    return Response.json({ error: "One or more selected foods are no longer available" }, { status: 400 });
  }
  if (lines.some((line) => {
    const specifications: unknown = catalog.get(line.itemId)?.specifications;
    return line.specification !== "" && (!Array.isArray(specifications)
      || !specifications.includes(line.specification));
  })) {
    return Response.json({ error: "One or more selected food options are no longer available" }, { status: 400 });
  }
  const normalizedLines = lines.map((line) => {
    const item = catalog.get(line.itemId);
    if (!item) return null;
    return { ...line, name: item.name, price: item.price };
  }).filter((line): line is NonNullable<typeof line> => line !== null);
  const total = normalizedLines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const orderNumber = `RH-${Date.now().toString().slice(-6)}`;
  const created = await db.transaction(async (tx) => {
    const order = (await tx.insert(orders).values({
      restaurantId,
      tableNumber,
      orderNumber,
      status: "confirmed",
      total,
      billRequested: false,
      waiterCalled: false,
      paymentStatus: "unpaid",
      invoiceNumber: null,
    }).returning())[0];
    if (!order) throw new Error("Order creation did not return an order.");
    await tx.insert(orderLines).values(normalizedLines.map((line) => ({
      orderId: order.id,
      itemId: line.itemId,
      itemName: line.name,
      quantity: line.quantity,
      price: line.price,
      specification: line.specification,
    })));
    return order;
  });

  return Response.json({ order: { ...created, orderLines: normalizedLines } }, { status: 201 });
}
