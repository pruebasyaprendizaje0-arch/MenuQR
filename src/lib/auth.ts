import { cookies } from "next/headers";
import { verifyToken, signToken } from "./jwt";

function logAuthError(context: string, error: any) {
  if (error?.message?.includes("request scope") || error?.message?.includes("cookies")) {
    return;
  }
  console.error(`Error en Auth (${context}):`, error);
}

// User session (SaaS Multi-tenant)
export async function getUserSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch (error) {
    logAuthError("getUserSession", error);
    return null;
  }
}

export async function setUserSession(userId: string, email: string) {
  try {
    const token = signToken({ userId, email });
    const cookieStore = await cookies();
    cookieStore.set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });
  } catch (error) {
    logAuthError("setUserSession", error);
    throw error;
  }
}

export async function clearUserSession() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("session_token");
  } catch (error) {
    logAuthError("clearUserSession", error);
  }
}

// Re-issue the session cookie from the current valid token.
// Only callable inside Server Actions / Route Handlers (never in Server Component render).
export async function refreshUserSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    if (!token) return;
    const payload = verifyToken(token);
    if (!payload) return;
    const freshToken = signToken({ userId: payload.userId, email: payload.email });
    cookieStore.set("session_token", freshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });
  } catch (error) {
    logAuthError("refreshUserSession", error);
  }
}

// Super Admin Session
export async function getSuperAdminSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("super_admin_session")?.value;
    return Boolean(token && verifyToken(token)?.role === "superadmin");
  } catch (error) {
    logAuthError("getSuperAdminSession", error);
    return false;
  }
}

export async function setSuperAdminSession() {
  try {
    const token = signToken({ userId: "superadmin", email: "superadmin@local", role: "superadmin" });
    const cookieStore = await cookies();
    cookieStore.set("super_admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 1 day
      path: "/",
    });
  } catch (error) {
    logAuthError("setSuperAdminSession", error);
    throw error;
  }
}

export async function clearSuperAdminSession() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("super_admin_session");
  } catch (error) {
    logAuthError("clearSuperAdminSession", error);
  }
}

