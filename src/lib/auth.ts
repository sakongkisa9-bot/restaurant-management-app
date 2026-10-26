import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secret = process.env.AUTH_SECRET ?? "development-secret-change-me";
const key = new TextEncoder().encode(secret);

export async function signSession(payload: Record<string, unknown>) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(key);
}

export async function verifySession(token: string) {
  const { payload } = await jwtVerify(token, key);
  return payload;
}

export async function getSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get("room_session")?.value ?? null;
}

export async function setSessionToken(token: string) {
  const cookieStore = await cookies();
  cookieStore.set("room_session", token, {
    httpOnly: true,
    secure: process.env.APP_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionToken() {
  const cookieStore = await cookies();
  cookieStore.delete("room_session");
}
