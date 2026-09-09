/**
 * Sanitiza, repara y convierte cualquier formato de URL, iframe o dirección
 * de Google Maps en una URL de iframe (Embed) 100% válida y funcional.
 * 
 * Previene de raíz los siguientes errores:
 * 1. "Invalid 'pb' parameter" por PB cortados, dañados, hashes obsoletos o entidades HTML.
 * 2. HTTP 400 Bad Request por PB incompletos o finalizados en '…'.
 * 3. Enlaces estándar de Google Maps (/maps/place/..., maps.app.goo.gl, etc.).
 * 4. Coordenadas sueltas o direcciones directas.
 */
export function sanitizeMapEmbedUrl(rawInput?: string | null): string | null {
  if (!rawInput || !rawInput.trim()) return null;

  let cleaned = rawInput.trim();

  // 1. Decodificar entidades HTML comunes (&amp; -> &, &quot; -> ", &#39; -> ')
  cleaned = cleaned
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\"/g, '"');

  // 2. Extraer el atributo src si fue pegado el bloque <iframe> completo
  // Usa la misma comilla de apertura y cierre. El nombre de un negocio puede
  // contener apóstrofos (por ejemplo, "Rose's Burger") dentro de un src con
  // comillas dobles; tratar ambas comillas como equivalentes corta el pb.
  const srcMatch = cleaned.match(/\bsrc\s*=\s*(["'])([\s\S]*?)\1/i);
  if (srcMatch && srcMatch[2]) {
    cleaned = srcMatch[2];
  }

  // Limpiar residuos finales de comillas, etiquetas HTML o espacios
  cleaned = cleaned.replace(/["']>.*$/, "").trim();
  cleaned = cleaned.replace(/&amp;/g, "&");

  // 3. Extraer coordenadas en cualquier formato común
  // - Coordenadas en formato PB de Google Maps: !3d-1.9284!2d-80.7516 o !2d-80.7516!3d-1.9284
  const pbLatMatch = cleaned.match(/!3d(-?\d+(?:\.\d+)?)/);
  const pbLngMatch = cleaned.match(/!2d(-?\d+(?:\.\d+)?)/);
  
  // - Coordenadas en formato @lat,lng
  const atCoordMatch = cleaned.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  
  // - Coordenadas en parámetros q=lat,lng o ll=lat,lng o query=lat,lng
  const paramCoordMatch = cleaned.match(/[?&](?:q|ll|query|center)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);

  // - Coordenadas puras sueltas: "-1.9284, -80.7516"
  const rawCoordMatch = cleaned.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);

  if (rawCoordMatch) {
    return `https://maps.google.com/maps?q=${rawCoordMatch[1]},${rawCoordMatch[2]}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
  }

  // 4. Manejo de URLs embebidas con parámetro pb (/maps/embed?pb=...)
  if (cleaned.includes("pb=")) {
    // Eliminar parámetro &key= accidental si existe
    cleaned = cleaned.replace(/([?&])key=[^&]*&?/g, "$1").replace(/[?&]$/, "");

    // Si el PB está incompleto, sospechoso de recorte o le faltan bloques mínimos:
    const isPotentiallyBrokenPb =
      cleaned.endsWith("…") ||
      cleaned.endsWith("...") ||
      cleaned.length < 160 || // Un PB de embed válido completo de Maps mide > 180 chars
      !cleaned.includes("!2m3!") ||
      !cleaned.includes("!4f13.1") ||
      cleaned.includes(" ");

    // Si detectamos coordenadas dentro del pb y el pb está dañado/sospechoso, usamos el embed universal limpio
    if (pbLatMatch && pbLngMatch) {
      if (isPotentiallyBrokenPb) {
        return `https://maps.google.com/maps?q=${pbLatMatch[1]},${pbLngMatch[1]}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
      }
    }

    // Asegurar protocolo completo HTTP/HTTPS
    if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
      const embedIdx = cleaned.indexOf("/maps/embed");
      if (embedIdx !== -1) {
        cleaned = `https://www.google.com${cleaned.substring(embedIdx)}`;
      } else {
        cleaned = `https://${cleaned}`;
      }
    }

    return cleaned;
  }

  // 5. Una URL de ficha debe conservar el nombre del negocio antes de usar
  // sus coordenadas de vista (@lat,lng). Estas últimas suelen ser solo el
  // centro del mapa y no identifican al comercio.
  if (cleaned.includes("/maps/place/")) {
    const placeMatch = cleaned.match(/\/maps\/place\/([^/@?#]+)/);
    if (placeMatch && placeMatch[1]) {
      const placeName = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
      return `https://maps.google.com/maps?q=${encodeURIComponent(placeName)}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
    }
  }

  // 6. Manejo de URLs de Google Maps con coordenadas @lat,lng o q=lat,lng
  if (atCoordMatch && atCoordMatch[1] && atCoordMatch[2]) {
    return `https://maps.google.com/maps?q=${atCoordMatch[1]},${atCoordMatch[2]}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
  }

  if (paramCoordMatch && paramCoordMatch[1] && paramCoordMatch[2]) {
    return `https://maps.google.com/maps?q=${paramCoordMatch[1]},${paramCoordMatch[2]}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
  }

  // 7. Si ya es una URL con output=embed
  if (cleaned.includes("output=embed")) {
    if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
      return `https://${cleaned}`;
    }
    return cleaned;
  }

  // 8. Si es una URL o dirección directa
  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(cleaned)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  }

  return `https://maps.google.com/maps?q=${encodeURIComponent(cleaned)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
}
