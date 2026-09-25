/**
 * Parser inteligente y tolerante para importación por lotes de platos (Excel & CSV).
 * Maneja caracteres especiales/tildes (UTF-8 / Windows-1252), precios con coma/punto decimal
 * y coincidencia flexible de cabeceras.
 */

export function fixMojibake(str: string): string {
  if (!str || typeof str !== "string") return "";
  try {
    // Si contiene patrones típicos de UTF-8 mal interpretado como Windows-1252 / ISO-8859-1
    if (/[\u00C2\u00C3\u00E2]/.test(str)) {
      const bytes = new Uint8Array([...str].map((c) => c.charCodeAt(0) & 0xff));
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      if (!decoded.includes("\uFFFD") && decoded.length <= str.length) {
        return decoded;
      }
    }
  } catch {
    // Retornar original si falla
  }
  return str;
}

export function normalizeKey(str: string): string {
  if (!str) return "";
  return fixMojibake(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function parsePriceValue(val: any): number {
  if (typeof val === "number") {
    return isNaN(val) ? 0 : Math.max(0, val);
  }
  if (val === null || val === undefined) return 0;
  let str = String(val).trim();
  if (!str) return 0;

  // Remover simbolos de moneda ($ USD € S/ Bs etc.) y espacios
  str = str.replace(/[^0-9.,-]/g, "").trim();
  if (!str) return 0;

  // Manejo de separadores decimales y de miles
  if (str.includes(".") && str.includes(",")) {
    const lastComma = str.lastIndexOf(",");
    const lastDot = str.lastIndexOf(".");
    if (lastComma > lastDot) {
      // Formato latino / europeo: 1.500,50 -> 1500.50
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      // Formato anglosajón: 1,500.50 -> 1500.50
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(",")) {
    // Formato con coma: 0,5 o 12,50 -> 0.5 o 12.50
    str = str.replace(",", ".");
  }

  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : Math.max(0, parsed);
}

export interface ExtractedDishRow {
  categoryName: string;
  name: string;
  description: string;
  price: number;
  isAvailable: boolean;
  imageUrl: string;
  rawPrice?: string;
}

export function extractDishRow(row: Record<string, any>): ExtractedDishRow {
  const keys = Object.keys(row || {});

  const getVal = (exactMatches: string[], partialFallbacks: string[] = []): string => {
    // 1. Coincidencia exacta normalizada
    for (const k of keys) {
      const normK = normalizeKey(k);
      for (const match of exactMatches) {
        if (normK === normalizeKey(match)) {
          const val = row[k];
          if (val !== undefined && val !== null && String(val).trim() !== "") {
            return fixMojibake(String(val).trim());
          }
        }
      }
    }

    // 2. Coincidencia parcial (por ejemplo, "precio ($)", "url de la imagen", etc.)
    for (const k of keys) {
      const normK = normalizeKey(k);
      for (const fallback of partialFallbacks) {
        const normFb = normalizeKey(fallback);
        if (normK.includes(normFb)) {
          const val = row[k];
          if (val !== undefined && val !== null && String(val).trim() !== "") {
            return fixMojibake(String(val).trim());
          }
        }
      }
    }

    return "";
  };

  const categoryName = getVal(
    ["categoria", "category", "seccion", "tipo", "rubro", "grupo"],
    ["categor", "seccion", "rubro", "tipo"]
  ) || "General";

  const name = getVal(
    ["nombre", "name", "plato", "nombredelplato", "nombreplato", "item", "producto", "articulo", "titulo"],
    ["nombre", "plato", "item", "producto", "articulo"]
  );

  const description = getVal(
    ["descripcion", "description", "detalle", "detalles", "ingredientes", "desc", "notas"],
    ["descrip", "detalle", "ingrediente", "desc"]
  );

  const rawPrice = getVal(
    [
      "precio", "price", "costo", "valor", "preciousd", "preciobs", "precios",
      "tarifa", "pvp", "preciounitario", "importe", "precioventa"
    ],
    ["precio", "price", "costo", "valor", "pvp", "tarifa", "importe"]
  );

  const rawAvailable = getVal(
    ["disponible", "available", "activo", "estado", "habilitado", "stock"],
    ["disponib", "activ", "estad", "habilit", "stock"]
  ).toUpperCase();

  const imageUrl = getVal(
    [
      "url_imagen", "urlimagen", "imagen", "image", "url", "imageurl", "foto",
      "urldeimagen", "urldelaimagen", "urldeimagendelplato", "urldeimagendelplatohttps",
      "linkimagen", "linkfoto", "fotodelplato", "fotourl", "link", "img", "foto_url", "url_foto"
    ],
    ["imagen", "image", "foto", "url", "link", "img", "pic"]
  );

  const parsedPrice = parsePriceValue(rawPrice);
  const isAvailable =
    rawAvailable !== "NO" &&
    rawAvailable !== "FALSE" &&
    rawAvailable !== "0" &&
    rawAvailable !== "INACTIVO" &&
    rawAvailable !== "DESACTIVADO";

  return {
    categoryName,
    name,
    description,
    price: parsedPrice,
    isAvailable,
    imageUrl: imageUrl || "",
    rawPrice,
  };
}
