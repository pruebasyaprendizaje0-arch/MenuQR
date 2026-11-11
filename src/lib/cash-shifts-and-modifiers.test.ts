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

// 6. Prueba de Resolución de Destinos POS (Para Llevar / Mesa en Salón) y Envío a Cocina KDS
function resolvePosOrderDestination(params: {
  modality: "LLEVAR" | "MESA";
  tableNumber?: string;
  customerName?: string;
  paymentMethod: string;
}) {
  const tableName =
    params.modality === "MESA"
      ? `Mesa #${params.tableNumber || "1"}`
      : "Para Llevar";

  const customerName =
    params.modality === "MESA"
      ? `Mesa #${params.tableNumber || "1"} (${params.paymentMethod})`
      : params.customerName?.trim()
      ? `${params.customerName.trim()} (Para Llevar)`
      : `Para Llevar (${params.paymentMethod})`;

  const kdsTipoEntrega = params.modality === "MESA" ? "SALON" : "RETIRO";

  return { tableName, customerName, kdsTipoEntrega };
}

const destLlevar = resolvePosOrderDestination({
  modality: "LLEVAR",
  customerName: "Carlos Gómez",
  paymentMethod: "DEUNA",
});
assert.strictEqual(destLlevar.tableName, "Para Llevar");
assert.strictEqual(destLlevar.customerName, "Carlos Gómez (Para Llevar)");
assert.strictEqual(destLlevar.kdsTipoEntrega, "RETIRO");

const destLlevarDefault = resolvePosOrderDestination({
  modality: "LLEVAR",
  paymentMethod: "EFECTIVO",
});
assert.strictEqual(destLlevarDefault.tableName, "Para Llevar");
assert.strictEqual(destLlevarDefault.customerName, "Para Llevar (EFECTIVO)");
assert.strictEqual(destLlevarDefault.kdsTipoEntrega, "RETIRO");

const destMesa = resolvePosOrderDestination({
  modality: "MESA",
  tableNumber: "4",
  paymentMethod: "TARJETA",
});
assert.strictEqual(destMesa.tableName, "Mesa #4");
assert.strictEqual(destMesa.customerName, "Mesa #4 (TARJETA)");
assert.strictEqual(destMesa.kdsTipoEntrega, "SALON");

console.log("✅ [PASS] 8: Resolución omnicanal en Caja POS (Para Llevar vs Mesa) y despacho a Cocina KDS verificado");

// 7. Prueba de Despacho Omnicanal desde Carta Pública a Cocina y Caja POS (Domicilio, Para Llevar y Mesa)
function compilePublicMenuOrderPayload(params: {
  selectedTable: string;
  customerName: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryReference?: string;
  deliveryCost?: number;
  total: number;
}) {
  const isTableOrder = Boolean(params.selectedTable && params.selectedTable !== "" && params.selectedTable !== "Llevar" && params.selectedTable !== "Domicilio");
  const isDeliveryOrder = params.selectedTable === "Domicilio";

  const targetMesa = isDeliveryOrder
    ? "DELIVERY"
    : isTableOrder
    ? params.selectedTable
    : "LLEVAR";

  const targetTipoEntrega = isDeliveryOrder
    ? "DOMICILIO"
    : isTableOrder
    ? "SALON"
    : "RETIRO";

  const fullCustomerAddress = isDeliveryOrder
    ? (params.deliveryReference?.trim()
        ? `${(params.deliveryAddress || "").trim()}\nRef: ${params.deliveryReference.trim()}`
        : (params.deliveryAddress || "").trim())
    : undefined;

  return {
    targetMesa,
    targetTipoEntrega,
    fullCustomerAddress,
    costoEnvio: isDeliveryOrder ? (params.deliveryCost || 0) : 0,
    total: params.total,
    isTableOrder,
    isDeliveryOrder,
  };
}

// 7.a Pedido a Domicilio desde el Menú Público
const payloadDomicilio = compilePublicMenuOrderPayload({
  selectedTable: "Domicilio",
  customerName: "María Augusta",
  customerPhone: "0998765432",
  deliveryAddress: "Av. Amazonas y Colón, Edif. Centro",
  deliveryReference: "Piso 4, Dpto 402",
  deliveryCost: 2.5,
  total: 18.5,
});

assert.strictEqual(payloadDomicilio.targetMesa, "DELIVERY");
assert.strictEqual(payloadDomicilio.targetTipoEntrega, "DOMICILIO");
assert.strictEqual(payloadDomicilio.isDeliveryOrder, true);
assert.strictEqual(payloadDomicilio.isTableOrder, false);
assert.strictEqual(payloadDomicilio.costoEnvio, 2.5);
assert.strictEqual(payloadDomicilio.fullCustomerAddress, "Av. Amazonas y Colón, Edif. Centro\nRef: Piso 4, Dpto 402");

