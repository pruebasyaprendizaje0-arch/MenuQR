export type StockLevel = "MUCHO" | "POCO" | "AGOTADO";

export interface ElementTag {
  id: string;
  label: string;
  icon?: string;
  colorHex?: string;
  keywords: string[]; // Palabras clave para buscar en nombres y descripciones de platos reales
  stockLevel?: StockLevel; // Nivel de stock: "MUCHO" | "POCO" | "AGOTADO"
  priority?: number; // Prioridad de recomendación hoy: 1 a 5
  isAvailableToday?: boolean;
}

export type BusinessPresetType = "mariscos" | "cafeteria" | "pizzeria" | "parrillada" | "personalizado";

export interface ElementFiltersConfig {
  enabled: boolean;
  title: string;
  subtitle: string;
  preset: BusinessPresetType;
  elements: ElementTag[];
  featuredElementId?: string | null; // Proteína o Elemento destacado del día
  dailySpecialDishIds?: string[]; // IDs de platos reales marcados como "Plato del Día"
  dailySpecialTitle?: string; // Título (ej: "⭐ Plato del Día" o "Especial del Chef")
  dailySpecialSubtitle?: string; // Subtítulo (ej: "Recomendación fresca y preparada hoy")
  showDailySpecialBadge?: boolean; // Activar banner de Plato del Día
}

