import { ecuadorData } from "./ecuador";

export interface ParsedSearchQuery {
  rawQuery: string;
  cleanQuery: string;
  textTokens: string[];
  locationToken: string | null;
  categoryToken: string | null;
  maxPrice: number | null;
  wantsCheap: boolean;
}

const STOP_WORDS = new Set([
  "en", "de", "del", "con", "el", "la", "los", "las", "un", "una", "unos", "unas",
  "por", "para", "cerca", "mio", "mia", "mias", "mios", "que", "donde", "restaurante",
  "restaurantes", "comida", "sitio", "lugar", "locales", "quisiera", "quiero", "busco"
]);

const KNOWN_CATEGORIES: Record<string, string[]> = {
  pizza: ["pizza", "pizzas", "pizzeria", "pizzerias", "napolitana", "calzone"],
  empanadas: ["empanada", "empanadas", "empanaditas"],
  hamburguesas: ["hamburguesa", "hamburguesas", "burger", "burgers"],
  mariscos: ["marisco", "mariscos", "pescado", "ceviche", "encocado", "camaron", "camarones"],
  pastas: ["pasta", "pastas", "fettuccine", "lasagna", "lasaña", "spaghetti", "ravioles"],
  bebidas: ["bebida", "bebidas", "coctel", "cocteles", "refresco", "jugo", "cerveza", "mojito"],
  cafeteria: ["cafe", "cafeteria", "cafecito", "capuchino", "postre", "torta"],
};

export function parseSearchQuery(rawQuery: string): ParsedSearchQuery {
  if (!rawQuery) {
    return {
      rawQuery: "",
      cleanQuery: "",
      textTokens: [],
      locationToken: null,
      categoryToken: null,
      maxPrice: null,
      wantsCheap: false,
    };
  }

  const cleanQuery = rawQuery
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  const words = cleanQuery.split(/\s+/).filter(Boolean);
  let locationToken: string | null = null;
  let categoryToken: string | null = null;
  let wantsCheap = false;
  let maxPrice: number | null = null;

  // Check for cheap / budget intent
  if (words.some((w) => ["barato", "barata", "baratos", "baratas", "economico", "economica"].includes(w))) {
    wantsCheap = true;
    maxPrice = 10;
  }

  // 1. Identify Location Token (matching ecuadorData provinces or cities/sectors)
  const allLocations: string[] = [];
  Object.entries(ecuadorData).forEach(([prov, cities]) => {
    allLocations.push(prov);
    cities.forEach((c) => allLocations.push(c));
  });
  allLocations.push("Montañita", "Olón", "Barbasquillo", "Tarqui", "Chipipe", "Cumbayá", "Urdesa");

  for (const loc of allLocations) {
    const normLoc = loc.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (cleanQuery.includes(normLoc) || rawQuery.toLowerCase().includes(loc.toLowerCase())) {
      locationToken = loc;
      break;
    }
  }

  // 2. Identify Category Token
  for (const [catKey, keywords] of Object.entries(KNOWN_CATEGORIES)) {
    for (const kw of keywords) {
      if (words.includes(kw) || cleanQuery.includes(kw)) {
        categoryToken = catKey;
        break;
      }
    }
    if (categoryToken) break;
  }

  // 3. Filter text tokens (excluding stop words, location words, and category words)
  const textTokens = words.filter((w) => {
    if (STOP_WORDS.has(w)) return false;
    if (locationToken && locationToken.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(w)) return false;
    if (categoryToken && categoryToken.toLowerCase().includes(w)) return false;
    return true;
  });

  return {
    rawQuery,
    cleanQuery,
    textTokens,
    locationToken,
    categoryToken,
    maxPrice,
    wantsCheap,
  };
}
