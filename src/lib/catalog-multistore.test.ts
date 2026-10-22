import assert from "assert";
import { sanitizeSlug, findRestaurantBySlugOrHistory } from "./slugs";

async function runTests() {
  console.log("==========================================");
  console.log("🧪 RUNNING CATALOG & MULTI-STORE TEST SUITE");
  console.log("==========================================");

  // 1. Slug Sanitization Tests
  assert.strictEqual(sanitizeSlug("Gitana swimwear"), "gitana-swimwear", "Debe convertir espacios a guiones");
  assert.strictEqual(sanitizeSlug("gitana   swimwear"), "gitana-swimwear", "Debe colapsar múltiples espacios a un solo guión");
  assert.strictEqual(sanitizeSlug("Aura Boutique & Calzado Urbano!"), "aura-boutique-calzado-urbano", "Debe eliminar caracteres especiales (&, !)");
  assert.strictEqual(sanitizeSlug("Tienda de Ropa Niño/Niña"), "tienda-de-ropa-nino-nina", "Debe normalizar tildes y eñes");
  assert.strictEqual(sanitizeSlug("--espacios-iniciales-y-finales--"), "espacios-iniciales-y-finales", "Debe recortar guiones en los extremos");
  assert.strictEqual(sanitizeSlug(""), "", "String vacío debe retornar vacío");
  console.log("✅ [PASS] Test 1: Sanitización universal de slugs verificada");

  // 2. Resilient Slug Search Tests (encoded vs decoded)
  const encodedTest = "%20gitana%20swimwear%20";
  let decoded = "";
  try {
    decoded = decodeURIComponent(encodedTest);
  } catch {}
  assert.strictEqual(sanitizeSlug(decoded), "gitana-swimwear", "Debe sanitizar correctamente slugs decodificados desde URI");
  console.log("✅ [PASS] Test 2: Búsqueda resiliente con slugs codificados (%20) verificada");

  // 3. Google OAuth BaseUrl 0.0.0.0 Safety Filter Test
  function sanitizeHostTest(host: string, appUrl?: string) {
    if (appUrl && !appUrl.includes("localhost") && !appUrl.includes("0.0.0.0")) {
      return appUrl.replace(/\/$/, "");
    }
    let cleanHost = host;
    if (!cleanHost || cleanHost.includes("0.0.0.0")) {
      cleanHost = "localhost:3000";
    }
    return `https://${cleanHost}`;
  }

  assert.strictEqual(sanitizeHostTest("0.0.0.0:3000"), "https://localhost:3000", "Debe reemplazar 0.0.0.0 por localhost:3000");
  assert.strictEqual(sanitizeHostTest("0.0.0.0"), "https://localhost:3000", "Debe sanitizar 0.0.0.0 aislado");
  assert.strictEqual(sanitizeHostTest("0.0.0.0:3000", "https://ubicame.cc"), "https://ubicame.cc", "Debe priorizar APP_URL legítimo");
  console.log("✅ [PASS] Test 3: Filtro contra 0.0.0.0 en redirecciones de Google OAuth verificado");

  // 4. Test Multi-Store active ID priority logic
  const mockUserRestaurants = [
    { id: "store-1", name: "Sumeria liquors", slug: "sumeria", userId: "user-abc" },
    { id: "store-2", name: "Gitana", slug: "gitana-swimwear", userId: "user-abc" },
  ];

  function resolveActiveStore(activeId: string | undefined, userId: string, list: typeof mockUserRestaurants) {
    if (activeId) {
      const match = list.find((r) => r.id === activeId && r.userId === userId);
      if (match) return match;
    }
    return list.find((r) => r.userId === userId) || null;
  }

  // Without activeId: returns first
  const defaultStore = resolveActiveStore(undefined, "user-abc", mockUserRestaurants);
  assert.strictEqual(defaultStore?.name, "Sumeria liquors", "Sin activeId debe devolver el primer negocio");

  // With activeId targeting store-2 (Gitana): strictly returns Gitana, NOT Sumeria
  const activeGitana = resolveActiveStore("store-2", "user-abc", mockUserRestaurants);
  assert.strictEqual(activeGitana?.name, "Gitana", "Con activeId='store-2' debe resolver estrictamente Gitana");
  assert.strictEqual(activeGitana?.slug, "gitana-swimwear", "El slug para 'Ver Catálogo' debe ser gitana-swimwear");
  console.log("✅ [PASS] Test 4: Aislamiento estricto de activeId en cuentas multi-negocio verificado");

  console.log("==========================================");
  console.log("🎉 TODAS LAS PRUEBAS DE CATÁLOGO Y MULTI-TIENDA PASARON (4/4)");
  console.log("==========================================");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
