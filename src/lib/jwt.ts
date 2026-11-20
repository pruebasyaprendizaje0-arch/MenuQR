import jwt from "jsonwebtoken";

const INSECURE_DEFAULT_SECRETS = new Set([
  "secret",
  "123456",
  "password",
  "menuqr-pro-super-secret-key-12345",
  "menuqr-pro-dev-fallback-secret-key-local-only",
]);

let hasWarnedInsecureSecret = false;

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
      if (!hasWarnedInsecureSecret) {
        console.warn("[Auth Warning] JWT_SECRET utiliza un valor de ejemplo. Se recomienda rotarla antes de desplegar a producción.");
        hasWarnedInsecureSecret = true;
      }
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

export interface KdsDispatchTokenPayload {
  orderId: string;
  restaurantId: string;
  total: number;
  orderNumber: number;
  purpose: "kds_dispatch";
}

export function signKdsDispatchToken(payload: KdsDispatchTokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "5m" });
}

export function verifyKdsDispatchToken(token: string): KdsDispatchTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as KdsDispatchTokenPayload;
    if (decoded && decoded.purpose === "kds_dispatch") {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

export type StaffRole = "COCINA" | "MESERO" | "CAJERO" | "ADMIN" | "SUPERADMIN";

export interface StaffSessionPayload {
  role: StaffRole;
  negocioId: string;
  staffId?: string;
  staffNombre?: string;
  purpose: "staff_session";
}

export function signStaffToken(payload: Omit<StaffSessionPayload, "purpose">): string {
  return jwt.sign({ ...payload, purpose: "staff_session" }, getJwtSecret(), { expiresIn: "24h" });
}

export function verifyStaffToken(token: string): StaffSessionPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as StaffSessionPayload;
    if (decoded && decoded.purpose === "staff_session") {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

export interface TableSessionPayload {
  purpose: "table_session";
  negocioId: string;
  mesa: string;
  orderId?: string;
  customerName?: string;
  createdAt: number;
}

export function signTableSessionToken(payload: Omit<TableSessionPayload, "purpose">): string {
  return jwt.sign({ ...payload, purpose: "table_session" }, getJwtSecret(), { expiresIn: "12h" });
}

export function verifyTableSessionToken(token: string): TableSessionPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as TableSessionPayload;
    if (decoded && decoded.purpose === "table_session") {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}



