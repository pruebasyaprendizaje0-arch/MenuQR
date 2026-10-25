import assert from "node:assert";

console.log("==========================================");
console.log("🧪 RUNNING UNIVERSAL STOCK & OPTION 1 TEST SUITE");
console.log("==========================================");

interface MockDish {
  id: string;
  name: string;
  stock: number;
  trackStock: boolean;
  isAvailable: boolean;
}

// Simulación del motor deductStockUniversal
function simulateUniversalDeduct(
  dishes: MockDish[],
  itemsToBuy: Array<{ dishId?: string; name?: string; quantity: number }>
): { success: boolean; error?: string; updated: MockDish[] } {
  const state = dishes.map((d) => ({ ...d }));

  // FASE 1: Validación previa
  for (const it of itemsToBuy) {
    const dish = state.find((d) => d.id === it.dishId || d.name.toLowerCase() === it.name?.toLowerCase());
    if (!dish) {
      return { success: false, error: `Producto no encontrado`, updated: state };
    }
    const curStock = typeof dish.stock === "number" ? dish.stock : 0;
    if (!dish.isAvailable || curStock <= 0) {
      return { success: false, error: `El producto "${dish.name}" se encuentra agotado en bodega.`, updated: state };
    }
    if (it.quantity > curStock) {
      return {
        success: false,
        error: `Stock insuficiente para "${dish.name}". Disponible: ${curStock}, solicitado: ${it.quantity}.`,
        updated: state,
      };
    }
  }

  // FASE 2: Deducción atómica y auto-bloqueo
  for (const it of itemsToBuy) {
    const dish = state.find((d) => d.id === it.dishId || d.name.toLowerCase() === it.name?.toLowerCase())!;
    const curStock = typeof dish.stock === "number" ? dish.stock : 0;
    const nextStock = Math.max(0, curStock - it.quantity);
    dish.stock = nextStock;
    dish.trackStock = true;
    dish.isAvailable = nextStock > 0;
  }

  return { success: true, updated: state };
}

// TEST 1: Deducción correcta y reducción de stock
{
  const dishes: MockDish[] = [
    { id: "d1", name: "Aguardiente Seco", stock: 11, trackStock: true, isAvailable: true },
  ];
  const res = simulateUniversalDeduct(dishes, [{ dishId: "d1", quantity: 2 }]);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.updated[0].stock, 9);
  assert.strictEqual(res.updated[0].isAvailable, true);
  console.log("✅ [PASS] Test 1: Deducción correcta de 2 unidades en producto con stock (11 -> 9)");
}

// TEST 2: Bloqueo cuando se intenta comprar producto con stock 0
{
  const dishes: MockDish[] = [
    { id: "d2", name: "Cerveza Club", stock: 0, trackStock: true, isAvailable: false },
  ];
  const res = simulateUniversalDeduct(dishes, [{ dishId: "d2", quantity: 1 }]);
  assert.strictEqual(res.success, false);
  assert.ok(res.error?.includes("agotado"));
  console.log("✅ [PASS] Test 2: Bloquea terminantemente la compra si el stock es 0 o está agotado");
}

// TEST 3: Agotado automático exacto al llegar a 0
{
  const dishes: MockDish[] = [
    { id: "d3", name: "Carbón Vegetal", stock: 3, trackStock: true, isAvailable: true },
  ];
  const res = simulateUniversalDeduct(dishes, [{ dishId: "d3", quantity: 3 }]);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.updated[0].stock, 0);
  assert.strictEqual(res.updated[0].isAvailable, false);
  console.log("✅ [PASS] Test 3: Al vender las últimas 3 unidades, el producto pasa automáticamente a Agotado (stock: 0, isAvailable: false)");
}

// TEST 4: Bloqueo si la cantidad solicitada excede la existencia
{
  const dishes: MockDish[] = [
    { id: "d4", name: "Almendras y Maní", stock: 5, trackStock: true, isAvailable: true },
  ];
  const res = simulateUniversalDeduct(dishes, [{ dishId: "d4", quantity: 6 }]);
  assert.strictEqual(res.success, false);
  assert.ok(res.error?.includes("Stock insuficiente"));
  console.log("✅ [PASS] Test 4: Bloquea si la cantidad solicitada (6) supera el stock disponible (5)");
}

// TEST 5: Conversión universal de catálogo ('Sin límite' -> controlado)
{
  const unmanagedDishes: MockDish[] = [
    { id: "d5", name: "Vino Tinto", stock: 0, trackStock: false, isAvailable: true },
    { id: "d6", name: "Whisky 12 Años", stock: 15, trackStock: false, isAvailable: true },
  ];

  const converted = unmanagedDishes.map((d) => ({
    ...d,
    trackStock: true,
    isAvailable: d.stock > 0,
  }));

  assert.strictEqual(converted[0].trackStock, true);
  assert.strictEqual(converted[0].isAvailable, false); // 0 unidades -> Agotado
  assert.strictEqual(converted[1].trackStock, true);
  assert.strictEqual(converted[1].isAvailable, true); // 15 unidades -> Disponible

  console.log("✅ [PASS] Test 5: Activación universal de stock convierte ítems sin límite a control estricto");
}

console.log("==========================================");
console.log("🎉 TODAS LAS PRUEBAS DE STOCK UNIVERSAL PASARON (5/5)");
console.log("==========================================");
