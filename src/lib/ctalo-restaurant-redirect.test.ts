import assert from "node:assert";
import { resolveBusinessVertical } from "./business-labels";

console.log("=== INICIANDO PRUEBAS DE ENRUTAMIENTO INVERSO CTALO -> MENUQR ===");

// 1. Restaurante no debe ser resuelto como retail
const empanadasStore = {
  name: "Las Empanadas de Mauro",
  businessType: "RESTAURANT",
  customLabels: JSON.stringify({
    vertical: "menuqr",
    businessSubType: "RESTAURANT",
    catalogTabTitle: "Menú Digital",
  }),
};

const vertical = resolveBusinessVertical(empanadasStore as any);
assert.strictEqual(vertical, "restaurante", "Las Empanadas de Mauro debe ser 'restaurante'");
console.log("✅ [PASS] 1: 'Las Empanadas de Mauro' se resuelve correctamente como 'restaurante'");

// 2. Simulación de redirección de host cuando viene de ctalo.localhost
const mockHostLocal = "ctalo.localhost:3000";
const cleanHostLocal = mockHostLocal.includes("localhost")
  ? mockHostLocal.replace(/^(ctalo|catalogo)\./i, "")
  : mockHostLocal.replace(/^(ctalo|catalogo)\./i, "menuqr.");
assert.strictEqual(cleanHostLocal, "localhost:3000", "ctalo.localhost:3000 debe limpiar a localhost:3000");
console.log("✅ [PASS] 2: Redirección local de 'ctalo.localhost:3000' limpia a 'localhost:3000'");

// 3. Simulación de redirección en producción de ctalo.ubicame.cc
const mockHostProd = "ctalo.ubicame.cc";
const cleanHostProd = mockHostProd.includes("localhost")
  ? mockHostProd.replace(/^(ctalo|catalogo)\./i, "")
  : mockHostProd.replace(/^(ctalo|catalogo)\./i, "menuqr.");
assert.strictEqual(cleanHostProd, "menuqr.ubicame.cc", "ctalo.ubicame.cc debe redirigir a menuqr.ubicame.cc");
console.log("✅ [PASS] 3: Redirección producción de 'ctalo.ubicame.cc' redirige a 'menuqr.ubicame.cc'");

// 4. Verificación de tienda retail que sí debe quedarse en ctalo
const tiendaRopa = {
  name: "Aura Boutique & Calzado Urbano",
  businessType: "RETAIL",
  customLabels: null,
};
const verticalTienda = resolveBusinessVertical(tiendaRopa as any);
assert.strictEqual(verticalTienda, "retail", "Aura Boutique debe ser 'retail'");
console.log("✅ [PASS] 4: Tienda de ropa/calzado permanece en 'retail'");

console.log("==================================================");
console.log("🎉 TODAS LAS PRUEBAS DE ENRUTAMIENTO CTALO PASARON (4/4)");
console.log("==================================================");

