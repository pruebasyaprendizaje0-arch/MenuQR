import { parseSearchQuery } from "./search-parser";
import { executeGastronomicSearch } from "./search-service";

async function runGastroSearchTests() {
  console.log("==================================================");
  console.log("🧪 RUNNING GASTRONOMIC SEARCH ENGINE TEST SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  // TEST 1: Intent & Location Parsing
  const parsed1 = parseSearchQuery("pizza en Manta");
  assert(parsed1.locationToken === "Manta", "Intent parser debe detectar locationToken = Manta");
  assert(parsed1.categoryToken === "pizza", "Intent parser debe detectar categoryToken = pizza");

  const parsed2 = parseSearchQuery("empanadas baratas en Montañita");
  assert(parsed2.locationToken === "Montañita", "Intent parser debe detectar locationToken = Montañita");
  assert(parsed2.categoryToken === "empanadas", "Intent parser debe detectar categoryToken = empanadas");
  assert(parsed2.wantsCheap === true, "Intent parser debe detectar intención de barato");

  // TEST 2: Query 1 - "pizza en Manta" -> Mamma Mia
  const res1 = await executeGastronomicSearch({ query: "pizza en Manta" });
  assert(res1.success === true, "Búsqueda debe retornar success: true");
  assert(res1.totalRestaurants > 0, "Búsqueda 'pizza en Manta' debe encontrar al menos 1 restaurante");
  if (res1.restaurants.length > 0) {
    assert(res1.restaurants[0].slug === "mamma-mia", "Primer resultado de 'pizza en Manta' debe ser Mamma Mia");
  }

  // TEST 3: Query 2 - "empanadas en Montañita" -> Las Empanadas de Mauro
  const res2 = await executeGastronomicSearch({ query: "empanadas en Montañita" });
  assert(res2.totalRestaurants > 0, "Búsqueda 'empanadas en Montañita' debe encontrar al menos 1 restaurante");
  if (res2.restaurants.length > 0) {
    assert(res2.restaurants[0].slug === "las-empanadas-de-mauro", "Primer resultado de 'empanadas en Montañita' debe ser Las Empanadas de Mauro");
  }

  // TEST 4: Query 3 - "Pizza Margherita" -> Dish Match
  const res3 = await executeGastronomicSearch({ query: "Pizza Margherita" });
  assert(res3.totalDishes > 0, "Búsqueda 'Pizza Margherita' debe encontrar el plato");
  if (res3.matchedDishes.length > 0) {
    assert(res3.matchedDishes[0].name.toLowerCase().includes("margherita"), "Plato coincidente debe ser Pizza Margherita");
  }

  // TEST 5: Empty query with 0 results - "sushi en Montañita" -> Suggestions
  const res4 = await executeGastronomicSearch({ query: "sushi en Montañita" });
  assert(res4.totalRestaurants === 0, "Búsqueda 'sushi en Montañita' debe devolver 0 restaurantes en la demo actual");
  assert(!!res4.suggestions, "Búsqueda sin resultados debe proporcionar sugerencias");
  assert(res4.suggestions?.availableCategories.length! > 0, "Sugerencias debe incluir categorías disponibles reales");

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runGastroSearchTests();
