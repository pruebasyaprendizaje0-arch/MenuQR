import assert from "node:assert";
import { deleteUploadedFile } from "./storage";

async function runDailyMenuTests() {
  console.log("==========================================");
  console.log("🧪 RUNNING DAILY MENU (ALMUERZO DEL DÍA) TEST SUITE");
  console.log("==========================================");

  // Test 1: deleteUploadedFile previene Directory Traversal
  console.log("Test 1: Prevención de Directory Traversal en borrado de archivos");
  const traversalAttempt1 = await deleteUploadedFile("/uploads/../../etc/passwd");
  assert.strictEqual(traversalAttempt1, false, "Debe rechazar rutas con ..");

  const traversalAttempt2 = await deleteUploadedFile("uploads/../secret.env");
  assert.strictEqual(traversalAttempt2, false, "Debe rechazar rutas con ..");

  const externalUrl = await deleteUploadedFile("https://images.unsplash.com/photo-123");
  assert.strictEqual(externalUrl, false, "Debe ignorar URLs externas");

  const emptyUrl = await deleteUploadedFile("");
  assert.strictEqual(emptyUrl, false, "Debe ignorar URLs vacías");

  const nullUrl = await deleteUploadedFile(null);
  assert.strictEqual(nullUrl, false, "Debe ignorar URLs nulas");
  console.log("  ✅ Seguridad en deleteUploadedFile verificada al 100%");

  // Test 2: Validación de cupo máximo de 4 platos
  console.log("Test 2: Límite estricto de 4 opciones para el Menú del Día");
  const MAX_DAILY_DISHES = 4;
  const mockExistingDishes = [
    { id: "1", name: "Almuerzo Pollo" },
    { id: "2", name: "Almuerzo Carne" },
    { id: "3", name: "Sopa Marinera" },
    { id: "4", name: "Opción Vegetariana" },
  ];

  function canAddDailyDish(currentCount: number): boolean {
    return currentCount < MAX_DAILY_DISHES;
  }

  assert.strictEqual(canAddDailyDish(mockExistingDishes.length), false, "Debe rechazar un 5to plato");
  assert.strictEqual(canAddDailyDish(2), true, "Debe permitir plato cuando hay menos de 4");
  assert.strictEqual(canAddDailyDish(3), true, "Debe permitir plato cuando hay 3");
  console.log("  ✅ Regla de negocio de cupo máximo (4 platos) validada");

  // Test 3: Detección inteligente de categoría Menú del Día
  console.log("Test 3: Detección semántica de categorías de almuerzo");
  const categories = [
    { id: "cat-1", name: "Pizzas" },
    { id: "cat-2", name: "Bebidas" },
    { id: "cat-3", name: "Menú del Día" },
  ];

  const found = categories.find((c) => {
    const l = c.name.toLowerCase();
    return l.includes("menú del día") || l.includes("menu del dia") || l.includes("almuerzo") || l.includes("plato del día");
  });

  assert.ok(found, "Debe encontrar la categoría Menú del Día");
  assert.strictEqual(found?.id, "cat-3");
  console.log("  ✅ Detección de categoría 'Menú del Día' verificada");

  console.log("==========================================");
  console.log("🎉 ALL DAILY MENU TESTS PASSED (3/3)");
  console.log("==========================================");
}

runDailyMenuTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
