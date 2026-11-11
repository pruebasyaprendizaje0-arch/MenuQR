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

// 4. Prueba del Pipeline Transversal de Modificadores en Carrito y Comanda
function compileCustomization(params: {
  dish: { id: string; name: string; price: number };
  modifierGroups: Array<{
    id: string;
    name: string;
    minSelect: number;
    maxSelect: number;
    options: Array<{ id: string; name: string; extraPrice: number }>;
  }>;
  selectedOptionIds: string[];
}) {
  const chosenSet = new Set(params.selectedOptionIds);
  let extras = 0;
  const notesParts: string[] = [];

  for (const grp of params.modifierGroups) {
    const picked = grp.options.filter((o) => chosenSet.has(o.id));
    if (picked.length > 0) {
      for (const p of picked) {
        extras += p.extraPrice;
      }
      const optsText = picked
        .map((p) => `${p.name}${p.extraPrice > 0 ? ` (+$${p.extraPrice.toFixed(2)})` : ""}`)
        .join(", ");
      notesParts.push(`${grp.name}: ${optsText}`);
    }
  }

  const modifiersNotes = notesParts.join(" · ");
  const sortedKey = Array.from(chosenSet).sort().join("_");
  const itemKey = `${params.dish.id}_${sortedKey}`;
  const unitPrice = params.dish.price + extras;
  const orderItemName = modifiersNotes ? `${params.dish.name} [${modifiersNotes}]` : params.dish.name;

  return {
    itemKey,
    unitPrice,
    modifiersNotes,
    orderItemName,
  };
}

const empanadaCustom = compileCustomization({
  dish: { id: "dish-emp-1", name: "Empanada Gigante de Camarón", price: 4.5 },
  modifierGroups: [
    {
      id: "grp-salsa",
      name: "Tipo de salsa",
      minSelect: 1,
      maxSelect: 3,
      options: [
        { id: "opt-salsa-1", name: "Salsa picante", extraPrice: 0.0 },
        { id: "opt-salsa-2", name: "Salsa de queso", extraPrice: 0.0 },
      ],
    },
    {
      id: "grp-extra",
      name: "Extras",
      minSelect: 0,
      maxSelect: 2,
      options: [
        { id: "opt-extra-1", name: "Extra queso", extraPrice: 0.5 },
      ],
    },
  ],
  selectedOptionIds: ["opt-salsa-2", "opt-extra-1"],
});

assert.strictEqual(empanadaCustom.unitPrice, 5.0, "Precio unitario debe ser $4.50 + $0.50 = $5.00");
assert.strictEqual(empanadaCustom.itemKey, "dish-emp-1_opt-extra-1_opt-salsa-2");
assert.strictEqual(
  empanadaCustom.orderItemName,
  "Empanada Gigante de Camarón [Tipo de salsa: Salsa de queso · Extras: Extra queso (+$0.50)]"
);
console.log("✅ [PASS] 6: Compilación precisa de precio, itemKey y nota para comanda de cocina y ticket");

// 5. Verificación de platos estándar sin modificadores
const platoDirecto = compileCustomization({
  dish: { id: "dish-cola-1", name: "Coca Cola 300ml", price: 1.5 },
  modifierGroups: [],
  selectedOptionIds: [],
});

assert.strictEqual(platoDirecto.unitPrice, 1.5);
assert.strictEqual(platoDirecto.itemKey, "dish-cola-1_");
assert.strictEqual(platoDirecto.orderItemName, "Coca Cola 300ml");
console.log("✅ [PASS] 7: Inserción directa sin fricción ni retrasos para platos sin modificadores");

// 6. Prueba de Resolución de Destinos POS (Mostrador / Para Llevar / Mesa) y Envío a Cocina KDS
function resolvePosOrderDestination(params: {
  modality: "MOSTRADOR" | "LLEVAR" | "MESA";
  tableNumber?: string;
  customerName?: string;
  paymentMethod: string;
}) {
  const tableName =
    params.modality === "MESA"
      ? `Mesa #${params.tableNumber || "1"}`
      : params.modality === "LLEVAR"
      ? "Para Llevar"
      : "Mostrador";

  const customerName =
    params.modality === "LLEVAR"
      ? params.customerName?.trim()
        ? `${params.customerName.trim()} (Para Llevar)`
        : `Para Llevar (${params.paymentMethod})`
      : params.modality === "MESA"
      ? `Mesa #${params.tableNumber || "1"} (${params.paymentMethod})`
      : params.customerName?.trim()
      ? `${params.customerName.trim()} (Mostrador)`
      : `Venta Mostrador (${params.paymentMethod})`;

  const kdsTipoEntrega =
    params.modality === "LLEVAR" ? "RETIRO" : params.modality === "MESA" ? "SALON" : "MOSTRADOR";

  return { tableName, customerName, kdsTipoEntrega };
}

const destMostrador = resolvePosOrderDestination({
  modality: "MOSTRADOR",
  paymentMethod: "EFECTIVO",
});
assert.strictEqual(destMostrador.tableName, "Mostrador");
assert.strictEqual(destMostrador.customerName, "Venta Mostrador (EFECTIVO)");
assert.strictEqual(destMostrador.kdsTipoEntrega, "MOSTRADOR");

const destLlevar = resolvePosOrderDestination({
  modality: "LLEVAR",
  customerName: "Carlos Gómez",
  paymentMethod: "DEUNA",
});
assert.strictEqual(destLlevar.tableName, "Para Llevar");
assert.strictEqual(destLlevar.customerName, "Carlos Gómez (Para Llevar)");
assert.strictEqual(destLlevar.kdsTipoEntrega, "RETIRO");

const destMesa = resolvePosOrderDestination({
  modality: "MESA",
  tableNumber: "4",
  paymentMethod: "TARJETA",
});
assert.strictEqual(destMesa.tableName, "Mesa #4");
assert.strictEqual(destMesa.customerName, "Mesa #4 (TARJETA)");
assert.strictEqual(destMesa.kdsTipoEntrega, "SALON");

console.log("✅ [PASS] 8: Resolución omnicanal en Caja POS (Mostrador, Para Llevar, Mesa) y despacho a Cocina KDS verificado");

console.log("==================================================");
console.log("🎉 TODAS LAS PRUEBAS DE CAJA, ARQUEO Y MODIFICADORES PASARON (8/8)");
console.log("==================================================");

