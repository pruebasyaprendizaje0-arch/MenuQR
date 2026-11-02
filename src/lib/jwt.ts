import jwt from "jsonwebtoken";

const INSECURE_DEFAULT_SECRETS = new Set([
  "secret",
  "123456",
  "password",
  "menuqr-pro-super-secret-key-12345",
  "menuqr-pro-dev-fallback-secret-key-local-only",
]);

function getJwtSecret(): string {
  const secret =
    process.env.JWT_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.SECRET_KEY?.trim();

  // En producción es estrictamente obligatorio definir JWT_SECRET y que cumpla longitud y entropía
  if (process.env.NODE_ENV === "production") {
    if (!secret) {
      console.error("[CRITICAL AUTH ERROR] La variable JWT_SECRET es obligatoria en entorno de producción.");
      throw new Error("JWT_SECRET no definida. Por favor configúrala en el panel de Coolify.");
    }
    if (INSECURE_DEFAULT_SECRETS.has(secret) || secret.length < 32) {
      console.error("[CRITICAL AUTH ERROR] JWT_SECRET es insegura, demasiado corta o utiliza un valor de ejemplo.");
      throw new Error("JWT_SECRET insegura detectada. Debe tener al menos 32 caracteres y ser generada aleatoriamente.");
    }
    return secret;
  }

  if (secret) {
    if (INSECURE_DEFAULT_SECRETS.has(secret)) {
      console.warn("[Auth Warning] JWT_SECRET utiliza un valor de ejemplo. Se recomienda rotarla antes de desplegar a producción.");
    }
    return secret;
  }

  // Fallback controlado exclusivo para tests locales
  return "menuqr-pro-dev-temporary-secret-key-min-32-chars-long";
}

export interface UserSessionPayload {
  userId: string;
  email: string;
  role?: "superadmin";
  restaurantId?: string;
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
