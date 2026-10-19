import assert from "node:assert";
import {
  parseDishImages,
  getPrimaryDishImage,
  getSecondaryDishImage,
  getTertiaryDishImage,
  serializeDishImages,
} from "./dish-images";
import { resolvePublicImageUrl } from "./seo";

console.log("=================================================");
console.log("🧪 RUNNING COMPREHENSIVE DISH IMAGES GALLERY TESTS");
console.log("=================================================");

function runDishImagesTests() {
  // 1. Single standard URL parsing
  const single = "https://images.unsplash.com/photo-shirt.webp";
  assert.deepStrictEqual(parseDishImages(single), [single], "Single URL must return array with 1 item");
  assert.strictEqual(getPrimaryDishImage(single), single, "Primary image must be the single URL");
  assert.strictEqual(getSecondaryDishImage(single), null, "Secondary image must be null for single URL");
  assert.strictEqual(getTertiaryDishImage(single), null, "Tertiary image must be null for single URL");
  console.log("✅ [PASS] 100% Retrocompatibilidad con URLs simples");

  // 2. Relative uploads path
  const uploadPath = "/uploads/dish-12345.webp";
  assert.deepStrictEqual(parseDishImages(uploadPath), [uploadPath], "Upload path must parse cleanly");
  assert.strictEqual(getPrimaryDishImage(uploadPath), uploadPath, "Primary image matches upload path");
  console.log("✅ [PASS] Compatibilidad con subidas locales /uploads/");

  // 3. JSON array with 2 URLs (Frente y Dorso/Espalda)
  const jsonTwo = JSON.stringify([
    "https://example.com/camisa-frente.webp",
    "https://example.com/camisa-espalda.webp",
  ]);
  const parsedTwo = parseDishImages(jsonTwo);
  assert.strictEqual(parsedTwo.length, 2, "JSON with 2 items must parse 2 URLs");
  assert.strictEqual(getPrimaryDishImage(jsonTwo), "https://example.com/camisa-frente.webp", "Primary must be frente");
  assert.strictEqual(getSecondaryDishImage(jsonTwo), "https://example.com/camisa-espalda.webp", "Secondary must be espalda");
  assert.strictEqual(getTertiaryDishImage(jsonTwo), null, "Tertiary must be null");
  console.log("✅ [PASS] Soporte de 2 fotos (Frente y Dorso/Espalda para ropa)");

  // 4. JSON array with 3 URLs (Frente, Espalda y Detalle)
  const jsonThree = JSON.stringify([
    "https://example.com/foto1.webp",
    "https://example.com/foto2.webp",
    "https://example.com/foto3.webp",
  ]);
  const parsedThree = parseDishImages(jsonThree);
  assert.strictEqual(parsedThree.length, 3, "JSON with 3 items must parse 3 URLs");
  assert.strictEqual(getPrimaryDishImage(jsonThree), "https://example.com/foto1.webp");
  assert.strictEqual(getSecondaryDishImage(jsonThree), "https://example.com/foto2.webp");
  assert.strictEqual(getTertiaryDishImage(jsonThree), "https://example.com/foto3.webp");
  console.log("✅ [PASS] Soporte de 3 fotos (Carrusel completo)");

  // 5. Max 3 constraint enforcement
  const jsonFour = JSON.stringify([
    "https://example.com/1.webp",
    "https://example.com/2.webp",
    "https://example.com/3.webp",
    "https://example.com/4.webp",
  ]);
  assert.strictEqual(parseDishImages(jsonFour).length, 3, "Must truncate to max 3 items");
  console.log("✅ [PASS] Límite estricto de máximo 3 fotos por producto");

  // 6. Serialization
  assert.strictEqual(serializeDishImages(["https://example.com/1.webp"]), "https://example.com/1.webp", "1 item serializes as plain string URL");
  assert.strictEqual(
    serializeDishImages(["https://example.com/1.webp", "https://example.com/2.webp"]),
    '["https://example.com/1.webp","https://example.com/2.webp"]',
    "2 items serialize as JSON array"
  );
  assert.strictEqual(
    serializeDishImages(["https://example.com/1.webp", "  ", "https://example.com/3.webp"]),
    '["https://example.com/1.webp","https://example.com/3.webp"]',
    "Empty slots are cleanly filtered out"
  );
  assert.strictEqual(serializeDishImages([]), null, "Empty array returns null");
  assert.strictEqual(serializeDishImages(["", "  "]), null, "Only whitespace returns null");
  console.log("✅ [PASS] Serialización inteligente (1 URL = string simple, 2-3 URLs = JSON array)");

  // 7. SEO resolvePublicImageUrl with JSON multi-image input
  const resolved = resolvePublicImageUrl(jsonTwo);
  assert.strictEqual(resolved, "https://example.com/camisa-frente.webp", "SEO must extract front photo for OG/Schema.org");
  console.log("✅ [PASS] Integración transparente con SEO OpenGraph y Schema.org");

  // 8. Robustness with empty and null values
  assert.deepStrictEqual(parseDishImages(null), []);
  assert.deepStrictEqual(parseDishImages(undefined), []);
  assert.deepStrictEqual(parseDishImages(""), []);
  assert.deepStrictEqual(parseDishImages("   "), []);
  assert.strictEqual(getPrimaryDishImage(null), null);
  assert.strictEqual(getSecondaryDishImage(null), null);
  console.log("✅ [PASS] Manejo seguro de valores nulos y cadenas vacías");

  console.log("\n🎉 ALL DISH IMAGES GALLERY TESTS PASSED SUCCESSFULLY! (8/8)\n");
}

runDishImagesTests();
