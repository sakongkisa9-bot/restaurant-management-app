import { NextRequest } from "next/server";
import { setSessionToken, signSession } from "@/lib/auth";

const DEVELOPER_PASSWORD = "16592@FREE man";

export async function POST(request: NextRequest) {
  const payload: unknown = await request.json();
  if (typeof payload !== "object" || payload === null || !("password" in payload) || typeof payload.password !== "string") {
    return Response.json({ error: "Developer password is required" }, { status: 400 });
  }

  if (payload.password !== DEVELOPER_PASSWORD) {
    return Response.json({ error: "Incorrect developer password" }, { status: 401 });
  }

  const token = await signSession({ role: "developer" });
  await setSessionToken(token);
  return Response.json({ ok: true });
}
