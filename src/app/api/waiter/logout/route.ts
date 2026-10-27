import { clearSessionToken } from "@/lib/auth";

export async function POST() {
  await clearSessionToken();
  return Response.json({ ok: true });
}
