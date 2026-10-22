import assert from "node:assert";

console.log("==========================================");
console.log("🧪 TESTING SUPER ADMIN NEW EXTENSIONS (3 IN 1)");
console.log("==========================================");

// 1. TEST: GMV and Churn Risk Logic
function calculateAnalyticsMetrics(orders: any[], restaurants: any[]) {
  const nonCancelledOrders = orders.filter((o) => o.status !== "CANCELLED");
  const gmvTotal = nonCancelledOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  const topRestaurants = [...restaurants]
    .sort((a, b) => (b.totalOrders || 0) - (a.totalOrders || 0))
    .slice(0, 5);

  const atRisk = restaurants.filter((r) => {
    const noOrders = (r.recentOrders || 0) === 0;
    const lowPhotos = (r.photoPercentage || 0) < 40;
    return noOrders || lowPhotos;
  });

  return { gmvTotal, topRestaurants, atRisk };
}

const mockOrders = [
  { id: "o-1", total: 25.5, status: "COMPLETED" },
  { id: "o-2", total: 40.0, status: "DELIVERED" },
  { id: "o-3", total: 100.0, status: "CANCELLED" }, // should be ignored
];

const mockRestaurants = [
  { id: "r-1", name: "Pizzería Roma", totalOrders: 150, recentOrders: 20, photoPercentage: 85 },
  { id: "r-2", name: "Burgers Express", totalOrders: 80, recentOrders: 0, photoPercentage: 20 }, // at risk (no recent orders + low photos)
  { id: "r-3", name: "Marisquería El Faro", totalOrders: 210, recentOrders: 35, photoPercentage: 90 },
];

const analytics = calculateAnalyticsMetrics(mockOrders, mockRestaurants);
assert.strictEqual(analytics.gmvTotal, 65.5, "GMV total debe excluir órdenes canceladas y sumar 65.5");
assert.strictEqual(analytics.topRestaurants[0].name, "Marisquería El Faro", "Top 1 debe ser El Faro");
assert.strictEqual(analytics.atRisk.length, 1, "Debe detectar exactamente 1 restaurante en riesgo");
assert.strictEqual(analytics.atRisk[0].name, "Burgers Express", "Restaurante en riesgo debe ser Burgers Express");
console.log("✅ [PASS] Test 1: GMV, Top Comercios y Detector Anti-Churn calculados con éxito");

// 2. TEST: Global Announcement Payload
interface Announcement {
  text: string;
  type: "info" | "success" | "warning" | "promo";
  link?: string;
  active: boolean;
}

function validateAnnouncement(data: Announcement) {
  assert(data.text && data.text.trim().length > 0, "El texto del anuncio no puede ser vacío");
  assert(["info", "success", "warning", "promo"].includes(data.type), "Tipo de anuncio debe ser válido");
  assert(typeof data.active === "boolean", "Estado activo debe ser booleano");
  return true;
}

const validPromo: Announcement = {
  text: "¡Ruleta de Premios ya disponible!",
  type: "promo",
  link: "/admin?tab=ruleta",
  active: true,
};
assert.strictEqual(validateAnnouncement(validPromo), true);
console.log("✅ [PASS] Test 2: Validación de esquema para Comunicados In-App correcta");

// 3. TEST: CSV Generation with UTF-8 BOM and RFC 4180 Escaping
function formatCsv(headers: string[], rows: (string | number)[][]): string {
  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  return (
    "\uFEFF" +
    headers.map(escapeCsv).join(",") +
    "\n" +
    rows.map((row) => row.map(escapeCsv).join(",")).join("\n")
  );
}

const csvOutput = formatCsv(
  ["Nombre", "Ciudad", "Nota"],
  [["Parrilladas \"El Gaucho\"", "Guayaquil", "Promoción 2x1 en carnes"]]
);

assert(csvOutput.startsWith("\uFEFF"), "El CSV debe comenzar con el BOM UTF-8 para compatibilidad Excel");
assert(csvOutput.includes('"Parrilladas ""El Gaucho"""'), "Las comillas dentro de un valor deben escaparse duplicadas");
assert(csvOutput.includes('"Guayaquil"'), "Los valores deben estar encapsulados");
console.log("✅ [PASS] Test 3: Generación de reportes CSV con UTF-8 BOM y escapado RFC 4180 verificada");

console.log("==========================================");
console.log("🎉 ALL SUPER ADMIN EXTENSION TESTS PASSED");
console.log("==========================================");
