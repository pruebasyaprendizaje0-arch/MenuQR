/**
 * Ubícame Pass - Utilidad de Cliente, Favoritos y Fidelización sin fricción
 * Funciona de forma 100% segura en el navegador con localStorage y sincronización con menuqr_saved_customer.
 */

export type UbicameVertical = "menuqr" | "ctalo" | "citas" | "reservas" | "servicios";

export interface PassProfile {
  name: string;
  phone: string;
  avatarUrl?: string;
  geoAlertsEnabled: boolean;
  latitude?: number;
  longitude?: number;
  addressLabel?: string;
  updatedAt: string;
}

export interface PassFavoritePlace {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  vertical: UbicameVertical;
  category?: string;
  city?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
}

export interface PassFavoriteItem {
  id: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  businessName: string;
  businessSlug: string;
  vertical: UbicameVertical;
  category?: string;
  orderCount: number;
  lastOrderedAt?: string;
}

export interface PassHistoryRecord {
  id: string;
  type: "pedido" | "cita" | "reserva" | "visita" | "cotizacion";
  businessName: string;
  businessSlug: string;
  vertical: UbicameVertical;
  date: string;
  time?: string;
  total?: number;
  status?: string;
  details?: string;
}

const STORAGE_KEY_PROFILE = "ubicame_pass_profile";
const STORAGE_KEY_PLACES = "ubicame_pass_favorite_places";
const STORAGE_KEY_ITEMS = "ubicame_pass_favorite_items";
const STORAGE_KEY_HISTORY = "ubicame_pass_history";
const LEGACY_CUSTOMER_KEY = "menuqr_saved_customer";

export function getPassProfile(): PassProfile {
  if (typeof window === "undefined") {
    return {
      name: "Invitado",
      phone: "",
      geoAlertsEnabled: true,
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.name || parsed?.phone) {
        return parsed;
      }
    }

    // Fallback: intentar recuperar desde menuqr_saved_customer
    const legacy = localStorage.getItem(LEGACY_CUSTOMER_KEY);
    if (legacy) {
      const parsedLegacy = JSON.parse(legacy);
      if (parsedLegacy?.name || parsedLegacy?.phone) {
        const fallback: PassProfile = {
          name: parsedLegacy.name || "Invitado",
          phone: parsedLegacy.phone || "",
          geoAlertsEnabled: true,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(fallback));
        return fallback;
      }
    }
  } catch (err) {
    console.warn("[Ubícame Pass] Error leyendo perfil local:", err);
  }

  return {
    name: "Invitado",
    phone: "",
    geoAlertsEnabled: true,
    updatedAt: new Date().toISOString(),
  };
}

export function savePassProfile(profile: Partial<PassProfile>): PassProfile {
  if (typeof window === "undefined") {
    return {
      name: profile.name || "Invitado",
      phone: profile.phone || "",
      geoAlertsEnabled: profile.geoAlertsEnabled ?? true,
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    const current = getPassProfile();
    const updated: PassProfile = {
      ...current,
      ...profile,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(updated));

    // Sincronizar hacia menuqr_saved_customer para que los menús no requieran volver a escribir
    localStorage.setItem(
      LEGACY_CUSTOMER_KEY,
      JSON.stringify({
        name: updated.name,
        phone: updated.phone,
      })
    );

    return updated;
  } catch (err) {
    console.warn("[Ubícame Pass] Error guardando perfil local:", err);
    return {
      name: profile.name || "Invitado",
      phone: profile.phone || "",
      geoAlertsEnabled: profile.geoAlertsEnabled ?? true,
      updatedAt: new Date().toISOString(),
    };
  }
}

export function getPassFavoritePlaces(): PassFavoritePlace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PLACES);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("[Ubícame Pass] Error leyendo lugares favoritos:", err);
  }
  return [];
}

export function togglePassFavoritePlace(place: PassFavoritePlace): boolean {
  if (typeof window === "undefined") return false;
  try {
    const current = getPassFavoritePlaces();
    const exists = current.some((p) => p.slug === place.slug || p.id === place.id);
    let next: PassFavoritePlace[];
    if (exists) {
      next = current.filter((p) => p.slug !== place.slug && p.id !== place.id);
    } else {
      next = [place, ...current].slice(0, 50);
    }
    localStorage.setItem(STORAGE_KEY_PLACES, JSON.stringify(next));
    return !exists;
  } catch (err) {
    console.warn("[Ubícame Pass] Error alternando lugar favorito:", err);
    return false;
  }
}

export function isPassFavoritePlace(slugOrId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const current = getPassFavoritePlaces();
    return current.some((p) => p.slug === slugOrId || p.id === slugOrId);
  } catch {
    return false;
  }
}

