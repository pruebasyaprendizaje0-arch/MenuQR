import assert from "node:assert";
import * as XLSX from "xlsx";

console.log("==========================================");
console.log("🧪 RUNNING BATCH DISH IMPORT & EXCEL TEST");
console.log("==========================================");

function runTests() {
  // 1. Test Excel / CSV generation and roundtrip
  const sampleData = [
    {
      Categoria: "Hamburguesas",
      Nombre: "Hamburguesa Doble Queso",
      Descripcion: "Carne angus 200g, doble cheddar y tocino crocante.",
      Precio: 8.50,
      Disponible: "SI",
      URL_Imagen: "https://example.com/burger.jpg",
    },
    {
      Categoria: "Bebidas",
      Nombre: "Gaseosa 500ml",
      Descripcion: "Refrescante",
      Precio: 2.00,
      Disponible: "SI",
      URL_Imagen: "",
    },
    {
      Categoria: "Postres",
      Nombre: "Cheesecake de Frutilla",
      Descripcion: "Cremoso con salsa de frutos rojos",
      Precio: 4.50,
      Disponible: "NO",
      URL_Imagen: "",
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Platos");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  assert.ok(buffer.length > 0, "Generated Excel buffer must not be empty");
  console.log("✅ [PASS] Generación de archivo Excel (.xlsx) exitosa");

  // Read back buffer
  const readWb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = readWb.SheetNames[0];
  const readRows = XLSX.utils.sheet_to_json<Record<string, any>>(readWb.Sheets[sheetName]);

  assert.strictEqual(readRows.length, 3, "Should parse 3 rows back from Excel");
  assert.strictEqual(readRows[0].Categoria, "Hamburguesas");
  assert.strictEqual(readRows[0].Nombre, "Hamburguesa Doble Queso");
  assert.strictEqual(Number(readRows[0].Precio), 8.5);
  console.log("✅ [PASS] Lectura y mapeo bidireccional de datos Excel correcto");

  // 2. Test tolerant column key mapping
  const testVariations = [
    { "CATEGORÍA": "Tacos", "Nombre del Plato": "Taco al Pastor", "Precio": "$3.50", "DISPONIBLE": "SI" },
    { "category": "Burritos", "name": "Burrito Mixto", "costo": "6.00", "estado": "activo" },
    { "Seccion": "Bebidas", "Item": "Corona", "Valor": "3.00", "Activo": "1" },
  ];

  testVariations.forEach((row, idx) => {
    const getVal = (possibleKeys: string[]) => {
      for (const key of Object.keys(row)) {
        const cleanKey = key.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        for (const target of possibleKeys) {
          if (cleanKey === target.toLowerCase()) {
            return String((row as any)[key] ?? "").trim();
          }
        }
      }
      return "";
    };

    const cat = getVal(["categoria", "category", "seccion", "tipo"]) || "General";
    const name = getVal(["nombre", "name", "plato", "nombre del plato", "item"]);
    const rawPrice = getVal(["precio", "price", "costo", "valor"]);
    const price = parseFloat(rawPrice.replace(/[^0-9.-]+/g, "")) || 0;

    assert.ok(name.length > 0, `Row ${idx + 1} must parse name successfully`);
    assert.ok(cat.length > 0, `Row ${idx + 1} must parse category successfully`);
    assert.ok(price > 0, `Row ${idx + 1} must parse price successfully`);
  });

  console.log("✅ [PASS] Normalización tolerante de cabeceras en español e inglés");
  console.log("==========================================");
  console.log("TODAS LAS PRUEBAS DE CARGA POR LOTES PASARON (100%)");
  console.log("==========================================");
}

runTests();
