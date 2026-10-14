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
  costPrice?: number;
  stock?: number | null;
  minStock?: number;
  supplierName?: string;
  barcode?: string;
  sku?: string;
  isAvailable: boolean;
  imageUrl: string;
  rawPrice?: string;
  rawCost?: string;
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

  // Costo de compra (primero para no confundir con precio de venta)
  const rawCost = getVal(
    [
      "costocompra", "costodecompra", "costounitario", "preciocosto", "costo", "cost", "costprice",
      "valorcompra", "preciodecompra"
    ],
    ["costocompra", "costodecompra", "costounit", "preciocosto", "costprice", "costo", "cost"]
  );

  const rawPrice = getVal(
    [
      "precioventa", "preciodeventa", "precio", "price", "pvp", "valorventa", "valordeventa",
      "preciousd", "preciobs", "precios", "tarifa", "preciounitario", "importe", "valor"
    ],
    ["precioventa", "precio", "price", "pvp", "tarifa", "importe", "valor"]
  );

  const supplierName = getVal(
    [
      "proveedorhabitual", "proveedor", "supplier", "distribuidor", "distribuidora",
      "nombredelproveedor", "proveedorprincipal"
    ],
    ["proveedor", "supplier", "distribuid"]
  );

  const rawStock = getVal(
    ["stockactual", "stockdisponible", "stock", "existencia", "existencias", "cantidad", "inventario", "unidades"],
    ["stockactual", "existencia", "stock", "cantidad"]
  );

  const rawMinStock = getVal(
    ["stockminimo", "minstock", "minimo", "alertastock", "stockalerta"],
    ["stockmin", "minstock", "minimo"]
  );

  const barcode = getVal(
    ["codigobarrassku", "codigobarras", "codigodebarras", "barcode", "sku", "codigo", "itemcode"],
    ["codigobarra", "barcode", "sku", "codigo"]
  );

  const rawAvailable = getVal(
    ["disponible", "available", "activo", "estado", "habilitado"],
    ["disponib", "activ", "estad", "habilit"]
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
  const parsedCost = rawCost ? parsePriceValue(rawCost) : 0;
  const parsedStock = rawStock !== "" && !isNaN(parseInt(rawStock.replace(/[^0-9-]/g, ""), 10))
    ? parseInt(rawStock.replace(/[^0-9-]/g, ""), 10)
    : null;
  const parsedMinStock = rawMinStock !== "" && !isNaN(parseInt(rawMinStock.replace(/[^0-9]/g, ""), 10))
    ? parseInt(rawMinStock.replace(/[^0-9]/g, ""), 10)
    : 0;

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
    costPrice: parsedCost,
    stock: parsedStock,
    minStock: parsedMinStock,
    supplierName: supplierName || undefined,
    barcode: barcode || undefined,
    sku: barcode || undefined,
    isAvailable,
    imageUrl: imageUrl || "",
    rawPrice,
    rawCost,
  };
}
