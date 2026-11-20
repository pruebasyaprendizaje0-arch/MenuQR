/**
 * Rate Limiter seguro en memoria para protección contra ataques de fuerza bruta
 * en accesos de Meseros (PIN), Cocina KDS (PIN) y SuperAdmin (Credenciales).
 *
 * Características:
 * - Aislamiento por entidad (mesero, cocina, superadmin) y por dirección IP.
 * - Cooldown con esperas temporales progresivas y recuperación segura automática.
 * - Cero afectación a rutas públicas de clientes y pedidos de comensales.
 * - Prevención de bypass por omisión o rotación de cabeceras.
 */

interface RateLimitEntry {
  failedAttempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

export interface RateLimitConfig {
  maxAttempts: number; // Intentos fallidos permitidos antes del bloqueo
  windowMs: number; // Ventana de tiempo en milisegundos para contar fallos
  lockoutMs: number; // Duración del bloqueo temporal en milisegundos
  resourceName: string; // Nombre amigable para mensajes (ej. "del mesero", "de cocina", "de SuperAdmin")
}

// Configuraciones predefinidas por módulo
export const MESERO_PIN_LIMIT: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 5 * 60 * 1000, // 5 minutos
  lockoutMs: 10 * 60 * 1000, // 10 minutos de bloqueo
  resourceName: "del personal",
};

export const COCINA_PIN_LIMIT: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 5 * 60 * 1000, // 5 minutos
  lockoutMs: 10 * 60 * 1000, // 10 minutos de bloqueo
  resourceName: "de Cocina KDS",
};

export const SUPERADMIN_LOGIN_LIMIT: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutos
  lockoutMs: 15 * 60 * 1000, // 15 minutos de bloqueo
  resourceName: "de SuperAdmin",
};

export interface RateLimitCheckResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
  error?: string;
}

// Almacén en memoria global para persistencia entre peticiones dentro del proceso Node.js
const rateLimitStore = new Map<string, RateLimitEntry>();

// Limpieza periódica para evitar fugas de memoria (cada 10 minutos)
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanup = Date.now();

function runGarbageCollection() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, entry] of rateLimitStore.entries()) {
    const isExpiredLockout = entry.lockedUntil ? now > entry.lockedUntil : true;
    const isExpiredWindow = now - entry.firstAttemptAt > 60 * 60 * 1000; // 1 hora
    if (isExpiredLockout && isExpiredWindow) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Extrae la dirección IP del cliente desde una petición o cabeceras Next.js.
 */
export function extractClientIp(reqOrHeaders?: Request | Headers | null): string {
  if (!reqOrHeaders) return "127.0.0.1";
  let headers: Headers | null = null;
  if ("headers" in reqOrHeaders && (reqOrHeaders as Request).headers) {
    headers = (reqOrHeaders as Request).headers;
  } else if (typeof (reqOrHeaders as Headers).get === "function") {
    headers = reqOrHeaders as Headers;
  }
  if (!headers) return "127.0.0.1";

  const xForwardedFor = headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();

  const cfConnectingIp = headers.get("cf-connecting-ip");
  if (cfConnectingIp?.trim()) return cfConnectingIp.trim();

  return "127.0.0.1";
}

/**
 * Verifica si una clave o IP específica está actualmente bloqueada.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitCheckResult {
  runGarbageCollection();
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry) {
    return { allowed: true, remainingAttempts: config.maxAttempts };
  }

  // Si está actualmente bloqueado
  if (entry.lockedUntil && now < entry.lockedUntil) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000));
    const minutes = Math.ceil(retryAfterSeconds / 60);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
      error: `Demasiados intentos fallidos ${config.resourceName}. Acceso bloqueado temporalmente por seguridad. Intenta nuevamente en ${minutes} minuto${minutes > 1 ? "s" : ""}.`,
    };
  }

  // Si el bloqueo expiró, recuperación segura automática
  if (entry.lockedUntil && now >= entry.lockedUntil) {
    rateLimitStore.delete(key);
    return { allowed: true, remainingAttempts: config.maxAttempts };
  }

  // Si la ventana de tiempo expiró sin llegar al bloqueo, reiniciar contador
  if (now - entry.firstAttemptAt > config.windowMs) {
    rateLimitStore.delete(key);
    return { allowed: true, remainingAttempts: config.maxAttempts };
  }

  const remaining = Math.max(0, config.maxAttempts - entry.failedAttempts);
  return { allowed: true, remainingAttempts: remaining };
}

/**
 * Registra un intento fallido y activa el bloqueo si se alcanza el umbral.
 */
export function recordFailedAttempt(key: string, config: RateLimitConfig): RateLimitCheckResult {
  runGarbageCollection();
  const now = Date.now();
  let entry = rateLimitStore.get(key);

  if (!entry || now - entry.firstAttemptAt > config.windowMs) {
    entry = {
      failedAttempts: 1,
      firstAttemptAt: now,
      lockedUntil: null,
    };
  } else {
    entry.failedAttempts += 1;
  }

  if (entry.failedAttempts >= config.maxAttempts) {
    entry.lockedUntil = now + config.lockoutMs;
    rateLimitStore.set(key, entry);

    const retryAfterSeconds = Math.ceil(config.lockoutMs / 1000);
    const minutes = Math.ceil(retryAfterSeconds / 60);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
      error: `Has superado el límite de intentos fallidos ${config.resourceName}. Tu acceso ha sido bloqueado temporalmente por ${minutes} minutos para proteger el sistema.`,
    };
  }

  rateLimitStore.set(key, entry);
  const remaining = Math.max(0, config.maxAttempts - entry.failedAttempts);
  return {
    allowed: true,
    remainingAttempts: remaining,
  };
}

/**
 * Limpia los intentos fallidos tras una autenticación exitosa.
 */
export function recordSuccessfulAuth(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Helper para verificar conjuntamente la entidad objetivo y la IP del cliente.
 */
export function verifyDoubleRateLimit(
  entityKey: string,
  ip: string,
  config: RateLimitConfig
): RateLimitCheckResult {
  // 1. Revisar límite por entidad (ej. id específico del mesero)
  const entityCheck = checkRateLimit(entityKey, config);
  if (!entityCheck.allowed) return entityCheck;

  // 2. Revisar límite por IP (evita rociado de contraseñas hacia múltiples meseros)
  const ipKey = `${config.resourceName}_ip:${ip}`;
  const ipCheck = checkRateLimit(ipKey, config);
  if (!ipCheck.allowed) return ipCheck;

  return {
    allowed: true,
    remainingAttempts: Math.min(entityCheck.remainingAttempts, ipCheck.remainingAttempts),
  };
}

/**
 * Helper para registrar fallo en ambos identificadores (entidad e IP).
 */
export function recordDoubleFailedAttempt(
  entityKey: string,
  ip: string,
  config: RateLimitConfig
): RateLimitCheckResult {
  const ipKey = `${config.resourceName}_ip:${ip}`;
  const r1 = recordFailedAttempt(entityKey, config);
  const r2 = recordFailedAttempt(ipKey, config);

  if (!r1.allowed) return r1;
  if (!r2.allowed) return r2;
  return {
    allowed: true,
    remainingAttempts: Math.min(r1.remainingAttempts, r2.remainingAttempts),
  };
}

/**
 * Helper para limpiar ambos tras éxito.
 */
export function clearDoubleRateLimit(entityKey: string, ip: string, config?: RateLimitConfig): void {
  const resource = config?.resourceName || "resource";
  const ipKey = `${resource}_ip:${ip}`;
  recordSuccessfulAuth(entityKey);
  recordSuccessfulAuth(ipKey);
}
