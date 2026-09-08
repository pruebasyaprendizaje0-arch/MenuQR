/**
 * Sanitiza y limpia URLs o bloques <iframe> de Google Maps Embed.
 * Soluciona errores como:
 * 1. HTTP 400 Bad Request por strings 'pb' truncados, incompletos o finalizados en '…'.
 * 2. Error 'Invalid pb parameter' por entidades HTML (&amp; en lugar de &).
 * 3. Concatenación accidental de clave de API (&key=...) en URLs pb gratuitas.
 * 4. URLs de Google Maps de tipo /maps/place/ o enlaces cortos (maps.app.goo.gl).
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
  const srcMatch = cleaned.match(/src=["']([^"']+)["']/i);
  if (srcMatch && srcMatch[1]) {
    cleaned = srcMatch[1];
  }

  // Limpiar residuos finales de comillas o etiquetas HTML
  cleaned = cleaned.replace(/["']>.*$/, "").trim();
  cleaned = cleaned.replace(/&amp;/g, "&");

  // 3. Manejo de URLs de Google Maps de tipo /maps/place/ o enlaces compartidos (maps.app.goo.gl)
  if (cleaned.includes("/maps/place/") || cleaned.includes("maps.app.goo.gl") || cleaned.includes("goo.gl/maps")) {
    const coordMatch = cleaned.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordMatch && coordMatch[1] && coordMatch[2]) {
      return `https://maps.google.com/maps?q=${coordMatch[1]},${coordMatch[2]}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
    }
    return `https://maps.google.com/maps?q=${encodeURIComponent(cleaned)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  }

  // 4. Manejo de URLs embebidas con parámetro pb (/maps/embed?pb=...)
  if (cleaned.includes("pb=")) {
    // Eliminar parámetro &key= accidental si existe
    cleaned = cleaned.replace(/([?&])key=[^&]*&?/g, "$1").replace(/[?&]$/, "");

    // Extraer coordenadas latitud (!3d) y longitud (!2d) si están en el string pb
    const latMatch = cleaned.match(/!3d(-?\d+\.\d+)/);
    const lngMatch = cleaned.match(/!2d(-?\d+\.\d+)/);
    
    // Verificar si el pb está truncado o le falta la metadata del lugar (!1m2! o !3m2! o !5e! o termina en puntos suspensivos)
    const isTruncatedOrIncomplete = 
      cleaned.endsWith("…") || 
      cleaned.endsWith("...") || 
      (!cleaned.includes("!1m2!") && !cleaned.includes("!3m2!") && !cleaned.includes("!5e"));

    // Si el pb está corrompido o truncado pero recuperamos las coordenadas, usamos el endpoint universal embed 200 OK
    if (isTruncatedOrIncomplete && latMatch && lngMatch) {
      return `https://maps.google.com/maps?q=${latMatch[1]},${lngMatch[1]}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
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

  // 5. Si es una URL o dirección directa
  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(cleaned)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  }

  return `https://maps.google.com/maps?q=${encodeURIComponent(cleaned)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
}
