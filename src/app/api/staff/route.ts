import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { staffMembers } from "@/lib/schema";
import { getAuthenticatedSession } from "@/lib/session-access";

const publicStaffFields = {
  id: staffMembers.id,
  restaurantId: staffMembers.restaurantId,
  staffCode: staffMembers.staffCode,
  name: staffMembers.name,
  role: staffMembers.role,
  passportPhoto: staffMembers.passportPhoto,
  phone: staffMembers.phone,
  email: staffMembers.email,
  salary: staffMembers.salary,
  salaryPayments: staffMembers.salaryPayments,
  ordersTaken: staffMembers.ordersTaken,
  revenueGenerated: staffMembers.revenueGenerated,
};

export async function GET(request: NextRequest) {
  if (!db) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const session = await getAuthenticatedSession();
  if (session?.role !== "admin" || typeof session.restaurantId !== "string") {
    return Response.json({ error: "Restaurant admin sign-in required" }, { status: 401 });
  }

  const restaurantId = session.restaurantId;
  const requestedRestaurantId = request.nextUrl.searchParams.get("restaurantId");
  if (requestedRestaurantId && requestedRestaurantId !== restaurantId) {
    return Response.json({ error: "You cannot access another restaurant's staff" }, { status: 403 });
  }

  const rows = await db.select(publicStaffFields).from(staffMembers).where(eq(staffMembers.restaurantId, restaurantId)).limit(200);
  return Response.json({ staff: rows });
}

export async function POST(request: NextRequest) {
  if (!db) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const session = await getAuthenticatedSession();
  if (session?.role !== "admin" || typeof session.restaurantId !== "string") {
    return Response.json({ error: "Restaurant admin sign-in required" }, { status: 401 });
  }

  const payload: unknown = await request.json();
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return Response.json({ error: "Staff details are required" }, { status: 400 });
  }

  const restaurantId = session.restaurantId;
  if ("restaurantId" in payload && typeof payload.restaurantId === "string" && payload.restaurantId !== restaurantId) {
    return Response.json({ error: "You cannot add staff to another restaurant" }, { status: 403 });
  }
  const name = "name" in payload && typeof payload.name === "string" ? payload.name.trim() : "";
  const role = "role" in payload && typeof payload.role === "string" ? payload.role.trim() : "Waiter";
  const password = "password" in payload && typeof payload.password === "string" ? payload.password.trim() : "";
  const passportPhoto = "passportPhoto" in payload && typeof payload.passportPhoto === "string" ? payload.passportPhoto : "";
  const phone = "phone" in payload && typeof payload.phone === "string" ? payload.phone.trim() : "";
  const email = "email" in payload && typeof payload.email === "string" ? payload.email.trim() : "";
  const salary = "salary" in payload ? payload.salary : null;
  const salaryPayments = "salaryPayments" in payload ? payload.salaryPayments : {};

  if (!name || !password || password.length < 8 || !role
    || (salary !== null && (typeof salary !== "number" || !Number.isFinite(salary) || salary < 0))
    || typeof salaryPayments !== "object" || salaryPayments === null || Array.isArray(salaryPayments)
    || Object.values(salaryPayments).some((status) => status !== "Paid" && status !== "Pending")) {
    return Response.json({ error: "Enter a name, role, password of at least 8 characters, valid salary, and payment history" }, { status: 400 });
  }

  const passwordHash = await hash(password, 12);
  const staffCode = `ST-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  const created = await db.insert(staffMembers).values({
    restaurantId,
    staffCode,
    name,
    role,
    passportPhoto,
    phone,
    email,
    passwordHash,
    salary,
    salaryPayments,
    ordersTaken: 0,
    revenueGenerated: 0,
  }).returning(publicStaffFields);

  return Response.json({ staff: created[0] }, { status: 201 });
}
