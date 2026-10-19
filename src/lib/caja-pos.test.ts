import assert from "node:assert";

console.log("==========================================");
console.log("🧪 RUNNING CAJA POS TEST SUITE (/caja)");
console.log("==========================================");

interface MockDish {
  id: string;
  restaurantId: string;
  name: string;
  price: number;
  stock: number | null;
  trackStock: boolean;
  isAvailable: boolean;
  barcode: string | null;
  sku: string | null;
  variants: string | null;
}

// Logic: Search dish by barcode, SKU, or box variant
function findDishByScannedCode(
  dishes: MockDish[],
  scannedCode: string
): { dish: MockDish | null; isBox: boolean; boxUnits: number } {
  const clean = scannedCode.trim();

  // 1. Exact barcode
  let dish = dishes.find((d) => d.barcode === clean) || null;
  if (dish) return { dish, isBox: false, boxUnits: 1 };

  // 2. SKU
  dish = dishes.find((d) => d.sku === clean) || null;
  if (dish) return { dish, isBox: false, boxUnits: 1 };

  // 3. Box barcode inside variants JSON
  for (const d of dishes) {
    if (d.variants) {
      try {
        const parsed = JSON.parse(d.variants);
        if (
          parsed.boxBarcode === clean ||
          parsed.codigo_caja === clean ||
          parsed.codigoCaja === clean
        ) {
          const units = Number(parsed.unitsPerBox || parsed.unidadesPorCaja || 12);
          return { dish: d, isBox: true, boxUnits: units > 0 ? units : 12 };
        }
      } catch {}
    }
  }

  return { dish: null, isBox: false, boxUnits: 1 };
}

// Logic: Process stock entry (ENTRADA)
function processStockEntry(
  dishes: MockDish[],
  items: { dishId: string; quantity: number }[]
): { success: boolean; updatedDishes: MockDish[] } {
  const updated = dishes.map((d) => ({ ...d }));

  for (const item of items) {
    if (item.quantity <= 0) {
      throw new Error(`Cantidad inválida (${item.quantity})`);
    }
    const d = updated.find((x) => x.id === item.dishId);
    if (!d) throw new Error("Producto no encontrado");

    const currentStock = d.stock ?? 0;
    d.stock = currentStock + item.quantity;
    d.trackStock = true;
    d.isAvailable = true;
  }

  return { success: true, updatedDishes: updated };
}

// Logic: Process sale checkout (VENTA)
function processStockSale(
  dishes: MockDish[],
  items: { dishId: string; quantity: number }[],
  paymentMethod: string
): { success: boolean; total: number; updatedDishes: MockDish[] } {
  const validMethods = ["EFECTIVO", "DEUNA", "TARJETA"];
  if (!validMethods.includes(paymentMethod)) {
    throw new Error(`Método de pago no soportado: ${paymentMethod}`);
  }

  const updated = dishes.map((d) => ({ ...d }));
  let grandTotal = 0;

  // Validation phase: check availability and stock
  for (const item of items) {
    if (item.quantity <= 0) {
      throw new Error(`Cantidad a vender debe ser mayor a 0`);
    }
    const d = updated.find((x) => x.id === item.dishId);
    if (!d) throw new Error(`Producto ${item.dishId} no encontrado`);

    if (d.trackStock) {
      const currentStock = d.stock ?? 0;
      if (currentStock < item.quantity) {
        throw new Error(
          `Stock insuficiente para "${d.name}". Disponible: ${currentStock}, Solicitado: ${item.quantity}`
        );
      }
    }

    grandTotal += d.price * item.quantity;
  }

  // Execution phase: decrement stock
  for (const item of items) {
    const d = updated.find((x) => x.id === item.dishId)!;
    if (d.trackStock) {
      const currentStock = d.stock ?? 0;
      const nextStock = Math.max(0, currentStock - item.quantity);
      d.stock = nextStock;
      if (nextStock === 0) {
        d.isAvailable = false;
      }
    }
  }

  return {
    success: true,
    total: Math.round(grandTotal * 100) / 100,
    updatedDishes: updated,
  };
}

