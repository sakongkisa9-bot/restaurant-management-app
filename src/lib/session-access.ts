import { getSessionToken, verifySession } from "./auth";

export async function getAuthenticatedSession() {
  const token = await getSessionToken();
  if (!token) return null;

  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

export async function isDeveloperSession() {
  const session = await getAuthenticatedSession();
  return session?.role === "developer";
}

export async function isRestaurantAdminSession(restaurantId: string) {
  const session = await getAuthenticatedSession();
  return session?.role === "admin" && session.restaurantId === restaurantId;
}

