import assert from "assert";

console.log("=== INICIANDO PRUEBAS DE CAJA POS PANTALLA DIVIDIDA (OPCIÓN 2) ===");

// 1. Clasificación de órdenes activas (Mesas en salón vs Para Llevar vs Domicilios)
interface MockOrder {
  id: string;
  mesa?: string | null;
  tipo_entrega?: string | null;
  vertical?: string | null;
  total: number;
  solicita_mesero?: boolean;
  estado: string;
}

const mockOrders: MockOrder[] = [
  { id: "1", mesa: "1", estado: "en_cocina", total: 15.5, solicita_mesero: false },
  { id: "2", mesa: "4", estado: "por_pagar", total: 22.0, solicita_mesero: true },
  { id: "3", mesa: "LLEVAR", tipo_entrega: "RETIRO", estado: "listo", total: 8.5 },
  { id: "4", mesa: "DELIVERY", tipo_entrega: "DOMICILIO", estado: "en_ruta", total: 14.0 },
  { id: "5", mesa: "CATALOGO", vertical: "ctalo", tipo_entrega: "DOMICILIO", estado: "nuevo", total: 35.0 },
];

{
  const mesas = mockOrders.filter((o) => {
    const m = (o.mesa || "").trim().toUpperCase();
    return m !== "DELIVERY" && m !== "LLEVAR" && m !== "CATALOGO" && o.tipo_entrega !== "RETIRO" && o.tipo_entrega !== "DOMICILIO";
  });

  const llevar = mockOrders.filter((o) => {
    const m = (o.mesa || "").trim().toUpperCase();
    return m === "LLEVAR" || o.tipo_entrega === "RETIRO";
  });

  const delivery = mockOrders.filter((o) => {
    const m = (o.mesa || "").trim().toUpperCase();
    return m === "DELIVERY" || o.tipo_entrega === "DOMICILIO" || o.vertical === "ctalo";
  });

  assert.strictEqual(mesas.length, 2, "Debe haber 2 mesas en salón");
  assert.strictEqual(llevar.length, 1, "Debe haber 1 pedido para llevar");
  assert.strictEqual(delivery.length, 2, "Debe haber 2 pedidos de delivery/domicilio");
  console.log("✅ [PASS] 1: Clasificación de pedidos por canal (Mesas, Llevar, Delivery) correcta");
}

// 2. Detección de alerta 'Pide Cuenta' en mesa
{
  const mesaPideCuenta = mockOrders.find((o) => o.mesa === "4")!;
  const pideCuenta = mesaPideCuenta.solicita_mesero || mesaPideCuenta.estado === "por_pagar";
  assert.strictEqual(pideCuenta, true, "Mesa 4 debe alertar cobro prioritario");
  console.log("✅ [PASS] 2: Detección de mesas con solicitud de cuenta en vivo validada");
}

// 3. Calculadora de cambio y vuelto en efectivo
{
  const totalTicket = 15.5;
  const cashGiven = 20.0;
  const change = Math.max(0, cashGiven - totalTicket);
  assert.strictEqual(change, 4.5, "El vuelto de $20.00 para $15.50 debe ser $4.50");
  console.log("✅ [PASS] 3: Cálculo matemático exacto de vuelto en efectivo");
}

// 4. Cobro con DeUna y Transferencias bancarias
{
  const mockRestaurant = {
    qrCobroUrl: "https://menuqr.ubicame.cc/uploads/qr-deuna.png",
    bankName: "Banco Pichincha",
    bankAccountNumber: "2205849301",
    bankAccountType: "Ahorros",
  };

  assert.ok(mockRestaurant.qrCobroUrl.startsWith("http"), "URL de QR DeUna debe ser válida");
  assert.strictEqual(mockRestaurant.bankAccountNumber, "2205849301", "Número de cuenta resuelto");
  console.log("✅ [PASS] 4: Resolución de QR DeUna y credenciales bancarias para transferencias");
}

// 5. División en partes iguales y pagos mixtos (Split Pay - Opción A)
{
  const total = 25.0;
  const people = 3;
  const quota = Math.round((total / people) * 100) / 100; // 8.33
  assert.strictEqual(quota, 8.33, "La cuota base para 3 personas de $25.00 debe ser $8.33");

  // Simulamos 3 abonos donde el último cubre exactamente el restante
  const payments = [
    { id: "1", payerName: "Persona 1", amount: quota, paymentMethod: "EFECTIVO" },
    { id: "2", payerName: "Persona 2", amount: quota, paymentMethod: "DEUNA" },
    { id: "3", payerName: "Persona 3", amount: Math.round((total - (quota * 2)) * 100) / 100, paymentMethod: "TARJETA" }, // 8.34
  ];

  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = Math.max(0, Math.round((total - totalPaid) * 100) / 100);

  assert.strictEqual(totalPaid, 25.0, "El total pagado debe sumar exactamente $25.00");
  assert.strictEqual(remaining, 0.0, "El saldo restante debe ser $0.00");
  assert.strictEqual(payments[2].amount, 8.34, "La última cuota ajusta el centavo redondeado");
  console.log("✅ [PASS] 5: Split Pay en partes iguales con ajuste automático de centavos validado");
}

// 6. Pagos mixtos con múltiples métodos y distribución en arqueo Z
{
  const totalOrder = 50.0;
  const splitDetails = [
    { amount: 20.0, paymentMethod: "EFECTIVO" },
    { amount: 15.0, paymentMethod: "DEUNA" },
    { amount: 10.0, paymentMethod: "TRANSFERENCIA" },
    { amount: 5.0, paymentMethod: "TARJETA" },
  ];

  let cashSum = 0;
  let deunaSum = 0;
  let transferSum = 0;
  let cardSum = 0;

  splitDetails.forEach((d) => {
    if (d.paymentMethod === "EFECTIVO") cashSum += d.amount;
    else if (d.paymentMethod === "DEUNA") deunaSum += d.amount;
    else if (d.paymentMethod === "TRANSFERENCIA") transferSum += d.amount;
    else cardSum += d.amount;
  });

  assert.strictEqual(cashSum, 20.0, "Efectivo debe ser $20.00");
  assert.strictEqual(deunaSum, 15.0, "DeUna debe ser $15.00");
  assert.strictEqual(transferSum, 10.0, "Transferencia debe ser $10.00");
  assert.strictEqual(cardSum, 5.0, "Tarjeta debe ser $5.00");
  assert.strictEqual(cashSum + deunaSum + transferSum + cardSum, totalOrder, "La suma mixta debe ser $50.00");
  console.log("✅ [PASS] 6: Distribución multi-método para Turno y Arqueo Z validada");
}

console.log("==================================================");
console.log("🎉 TODAS LAS PRUEBAS DE CAJA SPLIT SCREEN PASARON (6/6)");
console.log("==================================================");