// --- TEST CASES ---

const sampleDishes: MockDish[] = [
  {
    id: "dish-1",
    restaurantId: "rest-1",
    name: "Coca Cola 300ml",
    price: 0.75,
    stock: 20,
    trackStock: true,
    isAvailable: true,
    barcode: "786100010001",
    sku: "CC-300",
    variants: JSON.stringify({ boxBarcode: "786100019999", unitsPerBox: 24 }),
  },
  {
    id: "dish-2",
    restaurantId: "rest-1",
    name: "Snack Papas Onduladas",
    price: 1.25,
    stock: 2,
    trackStock: true,
    isAvailable: true,
    barcode: "786100020002",
    sku: "SN-OND",
    variants: null,
  },
  {
    id: "dish-3",
    restaurantId: "rest-1",
    name: "Camiseta Algodón Negra L",
    price: 18.0,
    stock: 5,
    trackStock: true,
    isAvailable: true,
    barcode: "786100030003",
    sku: "CAM-BLK-L",
    variants: null,
  },
];

// Test 1: Direct barcode scan match
console.log("Test 1: Direct barcode match");
const res1 = findDishByScannedCode(sampleDishes, "786100010001");
assert.strictEqual(res1.dish?.id, "dish-1");
assert.strictEqual(res1.isBox, false);
console.log("  ✅ Direct barcode match passed");

// Test 2: SKU match fallback
console.log("Test 2: SKU match fallback");
const res2 = findDishByScannedCode(sampleDishes, "SN-OND");
assert.strictEqual(res2.dish?.id, "dish-2");
assert.strictEqual(res2.isBox, false);
console.log("  ✅ SKU match passed");

// Test 3: Box barcode detection
console.log("Test 3: Box barcode detection with units");
const res3 = findDishByScannedCode(sampleDishes, "786100019999");
assert.strictEqual(res3.dish?.id, "dish-1");
assert.strictEqual(res3.isBox, true);
assert.strictEqual(res3.boxUnits, 24);
console.log("  ✅ Box barcode detection passed");

// Test 4: Unregistered code returns null
console.log("Test 4: Unregistered code detection");
const res4 = findDishByScannedCode(sampleDishes, "999999999999");
assert.strictEqual(res4.dish, null);
console.log("  ✅ Unregistered code handled correctly");

// Test 5: Stock Entry (ENTRADA) adds stock
console.log("Test 5: Stock Entry adds stock");
const entryResult = processStockEntry(sampleDishes, [
  { dishId: "dish-1", quantity: 24 }, // Entry of 1 box
  { dishId: "dish-2", quantity: 10 },
]);
assert.strictEqual(entryResult.success, true);
assert.strictEqual(entryResult.updatedDishes.find((d) => d.id === "dish-1")?.stock, 44);
assert.strictEqual(entryResult.updatedDishes.find((d) => d.id === "dish-2")?.stock, 12);
console.log("  ✅ Stock Entry calculation passed (20 + 24 = 44)");

// Test 6: Sale (VENTA) deducts stock and calculates total
console.log("Test 6: Sale deducts stock and calculates total with DeUna");
const saleResult = processStockSale(
  sampleDishes,
  [
    { dishId: "dish-1", quantity: 2 }, // 2 * 0.75 = 1.50
    { dishId: "dish-3", quantity: 1 }, // 1 * 18.00 = 18.00
  ],
  "DEUNA"
);
assert.strictEqual(saleResult.success, true);
assert.strictEqual(saleResult.total, 19.5);
assert.strictEqual(saleResult.updatedDishes.find((d) => d.id === "dish-1")?.stock, 18);
assert.strictEqual(saleResult.updatedDishes.find((d) => d.id === "dish-3")?.stock, 4);
console.log("  ✅ Sale calculation and stock reduction passed ($19.50)");

