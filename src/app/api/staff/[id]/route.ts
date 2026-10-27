import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { staffMembers } from "@/lib/schema";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const { id } = await params;
  const rows = await db.select().from(staffMembers).where(eq(staffMembers.id, id)).limit(1);
  if (!rows[0]) return Response.json({ error: "Staff member not found" }, { status: 404 });
  return Response.json({ staff: rows[0] });
}
