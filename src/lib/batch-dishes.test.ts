import assert from "node:assert";
import * as XLSX from "xlsx";
import { 
  extractDishRow, 
  parsePriceValue, 
  normalizeKey, 
  fixMojibake 
} from "./batch-dishes-parser";

console.log("=================================================");
console.log("🧪 RUNNING COMPREHENSIVE BATCH DISH IMPORT TESTS");
console.log("=================================================");

function runTests() {
  // 1. Test Price parsing with commas, currency symbols, and decimals
  assert.strictEqual(parsePriceValue("0,5"), 0.5, "0,5 should parse as 0.5");
  assert.strictEqual(parsePriceValue("0,50"), 0.5, "0,50 should parse as 0.5");
  assert.strictEqual(parsePriceValue("$ 0,5"), 0.5, "$ 0,5 should parse as 0.5");
  assert.strictEqual(parsePriceValue("$0.75"), 0.75, "$0.75 should parse as 0.75");
  assert.strictEqual(parsePriceValue("1.250,50"), 1250.50, "1.250,50 should parse as 1250.5");
  assert.strictEqual(parsePriceValue("1,250.50"), 1250.50, "1,250.50 should parse as 1250.5");
  assert.strictEqual(parsePriceValue(12.5), 12.5, "Numeric 12.5 should remain 12.5");
  assert.strictEqual(parsePriceValue("15 USD"), 15, "15 USD should parse as 15");
  assert.strictEqual(parsePriceValue(""), 0, "Empty string should parse as 0");
  console.log("✅ [PASS] Parser de precios con comas, puntos y símbolos monetarios ($0.5, 0,50, 1.250,50)");

  // 2. Test Key Normalization
  assert.strictEqual(normalizeKey("Precio ($)"), "precio", "Precio ($) -> precio");
  assert.strictEqual(normalizeKey("Precio ($ USD)"), "preciousd", "Precio ($ USD) -> preciousd");
  assert.strictEqual(normalizeKey("URL de Imagen"), "urldeimagen", "URL de Imagen -> urldeimagen");
  assert.strictEqual(normalizeKey("Foto del Plato (HTTPS)"), "fotodelplatohttps", "Foto del Plato (HTTPS) -> fotodelplatohttps");
  assert.strictEqual(normalizeKey("CATEGORÍA"), "categoria", "CATEGORÍA -> categoria");
  assert.strictEqual(normalizeKey("Descripción"), "descripcion", "Descripción -> descripcion");
  console.log("✅ [PASS] Normalización profunda de cabeceras con tildes, mayúsculas y símbolos");

  // 3. Test Row extraction with challenging headers
  const challengingRows = [
    {
      "Categoría": "Churros",
      "Nombre del Plato": "Churros Simples Sin Relleno",
      "Descripción": "Tradicionales con azúcar y/o canela (Vegano)",
      "Precio ($)": "0,5",
      "URL DE IMAGEN DEL PLATO (HTTPS)": "https://encrypted-tbn0.gstatic.com/images?q=tbn",
      "Disponible": "SI",
    },
    {
      "Categoria": "Churros",
      "Nombre": "Churros Rellenos de Nutella",
      "Detalle": "Rellenos con auténtica Nutella",
      "Precio": "$ 0,75",
      "Foto del Plato": "https://images.unsplash.com/photo-churros",
      "Estado": "Activo",
    },
    {
      "SECCION": "Alfajores",
      "PLATO": "Alfajor de Nuez Relleno de Manjar",
      "Descripcion": "Alfajor a base de nuez con dulce de leche",
      "Valor ($ USD)": "1,50",
      "Link de Imagen": "https://images.unsplash.com/photo-alfajor",
      "Disponible": "SI",
    },
  ];

  challengingRows.forEach((rawRow, idx) => {
    const extracted = extractDishRow(rawRow);
    assert.ok(extracted.name.length > 0, `Row ${idx + 1} must extract name`);
    assert.ok(extracted.categoryName.length > 0, `Row ${idx + 1} must extract category`);
    assert.ok(extracted.price > 0, `Row ${idx + 1} must extract price > 0`);
    assert.ok(extracted.imageUrl.startsWith("https://"), `Row ${idx + 1} must extract image URL`);
    assert.strictEqual(extracted.isAvailable, true, `Row ${idx + 1} must be available`);
  });

  const row1 = extractDishRow(challengingRows[0]);
  assert.strictEqual(row1.price, 0.5, "Row 1 price should be exactly 0.5");
  assert.strictEqual(row1.imageUrl, "https://encrypted-tbn0.gstatic.com/images?q=tbn");
  assert.strictEqual(row1.description, "Tradicionales con azúcar y/o canela (Vegano)");

  console.log("✅ [PASS] Extracción exitosa de casos reales con cabeceras variadas, URLs e imágenes");

  // 4. Test Mojibake recovery
  const mojibakeText = "Tradicionales con az\u00C3\u00BAcar y/o caf\u00C3\u00A9";
  const fixed = fixMojibake(mojibakeText);
  assert.strictEqual(fixed, "Tradicionales con azúcar y/o café", "Mojibake should be fixed properly");
  console.log("✅ [PASS] Corrección y recuperación de tildes dañadas por encoding");

  console.log("=================================================");
  console.log("🎉 TODAS LAS PRUEBAS PASARON EXITOSAMENTE (100%)");
  console.log("=================================================");
}

runTests();
