import { hash } from "bcryptjs";
import { asc, eq, inArray } from "drizzle-orm";
import { NextRequest } from "next/server";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { isDeveloperSession } from "@/lib/session-access";
import { slugify } from "@/lib/tenant";
import { customerFeedback, menuItems, orderLines, orders, restaurants, staffMembers } from "@/lib/schema";

const client = process.env.DATABASE_URL ? new Client({ connectionString: process.env.DATABASE_URL }) : null;
const db = client ? drizzle({ client }) : null;

function isMoneyAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseRegistration(payload: unknown) {
  if (typeof payload !== "object" || payload === null) return null;
  const name = "name" in payload && typeof payload.name === "string" ? payload.name.trim() : "";
  const installationFee = "installationFee" in payload ? payload.installationFee : null;
  const monthlyFee = "monthlyFee" in payload ? payload.monthlyFee : null;
  const adminPassword = "adminPassword" in payload && typeof payload.adminPassword === "string" ? payload.adminPassword : "";
  const installationPaid = "installationPaid" in payload && payload.installationPaid === true;
  const monthlyPaid = "monthlyPaid" in payload && payload.monthlyPaid === true;
  const autoSuspendIfUnpaid = "autoSuspendIfUnpaid" in payload && payload.autoSuspendIfUnpaid === true;

  if (!name || !isMoneyAmount(installationFee) || !isMoneyAmount(monthlyFee)) return null;
  return { name, installationFee, monthlyFee, adminPassword, installationPaid, monthlyPaid, autoSuspendIfUnpaid };
}

export async function GET() {
  if (!(await isDeveloperSession())) return Response.json({ error: "Developer sign-in required" }, { status: 401 });
  if (!db) return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });

  const rows = await db.select({
    id: restaurants.id,
    slug: restaurants.slug,
    name: restaurants.name,
    installationFee: restaurants.installationFee,
    monthlyFee: restaurants.monthlyFee,
    installationPaid: restaurants.installationPaid,
    monthlyPaid: restaurants.monthlyPaid,
    autoSuspendIfUnpaid: restaurants.autoSuspendIfUnpaid,
    createdAt: restaurants.createdAt,
  }).from(restaurants).orderBy(asc(restaurants.name));

  return Response.json({ restaurants: rows });
}

export async function POST(request: NextRequest) {
  if (!(await isDeveloperSession())) return Response.json({ error: "Developer sign-in required" }, { status: 401 });
  if (!db) return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });

  const payload: unknown = await request.json();
  const registration = parseRegistration(payload);
  if (!registration || registration.adminPassword.length < 8) {
    return Response.json({ error: "Enter a restaurant name, valid fees, and an admin password of at least 8 characters" }, { status: 400 });
  }

  const slug = slugify(registration.name);
  const existing = await db.select({ id: restaurants.id }).from(restaurants).where(eq(restaurants.slug, slug)).limit(1);
  if (existing.length) return Response.json({ error: "A restaurant with this name already exists" }, { status: 409 });

  const created = await db.insert(restaurants).values({
    name: registration.name,
    slug,
    installationFee: registration.installationFee,
    monthlyFee: registration.monthlyFee,
    installationPaid: registration.installationPaid,
    monthlyPaid: registration.monthlyPaid,
    autoSuspendIfUnpaid: registration.autoSuspendIfUnpaid,
    adminPasswordHash: await hash(registration.adminPassword, 12),
  }).returning({
    id: restaurants.id,
    slug: restaurants.slug,
    name: restaurants.name,
    installationFee: restaurants.installationFee,
    monthlyFee: restaurants.monthlyFee,
    installationPaid: restaurants.installationPaid,
    monthlyPaid: restaurants.monthlyPaid,
    autoSuspendIfUnpaid: restaurants.autoSuspendIfUnpaid,
    createdAt: restaurants.createdAt,
  });

  return Response.json({ restaurant: created[0] }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  if (!(await isDeveloperSession())) return Response.json({ error: "Developer sign-in required" }, { status: 401 });
  if (!db) return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });

  const payload: unknown = await request.json();
  if (typeof payload !== "object" || payload === null) return Response.json({ error: "Restaurant details are required" }, { status: 400 });
  const id = "id" in payload && typeof payload.id === "string" ? payload.id : "";
  const name = "name" in payload && typeof payload.name === "string" ? payload.name.trim() : "";
  const installationFee = "installationFee" in payload ? payload.installationFee : null;
  const monthlyFee = "monthlyFee" in payload ? payload.monthlyFee : null;
  const installationPaid = "installationPaid" in payload && payload.installationPaid === true;
  const monthlyPaid = "monthlyPaid" in payload && payload.monthlyPaid === true;
  const autoSuspendIfUnpaid = "autoSuspendIfUnpaid" in payload && payload.autoSuspendIfUnpaid === true;
  const newAdminPassword = "newAdminPassword" in payload && typeof payload.newAdminPassword === "string" ? payload.newAdminPassword : "";

  if (!id || !name || !isMoneyAmount(installationFee) || !isMoneyAmount(monthlyFee)) {
    return Response.json({ error: "Enter a restaurant name and valid non-negative fees" }, { status: 400 });
  }
  if (newAdminPassword && newAdminPassword.length < 8) {
    return Response.json({ error: "A new admin password must be at least 8 characters" }, { status: 400 });
  }

  const values = {
    name,
    installationFee,
    monthlyFee,
    installationPaid,
    monthlyPaid,
    autoSuspendIfUnpaid,
    ...(newAdminPassword ? { adminPasswordHash: await hash(newAdminPassword, 12) } : {}),
    updatedAt: new Date(),
  };
  const updated = await db.update(restaurants).set(values).where(eq(restaurants.id, id)).returning({
    id: restaurants.id,
    slug: restaurants.slug,
    name: restaurants.name,
    installationFee: restaurants.installationFee,
    monthlyFee: restaurants.monthlyFee,
    installationPaid: restaurants.installationPaid,
    monthlyPaid: restaurants.monthlyPaid,
    autoSuspendIfUnpaid: restaurants.autoSuspendIfUnpaid,
    createdAt: restaurants.createdAt,
  });
  if (!updated[0]) return Response.json({ error: "Restaurant not found" }, { status: 404 });
  return Response.json({ restaurant: updated[0] });
}

export async function DELETE(request: NextRequest) {
  if (!(await isDeveloperSession())) return Response.json({ error: "Developer sign-in required" }, { status: 401 });
  if (!db) return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });

  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!id) return Response.json({ error: "Restaurant id is required" }, { status: 400 });
  const existing = (await db.select({ id: restaurants.id }).from(restaurants).where(eq(restaurants.id, id)).limit(1))[0];
  if (!existing) return Response.json({ error: "Restaurant not found" }, { status: 404 });

  await db.transaction(async (tx) => {
    const restaurantOrders = await tx.select({ id: orders.id }).from(orders).where(eq(orders.restaurantId, id));
    const orderIds = restaurantOrders.map((order) => order.id);
    if (orderIds.length) await tx.delete(orderLines).where(inArray(orderLines.orderId, orderIds));
    await tx.delete(orders).where(eq(orders.restaurantId, id));
    await tx.delete(menuItems).where(eq(menuItems.restaurantId, id));
    await tx.delete(customerFeedback).where(eq(customerFeedback.restaurantId, id));
    await tx.delete(staffMembers).where(eq(staffMembers.restaurantId, id));
    await tx.delete(restaurants).where(eq(restaurants.id, id));
  });

  return Response.json({ ok: true });
}
