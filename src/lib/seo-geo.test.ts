import { prismaTenant } from "@/lib/db";
import { generateRestaurantJsonLd, normalizeSlug, unslugify } from "@/lib/seo";
import { calculateRestaurantCompleteness } from "@/lib/completeness";

async function runTests() {
  console.log("==========================================");
  console.log("🧪 RUNNING MENUQR SEO + GEO + SCHEMA TESTS");
  console.log("==========================================\n");

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

  // TEST 1: Database Model & Demo Restaurants
  try {
    const restaurants = await prismaTenant.restaurant.findMany({
      include: {
        categories: {
          include: {
            dishes: true,
          },
        },
      },
    });

    assert(restaurants.length >= 2, `Deberían existir al menos 2 restaurantes demo en PostgreSQL (Encontrados: ${restaurants.length})`);

    const mammaMia = restaurants.find((r) => r.slug === "mamma-mia");
    assert(!!mammaMia, "Demo Business 1 (mamma-mia) debe existir");
    if (mammaMia) {
      assert(mammaMia.province === "Manabí", "Mamma Mia debe tener province = Manabí");
      assert(mammaMia.city === "Manta", "Mamma Mia debe tener city = Manta");
      assert(typeof mammaMia.latitude === "number", "Mamma Mia debe tener latitud numérica");
    }

    const mauro = restaurants.find((r) => r.slug === "las-empanadas-de-mauro");
    assert(!!mauro, "Demo Business 2 (las-empanadas-de-mauro) debe existir");
    if (mauro) {
      assert(mauro.province === "Santa Elena", "Las Empanadas de Mauro debe tener province = Santa Elena");
      assert(mauro.city === "Santa Elena", "Las Empanadas de Mauro debe tener city = Santa Elena");
      assert(mauro.sector === "Montañita", "Las Empanadas de Mauro debe tener sector = Montañita");
    }

    // TEST 2: Slug Normalization & Unslugify
    assert(normalizeSlug("Manta, Manabí!") === "manta-manabi", "normalizeSlug debe limpiar caracteres especiales");
    assert(unslugify("las-empanadas-de-mauro") === "Las Empanadas De Mauro", "unslugify debe formatear correctamente");

    // TEST 3: Schema.org Generation
    if (mammaMia) {
      const jsonLd = generateRestaurantJsonLd(mammaMia);
      assert(jsonLd["@context"] === "https://schema.org", "Schema.org debe incluir @context");
      assert(Array.isArray(jsonLd["@graph"]), "Schema.org debe usar la especificación @graph");
      const restaurantEntity = jsonLd["@graph"].find((item: any) => item["@type"]?.includes("Restaurant"));
      assert(!!restaurantEntity, "Schema.org debe contener una entidad Restaurant");
      assert(restaurantEntity?.geo?.latitude === -0.9548, "Schema.org debe emitir GeoCoordinates si latitud es válida");
    }

    // TEST 4: Profile Completeness Score
    if (mammaMia) {
      const report = calculateRestaurantCompleteness(mammaMia);
      assert(report.overallScore >= 80, `Completeness score de Mamma Mia debe ser >= 80% (Actual: ${report.overallScore}%)`);
    }
  } catch (error) {
    console.error("Test execution encountered an exception:", error);
    failed++;
  }

  console.log("\n==========================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==========================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
