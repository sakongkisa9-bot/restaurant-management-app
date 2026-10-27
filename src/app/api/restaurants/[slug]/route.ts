import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { restaurants } from "@/lib/schema";
import { isRestaurantOperating } from "@/lib/restaurant-access";
import { isRestaurantAdminSession } from "@/lib/session-access";

const client = process.env.DATABASE_URL ? new Client({ connectionString: process.env.DATABASE_URL }) : null;
const db = client ? drizzle({ client }) : null;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!db) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const { slug } = await params;
  const restaurant = (await db.select({
    id: restaurants.id,
    slug: restaurants.slug,
    name: restaurants.name,
    logo: restaurants.logo,
    phone: restaurants.phone,
    email: restaurants.email,
    address: restaurants.address,
    mapsUrl: restaurants.mapsUrl,
    welcomeMessage: restaurants.welcomeMessage,
    famousDish: restaurants.famousDish,
    photos: restaurants.photos,
    paymentMethod: restaurants.paymentMethod,
    paymentNumber: restaurants.paymentNumber,
    tableCount: restaurants.tableCount,
    installationFee: restaurants.installationFee,
    monthlyFee: restaurants.monthlyFee,
    installationPaid: restaurants.installationPaid,
    monthlyPaid: restaurants.monthlyPaid,
    autoSuspendIfUnpaid: restaurants.autoSuspendIfUnpaid,
  }).from(restaurants).where(eq(restaurants.slug, slug)).limit(1))[0];
  if (!restaurant) return Response.json({ error: "Restaurant not found" }, { status: 404 });
  if (!isRestaurantOperating(restaurant) && !(await isRestaurantAdminSession(restaurant.id))) {
    return Response.json({ error: "This restaurant is temporarily unavailable", code: "RESTAURANT_SUSPENDED" }, { status: 403 });
  }
  return Response.json({
    restaurant: {
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      logo: restaurant.logo,
      phone: restaurant.phone,
      email: restaurant.email,
      address: restaurant.address,
      mapsUrl: restaurant.mapsUrl,
      welcomeMessage: restaurant.welcomeMessage,
      famousDish: restaurant.famousDish,
      photos: restaurant.photos,
      paymentMethod: restaurant.paymentMethod,
      paymentNumber: restaurant.paymentNumber,
      tableCount: restaurant.tableCount,
    },
  });
}
