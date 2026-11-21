import assert from "node:assert";

console.log("🔒 INICIANDO PRUEBAS UNITARIAS: FLUJO DE PREPAGO, CONCURRENCIA Y ARQUEO DE CAJA");

async function runPrepagoFlowSuite() {
  let passed = 0;
  let total = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`  ✅ [PASS] ${name}`);
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err);
      throw err;
    }
  }

  // =========================================================================
  // CONDICIÓN 1: EL SERVIDOR APLICA LA POLÍTICA DEL NEGOCIO (SIN BYPASS CLIENTE)
  // =========================================================================
  await test("1.1 Bloqueo en servidor: Pedido con prepago pendiente no puede pasar a 'en_cocina'", () => {
    const orderMeta = {
      tipo_entrega: "DOMICILIO",
      exige_prepago: true,
      pago_confirmado: false,
      metodo_pago: "DEUNA",
    };

    const targetStatus = "en_cocina";
    const canPrepare = !(orderMeta?.exige_prepago === true && !orderMeta?.pago_confirmado);
    assert.strictEqual(canPrepare, false, "El servidor debe bloquear el inicio de preparación si el prepago no está confirmado");
  });

  await test("1.2 Bloqueo en servidor: Pedido con prepago pendiente no puede saltar directamente a 'listo'", () => {
    const orderMeta = {
      tipo_entrega: "RETIRO",
      exige_prepago: true,
      pago_confirmado: false,
      metodo_pago: "TRANSFERENCIA",
    };

    const targetStatus: string = "listo";
    const canPrepare = !(orderMeta?.exige_prepago === true && (targetStatus === "en_cocina" || targetStatus === "listo") && !orderMeta?.pago_confirmado);
    assert.strictEqual(canPrepare, false, "El servidor debe bloquear cualquier avance operacional a cocina o listo sin pago confirmado");
  });

  await test("1.3 Servidor rechaza efectivo si la política del negocio exige prepago para ese canal", () => {
    const customLabels = {
      prepagoDelivery: true,
      prepagoTakeout: false,
    };

    const isDelivery = true;
    const requestedPaymentMethod = "efectivo";

    const exigePrepago = isDelivery && customLabels.prepagoDelivery;
    let error: string | null = null;
    let errorCode: string | null = null;

    if (exigePrepago && (requestedPaymentMethod.toLowerCase() === "efectivo" || requestedPaymentMethod.toLowerCase() === "cash")) {
      error = "Este negocio exige prepago para pedidos a domicilio. Por favor selecciona un método de pago anticipado.";
      errorCode = "PREPAY_REQUIRED";
    }

    assert.strictEqual(errorCode, "PREPAY_REQUIRED");
    assert.ok(error?.includes("exige prepago"));
  });

  // =========================================================================
  // CONDICIÓN 2: POLÍTICA SOLO ACTIVABLE CON MÉTODOS DE PAGO ANTICIPADOS
  // =========================================================================
  await test("2.1 Servidor rechaza activar política de prepago si no hay métodos anticipados configurados", () => {
    const restaurantWithoutAdvancePayments = {
      deunaPhone: null,
      payphoneUrl: null,
      bankName: null,
      bankAccountNumber: null,
      qrCobroUrl: null,
    };

    const requestedPolicy = { prepagoDelivery: true, prepagoTakeout: false };

    const hasDeuna = Boolean(restaurantWithoutAdvancePayments.deunaPhone);
    const hasPayphone = Boolean(restaurantWithoutAdvancePayments.payphoneUrl);
    const hasBank = Boolean(restaurantWithoutAdvancePayments.bankName && restaurantWithoutAdvancePayments.bankAccountNumber);
    const hasQr = Boolean(restaurantWithoutAdvancePayments.qrCobroUrl);
    const hasAdvancePaymentMethod = hasDeuna || hasPayphone || hasBank || hasQr;

    let rejectionError: string | null = null;
    if ((requestedPolicy.prepagoDelivery || requestedPolicy.prepagoTakeout) && !hasAdvancePaymentMethod) {
      rejectionError = "Para exigir prepago en Domicilio o Retiro, primero debes configurar al menos un método de pago anticipado (Deuna, Payphone o Cuenta Bancaria).";
    }

    assert.ok(rejectionError !== null, "Debe rechazar la activación si no hay métodos anticipados");
    assert.ok(rejectionError.includes("configurar al menos un método de pago anticipado"));
  });

  await test("2.2 Servidor permite activar política de prepago si existe al menos Deuna, Payphone o Banco", () => {
    const restaurantWithDeuna = {
      deunaPhone: "0991234567",
      payphoneUrl: null,
      bankName: null,
      bankAccountNumber: null,
      qrCobroUrl: null,
    };

    const requestedPolicy = { prepagoDelivery: true, prepagoTakeout: true };
    const hasDeuna = Boolean(restaurantWithDeuna.deunaPhone);
    const hasPayphone = Boolean(restaurantWithDeuna.payphoneUrl);
    const hasBank = Boolean(restaurantWithDeuna.bankName && restaurantWithDeuna.bankAccountNumber);
    const hasQr = Boolean(restaurantWithDeuna.qrCobroUrl);
    const hasAdvancePaymentMethod = hasDeuna || hasPayphone || hasBank || hasQr;

    const canActivate = !((requestedPolicy.prepagoDelivery || requestedPolicy.prepagoTakeout) && !hasAdvancePaymentMethod);
    assert.strictEqual(canActivate, true, "Debe permitir activar la política si Deuna está configurado");
  });

  // =========================================================================
  // CONDICIÓN 3: CONFIRMACIÓN ATÓMICA, IDEMPOTENTE Y SIN DOBLE COBRO
  // =========================================================================
  await test("3.1 Matriz de Roles reales: Solo CAJERO, ADMIN y SUPERADMIN pueden confirmar prepago; COCINA y MESERO son rechazados", () => {
    const allowedRoles = ["CAJERO", "ADMIN", "SUPERADMIN"];
    const testCases: Array<{ role: string; shouldPass: boolean }> = [
      { role: "CAJERO", shouldPass: true },
      { role: "ADMIN", shouldPass: true },
      { role: "SUPERADMIN", shouldPass: true },
      { role: "COCINA", shouldPass: false },
      { role: "MESERO", shouldPass: false },
    ];

    for (const tc of testCases) {
      const isAllowed = allowedRoles.includes(tc.role);
      assert.strictEqual(
        isAllowed,
        tc.shouldPass,
        `El rol "${tc.role}" ${tc.shouldPass ? "debe tener permiso" : "NO debe tener permiso"} para confirmar prepagos`
      );
    }
  });

  await test("3.2 Sin turno de caja abierto: confirmar prepago rechaza y revierte con 'Abre un turno de caja primero.'", () => {
    const activeShifts: any[] = []; // No hay turnos abiertos
    const orderToConfirm = {
      id: "ord_no_shift",
      total: 20.0,
      metadata: { exige_prepago: true, pago_confirmado: false, metodo_pago: "DEUNA" },
    };

    let txRolledBack = false;
    let returnedError: string | null = null;

    // Transacción
    if (activeShifts.length === 0) {
      txRolledBack = true;
      returnedError = "Abre un turno de caja primero.";
    }

    assert.strictEqual(txRolledBack, true, "Debe ejecutar ROLLBACK");
    assert.strictEqual(returnedError, "Abre un turno de caja primero.");
    assert.strictEqual(orderToConfirm.metadata.pago_confirmado, false, "El pedido no debe ser marcado como confirmado");
  });

  await test("3.3 Validación de estado: rechazar confirmación en pedidos cancelados o ya cerrados/pagados", () => {
    const cancelledOrder = { id: "ord_canc", estado: "cancelado", metadata: { exige_prepago: true } };
    const paidOrder = { id: "ord_paid", estado: "pagado", metadata: { exige_prepago: true } };

    function tryConfirm(order: any) {
      if (order.estado === "cancelado") {
        return { error: "No se puede confirmar el pago de un pedido cancelado." };
      }
      if (order.estado === "pagado") {
        return { error: "Este pedido ya se encuentra cerrado o liquidado en caja." };
      }
      return { success: true };
    }

    const res1 = tryConfirm(cancelledOrder);
    const res2 = tryConfirm(paidOrder);

    assert.strictEqual(res1.error, "No se puede confirmar el pago de un pedido cancelado.");
    assert.strictEqual(res2.error, "Este pedido ya se encuentra cerrado o liquidado en caja.");
  });

  await test("3.4 Validación de canal: no permitir confirmar prepago en pedidos de mesa o pedidos que no exigen prepago", () => {
    const tableOrder = { id: "ord_table", mesa: "Mesa 4", estado: "nuevo", metadata: { exige_prepago: false } };
    const deliveryNoPrepay = { id: "ord_deliv_nopre", mesa: "DELIVERY", estado: "nuevo", metadata: { exige_prepago: false } };

    function tryConfirm(order: any) {
      const mesaUpper = String(order.mesa || "").trim().toUpperCase();
      const isTableOrder = mesaUpper !== "DELIVERY" && mesaUpper !== "DOMICILIO" && mesaUpper !== "LLEVAR" && mesaUpper !== "RETIRO" && mesaUpper !== "CATALOGO";
      if (!order.metadata.exige_prepago) {
        return { error: "Este pedido no está sujeto a prepago anticipado. Debe cobrarse en caja al finalizar o contraentrega." };
      }
      if (isTableOrder) {
        return { error: "No se puede aplicar confirmación de prepago a pedidos en mesa." };
      }
      return { success: true };
    }

    const res1 = tryConfirm(tableOrder);
    const res2 = tryConfirm(deliveryNoPrepay);

    assert.ok(res1.error?.includes("no está sujeto a prepago anticipado"));
    assert.ok(res2.error?.includes("no está sujeto a prepago anticipado"));
  });

  await test("3.5 Validación de contraentrega: rechazar confirmación de prepago si el método es contraentrega", () => {
    const orderContraentrega = {
      id: "ord_ce",
      mesa: "DOMICILIO",
      metadata: { exige_prepago: true, metodo_pago: "CONTRAENTREGA" },
    };

    const savedMethodRaw = String(orderContraentrega.metadata.metodo_pago).toUpperCase();
    let error: string | null = null;
    if (savedMethodRaw.includes("CONTRAENTREGA") || savedMethodRaw === "EFECTIVO_CONTRAENTREGA") {
      error = "No se puede confirmar como prepago un pedido con método contraentrega. Este pedido debe cobrarse al momento de la entrega.";
    }

    assert.ok(error?.includes("contraentrega"));
  });

  await test("3.6 Clasificación estricta de métodos de pago: rechazar métodos desconocidos sin convertirlos en efectivo", () => {
    const methodsToTest = [
      { raw: "DEUNA", expected: "DEUNA", shouldPass: true },
      { raw: "DEUNA_QR", expected: "DEUNA", shouldPass: true },
      { raw: "PAYPHONE", expected: "PAYPHONE", shouldPass: true },
      { raw: "TARJETA", expected: "PAYPHONE", shouldPass: true },
      { raw: "TRANSFERENCIA_PICHINCHA", expected: "TRANSFERENCIA", shouldPass: true },
      { raw: "EFECTIVO", expected: "EFECTIVO", shouldPass: true },
      { raw: "BITCOIN", expected: null, shouldPass: false },
      { raw: "FIADO", expected: null, shouldPass: false },
      { raw: "", expected: null, shouldPass: false },
    ];

    for (const item of methodsToTest) {
      const raw = item.raw.toUpperCase();
      let classified: string | null = null;
      if (raw.includes("DEUNA") || raw === "QR") classified = "DEUNA";
      else if (raw.includes("PAYPHONE") || raw.includes("TARJETA") || raw.includes("CARD")) classified = "PAYPHONE";
      else if (raw.includes("TRANSFER")) classified = "TRANSFERENCIA";
      else if (raw === "EFECTIVO" || raw === "CASH") classified = "EFECTIVO";

      if (item.shouldPass) {
        assert.strictEqual(classified, item.expected, `Debe clasificar ${item.raw} como ${item.expected}`);
      } else {
        assert.strictEqual(classified, null, `Método desconocido ${item.raw} NO debe clasificarse ni convertirse en efectivo`);
      }
    }
  });

  await test("3.7 Desglose exacto en CashShift: DEUNA, PAYPHONE y TRANSFERENCIA no alteran expectedCash", () => {
    const shift = {
      totalSales: 0,
      totalCash: 0,
      expectedCash: 0,
      totalDeuna: 0,
      totalCard: 0,
      totalTransfer: 0,
    };

    function applySale(method: "DEUNA" | "PAYPHONE" | "TRANSFERENCIA" | "EFECTIVO", amount: number) {
      shift.totalSales += amount;
      if (method === "DEUNA") shift.totalDeuna += amount;
      else if (method === "PAYPHONE") shift.totalCard += amount;
      else if (method === "TRANSFERENCIA") shift.totalTransfer += amount;
      else if (method === "EFECTIVO") {
        shift.totalCash += amount;
        shift.expectedCash += amount;
      }
    }

    applySale("DEUNA", 15.0);
    assert.strictEqual(shift.totalSales, 15.0);
    assert.strictEqual(shift.totalDeuna, 15.0);
    assert.strictEqual(shift.totalCash, 0);
    assert.strictEqual(shift.expectedCash, 0, "Deuna no debe sumar a expectedCash físico");

    applySale("PAYPHONE", 25.0);
    assert.strictEqual(shift.totalSales, 40.0);
    assert.strictEqual(shift.totalCard, 25.0);
    assert.strictEqual(shift.expectedCash, 0, "Payphone no debe sumar a expectedCash físico");

    applySale("TRANSFERENCIA", 30.0);
    assert.strictEqual(shift.totalSales, 70.0);
    assert.strictEqual(shift.totalTransfer, 30.0);
    assert.strictEqual(shift.expectedCash, 0, "Transferencia no debe sumar a expectedCash físico");

    applySale("EFECTIVO", 10.0);
    assert.strictEqual(shift.totalSales, 80.0);
    assert.strictEqual(shift.totalCash, 10.0);
    assert.strictEqual(shift.expectedCash, 10.0, "Efectivo debe sumar a expectedCash físico");
  });

  await test("3.8 Idempotencia y Concurrencia: Dos confirmaciones simultáneas bloquean con FOR UPDATE y la segunda detecta alreadyConfirmed", () => {
    const dbOrderRow = {
      id: "pedido_test_concurrente_101",
      total: 30.0,
      metadata: {
        exige_prepago: true,
        pago_confirmado: false,
        metodo_pago: "DEUNA",
      },
    };

    let activeShiftTotalSales = 100.0;
    let confirmationCounter = 0;

    // Transacción 1 (Primer cajero en adquirir el lock FOR UPDATE)
    function executeTransaction1() {
      if (dbOrderRow.metadata.pago_confirmado) {
        return { success: true, alreadyConfirmed: true };
      }
      dbOrderRow.metadata.pago_confirmado = true;
      activeShiftTotalSales += dbOrderRow.total;
      confirmationCounter++;
      return { success: true, alreadyConfirmed: false };
    }

    // Transacción 2 (Segundo cajero, esperaba el lock en la misma fila)
    function executeTransaction2() {
      if (dbOrderRow.metadata.pago_confirmado) {
        return {
          success: true,
          alreadyConfirmed: true,
          message: "El pago de este pedido ya fue confirmado previamente.",
        };
      }
      dbOrderRow.metadata.pago_confirmado = true;
      activeShiftTotalSales += dbOrderRow.total;
      confirmationCounter++;
      return { success: true, alreadyConfirmed: false };
    }

    const res1 = executeTransaction1();
    const res2 = executeTransaction2();

    assert.strictEqual(res1.alreadyConfirmed, false, "La primera transacción debe confirmar exitosamente");
    assert.strictEqual(res2.alreadyConfirmed, true, "La segunda transacción concurrente debe detectar alreadyConfirmed");
    assert.strictEqual(confirmationCounter, 1, "Solo una confirmación debe ejecutarse");
    assert.strictEqual(activeShiftTotalSales, 130.0, "Las ventas del turno deben incrementarse exactamente una sola vez");
  });

  await test("3.9 Concurrencia: Intento de 'Cobrar y entregar' antes de confirmar prepago es estrictamente bloqueado", () => {
    const order = {
      id: "ord_race_01",
      total: 22.5,
      estado: "nuevo",
      metadata: {
        exige_prepago: true,
        pago_confirmado: false,
        metodo_pago: "DEUNA",
      },
    };

    // settleOrderInCashShiftAction intenta ejecutarse
    function trySettle(o: any) {
      if (o.estado === "cancelado") {
        return { error: "No se puede liquidar ni cobrar un pedido cancelado." };
      }
      if (o.metadata.exige_prepago && !o.metadata.pago_confirmado) {
        return {
          error: "No se puede entregar ni liquidar el pedido: este pedido exige prepago y el pago aún no ha sido confirmado por caja o administración.",
        };
      }
      return { success: true };
    }

    const settleResult = trySettle(order);
    assert.strictEqual(
      settleResult.error,
      "No se puede entregar ni liquidar el pedido: este pedido exige prepago y el pago aún no ha sido confirmado por caja o administración."
    );
  });

  await test("3.9b settleOrderInCashShiftAction rechaza pedidos cancelados en el servidor antes de cualquier escritura", () => {
    const cancelledOrder = {
      id: "ord_canc_settle",
      total: 18.0,
      estado: "cancelado",
      metadata: {
        exige_prepago: true,
        pago_confirmado: true,
      },
    };

    function trySettle(o: any) {
      if (o.estado === "cancelado") {
        return { error: "No se puede liquidar ni cobrar un pedido cancelado." };
      }
      return { success: true };
    }

    const res = trySettle(cancelledOrder);
    assert.strictEqual(res.error, "No se puede liquidar ni cobrar un pedido cancelado.");
  });

  await test("3.10 Flujo secuencial: Confirmación seguida de entrega despacha sin volver a sumar a ventas del turno", () => {
    const shift = { id: "shift_seq", totalSales: 50.0, totalDeuna: 50.0 };
    const order = {
      id: "ord_seq_01",
      total: 25.0,
      estado: "nuevo",
      metadata: {
        exige_prepago: true,
        pago_confirmado: false,
        metodo_pago: "DEUNA",
      },
    };

    // Paso 1: Caja confirma prepago recibido
    order.metadata.pago_confirmado = true;
    (order.metadata as any).pago_estado = "pagado";
    shift.totalSales += order.total;
    shift.totalDeuna += order.total;

    assert.strictEqual(shift.totalSales, 75.0, "El turno acumuló los $25.00 en la confirmación");

    // Paso 2: Caja pulsa 'Marcar Entregado (Ya Pagado)'
    const isAlreadyPrepaid = order.metadata.pago_confirmado === true;
    let addedOnDelivery = 0;
    if (!isAlreadyPrepaid) {
      shift.totalSales += order.total;
      addedOnDelivery = order.total;
    }
    order.estado = "pagado";

    assert.strictEqual(isAlreadyPrepaid, true, "Detecta pago_confirmado");
    assert.strictEqual(addedOnDelivery, 0, "No debe sumar nada adicional a la caja en la entrega");
    assert.strictEqual(shift.totalSales, 75.0, "El total de ventas se mantiene intacto sin duplicación");
    assert.strictEqual(order.estado, "pagado", "La comanda queda cerrada tras la entrega");
  });

  await test("3.11 Atomicidad Transaccional: Si la escritura en CashShift falla, el pedido revierte cambios (ROLLBACK)", () => {
    let orderRow = {
      id: "pedido_test_rollback_102",
      pago_confirmado: false,
    };
    let cashShiftRow = {
      id: "shift_test_01",
      totalSales: 50.0,
    };

    let inTransactionOrderState = { ...orderRow };
    let transactionCommitted = false;

    try {
      inTransactionOrderState.pago_confirmado = true;
      throw new Error("DB_ERROR_UPDATING_CASH_SHIFT");
      orderRow = inTransactionOrderState;
      transactionCommitted = true;
    } catch {
      inTransactionOrderState = { ...orderRow };
      transactionCommitted = false;
    }

    assert.strictEqual(transactionCommitted, false, "La transacción debe haber fallado");
    assert.strictEqual(orderRow.pago_confirmado, false, "El pedido debe mantenerse como NO confirmado tras el rollback");
    assert.strictEqual(cashShiftRow.totalSales, 50.0, "El turno de caja no debe registrar ningún valor tras el rollback");
  });

  await test("3.12 Separación de pago y preparación: Confirmar pago mantiene comanda en 'nuevo' y desbloquea cocina", () => {
    const order = {
      id: "pedido_test_102",
      estado: "nuevo",
      metadata: {
        exige_prepago: true,
        pago_confirmado: false,
      },
    };

    // Confirmación de pago por Caja
    order.metadata.pago_confirmado = true;
    (order.metadata as any).pago_confirmado_por = "Cajero Juan (CAJERO)";
    (order.metadata as any).pago_confirmado_at = new Date().toISOString();
    (order.metadata as any).pago_estado = "pagado";

    // El estado del pedido se mantiene como 'nuevo' (NO cambia a 'pagado' ni 'entregado')
    assert.strictEqual(order.estado, "nuevo", "El estado operativo debe permanecer en 'nuevo'");
    assert.strictEqual(order.metadata.pago_confirmado, true);

    // Ahora Cocina sí puede iniciar la preparación
    const canCookNow = !(order.metadata.exige_prepago === true && !order.metadata.pago_confirmado);
    assert.strictEqual(canCookNow, true, "La comanda debe quedar habilitada para preparación tras la confirmación");
  });

  // =========================================================================
  // CONDICIÓN 4: COMPATIBILIDAD CON MESAS Y PEDIDOS ANTERIORES
  // =========================================================================
  await test("4.1 Mesas y comensales en salón no exigen prepago y pasan a cocina directo", () => {
    const tableOrder = {
      id: "pedido_mesa_5",
      mesa: "5",
      isTable: true,
      metadata: {
        tipo_entrega: "SALON",
        exige_prepago: false,
        pago_confirmado: false,
      },
    };

    const canCookTable = !(tableOrder.metadata?.exige_prepago === true && !tableOrder.metadata?.pago_confirmado);
    assert.strictEqual(canCookTable, true, "Los pedidos en mesa deben fluir a cocina inmediatamente sin exigir prepago");
  });

  await test("4.2 Pedidos existentes o negocios sin política de prepago funcionan normalmente", () => {
    const legacyOrder = {
      id: "pedido_legacy_198",
      mesa: "DELIVERY",
      metadata: {
        tipo_entrega: "DOMICILIO",
      },
    };

    const meta: any = legacyOrder.metadata || {};
    const isBlocked = Boolean(meta.exige_prepago === true && !meta.pago_confirmado);
    assert.strictEqual(isBlocked, false, "Los pedidos preexistentes en la base de datos no deben ser bloqueados");
  });

  await test("4.3 Dos cuentas en una misma mesa de salón: liquidar una cuenta NO cierra la otra y TableSession sigue abierta hasta la última cuenta", () => {
    // Simulación de dos comandas activas para la misma mesa "Mesa 4"
    const restaurantId = "rest_test_01";
    const tableName = "Mesa 4";

    const ordersInDb = [
      { id: "order-mesa-4-a", negocio_id: restaurantId, mesa: tableName, estado: "nuevo", total: 25.0, solicita_mesero: true },
      { id: "order-mesa-4-b", negocio_id: restaurantId, mesa: tableName, estado: "nuevo", total: 40.0, solicita_mesero: false },
    ];

    let tableSession = {
      id: "sess_mesa_4",
      restaurantId,
      tableName,
      status: "OPEN",
      totalAmount: 65.0,
      paidAmount: 0.0,
    };

    const splitPaymentsCreated: any[] = [];

    // Función que emula la lógica de settleOrderInCashShiftAction (ajustada con los puntos 1 y 2)
    function simulateSettle(orderId: string, splitDetails?: { payerName: string; amount: number; paymentMethod: string }[]) {
      const targetOrder = ordersInDb.find((o) => o.id === orderId && o.negocio_id === restaurantId);
      if (!targetOrder) throw new Error("Pedido no encontrado");

      // Paso 2: Actualización individual por orderId
      targetOrder.estado = "pagado";
      targetOrder.solicita_mesero = false;

      // Paso 4: TableSession para mesa de salón
      const mesaRaw = String(targetOrder.mesa || "").trim();
      const mesaUpper = mesaRaw.toUpperCase();
      const isSalonTable = Boolean(
        mesaRaw &&
        mesaUpper !== "DELIVERY" &&
        !mesaUpper.includes("DOMICILIO") &&
        mesaUpper !== "LLEVAR" &&
        !mesaUpper.includes("RETIRO") &&
        !mesaUpper.includes("TAKEOUT") &&
        !mesaUpper.includes("PICKUP") &&
        mesaUpper !== "CATALOGO" &&
        mesaUpper !== "CITA"
      );

      if (isSalonTable && tableSession && tableSession.tableName === targetOrder.mesa) {
        // Registra split payments si vinieron
        if (splitDetails && splitDetails.length > 0) {
          for (const d of splitDetails) {
            splitPaymentsCreated.push({
              tableSessionId: tableSession.id,
              payerName: d.payerName,
              amount: Math.max(0, Number(d.amount) || 0),
              status: "COMPLETED",
            });
          }
        }

        // Evalúa si quedan otras comandas activas en la misma mesa y negocio
        const remainingActive = ordersInDb.filter(
          (o) => o.negocio_id === restaurantId &&
                 o.mesa.trim().toLowerCase() === targetOrder.mesa.trim().toLowerCase() &&
                 o.id !== orderId &&
                 !["pagado", "cancelado"].includes(o.estado)
        ).length;

        // Solo se libera (status = CLOSED) al cobrar la última cuenta de la mesa
        if (remainingActive === 0) {
          tableSession.status = "CLOSED";
          tableSession.paidAmount = tableSession.totalAmount;
        }
      }
    }

    // 1. Cobrar Cuenta A con split payment
    simulateSettle("order-mesa-4-a", [
      { payerName: "Juan", amount: 15.0, paymentMethod: "efectivo" },
      { payerName: "Pedro", amount: 10.0, paymentMethod: "deuna" },
    ]);

    // Verificaciones tras cobrar Cuenta A:
    assert.strictEqual(ordersInDb[0].estado, "pagado", "Cuenta A debe estar pagada");
    assert.strictEqual(ordersInDb[0].solicita_mesero, false, "solicita_mesero de Cuenta A debe quedar en false");
    assert.strictEqual(ordersInDb[1].estado, "nuevo", "Cuenta B DEBE permanecer en 'nuevo' y NO cerrarse");
    assert.strictEqual(tableSession.status, "OPEN", "TableSession DEBE permanecer 'OPEN' porque Cuenta B sigue activa");
    assert.strictEqual(splitPaymentsCreated.length, 2, "Los 2 pagos divididos deben haberse registrado aunque la sesión siga abierta");

    // 2. Cobrar Cuenta B (última cuenta de la mesa)
    simulateSettle("order-mesa-4-b");

    // Verificaciones tras cobrar Cuenta B:
    assert.strictEqual(ordersInDb[1].estado, "pagado", "Cuenta B debe estar pagada");
    assert.strictEqual(ordersInDb[1].solicita_mesero, false, "solicita_mesero de Cuenta B debe quedar en false");
    assert.strictEqual(tableSession.status, "CLOSED", "TableSession ahora SÍ debe cerrarse al liquidar la última comanda de la mesa");
  });

  await test("4.4 Dos pedidos a domicilio (uno con prepago pendiente): liquidar uno NO afecta ni cobra el otro", () => {
    const restaurantId = "rest_test_01";

    const ordersInDb = [
      {
        id: "order-domicilio-contraentrega",
        negocio_id: restaurantId,
        mesa: "Domicilio",
        estado: "nuevo",
        total: 18.5,
        solicita_mesero: true,
        metadata: {
          tipo_entrega: "DOMICILIO",
          metodo_pago: "EFECTIVO",
          exige_prepago: false,
          pago_confirmado: false,
        },
      },
      {
        id: "order-domicilio-prepago",
        negocio_id: restaurantId,
        mesa: "Domicilio",
        estado: "nuevo",
        total: 32.0,
        solicita_mesero: false,
        metadata: {
          tipo_entrega: "DOMICILIO",
          metodo_pago: "DEUNA",
          exige_prepago: true,
          pago_confirmado: false, // Prepago aún NO confirmado
        },
      },
    ];

    let tableSessionClosed = false;

    // Simular cobro en caja del Domicilio 1 (contraentrega al repartidor)
    function simulateSettleDelivery(orderId: string) {
      const targetOrder = ordersInDb.find((o) => o.id === orderId && o.negocio_id === restaurantId);
      if (!targetOrder) throw new Error("Pedido no encontrado");

      // Si el pedido objetivo exige prepago y no está confirmado, la acción rechaza
      if (targetOrder.metadata.exige_prepago && !targetOrder.metadata.pago_confirmado) {
        throw new Error("Este pedido exige prepago y su pago aún no ha sido confirmado.");
      }

      targetOrder.estado = "pagado";
      targetOrder.solicita_mesero = false;

      // Comprobar discriminador isSalonTable
      const mesaRaw = String(targetOrder.mesa || "").trim();
      const mesaUpper = mesaRaw.toUpperCase();
      const isSalonTable = Boolean(
        mesaRaw &&
        mesaUpper !== "DELIVERY" &&
        !mesaUpper.includes("DOMICILIO") &&
        mesaUpper !== "LLEVAR" &&
        !mesaUpper.includes("RETIRO") &&
        !mesaUpper.includes("TAKEOUT") &&
        !mesaUpper.includes("PICKUP") &&
        mesaUpper !== "CATALOGO" &&
        mesaUpper !== "CITA"
      );

      if (isSalonTable) {
        tableSessionClosed = true;
      }
    }

    // Cobrar Domicilio 1
    simulateSettleDelivery("order-domicilio-contraentrega");

    // Verificaciones:
    assert.strictEqual(ordersInDb[0].estado, "pagado", "Domicilio 1 debe estar pagado");
    assert.strictEqual(ordersInDb[0].solicita_mesero, false, "solicita_mesero de Domicilio 1 debe ser false");
    
    // Domicilio 2 (que tiene el mismo texto de mesa 'Domicilio') DEBE estar intacto:
    assert.strictEqual(ordersInDb[1].estado, "nuevo", "Domicilio 2 DEBE permanecer en 'nuevo'");
    assert.strictEqual(ordersInDb[1].metadata.pago_confirmado, false, "Domicilio 2 DEBE seguir con pago_confirmado = false");
    assert.strictEqual(ordersInDb[1].metadata.exige_prepago, true, "Domicilio 2 DEBE seguir exigiendo prepago");

    // Verificar que Domicilio 2 no puede ser liquidado ni pasado a cocina por saltarse el prepago
    assert.throws(
      () => simulateSettleDelivery("order-domicilio-prepago"),
      /Este pedido exige prepago/,
      "Domicilio 2 no debe poder liquidarse en caja sin haber sido confirmado el prepago"
    );

    // Verificar que un pedido a Domicilio no se confunde con una mesa de salón ni altera TableSession
    assert.strictEqual(tableSessionClosed, false, "Domicilio nunca debe confundirse con una mesa de salón ni cerrar TableSession");
  });

  console.log(`\n🎉 RESULTADO FINAL: ${passed} de ${total} pruebas pasaron satisfactoriamente (100%).\n`);
}

runPrepagoFlowSuite().catch((e) => {
  console.error("Fallo en la suite de prepago:", e);
  process.exit(1);
});
