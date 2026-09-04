import jwt from "jsonwebtoken";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) return secret;

  // A predictable fallback would let an attacker forge production sessions.
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET debe configurarse en producción.");
  }

  return "menuqr-local-development-only";
}

export interface UserSessionPayload {
  userId: string;
  email: string;
  role?: "superadmin";
}

export function signToken(payload: UserSessionPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): UserSessionPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as UserSessionPayload;
  } catch {
    return null;
  }
}
