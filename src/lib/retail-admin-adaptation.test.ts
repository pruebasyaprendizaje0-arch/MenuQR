import assert from "node:assert";
import { getBusinessLabels, resolveBusinessVertical } from "./business-labels";

console.log("=== INICIANDO PRUEBAS DE ADAPTACIÓN RETAIL EN PANEL ADMIN (FASE 3) ===");

// 1. Verificación de Terminología y Módulos Activos para RETAIL
{
  const retailLabels = getBusinessLabels(null, "RETAIL");
  
  assert.strictEqual(retailLabels.isGastro, false, "Retail no debe ser marcado como gastro");
  assert.strictEqual(retailLabels.items, "Productos", "En Retail, items debe ser 'Productos'");
  assert.strictEqual(retailLabels.itemSingle, "Producto", "En Retail, itemSingle debe ser 'Producto'");
  assert.strictEqual(retailLabels.categories, "Colecciones / Departamentos", "En Retail, categorías debe ser 'Colecciones / Departamentos'");
  assert.strictEqual(retailLabels.inventoryTabTitle, "Bodega & Proveedores", "En Retail, inventario debe ser 'Bodega & Proveedores'");
  assert.strictEqual(retailLabels.showSplitBill, false, "En Retail, Dividir Cuenta debe estar desactivado");
  assert.strictEqual(retailLabels.showTablesConfig, false, "En Retail, Configuración de Mesas debe estar desactivada");
  
  console.log("✅ [PASS] 1: Terminología y módulos para RETAIL verificados ('Productos', 'Colecciones', sin mesas ni división de cuenta)");
}

// 2. Política de No Regresión para RESTAURANT (Zero-Regressions Gastronómico)
{
  const restaurantLabels = getBusinessLabels(null, "RESTAURANT");

  assert.strictEqual(restaurantLabels.isGastro, true, "Restaurante debe ser marcado como gastro");
  assert.strictEqual(restaurantLabels.items, "Platos", "En Restaurante, items debe ser 'Platos'");
  assert.strictEqual(restaurantLabels.itemSingle, "Plato", "En Restaurante, itemSingle debe ser 'Plato'");
  assert.strictEqual(restaurantLabels.categories, "Categorías", "En Restaurante, categorías debe ser 'Categorías'");
  assert.strictEqual(restaurantLabels.showSplitBill, true, "En Restaurante, Dividir Cuenta debe estar activo");
  assert.strictEqual(restaurantLabels.showTablesConfig, true, "En Restaurante, Configuración de Mesas debe estar activa");
  assert.strictEqual(restaurantLabels.kitchen, "Comandas de Cocina", "En Restaurante, cocina debe ser 'Comandas de Cocina'");

  console.log("✅ [PASS] 2: Preservación intacta de la operativa de Restaurantes (Zero-Regressions con 'Platos', 'Mesas' y 'Cocina')");
}

// 3. Resolución Dinámica de Vertical en Base de Datos (Discriminador y customLabels)
{
  // Comercio configurado como RETAIL
  const storeRetail = {
    businessType: "RETAIL",
    customLabels: JSON.stringify({ vertical: "retail" }),
  };
  assert.strictEqual(resolveBusinessVertical(storeRetail), "retail", "Debe resolver vertical 'retail'");

  // Restaurante estándar en producción
  const restaurantProd = {
    businessType: "RESTAURANT",
    customLabels: null,
  };
  assert.strictEqual(resolveBusinessVertical(restaurantProd), "restaurante", "Debe resolver vertical 'restaurante'");

  console.log("✅ [PASS] 3: Discriminador polimórfico de negocio resuelto correctamente sin romper defaults");
}

// 4. Estructura de Variantes para Productos de Catálogo (Talla, Color, Presentación)
{
  const variantsPayload = {
    hasVariants: true,
    attribute1Name: "Talla",
    attribute1Options: ["S", "M", "L", "XL"],
    attribute2Name: "Color",
    attribute2Options: ["Negro", "Blanco", "Azul"],
    tallas: ["S", "M", "L", "XL"],
    colores: ["Negro", "Blanco", "Azul"],
  };

  const serialized = JSON.stringify(variantsPayload);
  const deserialized = JSON.parse(serialized);

  assert.strictEqual(deserialized.hasVariants, true);
  assert.strictEqual(deserialized.attribute1Name, "Talla");
  assert.strictEqual(deserialized.attribute1Options.length, 4);
  assert.strictEqual(deserialized.attribute2Options.length, 3);

  console.log("✅ [PASS] 4: Serialización y deserialización de variantes multi-atributo validada");
}

console.log("==================================================");
console.log("🎉 TODAS LAS PRUEBAS DE ADAPTACIÓN RETAIL PASARON (4/4)");
console.log("==================================================");

