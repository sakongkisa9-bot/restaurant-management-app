export async function GET() {
  return Response.json({ ok: true, app: "restaurant-management", env: process.env.APP_ENV ?? "development" });
}