export function getPassFavoriteItems(): PassFavoriteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ITEMS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("[Ubícame Pass] Error leyendo items favoritos:", err);
  }
  return [];
}

export function recordPassItemOrder(item: Omit<PassFavoriteItem, "orderCount">): void {
  if (typeof window === "undefined") return;
  try {
    const current = getPassFavoriteItems();
    const index = current.findIndex((i) => i.id === item.id || (i.name === item.name && i.businessSlug === item.businessSlug));
    let next: PassFavoriteItem[];
    if (index >= 0) {
      const existing = current[index];
      const updated: PassFavoriteItem = {
        ...existing,
        ...item,
        orderCount: existing.orderCount + 1,
        lastOrderedAt: new Date().toISOString(),
      };
      next = [...current];
      next[index] = updated;
    } else {
      const created: PassFavoriteItem = {
        ...item,
        orderCount: 1,
        lastOrderedAt: new Date().toISOString(),
      };
      next = [created, ...current];
    }
    // Ordenar por frecuencia de pedido desc
    next.sort((a, b) => b.orderCount - a.orderCount);
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(next.slice(0, 50)));
  } catch (err) {
    console.warn("[Ubícame Pass] Error guardando pedido de item:", err);
  }
}

export function getPassHistory(): PassHistoryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("[Ubícame Pass] Error leyendo historial:", err);
  }
  return [];
}

export function addPassHistoryRecord(record: Omit<PassHistoryRecord, "id" | "date"> & { date?: string }): void {
  if (typeof window === "undefined") return;
  try {
    const current = getPassHistory();
    const newRecord: PassHistoryRecord = {
      ...record,
      id: "hist-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      date: record.date || new Date().toISOString(),
    };
    const next = [newRecord, ...current].slice(0, 100);
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(next));
  } catch (err) {
    console.warn("[Ubícame Pass] Error guardando registro de historial:", err);
  }
}

export interface TableOrderSyncData {
  restaurant: {
    id: string;
    slug: string;
    name: string;
    logoUrl?: string | null;
    coverUrl?: string | null;
    specialty?: string | null;
    city?: string | null;
    vertical?: UbicameVertical;
  };
  items: Array<{
    id?: string;
    nombre: string;
    cantidad?: number;
    precio?: number | string;
    imageUrl?: string | null;
  }>;
  allCatalogDishes?: Array<{
    id: string;
    name: string;
    price: number;
    imageUrl?: string | null;
  }>;
  total?: number | string;
  orderStatus?: string;
  customerName?: string;
  customerPhone?: string;
}

/**
 * Sincroniza integralmente una orden acumulada en mesa (incluyendo rondas extras y platos de mesero)
 * hacia Ubícame Pass: perfil, local en favoritos, todos los platos acumulados y registro de historial.
 */
