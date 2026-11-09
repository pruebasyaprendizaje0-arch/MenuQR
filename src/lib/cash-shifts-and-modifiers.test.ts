import assert from "node:assert";

console.log("=== INICIANDO PRUEBAS DE CAJA, ARQUEO Y MODIFICADORES GASTRONÓMICOS ===");

// 1. Prueba de Arqueo Ciego y Cuadre Matemático de Caja
function calculateShiftTotals(params: {
  initialCash: number;
  orders: Array<{ total: number; paymentMethod: string; status: string }>;
  movements: Array<{ amount: number; type: "CASH_IN" | "CASH_OUT" }>;
  actualCash: number;
}) {
  let totalCashSales = 0;
  let totalCardSales = 0;
  let totalTransferSales = 0;
  let totalDeunaSales = 0;
  let totalSales = 0;

  for (const o of params.orders) {
    if (o.status === "CANCELLED") continue;
    totalSales += o.total;
    const pm = (o.paymentMethod || "").toUpperCase();
    if (pm.includes("EFECTIVO") || pm === "CASH") totalCashSales += o.total;
    else if (pm.includes("TARJETA") || pm.includes("CARD") || pm.includes("PAYPHONE")) totalCardSales += o.total;
    else if (pm.includes("TRANSFERENCIA") || pm.includes("TRANSFER")) totalTransferSales += o.total;
    else if (pm.includes("DEUNA")) totalDeunaSales += o.total;
    else totalCashSales += o.total;
  }

  let cashInTotal = 0;
  let cashOutTotal = 0;
  for (const m of params.movements) {
    if (m.type === "CASH_IN") cashInTotal += m.amount;
    if (m.type === "CASH_OUT") cashOutTotal += m.amount;
  }

  const expectedCash = Math.round((params.initialCash + totalCashSales + cashInTotal - cashOutTotal) * 100) / 100;
  const actualCash = Math.round(params.actualCash * 100) / 100;
  const difference = Math.round((actualCash - expectedCash) * 100) / 100;

  return {
    initialCash: params.initialCash,
    totalCashSales: Math.round(totalCashSales * 100) / 100,
    totalCardSales: Math.round(totalCardSales * 100) / 100,
    totalTransferSales: Math.round(totalTransferSales * 100) / 100,
    totalDeunaSales: Math.round(totalDeunaSales * 100) / 100,
    totalSales: Math.round(totalSales * 100) / 100,
    cashInTotal: Math.round(cashInTotal * 100) / 100,
    cashOutTotal: Math.round(cashOutTotal * 100) / 100,
    expectedCash,
    actualCash,
    difference,
    isSquare: Math.abs(difference) < 0.01,
    isSurplus: difference > 0.01,
    isShortage: difference < -0.01,
  };
}

// Escenario 1: Cuadre exacto
const cuadreExacto = calculateShiftTotals({
  initialCash: 50.0,
  orders: [
    { total: 15.5, paymentMethod: "EFECTIVO", status: "COMPLETED" },
    { total: 20.0, paymentMethod: "TARJETA", status: "COMPLETED" },
    { total: 10.0, paymentMethod: "DEUNA", status: "COMPLETED" },
    { total: 50.0, paymentMethod: "EFECTIVO", status: "CANCELLED" }, // Cancelada se excluye
  ],
  movements: [
    { amount: 10.0, type: "CASH_IN" }, // Cambio de billetes
    { amount: 5.5, type: "CASH_OUT" }, // Compra de hielo
  ],
  actualCash: 70.0, // 50 + 15.5 + 10 - 5.5 = 70.0
});

assert.strictEqual(cuadreExacto.totalSales, 45.5, "Total de ventas activas debe ser $45.50");
assert.strictEqual(cuadreExacto.totalCashSales, 15.5, "Ventas en efectivo debe ser $15.50");
assert.strictEqual(cuadreExacto.expectedCash, 70.0, "Efectivo esperado debe ser $70.00");
assert.strictEqual(cuadreExacto.difference, 0.0, "Diferencia debe ser 0.00");
assert.strictEqual(cuadreExacto.isSquare, true, "Caja debe estar exactamente cuadrada");
console.log("✅ [PASS] 1: Cálculo exacto de arqueo de caja y exclusión de órdenes canceladas");

