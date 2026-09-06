import jwt from "jsonwebtoken";

function getJwtSecret(): string {
  const secret =
    process.env.JWT_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.SECRET_KEY?.trim();

  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    console.error("[CRITICAL AUTH ERROR] La variable JWT_SECRET es obligatoria en entorno de producción.");
    throw new Error("JWT_SECRET no definida. Por favor agrégala en el panel de Coolify.");
  }

  console.warn(
    "[Auth Warning] JWT_SECRET no está definida. Utilizando clave de respaldo únicamente para desarrollo local."
  );

  return "menuqr-pro-dev-fallback-secret-key-local-only";
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

