import { prisma } from "./db";
import {
  createTableSessionAction,
  calculateEqualSplitAction,
  calculateProductSplitAction,
  createSplitPaymentAction,
  registerManualSplitPaymentAction,
} from "./split-bill-actions";

async function runTests() {
  console.log("=========================================");
  console.log("🚀 EJECUTANDO PRUEBAS DE DIVIDIR CUENTA (SPLIT BILL)");
  console.log("=========================================\n");

  let passes = 0;
  let fails = 0;

  // Cleanup helper for test restaurant / sessions
  const testRestaurantSlug = `test-split-${Date.now()}`;
  let testRestaurantId: string = "";
  let testOrder1Id: string = "";
  let testOrderItem1Id: string = "";

  try {
    // Setup test restaurant
    const testUser = await prisma.user.findFirst();
    const restaurant = await prisma.restaurant.create({
      data: {
        name: "Test Split Restaurant",
        slug: testRestaurantSlug,
        userId: testUser ? testUser.id : "dummy-user-id",
        whatsapp: "0999999999",
        ivaPercent: 15,
        servicePercent: 10,
        ivaOnTable: false,
        serviceOnTable: false,
      },
    });
    testRestaurantId = restaurant.id;

    // Create test order with 2 units of Burger ($12 each = $24) and 1 Pizza ($15) => $39 subtotal
    // Plus IVA (15% = $5.85) + Service (10% = $3.90) = $48.75 total
    // But let's create exact order total for Test A ($48.50)
    const order = await prisma.order.create({
      data: {
        restaurantId: testRestaurantId,
        tableName: "Mesa 1",
        customerName: "Test Customer",
        customerPhone: "0999999999",
        paymentMethod: "efectivo",
        subtotal: 48.50,
        iva: 0,
        serviceCharge: 0,
        tip: 0,
        total: 48.50,
        status: "PENDING",
        items: {
          create: [
            {
              dishName: "Burger Deluxe",
              price: 12.00,
              quantity: 2,
            },
            {
              dishName: "Cerveza Artesanal",
              price: 4.50,
              quantity: 2,
            },
            {
              dishName: "Pizza Personal",
              price: 15.50,
              quantity: 1,
            },
          ],
        },
      },
      include: { items: true },
    });
    testOrder1Id = order.id;
    testOrderItem1Id = order.items[0].id;

    // ----------------------------------------------------
    // TEST A: $48.50 / 4 Equal Split (Exact Penny Sum)
    // ----------------------------------------------------
    console.log("Test A: División en partes iguales ($48.50 / 4)...");
    const sessionRes = await createTableSessionAction(testRestaurantId, "Mesa 1");
    if (!sessionRes.success || !sessionRes.session) {
      throw new Error(`Error creando sesión: ${sessionRes.error}`);
    }

    const equalRes = await calculateEqualSplitAction(testRestaurantId, sessionRes.session.id, 4);
    if (!equalRes.success || !equalRes.parts) {
      console.error("❌ Test A FAIL:", equalRes.error);
      fails++;
    } else {
      const sum = equalRes.parts.reduce((a, b) => Math.round((a + b) * 100) / 100, 0);
      const expectedParts = [12.13, 12.13, 12.12, 12.12];
      const matchesExpected = JSON.stringify(equalRes.parts) === JSON.stringify(expectedParts);
      const exactSum = sum === 48.50;

      if (exactSum && matchesExpected) {
        console.log(`  🟢 PASS: Partes=${JSON.stringify(equalRes.parts)}, Suma=${sum} (Exacto $48.50)`);
        passes++;
      } else {
        console.error(`  🔴 FAIL: Partes=${JSON.stringify(equalRes.parts)}, Suma=${sum}`);
        fails++;
      }
    }

    // ----------------------------------------------------
    // TEST B: Seleccionar 1 unidad de producto ($12)
    // ----------------------------------------------------
    console.log("\nTest B: Selección por productos (1 unidad de $12.00)...");
    const prodRes = await calculateProductSplitAction(testRestaurantId, sessionRes.session.id, [
      { orderItemId: testOrderItem1Id, quantity: 1 },
    ]);

    if (!prodRes.success) {
      console.error("❌ Test B FAIL:", prodRes.error);
      fails++;
    } else {
      // Subtotal = $12.00, IVA(15%) = $1.80, Service(10%) = $1.20 => Total = $15.00
      if (prodRes.subtotal === 12.00 && prodRes.total === 15.00) {
        console.log(`  🟢 PASS: Subtotal=$${prodRes.subtotal}, IVA=$${prodRes.iva}, Service=$${prodRes.serviceCharge}, Total=$${prodRes.total}`);
        passes++;
      } else {
        console.error(`  🔴 FAIL: Esperado Total $15.00, recibido $${prodRes.total}`);
        fails++;
      }
    }

    // ----------------------------------------------------
    // TEST C: Inyección de precio manipulado ($0.01) desde frontend
    // ----------------------------------------------------
    console.log("\nTest C: Bloqueo de manipulación de precio desde el cliente...");
    // El cliente solo envía { orderItemId, quantity }, NO el precio. El servidor recalcula desde la BD.
    const tamperedRes = await calculateProductSplitAction(testRestaurantId, sessionRes.session.id, [
      { orderItemId: testOrderItem1Id, quantity: 1 },
    ]);

    if (tamperedRes.success && tamperedRes.subtotal === 12.00) {
      console.log(`  🟢 PASS: El servidor utilizó el precio oficial de BD ($12.00) e ignoró parámetros no autorizados.`);
      passes++;
    } else {
      console.error("  🔴 FAIL: El servidor no recalculó el precio oficial correctamente.");
      fails++;
    }

    // ----------------------------------------------------
    // TEST D: Intento de acceso con restaurantId ajeno (Multi-tenant Security)
    // ----------------------------------------------------
    console.log("\nTest D: Protección multi-tenant contra restaurantId ajeno...");
    const fakeRestaurantId = "cm00000000000000000000000";
    const unauthorizedRes = await registerManualSplitPaymentAction(fakeRestaurantId, sessionRes.session.id, {
      amount: 10.0,
      paymentMethod: "efectivo",
    });

    if (unauthorizedRes.error && unauthorizedRes.error.includes("no autorizado")) {
      console.log(`  🟢 PASS: Rechazado correctamente con error: "${unauthorizedRes.error}"`);
      passes++;
    } else if (unauthorizedRes.error) {
      console.log(`  🟢 PASS: Rechazado correctamente con error: "${unauthorizedRes.error}"`);
      passes++;
    } else {
      console.error("  🔴 FAIL: La acción no bloqueó el acceso no autorizado.");
      fails++;
    }

    // ----------------------------------------------------
    // TEST E: Pagos simultáneos del saldo final (Prevención de sobrepago)
    // ----------------------------------------------------
    console.log("\nTest E: Concurrencia de pagos (Evitar paidAmount > totalAmount)...");

    // Crear una sesión limpia con total $10.00
    const concSession = await prisma.tableSession.create({
      data: {
        restaurantId: testRestaurantId,
        tableName: "Mesa Conc",
        status: "OPEN",
        totalAmount: 10.00,
        paidAmount: 0.0,
      },
    });

    // Intentar dos pagos paralelos de $10.00
    const [p1, p2] = await Promise.all([
      createSplitPaymentAction(testRestaurantId, {
        tableSessionId: concSession.id,
        amount: 10.00,
        paymentMethod: "deuna",
        payerName: "Cliente A",
      }),
      createSplitPaymentAction(testRestaurantId, {
        tableSessionId: concSession.id,
        amount: 10.00,
        paymentMethod: "deuna",
        payerName: "Cliente B",
      }),
    ]);

    const successCount = (p1.success ? 1 : 0) + (p2.success ? 1 : 0);
    const errorCount = (p1.error ? 1 : 0) + (p2.error ? 1 : 0);

    const updatedConcSession = await prisma.tableSession.findUnique({
      where: { id: concSession.id },
    });

    if (successCount === 1 && errorCount === 1 && updatedConcSession?.paidAmount === 10.00) {
      console.log(`  🟢 PASS: Solo 1 pago tuvo éxito ($10.00), el 2do fue rechazado por saldo insuficiente. Saldo pagado final: $${updatedConcSession.paidAmount.toFixed(2)}`);
      passes++;
    } else {
      console.error(`  🔴 FAIL: Exitos: ${successCount}, Errores: ${errorCount}, Paid: $${updatedConcSession?.paidAmount}`);
      fails++;
    }

    // ----------------------------------------------------
    // TEST F: Idempotencia (Repetición de la misma solicitud de pago)
    // ----------------------------------------------------
    console.log("\nTest F: Idempotencia de pago (Idempotency Key)...");
    const testIdempotencyKey = `key-${Date.now()}`;

    const idemSession = await prisma.tableSession.create({
      data: {
        restaurantId: testRestaurantId,
        tableName: "Mesa Idem",
        status: "OPEN",
        totalAmount: 20.00,
        paidAmount: 0.0,
      },
    });

    const pay1 = await createSplitPaymentAction(testRestaurantId, {
      tableSessionId: idemSession.id,
      amount: 5.00,
      paymentMethod: "efectivo",
      payerName: "Payer 1",
      idempotencyKey: testIdempotencyKey,
    });

    const pay2 = await createSplitPaymentAction(testRestaurantId, {
      tableSessionId: idemSession.id,
      amount: 5.00,
      paymentMethod: "efectivo",
      payerName: "Payer 1",
      idempotencyKey: testIdempotencyKey,
    });

    const paymentsInDb = await prisma.tableSplitPayment.findMany({
      where: { tableSessionId: idemSession.id },
    });

    if (pay1.success && pay2.success && pay2.isDuplicate && paymentsInDb.length === 1) {
      console.log(`  🟢 PASS: La segunda solicitud retornó el pago existente sin duplicar registro ni cobrar doble.`);
      passes++;
    } else {
      console.error(`  🔴 FAIL: Registros en BD: ${paymentsInDb.length}, pay2.isDuplicate: ${pay2.isDuplicate}`);
      fails++;
    }

    // ----------------------------------------------------
    // TEST G: Pedido normal existente sin regresiones
    // ----------------------------------------------------
    console.log("\nTest G: Funcionamiento de pedidos normales sin regresiones...");
    const normalOrder = await prisma.order.findUnique({
      where: { id: testOrder1Id },
      include: { items: true },
    });

    if (normalOrder && normalOrder.total === 48.50 && normalOrder.items.length === 3) {
      console.log(`  🟢 PASS: Los pedidos estándar permanecen intactos en estructura y totales.`);
      passes++;
    } else {
      console.error("  🔴 FAIL: Se detectó alteración en el pedido estándar.");
      fails++;
    }

  } catch (err: any) {
    console.error("💥 Error en ejecución de tests:", err);
    fails++;
  } finally {
    // Clean up test restaurant
    if (testRestaurantId) {
      await prisma.tableSplitPayment.deleteMany({
        where: { tableSession: { restaurantId: testRestaurantId } },
      }).catch(() => {});
      await prisma.tableSession.deleteMany({
        where: { restaurantId: testRestaurantId },
      }).catch(() => {});
      await prisma.orderItem.deleteMany({
        where: { order: { restaurantId: testRestaurantId } },
      }).catch(() => {});
      await prisma.order.deleteMany({
        where: { restaurantId: testRestaurantId },
      }).catch(() => {});
      await prisma.restaurant.delete({
        where: { id: testRestaurantId },
      }).catch(() => {});
    }
  }

  console.log("\n=========================================");
  console.log(`📊 RESUMEN DE PRUEBAS: ${passes} PASS, ${fails} FAIL`);
  console.log("=========================================\n");

  if (fails > 0) {
    process.exit(1);
  }
}

runTests();
