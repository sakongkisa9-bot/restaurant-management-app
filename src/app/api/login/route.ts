import { compare } from "bcryptjs";
import { NextRequest } from "next/server";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { staffMembers } from "@/lib/schema";
import { setSessionToken, signSession } from "@/lib/auth";

const client = process.env.DATABASE_URL ? new Client({ connectionString: process.env.DATABASE_URL }) : null;
const db = client ? drizzle({ client }) : null;

export async function POST(request: NextRequest) {
  if (!db) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const payload = await request.json();
  const restaurantId = String(payload.restaurantId ?? "").trim();
  const name = String(payload.name ?? "").trim();
  const password = String(payload.password ?? "");

  if (!restaurantId || !name || !password) {
    return Response.json({ error: "restaurantId, staff name, and password are required" }, { status: 400 });
  }

  const member = (await db.select().from(staffMembers).where(eq(staffMembers.restaurantId, restaurantId)).limit(200)).find((row) => row.name.toLowerCase() === name.toLowerCase());
  if (!member) {
    return Response.json({ error: "Invalid staff credentials" }, { status: 401 });
  }

  const valid = await compare(password, member.passwordHash);
  if (!valid) {
    return Response.json({ error: "Invalid staff credentials" }, { status: 401 });
  }

  const token = await signSession({ restaurantId, staffId: member.id, name: member.name, role: member.role });
  await setSessionToken(token);

  return Response.json({ ok: true, staff: { id: member.id, name: member.name, role: member.role } });
}
