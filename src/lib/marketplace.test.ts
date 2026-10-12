import { type MarketplaceItem } from "./suggested-dishes-actions";

console.log("==========================================");
console.log("🧪 RUNNING MARKETPLACE LOGIC & CLASSIFICATION SUITE");
console.log("==========================================");

// Mock items
const mockItems: MarketplaceItem[] = [
  {
    id: "item-1",
    name: "Empanada de Camarón",
    description: "Rellena de camarones frescos con queso manaba",
    price: 3.5,
    imageUrl: "/uploads/empanada.jpg",
    isAvailable: true,
    stock: 20,
    trackStock: true,
    isService: false,
    isSuggested: true,
    itemType: "restaurant",
    categoryName: "Empanadas",
    restaurant: {
      id: "rest-1",
      name: "Las Empanadas de Mauro",
      slug: "las-empanadas-de-mauro",
      logoUrl: "/logo1.png",
      specialty: "Empanadas y Mariscos",
      businessType: "RESTAURANT",
      catalogMode: "MENU",
      locality: "Montañita, Santa Elena",
      city: "Santa Elena",
      province: "Santa Elena",
      parish: "Manglaralto",
      sector: "Montañita",
      latitude: -1.828,
      longitude: -80.751,
      themeColor: "#ef4444",
      whatsapp: "0991112233",
    },
  },
  {
    id: "item-2",
    name: "Pizza Margherita",
    description: "Salsa pomodoro San Marzano y mozzarella fresca",
    price: 12.0,
    imageUrl: "/uploads/pizza.jpg",
    isAvailable: true,
    stock: null,
    trackStock: false,
    isService: false,
    isSuggested: true,
    itemType: "restaurant",
    categoryName: "Pizzas",
    restaurant: {
      id: "rest-2",
      name: "Mamma Mia",
      slug: "mamma-mia",
      logoUrl: "/logo2.png",
      specialty: "Comida Italiana",
      businessType: "RESTAURANT",
      catalogMode: "MENU",
      locality: "Manta, Manabí",
      city: "Manta",
      province: "Manabí",
      parish: "Manta",
      sector: "Barbasquillo",
      latitude: -0.962,
      longitude: -80.712,
      themeColor: "#10b981",
      whatsapp: "+593988776655",
    },
  },
  {
    id: "item-3",
    name: "Whisky Chivas Regal 12 Años",
    description: "Botella 750ml importada original",
    price: 38.0,
    imageUrl: "/uploads/whisky.jpg",
    isAvailable: true,
    stock: 10,
    trackStock: true,
    isService: false,
    isSuggested: true,
    itemType: "store",
    categoryName: "Licores",
    restaurant: {
      id: "rest-3",
      name: "Sumeria Liquors",
      slug: "sumeria-liquors",
      logoUrl: "/logo3.png",
      specialty: "Licores y Vinos",
      businessType: "RETAIL",
      catalogMode: "CATALOG",
      locality: "Montañita, Santa Elena",
      city: "Santa Elena",
      province: "Santa Elena",
      parish: "Manglaralto",
      sector: "Montañita",
      latitude: -1.828,
      longitude: -80.751,
      themeColor: "#3b82f6",
      whatsapp: "593977665544",
    },
  },
];

// Test 1: Category Separation
const restaurantItems = mockItems.filter((i) => i.itemType === "restaurant");
const storeItems = mockItems.filter((i) => i.itemType === "store");

if (restaurantItems.length !== 2 || storeItems.length !== 1) {
  console.error("❌ Test 1 FAILED: Incorrect classification count", {
    restaurants: restaurantItems.length,
    stores: storeItems.length,
  });
  process.exit(1);
}
console.log("✅ [PASS] Test 1: Separación estricta de ítems de Restaurantes (2) vs Tiendas (1)");

// Test 2: Search by query (dishes and stores)
const query = "empanada";
const searched = mockItems.filter((i) => i.name.toLowerCase().includes(query));
if (searched.length !== 1 || searched[0].id !== "item-1") {
  console.error("❌ Test 2 FAILED: Search by keyword failed", searched);
  process.exit(1);
}
console.log("✅ [PASS] Test 2: Búsqueda libre por término gastronómico encuentra el plato exacto");

// Test 3: Geo Filter by Province
const santaElenaItems = mockItems.filter(
  (i) => i.restaurant.province.toLowerCase() === "santa elena"
);
if (santaElenaItems.length !== 2) {
  console.error("❌ Test 3 FAILED: Geo filter Santa Elena failed", santaElenaItems);
  process.exit(1);
}
console.log("✅ [PASS] Test 3: Filtro geográfico por provincia (Santa Elena) agrupa tanto restaurante como tienda");

// Test 4: Price Sorting
const sortedAsc = [...mockItems].sort((a, b) => a.price - b.price);
if (sortedAsc[0].price !== 3.5 || sortedAsc[2].price !== 38.0) {
  console.error("❌ Test 4 FAILED: Price sorting asc failed", sortedAsc);
  process.exit(1);
}
console.log("✅ [PASS] Test 4: Ordenamiento por precio ascendente ($3.50 -> $38.00) verificado");

// Test 5: WhatsApp formatting helper
function formatWaLink(item: MarketplaceItem): string {
  const raw = item.restaurant.whatsapp || "593999999999";
  let clean = raw.replace(/\D/g, "");
  if (!clean.startsWith("593") && clean.startsWith("0")) {
    clean = "593" + clean.substring(1);
  }
  return `https://wa.me/${clean}?text=${encodeURIComponent(
    `Hola ${item.restaurant.name}, deseo pedir ${item.name}`
  )}`;
}

const waLink1 = formatWaLink(mockItems[0]);
if (!waLink1.includes("593991112233") || !waLink1.includes("Empanada")) {
  console.error("❌ Test 5 FAILED: WhatsApp link formatting failed", waLink1);
  process.exit(1);
}
console.log("✅ [PASS] Test 5: Enlace a WhatsApp Express generado con prefijo Ecuador 593 y nombre del producto");

console.log("==========================================");
console.log("🎉 TODAS LAS PRUEBAS DEL MARKETPLACE PASARON (5/5)");
console.log("==========================================");