// Test 7: Sale blocks checkout if stock insufficient
console.log("Test 7: Insufficient stock prevents sale");
assert.throws(
  () => {
    processStockSale(sampleDishes, [{ dishId: "dish-2", quantity: 5 }], "EFECTIVO"); // Only 2 in stock
  },
  (err: any) => err.message.includes("Stock insuficiente")
);
console.log("  ✅ Insufficient stock correctly blocked");

// Test 8: Selling exact remaining stock auto-exhausts (isAvailable = false)
console.log("Test 8: Exact stock depletion marks isAvailable = false");
const exhaustResult = processStockSale(
  sampleDishes,
  [{ dishId: "dish-2", quantity: 2 }],
  "TARJETA"
);
const depletedDish = exhaustResult.updatedDishes.find((d) => d.id === "dish-2");
assert.strictEqual(depletedDish?.stock, 0);
assert.strictEqual(depletedDish?.isAvailable, false);
console.log("  ✅ Auto-exhaust at stock 0 passed");

// Test 9: Invalid payment method rejected
console.log("Test 9: Invalid payment method rejected");
assert.throws(
  () => {
    processStockSale(sampleDishes, [{ dishId: "dish-1", quantity: 1 }], "BITCOIN");
  },
  (err: any) => err.message.includes("Método de pago no soportado")
);
console.log("  ✅ Invalid payment method rejected");

// Helper simulating superAdminToggleRestaurantModuleAction
function toggleModuleConfig(
  customLabelsJson: string | null,
  moduleKey: "inventory" | "caja" | "ruleta",
  enable: boolean
): string {
  let customObj: any = {};
  if (customLabelsJson) {
    try {
      customObj = JSON.parse(customLabelsJson);
    } catch {
      customObj = {};
    }
  }

  let disabledMods: string[] = Array.isArray(customObj.disabledModules)
    ? [...customObj.disabledModules]
    : [];

  if (enable) {
    disabledMods = disabledMods.filter((m) => m !== moduleKey);
  } else {
    if (!disabledMods.includes(moduleKey)) disabledMods.push(moduleKey);
  }

  customObj.disabledModules = disabledMods;
  return JSON.stringify(customObj);
}

// Test 10: Toggle tools OFF via Super Admin
console.log("Test 10: Super Admin toggles tools OFF (caja, inventory, ruleta)");
let config = JSON.stringify({ disabledModules: [] });

config = toggleModuleConfig(config, "caja", false);
config = toggleModuleConfig(config, "inventory", false);
config = toggleModuleConfig(config, "ruleta", false);

const parsedDisabled: string[] = JSON.parse(config).disabledModules;
assert.ok(parsedDisabled.includes("caja"));
assert.ok(parsedDisabled.includes("inventory"));
assert.ok(parsedDisabled.includes("ruleta"));
console.log("  ✅ Disabled modules correctly contain [caja, inventory, ruleta]");

// Test 11: Business Labels reflection
console.log("Test 11: Business Labels disabled check");
const isCajaActive = !parsedDisabled.includes("caja");
const isInventoryActive = !parsedDisabled.includes("inventory");
const isRuletaActive = !parsedDisabled.includes("ruleta");

assert.strictEqual(isCajaActive, false);
assert.strictEqual(isInventoryActive, false);
assert.strictEqual(isRuletaActive, false);
console.log("  ✅ Tools are cleanly identified as inactive (false)");

// Test 12: Re-enabling a tool (e.g. Caja POS ON)
console.log("Test 12: Re-enabling Caja POS (ON)");
config = toggleModuleConfig(config, "caja", true);
const parsedAfterReenable: string[] = JSON.parse(config).disabledModules;
assert.strictEqual(parsedAfterReenable.includes("caja"), false);
assert.strictEqual(parsedAfterReenable.includes("inventory"), true);
assert.strictEqual(parsedAfterReenable.includes("ruleta"), true);
console.log("  ✅ Caja POS re-activated without affecting other tool settings");

console.log("==========================================");
console.log("🎉 ALL CAJA POS & TOOL TOGGLE TESTS PASSED");
console.log("==========================================");

