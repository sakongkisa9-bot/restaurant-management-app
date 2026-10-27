import { asc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isRestaurantOperating } from "@/lib/restaurant-access";
import { isRestaurantAdminSession } from "@/lib/session-access";
import { restaurants } from "@/lib/schema";

export async function GET() {
  if (!db) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const rows = await db.select({
    name: restaurants.name,
    slug: restaurants.slug,
    installationFee: restaurants.installationFee,
    monthlyFee: restaurants.monthlyFee,
    installationPaid: restaurants.installationPaid,
    monthlyPaid: restaurants.monthlyPaid,
    autoSuspendIfUnpaid: restaurants.autoSuspendIfUnpaid,
  })
    .from(restaurants)
    .orderBy(asc(restaurants.name));
  return Response.json({
    restaurants: rows
      .filter((restaurant) => isRestaurantOperating(restaurant))
      .map(({ name, slug }) => ({ name, slug })),
  });
}

export async function PUT(request: NextRequest) {
  if (!db) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const payload = await request.json();
  const id = String(payload.id ?? "");
  if (!id) return Response.json({ error: "Restaurant id is required" }, { status: 400 });
  if (!(await isRestaurantAdminSession(id))) {
    return Response.json({ error: "Restaurant admin sign-in required" }, { status: 401 });
  }

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
