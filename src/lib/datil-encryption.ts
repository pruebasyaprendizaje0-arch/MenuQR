import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Obtiene una clave de 32 bytes segura derivada de las variables de entorno.
 */
function getMasterKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_SECRET ||
    process.env.JWT_SECRET ||
    "menuqr-pro-electronic-billing-datil-sri-master-secret-2026";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Cifra la contraseña de API de Dátil (X-Password) con AES-256-GCM.
 * Devuelve un string en formato "iv:authTag:encryptedPayload" en Base64.
 */
export function encryptDatilPassword(plainPassword: string): string {
  if (!plainPassword || plainPassword.trim().length === 0) {
    return "";
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getMasterKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plainPassword.trim(), "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

/**
 * Descifra la contraseña de API de Dátil previamente cifrada con AES-256-GCM.
 * Solo debe ser invocada en el servidor al momento de conectar con la API de Dátil.
 */
export function decryptDatilPassword(encryptedPassword: string): string {
  if (!encryptedPassword || !encryptedPassword.includes(":")) {
    return "";
  }

  try {
    const parts = encryptedPassword.split(":");
    if (parts.length !== 3) {
      throw new Error("Formato de token cifrado inválido.");
    }

    const iv = Buffer.from(parts[0], "base64");
    const authTag = Buffer.from(parts[1], "base64");
    const encryptedText = Buffer.from(parts[2], "base64");

    const decipher = crypto.createDecipheriv(ALGORITHM, getMasterKey(), iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encryptedText),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    console.error("Error descifrando credencial de Dátil:", error);
    return "";
  }
}

/**
 * Genera una máscara segura para renderizar en el cliente sin exponer la contraseña real.
 */
export function maskDatilPassword(hasPassword: boolean): string {
  return hasPassword ? "••••••••••••••••" : "";
}