export function syncTableOrderToPass(data: TableOrderSyncData): void {
  if (typeof window === "undefined") return;
  try {
    const {
      restaurant,
      items,
      allCatalogDishes = [],
      total,
      orderStatus = "En Mesa",
      customerName,
      customerPhone,
    } = data;
    if (!restaurant?.slug) return;

    // 1. Sincronizar Perfil
    if (customerName || customerPhone) {
      savePassProfile({
        name: customerName,
        phone: customerPhone,
      });
    }

    // 2. Sincronizar Local en Favoritos
    const currentPlaces = getPassFavoritePlaces();
    const placeExists = currentPlaces.some((p) => p.slug === restaurant.slug || p.id === restaurant.id);
    if (!placeExists) {
      const newPlace: PassFavoritePlace = {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        logoUrl: restaurant.logoUrl,
        coverUrl: restaurant.coverUrl,
        vertical: restaurant.vertical || "menuqr",
        category: restaurant.specialty || (restaurant.vertical === "ctalo" ? "Catálogo Retail" : "Restaurante"),
        city: restaurant.city || "Ecuador",
      };
      localStorage.setItem(STORAGE_KEY_PLACES, JSON.stringify([newPlace, ...currentPlaces].slice(0, 50)));
    } else if (restaurant.vertical) {
      const updatedPlaces = currentPlaces.map((p) =>
        p.slug === restaurant.slug || p.id === restaurant.id
          ? { ...p, vertical: restaurant.vertical || p.vertical }
          : p
      );
      localStorage.setItem(STORAGE_KEY_PLACES, JSON.stringify(updatedPlaces));
    }

    // 3. Sincronizar CADA plato acumulado a "Mis Platos & Productos Habituales"
    if (items && items.length > 0) {
      const currentItems = getPassFavoriteItems();
      const updatedItems = [...currentItems];

      // Mapa de búsqueda rápida en el catálogo para completar imágenes y precios
      const catalogMap = new Map<string, { id: string; name: string; price: number; imageUrl?: string | null }>();
      allCatalogDishes.forEach((d) => {
        if (d.name) catalogMap.set(d.name.toLowerCase().trim(), d);
        if (d.id) catalogMap.set(d.id, d);
      });

      items.forEach((it) => {
        const itName = (it.nombre || "").trim();
        if (!itName) return;

        const matchedCatalog = catalogMap.get(itName.toLowerCase()) || (it.id ? catalogMap.get(it.id) : null);
        const resolvedId = it.id || matchedCatalog?.id || `dish-${restaurant.slug}-${itName}`;
        const resolvedPrice = matchedCatalog?.price ?? (it.precio != null ? Number(it.precio) : 0);
        const resolvedImage = it.imageUrl || matchedCatalog?.imageUrl || null;

        const existingIdx = updatedItems.findIndex(
          (si) =>
            si.id === resolvedId ||
            (si.name.toLowerCase() === itName.toLowerCase() && si.businessSlug === restaurant.slug)
        );

        if (existingIdx >= 0) {
          updatedItems[existingIdx] = {
            ...updatedItems[existingIdx],
            name: itName,
            price: resolvedPrice || updatedItems[existingIdx].price,
            imageUrl: resolvedImage || updatedItems[existingIdx].imageUrl,
            lastOrderedAt: new Date().toISOString(),
          };
        } else {
          updatedItems.unshift({
            id: resolvedId,
            name: itName,
            price: resolvedPrice,
            imageUrl: resolvedImage,
            businessName: restaurant.name,
            businessSlug: restaurant.slug,
            vertical: restaurant.vertical || "menuqr",
            orderCount: it.cantidad || 1,
            lastOrderedAt: new Date().toISOString(),
          });
        }
      });

      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(updatedItems.slice(0, 50)));
    }

    // 4. Sincronizar Registro en Historial
    const calcTotal =
      total != null
        ? Number(total)
        : items.reduce((acc, it) => acc + (Number(it.precio) || 0) * (it.cantidad || 1), 0);
    const detailsSummary = items.map((it) => `${it.cantidad || 1}x ${it.nombre}`).join(", ");
    const currentHistory = getPassHistory();
    const updatedHistory = [...currentHistory];

    const todayDate = "Hoy";
    const existingHistIdx = updatedHistory.findIndex(
      (h) => h.businessSlug === restaurant.slug && h.date === todayDate
    );

    const nowTime = new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });

    if (existingHistIdx >= 0) {
      updatedHistory[existingHistIdx] = {
        ...updatedHistory[existingHistIdx],
        vertical: restaurant.vertical || updatedHistory[existingHistIdx].vertical || "menuqr",
        total: calcTotal || updatedHistory[existingHistIdx].total,
        details: detailsSummary || updatedHistory[existingHistIdx].details,
        time: nowTime,
        status: orderStatus,
      };
    } else {
      updatedHistory.unshift({
        id: `hist-${restaurant.slug}-${Date.now().toString(36)}`,
        type: "pedido",
        businessName: restaurant.name,
        businessSlug: restaurant.slug,
        vertical: restaurant.vertical || "menuqr",
        date: todayDate,
        time: nowTime,
        total: calcTotal,
        status: orderStatus,
        details: detailsSummary,
      });
    }

    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updatedHistory.slice(0, 100)));
  } catch (err) {
    console.warn("[Ubícame Pass] Error en syncTableOrderToPass:", err);
  }
}

/**
 * Limpia y sanitiza URLs de imágenes.
 * Resuelve casos donde se guardó un JSON string array como '["https://...", "https://..."]'
 * o cadenas vacías "", devolviendo siempre una URL válida o el fallback.
 */
export function sanitizeImageUrl(rawUrl: string | null | undefined, fallbackUrl = ""): string {
  if (!rawUrl || typeof rawUrl !== "string") return fallbackUrl;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed === '""' || trimmed === "[]" || trimmed === "null" || trimmed === "undefined") {
    return fallbackUrl;
  }

  // Si está serializado como un array JSON: '["https://...", "https://..."]'
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        for (const item of parsed) {
          if (typeof item === "string" && item.trim().length > 0) {
            return sanitizeImageUrl(item.trim(), fallbackUrl);
          }
        }
      }
    } catch {
      const match = trimmed.match(/https?:\/\/[^\s"',\]]+/);
      if (match) return match[0];
    }
    return fallbackUrl;
  }

  // Quitar comillas dobles o simples extras si vienen envueltas
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const unquoted = trimmed.slice(1, -1).trim();
    return sanitizeImageUrl(unquoted, fallbackUrl);
  }

  // Validar esquemas aceptados
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:image/")
  ) {
    return trimmed;
  }

  return fallbackUrl;
}

/**
 * Fórmula de Haversine para calcular distancia esférica en kilómetros
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radio medio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

