import assert from "node:assert";

console.log("=== INICIANDO PRUEBAS UNITARIAS: PLATOS SUGERIDOS / DEL DÍA ===");

// Simulación de lógica de platos sugeridos
function filterSuggestedDishes<T extends { id: string; name: string; isAvailable: boolean }>(
  allDishes: T[],
  suggestedIds: string[]
): T[] {
  if (!suggestedIds || suggestedIds.length === 0) return [];
  return allDishes.filter((dish) => suggestedIds.includes(dish.id) && dish.isAvailable);
}

function toggleSuggestedId(currentIds: string[], dishId: string): string[] {
  if (currentIds.includes(dishId)) {
    return currentIds.filter((id) => id !== dishId);
  }
  return [...currentIds, dishId];
}

const mockDishes = [
  { id: "dish-1", name: "Ceviche Mixto", isAvailable: true },
  { id: "dish-2", name: "Encebollado Especial", isAvailable: true },
  { id: "dish-3", name: "Arroz Marinero", isAvailable: false },
  { id: "dish-4", name: "Seco de Pollo", isAvailable: true },
];

// Test 1: Filtrar platos sugeridos disponibles
const suggested = filterSuggestedDishes(mockDishes, ["dish-1", "dish-3"]);
assert.strictEqual(suggested.length, 1, "Debe retornar solo platos sugeridos que estén disponibles");
assert.strictEqual(suggested[0].id, "dish-1", "El plato retornado debe ser el plato sugerido disponible");
console.log("✅ [PASS] Filtrado de platos sugeridos disponibles correcto");

// Test 2: Toggle activar plato sugerido
let ids: string[] = [];
ids = toggleSuggestedId(ids, "dish-1");
assert.deepStrictEqual(ids, ["dish-1"], "Debe agregar el ID a la lista");
console.log("✅ [PASS] Alternar agregar plato sugerido");

// Test 3: Toggle desactivar plato sugerido
ids = toggleSuggestedId(ids, "dish-1");
assert.deepStrictEqual(ids, [], "Debe remover el ID de la lista");
console.log("✅ [PASS] Alternar remover plato sugerido");

// Test 4: Manejo de lista vacía
const emptySuggested = filterSuggestedDishes(mockDishes, []);
assert.strictEqual(emptySuggested.length, 0, "Debe retornar array vacío si no hay sugeridos");
console.log("✅ [PASS] Manejo seguro de lista vacía");

console.log("🎉 ¡TODAS LAS PRUEBAS DE PLATOS SUGERIDOS PASARON SATISFACTORIAMENTE!");
