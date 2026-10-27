import { and, eq } from "drizzle-orm";
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

async function getAuthorizedRestaurantId() {
  const session = await getAuthenticatedSession();
  return session?.role === "admin" && typeof session.restaurantId === "string"
    ? session.restaurantId
    : null;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  const restaurantId = await getAuthorizedRestaurantId();
  if (!restaurantId) return Response.json({ error: "Restaurant admin sign-in required" }, { status: 401 });

  const { id } = await params;
  const staff = (await db.select(publicStaffFields)
    .from(staffMembers)
    .where(and(eq(staffMembers.id, id), eq(staffMembers.restaurantId, restaurantId)))
    .limit(1))[0];
  if (!staff) return Response.json({ error: "Staff member not found" }, { status: 404 });
  return Response.json({ staff });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  const restaurantId = await getAuthorizedRestaurantId();
  if (!restaurantId) return Response.json({ error: "Restaurant admin sign-in required" }, { status: 401 });

  const { id } = await params;
  const payload: unknown = await request.json();
  if (typeof payload !== "object" || payload === null) {
    return Response.json({ error: "Staff details are required" }, { status: 400 });
  }

  const name = "name" in payload && typeof payload.name === "string" ? payload.name.trim() : "";
  const role = "role" in payload && typeof payload.role === "string" ? payload.role.trim() : "";
  const phone = "phone" in payload && typeof payload.phone === "string" ? payload.phone : "";
  const email = "email" in payload && typeof payload.email === "string" ? payload.email : "";
  const passportPhoto = "passportPhoto" in payload && typeof payload.passportPhoto === "string" ? payload.passportPhoto : "";
  const salary = "salary" in payload ? payload.salary : null;
  const salaryPayments = "salaryPayments" in payload ? payload.salaryPayments : {};
  const password = "password" in payload && typeof payload.password === "string" ? payload.password.trim() : "";

  if (!name || !role || (salary !== null && (typeof salary !== "number" || !Number.isFinite(salary) || salary < 0))
    || typeof salaryPayments !== "object" || salaryPayments === null || Array.isArray(salaryPayments)
    || Object.values(salaryPayments).some((status) => status !== "Paid" && status !== "Pending")) {
    return Response.json({ error: "Enter a name, role, valid salary, and payment history" }, { status: 400 });
  }
  if (password && password.length < 8) {
    return Response.json({ error: "Staff passwords must be at least 8 characters" }, { status: 400 });
  }

  const updated = await db.update(staffMembers).set({
    name,
    role,
    phone,
    email,
    passportPhoto,
    salary,
    salaryPayments,
    ...(password ? { passwordHash: await hash(password, 12) } : {}),
    updatedAt: new Date(),
  }).where(and(eq(staffMembers.id, id), eq(staffMembers.restaurantId, restaurantId))).returning(publicStaffFields);

  if (!updated[0]) return Response.json({ error: "Staff member not found" }, { status: 404 });
  return Response.json({ staff: updated[0] });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  const restaurantId = await getAuthorizedRestaurantId();
  if (!restaurantId) return Response.json({ error: "Restaurant admin sign-in required" }, { status: 401 });

  const { id } = await params;
  const deleted = await db.delete(staffMembers)
    .where(and(eq(staffMembers.id, id), eq(staffMembers.restaurantId, restaurantId)))
    .returning({ id: staffMembers.id });
  if (!deleted[0]) return Response.json({ error: "Staff member not found" }, { status: 404 });
  return Response.json({ ok: true });
}
