import { compare } from "bcryptjs";
import { and, asc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { restaurants, staffMembers } from "@/lib/schema";
import { setSessionToken, signSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!db) return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  const restaurantId = request.nextUrl.searchParams.get("restaurantId") ?? "";
  const slug = request.nextUrl.searchParams.get("slug") ?? "";
  if (!restaurantId && !slug) return Response.json({ error: "restaurantId or slug is required" }, { status: 400 });

  const restaurant = (await db.select({ id: restaurants.id, name: restaurants.name })
    .from(restaurants)
    .where(restaurantId ? eq(restaurants.id, restaurantId) : eq(restaurants.slug, slug))
    .limit(1))[0];
  if (!restaurant) return Response.json({ error: "Restaurant not found" }, { status: 404 });

  const waiters = await db.select({
    id: staffMembers.id,
    name: staffMembers.name,
  }).from(staffMembers)
    .where(and(eq(staffMembers.restaurantId, restaurant.id), eq(staffMembers.role, "Waiter")))
    .orderBy(asc(staffMembers.name));

  return Response.json({ restaurantId: restaurant.id, waiters });
}

export async function POST(request: NextRequest) {
  if (!db) return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  const payload: unknown = await request.json();
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return Response.json({ error: "Waiter credentials are required" }, { status: 400 });
  }
  const restaurantId = "restaurantId" in payload && typeof payload.restaurantId === "string" ? payload.restaurantId : "";
  const staffId = "staffId" in payload && typeof payload.staffId === "string" ? payload.staffId : "";
  const securityKey = "securityKey" in payload && typeof payload.securityKey === "string" ? payload.securityKey : "";
  if (!restaurantId || !staffId || !securityKey) {
    return Response.json({ error: "Select a waiter and enter their security key" }, { status: 400 });
  }

  const member = (await db.select().from(staffMembers)
    .where(and(
      eq(staffMembers.id, staffId),
      eq(staffMembers.restaurantId, restaurantId),
      eq(staffMembers.role, "Waiter"),
    ))
    .limit(1))[0];
  if (!member || !(await compare(securityKey, member.passwordHash))) {
    return Response.json({ error: "Invalid waiter or security key" }, { status: 401 });
  }

  const token = await signSession({
    restaurantId,
    staffId: member.id,
    name: member.name,
    role: "waiter",
  });
  await setSessionToken(token);
  return Response.json({
    ok: true,
    waiter: {
      id: member.id,
      name: member.name,
      passportPhoto: member.passportPhoto ?? "",
    },
  });
}
