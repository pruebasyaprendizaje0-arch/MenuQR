/**
 * Utility functions for handling multi-image galleries in Dish / Product models.
 * Backwards compatible with single string URLs and supports up to 3 image URLs
 * (e.g. Frente / Principal, Reverso / Espalda, Detalle / Ángulo).
 */

export function parseDishImages(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // 1. JSON array format: ["url1", "url2", "url3"]
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(
            (item) =>
              Boolean(item) &&
              (item.startsWith("http://") ||
                item.startsWith("https://") ||
                item.startsWith("/uploads/") ||
                item.startsWith("uploads/"))
          )
          .slice(0, 3);
      }
    } catch {
      // Fallback if not valid JSON
    }
  }

  // 2. Legacy / fallback comma-separated format
  if (trimmed.includes(",")) {
    const parts = trimmed
      .split(",")
      .map((p) => p.trim())
      .filter(
        (p) =>
          Boolean(p) &&
          (p.startsWith("http://") ||
            p.startsWith("https://") ||
            p.startsWith("/uploads/") ||
            p.startsWith("uploads/"))
      );
    if (parts.length > 0) {
      return parts.slice(0, 3);
    }
  }

  // 3. Single standard URL string
  return [trimmed];
}

export function getPrimaryDishImage(raw: string | null | undefined): string | null {
  const images = parseDishImages(raw);
  return images.length > 0 ? images[0] : null;
}

export function getSecondaryDishImage(raw: string | null | undefined): string | null {
  const images = parseDishImages(raw);
  return images.length > 1 ? images[1] : null;
}

export function getTertiaryDishImage(raw: string | null | undefined): string | null {
  const images = parseDishImages(raw);
  return images.length > 2 ? images[2] : null;
}

export function serializeDishImages(images: (string | null | undefined)[]): string | null {
  if (!images || !Array.isArray(images)) return null;

  const valid = images
    .map((img) => (typeof img === "string" ? img.trim() : ""))
    .filter((img) => Boolean(img))
    .slice(0, 3);

  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0]; // 100% legacy/standard string URL

  return JSON.stringify(valid);
}
