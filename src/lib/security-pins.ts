import bcrypt from "bcryptjs";

// Lista negra estricta de PINs predeterminados, triviales o inseguros
export const BLACKLISTED_PINS = new Set([
  "1234",
  "0000",
  "1111",
  "2222",
  "3333",
  "4444",
  "5555",
  "6666",
  "7777",
  "8888",
  "9999",
  "5678",
  "4321",
  "123456",
  "000000",
  "111111",
  "654321",
]);

/**
 * Valida si un PIN cumple con el formato numérico de 4 a 8 dígitos y no es un valor predeterminado/inseguro.
 */
export function validatePinFormat(pin: unknown): { valid: boolean; error?: string; cleanPin?: string } {
  if (typeof pin !== "string" && typeof pin !== "number") {
    return { valid: false, error: "El PIN debe ser una cadena de números." };
  }
  const cleanPin = String(pin).trim();
  if (cleanPin.length < 4 || cleanPin.length > 8 || !/^\d+$/.test(cleanPin)) {
    return { valid: false, error: "El PIN debe ser numérico de 4 a 8 dígitos." };
  }
  if (BLACKLISTED_PINS.has(cleanPin)) {
    return {
      valid: false,
      error: "El PIN ingresado es un valor predeterminado o inseguro (ej. 1234, 0000). Por favor asigna un PIN personalizado.",
    };
  }
  return { valid: true, cleanPin };
}

/**
 * Determina si una cadena ya es un hash bcrypt válido.
 */
export function isHashedPin(val: unknown): boolean {
  if (typeof val !== "string") return false;
  const trimmed = val.trim();
  return (trimmed.startsWith("$2a$") || trimmed.startsWith("$2b$")) && trimmed.length >= 59;
}

/**
 * Genera el hash seguro bcrypt de un PIN numérico.
 */
export function hashPin(pin: string): string {
  const clean = pin.trim();
  return bcrypt.hashSync(clean, 10);
}

/**
 * Compara un PIN en texto plano contra el hash almacenado mediante tiempo seguro.
 */
export function verifyPinHash(plainPin: string, storedHash: string): boolean {
  if (!plainPin || !storedHash) return false;
  const cleanPin = String(plainPin).trim();
  const cleanHash = String(storedHash).trim();
  if (!isHashedPin(cleanHash)) {
    // Si no está hasheado, nunca validar contra texto plano (prohibido)
    return false;
  }
  try {
    return bcrypt.compareSync(cleanPin, cleanHash);
  } catch (err) {
    console.error("[verifyPinHash] Error comparando bcrypt:", err);
    return false;
  }
}
