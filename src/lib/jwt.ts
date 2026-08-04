import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "menuqr-pro-fallback-secret-key-999";

export interface UserSessionPayload {
  userId: string;
  email: string;
}

export function signToken(payload: UserSessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): UserSessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserSessionPayload;
  } catch {
    return null;
  }
}