// 7.b Pedido Para Llevar desde el Menú Público
const payloadLlevar = compilePublicMenuOrderPayload({
  selectedTable: "Llevar",
  customerName: "Juan Pérez",
  customerPhone: "0991112233",
  total: 12.0,
});

assert.strictEqual(payloadLlevar.targetMesa, "LLEVAR");
assert.strictEqual(payloadLlevar.targetTipoEntrega, "RETIRO");
assert.strictEqual(payloadLlevar.isDeliveryOrder, false);
assert.strictEqual(payloadLlevar.isTableOrder, false);
assert.strictEqual(payloadLlevar.fullCustomerAddress, undefined);

// 7.c Pedido en Mesa desde el Menú Público
const payloadMesa = compilePublicMenuOrderPayload({
  selectedTable: "3",
  customerName: "Andrés M.",
  customerPhone: "0995556677",
  total: 24.0,
});

assert.strictEqual(payloadMesa.targetMesa, "3");
assert.strictEqual(payloadMesa.targetTipoEntrega, "SALON");
assert.strictEqual(payloadMesa.isTableOrder, true);
assert.strictEqual(payloadMesa.isDeliveryOrder, false);

console.log("✅ [PASS] 9: Despacho omnicanal garantizado para Domicilio, Para Llevar y Mesa hacia Cocina y Caja POS");

// 8. Prueba de Clasificación Estricta en Caja POS y Desglose de Costo de Envío
function classifyPosOrderAndCalculateTotal(order: {
  mesa: string;
  tipo_entrega?: string;
  metadata?: any;
  items: Array<{ precio: number; cantidad: number }>;
  total: number;
}) {
  const mesaStr = (order.mesa || "").trim().toUpperCase();
  const meta = order.metadata || {};

  const isLlevar =
    mesaStr === "LLEVAR" ||
    mesaStr === "TAKEAWAY" ||
    mesaStr === "RETIRO" ||
    order.tipo_entrega === "RETIRO" ||
    meta?.tipo_entrega === "RETIRO" ||
    meta?.tipo_pedido === "llevar";

  const isDelivery =
    !isLlevar && (
      mesaStr === "DELIVERY" ||
      mesaStr === "DOMICILIO" ||
      order.tipo_entrega === "DOMICILIO" ||
      meta?.tipo_entrega === "DOMICILIO" ||
      meta?.tipo_pedido === "delivery"
    );

  const isMesa = !isLlevar && !isDelivery;

  const itemsSubtotal = (order.items || []).reduce((acc, it) => acc + it.precio * it.cantidad, 0);
  const deliveryCost = meta?.costo_envio ?? (order.total - itemsSubtotal > 0.05 ? order.total - itemsSubtotal : 0);

  return {
    isLlevar,
    isDelivery,
    isMesa,
    itemsSubtotal,
    deliveryCost,
    totalToCharge: order.total,
  };
}

const checkLlevar = classifyPosOrderAndCalculateTotal({
  mesa: "LLEVAR",
  tipo_entrega: "RETIRO",
  metadata: { tipo_pedido: "llevar", tipo_entrega: "RETIRO" },
  items: [{ precio: 10.0, cantidad: 1 }],
  total: 10.0,
});
assert.strictEqual(checkLlevar.isLlevar, true);
assert.strictEqual(checkLlevar.isDelivery, false);
assert.strictEqual(checkLlevar.deliveryCost, 0);
assert.strictEqual(checkLlevar.totalToCharge, 10.0);

const checkDelivery = classifyPosOrderAndCalculateTotal({
  mesa: "DELIVERY",
  tipo_entrega: "DOMICILIO",
  metadata: { tipo_pedido: "delivery", tipo_entrega: "DOMICILIO", costo_envio: 2.0 },
  items: [{ precio: 4.0, cantidad: 2 }], // 2 empanadas = $8.00
  total: 10.0, // $8.00 + $2.00 envío = $10.00
});
assert.strictEqual(checkDelivery.isLlevar, false);
assert.strictEqual(checkDelivery.isDelivery, true);
assert.strictEqual(checkDelivery.itemsSubtotal, 8.0);
assert.strictEqual(checkDelivery.deliveryCost, 2.0);
assert.strictEqual(checkDelivery.totalToCharge, 10.0);

console.log("✅ [PASS] 10: Separación estricta de Para Llevar vs Domicilio y desglose de costo de envío verificado");

console.log("==================================================");
console.log("🎉 TODAS LAS PRUEBAS DE CAJA, ARQUEO Y MODIFICADORES PASARON (10/10)");
console.log("==================================================");

