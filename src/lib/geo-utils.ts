export interface ParsedLocality {
  province: string;
  canton: string;
  parroquia: string;
  sector: string;
}

/**
 * Parsea el string combinado de localidad almacenado en Restaurant.locality
 * Formatos soportados:
 * 1. "Provincia | Cantón | Parroquia | Sector"
 * 2. "Cantón, Provincia" o "Sector, Cantón, Provincia"
 */
export function parseLocality(localityStr: string | null): ParsedLocality {
  if (!localityStr) {
    return { province: "", canton: "", parroquia: "", sector: "" };
  }
  const parts = localityStr.split(" | ");
  if (parts.length >= 2) {
    return {
      province: parts[0] || "",
      canton: parts[1] || "",
      parroquia: parts[2] || "",
      sector: parts[3] || "",
    };
  }

  const oldParts = localityStr.split(", ");
  if (oldParts.length === 2) {
    return {
      province: oldParts[1] || "",
      canton: oldParts[0] || "",
      parroquia: oldParts[0] || "",
      sector: "",
    };
  } else if (oldParts.length >= 3) {
    return {
      province: oldParts[oldParts.length - 1] || "",
      canton: oldParts[oldParts.length - 2] || "",
      parroquia: oldParts[0] || "",
      sector: oldParts[0] || "",
    };
  }

  return {
    province: "",
    canton: "",
    parroquia: localityStr,
    sector: "",
  };
}

/**
 * Calcula la distancia ortodrómica en kilómetros usando la fórmula de Haversine.
 */
export function calculateHaversineDistanceKm(
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

/**
 * Formatea una distancia en km para visualización en badges UI (ej. "650 m" o "2.4 km").
 */
export function formatDistanceLabel(distanceKm: number): string {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Solicita las coordenadas GPS del navegador con manejo de permisos y timeout seguro.
 */
export function requestBrowserCoordinates(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      reject(new Error("La geolocalización no está soportada en este navegador."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        let msg = "No se pudo obtener la ubicación.";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "Permiso de ubicación denegado por el usuario.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = "Posición GPS no disponible en este dispositivo.";
        } else if (err.code === err.TIMEOUT) {
          msg = "Tiempo de espera agotado al consultar GPS.";
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}