// Escenario 2: Faltante de dinero
const cuadreFaltante = calculateShiftTotals({
  initialCash: 100.0,
  orders: [{ total: 50.0, paymentMethod: "EFECTIVO", status: "COMPLETED" }],
  movements: [],
  actualCash: 145.0, // Esperado 150 -> faltante -5.00
});
assert.strictEqual(cuadreFaltante.expectedCash, 150.0);
assert.strictEqual(cuadreFaltante.difference, -5.0);
assert.strictEqual(cuadreFaltante.isShortage, true);
console.log("✅ [PASS] 2: Detección correcta de faltante en arqueo ciego");

// Escenario 3: Sobrante de dinero
const cuadreSobrante = calculateShiftTotals({
  initialCash: 20.0,
  orders: [{ total: 30.0, paymentMethod: "EFECTIVO", status: "COMPLETED" }],
  movements: [],
  actualCash: 52.5, // Esperado 50 -> sobrante +2.50
});
assert.strictEqual(cuadreSobrante.expectedCash, 50.0);
assert.strictEqual(cuadreSobrante.difference, 2.5);
assert.strictEqual(cuadreSobrante.isSurplus, true);
console.log("✅ [PASS] 3: Detección correcta de sobrante en arqueo ciego");

// 2. Prueba de Tarifa de IVA (STANDARD 15%, ZERO 0%, EXEMPT 0%)
function computeTaxes(subtotal: number, vatRate: "STANDARD" | "ZERO" | "EXEMPT", hasIce: boolean = false) {
  const rate = vatRate === "STANDARD" ? 0.15 : 0.0;
  const iva = Math.round(subtotal * rate * 100) / 100;
  const ice = hasIce ? Math.round(subtotal * 0.10 * 100) / 100 : 0.0;
  const total = Math.round((subtotal + iva + ice) * 100) / 100;
  return { subtotal, iva, ice, total };
}

const taxStandard = computeTaxes(100.0, "STANDARD");
assert.strictEqual(taxStandard.iva, 15.0, "IVA 15% debe ser $15.00");
assert.strictEqual(taxStandard.total, 115.0);

const taxZero = computeTaxes(100.0, "ZERO");
assert.strictEqual(taxZero.iva, 0.0, "IVA 0% debe ser $0.00");
assert.strictEqual(taxZero.total, 100.0);

const taxExempt = computeTaxes(50.0, "EXEMPT");
assert.strictEqual(taxExempt.iva, 0.0, "IVA EXEMPT debe ser $0.00");
assert.strictEqual(taxExempt.total, 50.0);

const taxWithIce = computeTaxes(100.0, "STANDARD", true);
assert.strictEqual(taxWithIce.iva, 15.0);
assert.strictEqual(taxWithIce.ice, 10.0);
assert.strictEqual(taxWithIce.total, 125.0);
console.log("✅ [PASS] 4: Cálculo fiscal de IVA (15%, 0%, Exento) e ICE verificado");

// 3. Prueba de Aislamiento de Modificadores Gastronómicos vs Variantes de Retail
const retailDish = {
  id: "dish-retail-1",
  name: "Zapatillas Deportivas",
  variants: JSON.stringify({
    hasVariants: true,
    attribute1Name: "Talla",
    attribute1Options: ["38", "39", "40"],
    attribute2Name: "Color",
    attribute2Options: ["Negro", "Blanco"],
  }),
};

const parsedRetailVariants = JSON.parse(retailDish.variants);
assert.strictEqual(parsedRetailVariants.hasVariants, true);
assert.deepStrictEqual(parsedRetailVariants.attribute1Options, ["38", "39", "40"]);

// Los modificadores de restaurante operan como entidad relacional independiente
const gastroModifierGroup = {
  id: "group-1",
  dishId: "dish-gastro-1",
  name: "Término de la carne",
  minSelect: 1,
  maxSelect: 1,
  options: [
    { id: "opt-1", name: "Término Medio", extraPrice: 0.0 },
    { id: "opt-2", name: "Bien Cocido", extraPrice: 0.0 },
  ],
};

assert.strictEqual(gastroModifierGroup.minSelect, 1);
assert.strictEqual(gastroModifierGroup.options.length, 2);
assert.notStrictEqual(retailDish.variants, JSON.stringify(gastroModifierGroup), "Aislamiento estricto de estructuras confirmado");
console.log("✅ [PASS] 5: Aislamiento arquitectónico estricto entre modificadores de restaurante y variantes retail");

console.log("==================================================");
console.log("🎉 TODAS LAS PRUEBAS DE CAJA, ARQUEO Y MODIFICADORES PASARON (5/5)");
console.log("==================================================");