export const PRESET_CONFIGS: Record<BusinessPresetType, { title: string; subtitle: string; elements: ElementTag[] }> = {
  mariscos: {
    title: "¿Qué proteína o marisco prefieres hoy?",
    subtitle: "Filtra al instante los platos de nuestra carta según tu ingrediente favorito",
    elements: [
      { id: "mar-1", label: "Camarón", icon: "shrimp", colorHex: "#F97316", keywords: ["camaron", "camarones", "camarón", "shrimp"], stockLevel: "MUCHO", priority: 5, isAvailableToday: true },
      { id: "mar-2", label: "Pescado", icon: "fish", colorHex: "#0EA5E9", keywords: ["pescado", "corvina", "dorado", "salmon", "salmón", "atun", "atún", "tilapia", "robalo", "róbalo"], stockLevel: "MUCHO", priority: 4, isAvailableToday: true },
      { id: "mar-3", label: "Pulpo", icon: "octopus", colorHex: "#8B5CF6", keywords: ["pulpo", "calamar", "calamares", "anillos de calamar"], stockLevel: "POCO", priority: 5, isAvailableToday: true },
      { id: "mar-4", label: "Carne", icon: "steak", colorHex: "#EF4444", keywords: ["carne", "lomo", "res", "churrasco"], stockLevel: "MUCHO", priority: 3, isAvailableToday: true },
      { id: "mar-5", label: "Pollo", icon: "drumstick", colorHex: "#10B981", keywords: ["pollo", "pechuga", "alitas"], stockLevel: "MUCHO", priority: 2, isAvailableToday: true },
      { id: "mar-6", label: "Cangrejo / Concha", icon: "crab", colorHex: "#D97706", keywords: ["cangrejo", "concha", "conchas", "pata gorda"], stockLevel: "POCO", priority: 4, isAvailableToday: true },
    ],
  },
  cafeteria: {
    title: "¿Qué se te antoja disfrutar hoy?",
    subtitle: "Encuentra tus bebidas y acompañamientos ideales en nuestra cafetería",
    elements: [
      { id: "caf-1", label: "Café de Especialidad", icon: "coffee", colorHex: "#B45309", keywords: ["espresso", "americano", "capuccino", "cappuccino", "latte", "mocaccino", "filtrado", "prensa", "v60", "cafe", "café"], stockLevel: "MUCHO", priority: 5, isAvailableToday: true },
      { id: "caf-2", label: "Bebidas Frías / Frappés", icon: "ice", colorHex: "#06B6D4", keywords: ["frio", "frío", "ice", "frappe", "frappé", "smoothie", "cold brew", "granizado", "malteada"], stockLevel: "MUCHO", priority: 4, isAvailableToday: true },
      { id: "caf-3", label: "Té & Infusiones", icon: "leaf", colorHex: "#10B981", keywords: ["té", "te", "infusion", "infusión", "matcha", "chai", "manzanilla", "menta", "verde"], stockLevel: "MUCHO", priority: 3, isAvailableToday: true },
      { id: "caf-4", label: "Leches Vegetales (Avena/Almendra)", icon: "milk", colorHex: "#F59E0B", keywords: ["almendra", "avena", "soya", "coco", "deslactosada", "vegetal"], stockLevel: "POCO", priority: 4, isAvailableToday: true },
      { id: "caf-5", label: "Postres & Dulces", icon: "cake", colorHex: "#EC4899", keywords: ["cheesecake", "torta", "pastel", "croissant", "galleta", "cookie", "brownie", "muffin", "waffle", "crepe", "dulce"], stockLevel: "POCO", priority: 5, isAvailableToday: true },
      { id: "caf-6", label: "Salados & Sandwiches", icon: "sandwich", colorHex: "#EAB308", keywords: ["sandwich", "sándwich", "tostada", "omelette", "huevos", "panini", "quiche", "empanada", "wrap", "bagel"], stockLevel: "MUCHO", priority: 3, isAvailableToday: true },
    ],
  },
  pizzeria: {
    title: "¿Qué ingredientes buscas en tu pizza o pasta?",
    subtitle: "Selecciona tus ingredientes clave y descubre nuestros platos disponibles",
    elements: [
      { id: "piz-1", label: "Masa Tradicional / Mozzarella", icon: "cheese", colorHex: "#F59E0B", keywords: ["mozzarella", "parmesano", "gorgonzola", "burrata", "ricotta", "provolone", "cuatro quesos"], stockLevel: "MUCHO", priority: 5, isAvailableToday: true },
      { id: "piz-2", label: "Pepperoni & Embutidos", icon: "meat", colorHex: "#EF4444", keywords: ["pepperoni", "peperoni", "jamon", "jamón", "prosciutto", "tocino", "bacon", "salami", "salchicha", "carne"], stockLevel: "MUCHO", priority: 4, isAvailableToday: true },
      { id: "piz-3", label: "Champiñones & Vegetales", icon: "mushroom", colorHex: "#10B981", keywords: ["champiñon", "champiñón", "champiñones", "hongos", "albahaca", "aceituna", "tomate", "pimiento", "rucula", "rúcula"], stockLevel: "MUCHO", priority: 3, isAvailableToday: true },
      { id: "piz-4", label: "Mariscos al Horno", icon: "shrimp", colorHex: "#0EA5E9", keywords: ["camaron", "camarón", "anchoa", "atun", "atún", "frutti di mare"], stockLevel: "POCO", priority: 4, isAvailableToday: true },
      { id: "piz-5", label: "Pastas Frescas", icon: "pasta", colorHex: "#D97706", keywords: ["lasagna", "lasaña", "spaghetti", "fettuccine", "ravioli", "penne", "carbonara", "bolognesa", "alfredo"], stockLevel: "MUCHO", priority: 4, isAvailableToday: true },
    ],
  },
  parrillada: {
    title: "¿Qué tipo de corte o asado prefieres?",
    subtitle: "Encuentra tus cortes de carne, asados y acompañamientos al carbón",
    elements: [
      { id: "parr-1", label: "Cortes de Res (Bife / Picaña)", icon: "steak", colorHex: "#DC2626", keywords: ["bife", "picaña", "picanha", "ribeye", "t-bone", "lomo fino", "asado de tira", "vacio", "vacío", "entraña"], stockLevel: "MUCHO", priority: 5, isAvailableToday: true },
      { id: "parr-2", label: "Costillas BBQ & Cerdo", icon: "ribs", colorHex: "#EA580C", keywords: ["costilla", "costillas", "bbq", "bondiola", "matambre", "chuleta", "cerdo", "pork"], stockLevel: "MUCHO", priority: 4, isAvailableToday: true },
      { id: "parr-3", label: "Pollo a la Brasa", icon: "drumstick", colorHex: "#D97706", keywords: ["pollo", "pechuga", "alitas", "muslo", "cuarto de pollo"], stockLevel: "MUCHO", priority: 3, isAvailableToday: true },
      { id: "parr-4", label: "Chorizos & Embutidos", icon: "sausage", colorHex: "#B91C1C", keywords: ["chorizo", "morcilla", "chistorra", "longaniza", "provoleta"], stockLevel: "POCO", priority: 4, isAvailableToday: true },
      { id: "parr-5", label: "Hamburguesas Artesanales", icon: "burger", colorHex: "#EAB308", keywords: ["hamburguesa", "burger", "angus", "cheeseburger"], stockLevel: "MUCHO", priority: 3, isAvailableToday: true },
    ],
  },
  personalizado: {
    title: "¿Qué se te antoja hoy?",
    subtitle: "Selecciona tus ingredientes favoritos para ver nuestros platos recomendados",
    elements: [
      { id: "pers-1", label: "Ingrediente Principal", icon: "sparkles", colorHex: "#EF4444", keywords: ["especialidad", "plato fuerte"], stockLevel: "MUCHO", priority: 5, isAvailableToday: true },
      { id: "pers-2", label: "Ingrediente Secundario", icon: "tag", colorHex: "#F59E0B", keywords: ["entrada", "postre"], stockLevel: "POCO", priority: 3, isAvailableToday: true },
    ],
  },
};

export const DEFAULT_ELEMENT_FILTERS_CONFIG: ElementFiltersConfig = {
  enabled: false,
  title: "¿Qué se te antoja hoy?",
  subtitle: "Filtra los platos de nuestra carta según tus ingredientes favoritos",
  preset: "personalizado",
  elements: PRESET_CONFIGS.personalizado.elements,
  featuredElementId: null,
  dailySpecialDishIds: [],
  dailySpecialTitle: "⭐ Plato del Día / Especial de Hoy",
  dailySpecialSubtitle: "Seleccionado con los ingredientes más frescos de nuestra cocina",
  showDailySpecialBadge: true,
};
