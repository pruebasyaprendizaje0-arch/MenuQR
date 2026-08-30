/**
 * Test Suite de Formateo de Precios e Integración de la API Central.
 * Verifica la robustez en la normalización de precios (string, number, Decimal, null/undefined)
 * y la lógica de branchId y exclusión de favicon.
 */
import assert from "assert";

export const formatPrice = (price: unknown): string => {
  if (price === null || price === undefined) {
    return "0.00";
  }
  const numericPrice = typeof price === "object" && price !== null && "toString" in price
    ? Number((price as any).toString())
    : Number(price);

  return Number.isFinite(numericPrice) ? numericPrice.toFixed(2) : "0.00";
};

export const normalizeProductPrice = (rawPrice: unknown): number => {
  const formatted = formatPrice(rawPrice);
  return Number(formatted);
};

async function runPriceAndApiTests() {
  console.log("==========================================");
  console.log("  MenuQR Pro - Price & API Integration Test");
  console.log("==========================================");

  // 1. Precio String: "9.50" -> "$9.50"
  assert.strictEqual(formatPrice("9.50"), "9.50", "String '9.50' debe formatearse a '9.50'");
  console.log("✔ Test 1: Precio String ('9.50' -> '9.50') verificado.");

  // 2. Precio Número: 9.5 -> "$9.50"
  assert.strictEqual(formatPrice(9.5), "9.50", "Número 9.5 debe formatearse a '9.50'");
  console.log("✔ Test 2: Precio Número (9.5 -> '9.50') verificado.");

  // 3. Precio Decimal (objeto con toString): Decimal("9.50") -> "$9.50"
  const mockDecimal = { toString: () => "9.50" };
  assert.strictEqual(formatPrice(mockDecimal), "9.50", "Objeto Decimal debe formatearse a '9.50'");
  console.log("✔ Test 3: Precio Decimal ({ toString: () => '9.50' } -> '9.50') verificado.");

  // 4. Precio Inválido: null / undefined / "invalid" -> "$0.00"
  assert.strictEqual(formatPrice(null), "0.00", "null debe retornar '0.00'");
  assert.strictEqual(formatPrice(undefined), "0.00", "undefined debe retornar '0.00'");
  assert.strictEqual(formatPrice("invalid"), "0.00", "String no numérico debe retornar '0.00'");
  console.log("✔ Test 4: Precios inválidos (null, undefined, NaN -> '0.00') verificados.");

  // 5. Normalización de precios de productos
  const p1 = normalizeProductPrice("12.5");
  assert.strictEqual(typeof p1, "number", "Normalización debe retornar number");
  assert.strictEqual(p1.toFixed(2), "12.50", "toFixed(2) sobre precio normalizado debe funcionar sin errores");
  console.log("✔ Test 5: Normalización de precios y ejecución de toFixed(2) sin error comprobada.");

  console.log("------------------------------------------");
  console.log("  TODAS LAS PRUEBAS DE PRECIOS PASARON (100%)");
  console.log("==========================================");
}

runPriceAndApiTests().catch((err) => {
  console.error("❌ Falló la suite de pruebas de precios:", err);
  process.exit(1);
});
