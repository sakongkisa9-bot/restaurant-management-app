import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getAuthenticatedSession } from "@/lib/session-access";
import { restaurants } from "@/lib/schema";

const client = process.env.DATABASE_URL ? new Client({ connectionString: process.env.DATABASE_URL }) : null;
const db = client ? drizzle({ client }) : null;

export async function POST(request: NextRequest) {
  if (!db) return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });

  const session = await getAuthenticatedSession();
  if (session?.role !== "admin" || typeof session.restaurantId !== "string") {
    return Response.json({ error: "Restaurant admin sign-in required" }, { status: 401 });
  }

  const payload: unknown = await request.json();
  if (typeof payload !== "object" || payload === null) {
    return Response.json({ error: "Current and new passwords are required" }, { status: 400 });
  }

  const currentPassword = "currentPassword" in payload && typeof payload.currentPassword === "string" ? payload.currentPassword : "";
  const newPassword = "newPassword" in payload && typeof payload.newPassword === "string" ? payload.newPassword : "";
  if (!currentPassword || newPassword.length < 8) {
    return Response.json({ error: "Enter your current password and a new password of at least 8 characters" }, { status: 400 });
  }

  const restaurant = (await db.select().from(restaurants).where(eq(restaurants.id, session.restaurantId)).limit(1))[0];
  if (!restaurant?.adminPasswordHash || !(await compare(currentPassword, restaurant.adminPasswordHash))) {
    return Response.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  await db.update(restaurants)
    .set({ adminPasswordHash: await hash(newPassword, 12), updatedAt: new Date() })
    .where(eq(restaurants.id, restaurant.id));

  return Response.json({ ok: true });
}
