import { RuletaPremioItem, DEFAULT_RULETA_PREMIOS } from "./ruleta-types";

export * from "./ruleta-types";

/**
 * Normaliza teléfonos de Ecuador/Internacionales para evitar duplicados por formato.
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("09") && cleaned.length === 10) {
    cleaned = "593" + cleaned.substring(1);
  } else if (cleaned.length === 9 && cleaned.startsWith("9")) {
    cleaned = "593" + cleaned;
  }
  return cleaned;
}

/**
 * Generador de código de cupón único y legible
 */
export function generateUniqueCouponCode(prefix: string = "QR", restaurantSlug: string = ""): string {
  const cleanPrefix = (prefix || restaurantSlug.slice(0, 4) || "GIFT")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let randomPart = "";
  for (let i = 0; i < 4; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${cleanPrefix}-${randomPart}`;
}

/**
 * Algoritmo de probabilidad ponderada en Backend
 */
export function selectWeightedPrize(premios: RuletaPremioItem[]): { premio: RuletaPremioItem; sectorIndex: number } {
  const safePremios = Array.isArray(premios) && premios.length > 0 ? premios : DEFAULT_RULETA_PREMIOS;
  const totalWeight = safePremios.reduce((sum, p) => sum + (Number(p.probabilidad) || 0), 0);
  
  if (totalWeight <= 0) {
    return { premio: safePremios[0], sectorIndex: 0 };
  }

  let random = Math.random() * totalWeight;
  for (let i = 0; i < safePremios.length; i++) {
    const p = safePremios[i];
    random -= (Number(p.probabilidad) || 0);
    if (random <= 0) {
      return { premio: p, sectorIndex: i };
    }
  }

  return { premio: safePremios[safePremios.length - 1], sectorIndex: safePremios.length - 1 };
}
