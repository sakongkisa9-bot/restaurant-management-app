import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { restaurants, staffMembers } from "@/lib/schema";

const client = process.env.DATABASE_URL ? new Client({ connectionString: process.env.DATABASE_URL }) : null;
const db = client ? drizzle({ client }) : null;

export async function GET() {
  if (!db) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const rows = await db.select().from(restaurants).limit(25);
  return Response.json({ restaurants: rows });
}

export async function POST(request: NextRequest) {
  if (!db) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const payload = await request.json();
  const name = String(payload.name ?? "").trim();
  const slug = String(payload.slug ?? "").trim();

  if (!name) {
    return Response.json({ error: "Restaurant name is required" }, { status: 400 });
  }

  const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const existing = await db.select().from(restaurants).where(eq(restaurants.slug, finalSlug)).limit(1);
  if (existing.length) {
    return Response.json({ error: "Restaurant slug already exists" }, { status: 409 });
  }

  const created = await db.insert(restaurants)
    .values({
      name,
      slug: finalSlug,
      tableCount: Number(payload.tableCount ?? 12),
      paymentMethod: String(payload.paymentMethod ?? "Till number"),
      paymentNumber: String(payload.paymentNumber ?? ""),
    })
    .returning();

  return Response.json({ restaurant: created[0] }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  if (!db) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const payload = await request.json();
  const id = String(payload.id ?? "");
  if (!id) return Response.json({ error: "Restaurant id is required" }, { status: 400 });

  const updated = await db.update(restaurants)
    .set({
      name: String(payload.name ?? ""),
      slug: String(payload.slug ?? ""),
      phone: String(payload.phone ?? ""),
      email: String(payload.email ?? ""),
      address: String(payload.address ?? ""),
      mapsUrl: String(payload.mapsUrl ?? ""),
      welcomeMessage: String(payload.welcomeMessage ?? ""),
      famousDish: String(payload.famousDish ?? ""),
      paymentMethod: String(payload.paymentMethod ?? "Till number"),
      paymentNumber: String(payload.paymentNumber ?? ""),
      tableCount: Number(payload.tableCount ?? 12),
      photos: Array.isArray(payload.photos) ? payload.photos : [],
      updatedAt: new Date(),
    })
    .where(eq(restaurants.id, id))
    .returning();

  return Response.json({ restaurant: updated[0] ?? null });
}
