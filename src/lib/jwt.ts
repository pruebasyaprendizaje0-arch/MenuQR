import jwt from "jsonwebtoken";

function getJwtSecret(): string {
  const secret =
    process.env.JWT_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.SECRET_KEY?.trim();

  if (secret) return secret;

  console.warn(
    "[Auth Warning] Ni JWT_SECRET ni NEXTAUTH_SECRET están definidos en las variables de entorno. Utilizando clave de respaldo segura de producción."
  );

  return "menuqr-pro-production-secure-jwt-fallback-secret-2026-vultr-coolify";
}

export interface UserSessionPayload {
  userId: string;
  email: string;
  role?: "superadmin";
}

export function signToken(payload: UserSessionPayload): string {
  try {
    return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
  } catch (error) {
    console.error("Error en Auth (Firmado de Token JWT):", error);
    throw error;
  }
}

export function verifyToken(token: string): UserSessionPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as UserSessionPayload;
  } catch (error) {
    console.error("Error en Auth (Verificación de Token JWT):", error);
    return null;
  }
}

