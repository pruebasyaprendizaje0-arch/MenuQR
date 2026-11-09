import assert from "assert";

console.log("=== INICIANDO PRUEBAS DE ANÁLISIS HISTÓRICO Y VENTAS DIARIAS ===");

interface MockOrder {
  id: string;
  orderNumber: number;
  total: number;
  paymentMethod?: string | null;
  status: string;
  createdAt: string; // ISO
  isTest?: boolean;
}

const mockOrders: MockOrder[] = [
  { id: "1", orderNumber: 101, total: 25.0, paymentMethod: "EFECTIVO", status: "COMPLETED", createdAt: "2026-11-06T13:30:00.000Z", isTest: false },
  { id: "2", orderNumber: 102, total: 15.0, paymentMethod: "DEUNA", status: "COMPLETED", createdAt: "2026-11-06T20:15:00.000Z", isTest: false },
  { id: "3", orderNumber: 103, total: 40.0, paymentMethod: "TARJETA", status: "COMPLETED", createdAt: "2026-11-07T14:00:00.000Z", isTest: false },
  { id: "4", orderNumber: 104, total: 60.0, paymentMethod: "EFECTIVO", status: "COMPLETED", createdAt: "2026-11-08T12:45:00.000Z", isTest: false },
  { id: "5", orderNumber: 105, total: 35.0, paymentMethod: "TRANSFERENCIA", status: "COMPLETED", createdAt: "2026-11-08T19:00:00.000Z", isTest: false },
  { id: "6", orderNumber: 106, total: 100.0, paymentMethod: "EFECTIVO", status: "CANCELLED", createdAt: "2026-11-08T21:00:00.000Z", isTest: false }, // Debe ser ignorado
];

// 1. Filtrado por rango de fechas (06 Nov al 08 Nov) con manejo robusto de zona horaria local
function filterOrdersByDateRange(orders: MockOrder[], startDateStr: string, endDateStr: string) {
  const [sY, sM, sD] = startDateStr.split("-").map(Number);
  const start = new Date(sY, sM - 1, sD, 0, 0, 0, 0);

  const [eY, eM, eD] = endDateStr.split("-").map(Number);
  const end = new Date(eY, eM - 1, eD, 23, 59, 59, 999);

  return orders.filter((o) => {
    if (o.status === "CANCELLED") return false;
    const d = new Date(o.createdAt);
    return d >= start && d <= end;
  });
}

// 2. Agrupación diaria en hora local
function aggregateDailySales(orders: MockOrder[]) {
  const map = new Map<string, { dateStr: string; total: number; count: number; methods: Record<string, number> }>();

  orders.forEach((o) => {
    const d = new Date(o.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    if (!map.has(key)) {
      map.set(key, {
        dateStr: key,
        total: 0,
        count: 0,
        methods: { EFECTIVO: 0, DEUNA: 0, TRANSFERENCIA: 0, TARJETA: 0 },
      });
    }

    const item = map.get(key)!;
    item.total += o.total;
    item.count += 1;

    const pm = (o.paymentMethod || "EFECTIVO").toUpperCase();
    if (pm.includes("EFECTIVO")) item.methods.EFECTIVO += o.total;
    else if (pm.includes("DEUNA")) item.methods.DEUNA += o.total;
    else if (pm.includes("TRANSFERENCIA")) item.methods.TRANSFERENCIA += o.total;
    else item.methods.TARJETA += o.total;
  });

  return Array.from(map.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
}

// Test 1: Filtrado y exclusión de cancelados
{
  const filtered = filterOrdersByDateRange(mockOrders, "2026-11-06", "2026-11-08");
  assert.strictEqual(filtered.length, 5, "Debe haber 5 órdenes válidas (la cancelada de $100 se excluye)");
  const total = filtered.reduce((acc, o) => acc + o.total, 0);
  assert.strictEqual(total, 175.0, "25 + 15 + 40 + 60 + 35 = $175.00");
  console.log("✅ [PASS] 1: Filtrado por rango y exclusión de pedidos cancelados");
}

// Test 2: Ticket promedio del período
{
  const filtered = filterOrdersByDateRange(mockOrders, "2026-11-06", "2026-11-08");
  const total = filtered.reduce((acc, o) => acc + o.total, 0);
  const avgTicket = total / filtered.length;
  assert.strictEqual(avgTicket, 35.0, "Ticket promedio: 175 / 5 = $35.00");
  console.log("✅ [PASS] 2: Cálculo matemático de Ticket Promedio (AOV)");
}

// Test 3: Desglose por método de pago
{
  const filtered = filterOrdersByDateRange(mockOrders, "2026-11-06", "2026-11-08");
  let cash = 0;
  let deuna = 0;
  let card = 0;
  let transfer = 0;

  filtered.forEach((o) => {
    const pm = (o.paymentMethod || "").toUpperCase();
    if (pm === "EFECTIVO") cash += o.total;
    else if (pm === "DEUNA") deuna += o.total;
    else if (pm === "TRANSFERENCIA") transfer += o.total;
    else card += o.total;
  });

  assert.strictEqual(cash, 85.0, "Efectivo: 25 + 60 = $85.00");
  assert.strictEqual(deuna, 15.0, "DeUna: $15.00");
  assert.strictEqual(card, 40.0, "Tarjeta: $40.00");
  assert.strictEqual(transfer, 35.0, "Transferencia: $35.00");
  assert.strictEqual(cash + deuna + card + transfer, 175.0, "La suma debe ser $175.00");
  console.log("✅ [PASS] 3: Desglose por métodos de pago exacto");
}

// Test 4: Detección del día con mayor facturación (Día Pico)
{
  const filtered = filterOrdersByDateRange(mockOrders, "2026-11-06", "2026-11-08");
  const daily = aggregateDailySales(filtered);

  assert.strictEqual(daily.length, 3, "Debe haber 3 días con ventas");
  assert.strictEqual(daily[0].total, 40.0, "06 Nov: 25 + 15 = $40.00");
  assert.strictEqual(daily[1].total, 40.0, "07 Nov: $40.00");
  assert.strictEqual(daily[2].total, 95.0, "08 Nov: 60 + 35 = $95.00");

  const peakDay = [...daily].sort((a, b) => b.total - a.total)[0];
  assert.strictEqual(peakDay.dateStr, "2026-11-08", "El día pico debe ser el 08 de Noviembre");
  assert.strictEqual(peakDay.total, 95.0);
  console.log("✅ [PASS] 4: Agrupación diaria y detección de día pico de facturación");
}

console.log("==================================================");
console.log("🎉 TODAS LAS PRUEBAS DE ANALÍTICA DE VENTAS PASARON (4/4)");
console.log("==================================================");
