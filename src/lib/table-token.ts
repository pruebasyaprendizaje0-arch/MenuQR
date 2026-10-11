/**
 * Table Cryptographic Security & URL Management
 * Genera y valida tokens criptográficos anti-manipulación para códigos QR de mesa.
 * Implementación pura en TypeScript compatible con Client Components y Node.js.
 */

// Implementación SHA-256 pura en TypeScript (RFC 6234 / FIPS 180-4)
// Sin dependencias externas para garantizar sincronía total en cliente y servidor.
function sha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = "";

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isPrime = (n: number) => {
    for (let factor = 2; factor * factor <= n; factor++) {
      if (n % factor === 0) return false;
    }
    return true;
  };

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (isPrime(candidate)) {
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 1 / 2) * maxWord) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (let i = 0; i < ascii.length; i++) {
    words[i >> 2] |= ascii.charCodeAt(i) << ((3 - (i % 4)) * 8);
  }

  for (let j = 0; j < words.length; j += 16) {
    const w = words.slice(j, j + 16);
    const oldHash = [...hash];

    for (let i = 0; i < 64; i++) {
      if (i >= 16) {
        const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (((w[i - 16] + s0) | 0) + ((w[i - 7] + s1) | 0)) | 0;
      }

      const s1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (((((hash[7] + s1) | 0) + ch) | 0) + ((k[i] + w[i]) | 0)) | 0;
      const s0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0 + maj) | 0;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? "0" : "") + b.toString(16);
    }
  }

  return result;
}

const DEFAULT_SALT = "menuqr_pro_salt_2026";

/**
 * Normaliza el identificador de mesa para comparación consistente
 */
export function normalizeTableName(table: string): string {
  return String(table || "").trim().toLowerCase();
}

/**
 * Genera un token criptográfico anti-manipulación para una mesa de un restaurante específico.
 * Utiliza 10 caracteres hexadecimales (40 bits de entropía).
 */
export function generateTableToken(
  restaurantId: string,
  tableName: string,
  secret: string = DEFAULT_SALT
): string {
  if (!restaurantId || !tableName) return "";
  const normalized = normalizeTableName(tableName);
  const payload = `table_auth:${restaurantId}:${normalized}:${secret}`;
  return sha256(payload).slice(0, 10);
}

/**
 * Valida si un token proporcionado coincide con la mesa y el restaurante.
 */
export function verifyTableToken(
  restaurantId: string,
  tableName: string,
  token: string | null | undefined,
  secret: string = DEFAULT_SALT
): boolean {
  if (!restaurantId || !tableName || !token) return false;
  const expected = generateTableToken(restaurantId, tableName, secret);
  return token.trim().toLowerCase() === expected.toLowerCase();
}

/**
 * Genera la URL completa y segura para el código QR de una mesa.
 */
export function buildTableQrUrl(
  baseUrl: string,
  slug: string,
  tableName: string,
  restaurantId: string
): string {
  const cleanBase = (baseUrl || "").replace(/\/+$/, "");
  const token = generateTableToken(restaurantId, tableName);
  const encodedTable = encodeURIComponent(tableName.trim());
  return `${cleanBase}/${slug}?mesa=${encodedTable}&auth=${token}`;
}

/**
 * Parsea los parámetros de mesa desde URL y verifica su autenticidad.
 */
export function parseTableFromUrl(
  urlParams: URLSearchParams,
  restaurantId: string
): { tableName: string | null; isVerified: boolean; rawToken: string | null } {
  const mesa = urlParams.get("mesa") || urlParams.get("table");
  const token = urlParams.get("auth") || urlParams.get("token") || urlParams.get("t");

  if (!mesa) {
    return { tableName: null, isVerified: false, rawToken: null };
  }

  const isVerified = Boolean(token && verifyTableToken(restaurantId, mesa, token));

  return {
    tableName: mesa.trim(),
    isVerified,
    rawToken: token || null,
  };
}
