import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { staffMembers } from "@/lib/schema";

export async function GET(request: NextRequest) {
  if (!db) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const restaurantId = request.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) {
    return Response.json({ error: "restaurantId is required" }, { status: 400 });
  }

  const rows = await db.select().from(staffMembers).where(eq(staffMembers.restaurantId, restaurantId)).limit(200);
  return Response.json({ staff: rows });
}

export async function POST(request: NextRequest) {
  if (!db) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const payload = await request.json();
  const restaurantId = String(payload.restaurantId ?? "");
  const name = String(payload.name ?? "").trim();
  const role = String(payload.role ?? "Waiter").trim();
  const password = String(payload.password ?? "").trim();

  if (!restaurantId || !name || !password) {
    return Response.json({ error: "restaurantId, name, and password are required" }, { status: 400 });
  }

  const passwordHash = await hash(password, 12);
  const staffCode = `ST-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  const created = await db.insert(staffMembers).values({
    restaurantId,
    staffCode,
    name,
    role,
    passportPhoto: String(payload.passportPhoto ?? ""),
    phone: String(payload.phone ?? ""),
    email: String(payload.email ?? ""),
    passwordHash,
    salary: payload.salary === null || payload.salary === undefined ? null : Number(payload.salary ?? 0),
    salaryPayments: payload.salaryPayments ?? {},
    ordersTaken: Number(payload.ordersTaken ?? 0),
    revenueGenerated: Number(payload.revenueGenerated ?? 0),
  }).returning();

  return Response.json({ staff: created[0] }, { status: 201 });
}
