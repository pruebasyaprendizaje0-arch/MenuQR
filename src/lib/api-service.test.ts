/**
 * Test Suite para centralApiService en MenuQR Pro.
 * Verifica la existencia y firma de cada llamada a la API Central.
 */
import assert from "assert";
import { centralApiService, isCentralApiEnabled, getApiBaseUrl } from "./api-service";

async function runTests() {
  console.log("==========================================");
  console.log("  MenuQR Pro - Central API Test Suite");
  console.log("==========================================");

  // 1. Check feature flag helper
  assert.strictEqual(typeof isCentralApiEnabled, "function", "isCentralApiEnabled debe ser una función");
  assert.strictEqual(typeof isCentralApiEnabled(), "boolean", "isCentralApiEnabled debe retornar boolean");
  console.log("✔ Test 1: isCentralApiEnabled helper verificado.");

  // 2. Auth Endpoints
  assert.strictEqual(typeof centralApiService.login, "function", "login debe estar definido");
  assert.strictEqual(typeof centralApiService.register, "function", "register debe estar definido");
  assert.strictEqual(typeof centralApiService.getMe, "function", "getMe debe estar definido");
  console.log("✔ Test 2: Métodos de Autenticación (Fase 1) verificados.");

  // 3. Read Endpoints (Fase 2)
  assert.strictEqual(typeof centralApiService.getMenu, "function", "getMenu debe estar definido");
  assert.strictEqual(typeof centralApiService.getBusinesses, "function", "getBusinesses debe estar definido");
  assert.strictEqual(typeof centralApiService.getBusinessById, "function", "getBusinessById debe estar definido");
  assert.strictEqual(typeof centralApiService.getBranches, "function", "getBranches debe estar definido");
  assert.strictEqual(typeof centralApiService.getCategories, "function", "getCategories debe estar definido");
  assert.strictEqual(typeof centralApiService.getProducts, "function", "getProducts debe estar definido");
  assert.strictEqual(typeof centralApiService.getOrders, "function", "getOrders debe estar definido");
  console.log("✔ Test 3: Métodos de Lectura de la API Central (Fase 2) verificados.");

  // 4. Write Endpoints (Fase 3)
  assert.strictEqual(typeof centralApiService.createBusiness, "function", "createBusiness debe estar definido");
  assert.strictEqual(typeof centralApiService.updateBusiness, "function", "updateBusiness debe estar definido");
  assert.strictEqual(typeof centralApiService.createBranch, "function", "createBranch debe estar definido");
  assert.strictEqual(typeof centralApiService.createCategory, "function", "createCategory debe estar definido");
  assert.strictEqual(typeof centralApiService.updateCategory, "function", "updateCategory debe estar definido");
  assert.strictEqual(typeof centralApiService.deleteCategory, "function", "deleteCategory debe estar definido");
  assert.strictEqual(typeof centralApiService.createProduct, "function", "createProduct debe estar definido");
  assert.strictEqual(typeof centralApiService.updateProduct, "function", "updateProduct debe estar definido");
  assert.strictEqual(typeof centralApiService.setProductAvailability, "function", "setProductAvailability debe estar definido");
  assert.strictEqual(typeof centralApiService.deleteProduct, "function", "deleteProduct debe estar definido");
  assert.strictEqual(typeof centralApiService.createOrder, "function", "createOrder debe estar definido");
  assert.strictEqual(typeof centralApiService.updateOrderStatus, "function", "updateOrderStatus debe estar definido");
  console.log("✔ Test 4: Métodos de Escritura de la API Central (Fase 3) verificados.");

  // 5. Test MIGRATION_API_URL priority in getApiBaseUrl
  const originalMigrationUrl = process.env.MIGRATION_API_URL;
  const originalApiUrl = process.env.API_URL;
  const originalNextPublicUrl = process.env.NEXT_PUBLIC_API_URL;

  try {
    process.env.MIGRATION_API_URL = "http://host-interno-migration:3000";
    process.env.API_URL = "http://host-interno-api:3000";
    process.env.NEXT_PUBLIC_API_URL = "https://api.ubicame.cc";

    assert.strictEqual(
      getApiBaseUrl(),
      "http://host-interno-migration:3000",
      "MIGRATION_API_URL debe tener la prioridad más alta"
    );

    delete process.env.MIGRATION_API_URL;
    assert.strictEqual(
      getApiBaseUrl(),
      "http://host-interno-api:3000",
      "API_URL debe tener la segunda prioridad más alta"
    );

    delete process.env.API_URL;
    assert.strictEqual(
      getApiBaseUrl(),
      "https://api.ubicame.cc",
      "NEXT_PUBLIC_API_URL debe usarse si MIGRATION_API_URL y API_URL no están presentes"
    );
  } finally {
    process.env.MIGRATION_API_URL = originalMigrationUrl;
    process.env.API_URL = originalApiUrl;
    process.env.NEXT_PUBLIC_API_URL = originalNextPublicUrl;
  }
  console.log("✔ Test 5: Prioridad de MIGRATION_API_URL verificada correctamente.");

  console.log("------------------------------------------");
  console.log("  TODAS LAS PRUEBAS DE LA API PASARON (100%)");
  console.log("==========================================");
}

runTests().catch((err) => {
  console.error("❌ Falló la suite de pruebas de la API:", err);
  process.exit(1);
});
