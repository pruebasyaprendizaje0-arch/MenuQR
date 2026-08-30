import { cookies } from "next/headers";
import { verifyToken, signToken } from "./jwt";

// User session (SaaS Multi-tenant)
export async function getUserSession() {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function setUserSession(userId: string, email: string) {
  const token = signToken({ userId, email });
  const cookieStore = cookies();
  cookieStore.set("session_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export async function clearUserSession() {
  const cookieStore = cookies();
  cookieStore.delete("session_token");
}

// Re-issue the session cookie from the current valid token.
// Only callable inside Server Actions / Route Handlers (never in Server Component render).
export async function refreshUserSession() {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return;
  const payload = verifyToken(token);
  if (!payload) return;
  const freshToken = signToken({ userId: payload.userId, email: payload.email });
  cookieStore.set("session_token", freshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

// Super Admin Session
export async function getSuperAdminSession() {
  const cookieStore = cookies();
  const session = cookieStore.get("super_admin_session");
  return session?.value === "authenticated";
}

export async function setSuperAdminSession() {
  const cookieStore = cookies();
  cookieStore.set("super_admin_session", "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24, // 1 day
    path: "/",
  });
}

export async function clearSuperAdminSession() {
  const cookieStore = cookies();
  cookieStore.delete("super_admin_session");
}
