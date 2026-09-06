import { prismaTenant } from "@/lib/db";
import { generateRestaurantJsonLd, normalizeSlug, unslugify, getBaseUrl, resolvePublicImageUrl } from "@/lib/seo";
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

    // TEST 2: Slug Normalization, Unslugify & Canonical Base URL
    assert(normalizeSlug("Manta, Manabí!") === "manta-manabi", "normalizeSlug debe limpiar caracteres especiales");
    assert(unslugify("las-empanadas-de-mauro") === "Las Empanadas De Mauro", "unslugify debe formatear correctamente");
    assert(getBaseUrl() === (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://menuqr.ubicame.cc"), "getBaseUrl debe retornar el dominio canónico de producción");

    // TEST 2B: Public Page Link Audit (Prevent regression links to /mamma-mia)
    const fs = await import("fs");
    const path = await import("path");
    const mainPagePath = path.join(process.cwd(), "src", "app", "page.tsx");
    const slugPagePath = path.join(process.cwd(), "src", "app", "[slug]", "page.tsx");

    const mainPageContent = fs.readFileSync(mainPagePath, "utf-8");
    const slugPageContent = fs.readFileSync(slugPagePath, "utf-8");

    assert(!mainPageContent.includes('href="/mamma-mia"'), "src/app/page.tsx no debe contener enlaces a /mamma-mia");
    assert(!slugPageContent.includes('href="/mamma-mia"'), "src/app/[slug]/page.tsx no debe contener enlaces a /mamma-mia");
    assert(mainPageContent.includes('href="/pigro"'), "src/app/page.tsx debe enlazar al menú de muestra /pigro");
    assert(slugPageContent.includes('href="/pigro"'), "src/app/[slug]/page.tsx debe enlazar al menú de muestra /pigro");

    // TEST 3: Safe Image URL Resolution (resolvePublicImageUrl)
    assert(resolvePublicImageUrl("https://example.com/logo.png") === "https://example.com/logo.png", "resolvePublicImageUrl debe conservar URL HTTPS válida");
    assert(resolvePublicImageUrl("http://example.com/photo.jpg") === "http://example.com/photo.jpg", "resolvePublicImageUrl debe conservar URL HTTP válida");
    assert(resolvePublicImageUrl("/uploads/dish.webp") === `${getBaseUrl()}/uploads/dish.webp`, "resolvePublicImageUrl debe convertir ruta relativa en absoluta con dominio canónico");
    assert(resolvePublicImageUrl("uploads/dish.webp") === `${getBaseUrl()}/uploads/dish.webp`, "resolvePublicImageUrl debe convertir ruta relativa sin slash en absoluta");
    assert(resolvePublicImageUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg...") === undefined, "resolvePublicImageUrl debe rechazar cadenas data:image");
    assert(resolvePublicImageUrl("javascript:alert(1)") === undefined, "resolvePublicImageUrl debe rechazar esquemas javascript:");
    assert(resolvePublicImageUrl("") === undefined, "resolvePublicImageUrl debe retornar undefined para cadenas vacías");
    assert(resolvePublicImageUrl(null) === undefined, "resolvePublicImageUrl debe retornar undefined para valores nulos");

    // TEST 4: Schema.org JSON-LD (image filtering, openingHoursSpecification, priceRange, sameAs filtering, custom metadata)
    if (mammaMia) {
      const mockRestaurantData = {
        ...mammaMia,
        seoTitle: "Mamma Mia SEO Custom Title",
        priceRange: "$$",
        googleBusinessUrl: "https://maps.google.com/?cid=valid_url_for_test",
        logoUrl: "data:image/jpeg;base64,invalidDataUriLogo",
        categories: [
          {
            name: "Pastas",
            dishes: [
              {
                name: "Spaghetti Pesto",
                description: "Spaghetti con pesto casero",
                imageUrl: "data:image/jpeg;base64,invalidDataUriDish",
                price: 11.9,
                isAvailable: true,
              },
              {
                name: "Lasagna",
                description: "Lasagna de carne",
                imageUrl: "https://images.example.com/lasagna.jpg",
                price: 14.9,
                isAvailable: true,
              },
            ],
          },
        ],
        structuredSchedule: JSON.stringify({
          monday: { open: "12:00", close: "23:00", closed: false },
          tuesday: { open: "12:00", close: "23:00", closed: false },
        }),
      };

      const jsonLd = generateRestaurantJsonLd(mockRestaurantData);
      assert(jsonLd["@context"] === "https://schema.org", "Schema.org debe incluir @context");
      assert(Array.isArray(jsonLd["@graph"]), "Schema.org debe usar la especificación @graph");

      const graph = jsonLd["@graph"] as Array<Record<string, unknown>>;
      const restaurantEntity = graph.find((item) => {
        const types = item["@type"];
        return Array.isArray(types) && types.includes("Restaurant");
      });

      assert(!!restaurantEntity, "Schema.org debe contener una entidad Restaurant");
      assert(restaurantEntity?.image === undefined, "La propiedad image del restaurante debe ser omitida si es un data:URI");
      assert(restaurantEntity?.priceRange === "$$", "priceRange debe ser emitido correctamente como '$$'");

      const openingHours = restaurantEntity?.openingHoursSpecification as Array<Record<string, unknown>>;
      assert(Array.isArray(openingHours) && openingHours.length === 2, "openingHoursSpecification debe contener las 2 reglas de horario válidas");
      assert(openingHours?.[0]?.dayOfWeek === "Monday" && openingHours?.[0]?.opens === "12:00", "openingHoursSpecification debe formatear correctamente el día Monday");

      const menuObj = restaurantEntity?.hasMenu as Record<string, unknown>;
      const menuSections = menuObj?.hasMenuSection as Array<Record<string, unknown>>;
      const dishesList = menuSections?.[0]?.hasMenuItem as Array<Record<string, unknown>>;

      assert(dishesList?.[0]?.image === undefined, "Dishes con data:URI no deben incluir propiedad image en JSON-LD");
      assert(dishesList?.[1]?.image === "https://images.example.com/lasagna.jpg", "Dishes con URL HTTPS válida deben incluir propiedad image intacta");

      const stringifiedJsonLd = JSON.stringify(jsonLd);
      assert(!stringifiedJsonLd.includes("data:image"), "El JSON-LD generado no debe contener ninguna ocurrencia de data:image");
      assert(!stringifiedJsonLd.includes(`${getBaseUrl()}data:image`), "El JSON-LD generado no debe contener URLs malformadas de tipo https://...data:image");

      const sameAs = restaurantEntity?.sameAs as string[];
      assert(Array.isArray(sameAs) && sameAs.includes("https://maps.google.com/?cid=valid_url_for_test"), "googleBusinessUrl válido debe incluirse en sameAs");

      // Test filtering invalid/empty googleBusinessUrl (sin protocolo HTTP/HTTPS)
      const noGbusData = {
        ...mammaMia,
        googleBusinessUrl: "invalid-url-without-http",
      };
      const jsonLdNoGbus = generateRestaurantJsonLd(noGbusData);
      const restaurantNoGbus = (jsonLdNoGbus["@graph"] as Array<Record<string, unknown>>).find((item) => {
        const types = item["@type"];
        return Array.isArray(types) && types.includes("Restaurant");
      });
      const sameAsNoGbus = (restaurantNoGbus?.sameAs as string[]) || [];
      assert(!sameAsNoGbus.includes("invalid-url-without-http"), "googleBusinessUrl inválido sin HTTP debe ser excluido de sameAs");
    }

    // TEST 5: Profile Completeness Score
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
