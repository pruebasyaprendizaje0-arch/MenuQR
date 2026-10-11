import assert from "node:assert";

// Simulation unit tests for Stock Control (Opción 1: Control de Porciones Diarias y Auto-Agotado)
console.log("==========================================");
console.log("🧪 RUNNING STOCK CONTROL TEST SUITE");
console.log("==========================================");

interface MockDish {
  id: string;
  name: string;
  isAvailable: boolean;
  trackStock: boolean;
  stock: number;
  minStock: number;
}

function simulateCreateOrder(
  dishes: MockDish[],
  orderedItems: { dishId: string; quantity: number }[]
): { success: boolean; error?: string; updatedDishes: MockDish[] } {
  const updatedDishes = dishes.map((d) => ({ ...d }));

  for (const item of orderedItems) {
    const dish = updatedDishes.find((d) => d.id === item.dishId);
    if (!dish) {
      return { success: false, error: "Plato no encontrado", updatedDishes };
    }

    if (!dish.isAvailable) {
      return {
        success: false,
        error: `El producto "${dish.name}" está agotado y no puede ser ordenado.`,
        updatedDishes,
      };
    }

    if (dish.trackStock) {
      const availableStock = dish.stock ?? 0;
      if (availableStock <= 0) {
        return {
          success: false,
          error: `El producto "${dish.name}" se encuentra agotado (stock: 0).`,
          updatedDishes,
        };
      }

      if (item.quantity > availableStock) {
        return {
          success: false,
          error: `No hay suficiente stock para "${dish.name}". Disponibles: ${availableStock}, solicitados: ${item.quantity}.`,
          updatedDishes,
        };
      }
    }
  }

  // Deduct stock
  for (const item of orderedItems) {
    const dish = updatedDishes.find((d) => d.id === item.dishId)!;
    if (dish.trackStock) {
      dish.stock = Math.max(0, dish.stock - item.quantity);
      if (dish.stock === 0) {
        dish.isAvailable = false;
      }
    }
  }

  return { success: true, updatedDishes };
}

function simulateReplenish(
  dish: MockDish,
  addedStock: number
): MockDish {
  const newStock = Math.max(0, dish.stock + addedStock);
  return {
    ...dish,
    stock: newStock,
    isAvailable: newStock > 0 ? true : dish.isAvailable,
  };
}

// TEST 1: Dish with trackStock=false is limitless
{
  const dishes: MockDish[] = [
    { id: "d1", name: "Agua Mineral", isAvailable: true, trackStock: false, stock: 0, minStock: 0 },
  ];
  const res = simulateCreateOrder(dishes, [{ dishId: "d1", quantity: 50 }]);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.updatedDishes[0].isAvailable, true);
  console.log("✅ [PASS] Test 1: Producto sin control de stock (trackStock=false) permite pedidos ilimitados");
}

// TEST 2: Dish with trackStock=true rejects order when quantity exceeds available stock
{
  const dishes: MockDish[] = [
    { id: "d2", name: "Costillar BBQ", isAvailable: true, trackStock: true, stock: 3, minStock: 2 },
  ];
  const res = simulateCreateOrder(dishes, [{ dishId: "d2", quantity: 5 }]);
  assert.strictEqual(res.success, false);
  assert.ok(res.error?.includes("No hay suficiente stock"));
  console.log("✅ [PASS] Test 2: Bloquea pedidos que exceden el stock disponible");
}

// TEST 3: Dish reaches stock=0 and is automatically marked isAvailable=false (Agotado)
{
  const dishes: MockDish[] = [
    { id: "d3", name: "Lasaña de la Casa", isAvailable: true, trackStock: true, stock: 4, minStock: 2 },
  ];
  const res = simulateCreateOrder(dishes, [{ dishId: "d3", quantity: 4 }]);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.updatedDishes[0].stock, 0);
  assert.strictEqual(res.updatedDishes[0].isAvailable, false);
  console.log("✅ [PASS] Test 3: Al llegar a stock=0 se marca automáticamente como Agotado (isAvailable=false)");
}

// TEST 4: Once marked Agotado, subsequent orders are rejected
{
  const dishes: MockDish[] = [
    { id: "d4", name: "Tiramisú", isAvailable: false, trackStock: true, stock: 0, minStock: 2 },
  ];
  const res = simulateCreateOrder(dishes, [{ dishId: "d4", quantity: 1 }]);
  assert.strictEqual(res.success, false);
  assert.ok(res.error?.includes("agotado"));
  console.log("✅ [PASS] Test 4: Pedidos posteriores a un producto agotado son rechazados");
}

// TEST 5: Stock alert condition (stock <= minStock)
{
  const dish: MockDish = { id: "d5", name: "Encebollado Mixto", isAvailable: true, trackStock: true, stock: 2, minStock: 3 };
  const isCritical = dish.trackStock && dish.stock <= dish.minStock && dish.stock > 0;
  assert.strictEqual(isCritical, true);
  console.log("✅ [PASS] Test 5: Detección visual de stock crítico (stock <= minStock)");
}

// TEST 6: Quick replenishment restores availability
{
  const soldOutDish: MockDish = { id: "d6", name: "Seco de Chivo", isAvailable: false, trackStock: true, stock: 0, minStock: 3 };
  const replenished = simulateReplenish(soldOutDish, 5);
  assert.strictEqual(replenished.stock, 5);
  assert.strictEqual(replenished.isAvailable, true);
  console.log("✅ [PASS] Test 6: Reposición rápida (+5) reactiva la disponibilidad (isAvailable=true)");
}

console.log("==========================================");
console.log("🎉 TODAS LAS PRUEBAS DE STOCK PASARON EXITOSAMENTE (6/6)");
console.log("==========================================");
