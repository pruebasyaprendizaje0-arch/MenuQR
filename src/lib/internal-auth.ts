import crypto from "crypto";
import { NextRequest } from "next/server";

/**
 * Valida de forma estricta y en tiempo constante (anti-timing attack)
 * si la petición incluye la clave secreta interna para n8n / VPS.
 */
export function verifyInternalApiKey(req: NextRequest | Request): boolean {
  const secretKey = process.env.INTERNAL_API_KEY;
  if (!secretKey || secretKey.trim().length === 0) {
    console.error("[CRITICAL AUTH] INTERNAL_API_KEY no está configurada en las variables de entorno del servidor.");
    return false;
  }

  const headerKey = req.headers.get("x-internal-api-key") || req.headers.get("authorization");
  if (!headerKey) {
    return false;
  }

  const rawKey = headerKey.startsWith("Bearer ")
    ? headerKey.slice(7).trim()
    : headerKey.trim();

  try {
    const keyBuffer = Buffer.from(rawKey);
    const secretBuffer = Buffer.from(secretKey);

    if (keyBuffer.length !== secretBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(keyBuffer, secretBuffer);
  } catch {
    return false;
  }
}
