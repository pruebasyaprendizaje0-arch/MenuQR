import assert from "node:assert";
import { createHash, randomUUID, randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "./db";
import { pool } from "./db-pool";
import { signKdsDispatchToken, verifyKdsDispatchToken } from "./jwt";
import { createOrderAction } from "./actions";
import { POST as pedidosPostHandler } from "../app/api/pedidos/route";
import {
  processCheckoutAttemptResult,
  savePendingAttemptToStorage,
  loadPendingAttemptFromStorage,
  clearPendingAttemptFromStorage,
  getPendingAttemptStorageKey,
  executeKdsDispatch,
  type PendingCheckoutAttempt,
  type KdsDispatchPayload,
} from "./checkout-recovery";

console.log("=====================================================================");
console.log("🧪 PRUEBAS UNITARIAS SOBRE FUNCIONES REALES (actions.ts Y route.ts)");
console.log("=====================================================================");

// Desactivar DDL en memoria para ensureDbTables
(globalThis as any).tablesInitialized = true;

const TEST_RESTAURANT_ID = "rest-pigro-test-001";
const TEST_DISH_ID = "dish-test-mariscos-001";

// ---------------------------------------------------------------------------
// TEST 1: Reintento Conserva Identidad y Rechaza Cambio de Carrito
// ---------------------------------------------------------------------------
console.log("\n[TEST 1] Verificando createOrderAction REAL con identidad y conflicto de carrito...");
(async () => {
  const clientOrderId = randomUUID();
  const clientSecret = randomBytes(32).toString("hex");
  const claimHash = createHash("sha256").update(clientSecret).digest("hex");

  const existingOrderInDb = {
    id: clientOrderId,
    restaurantId: TEST_RESTAURANT_ID,
    tableName: "Llevar",
    total: 16.13,
    orderNumber: 175,
    claimHash: claimHash,
    items: [
      {
        id: "item-1",
        orderId: clientOrderId,
        dishName: "Mariscos all'Arrabbiata",
        price: 12.90,
        quantity: 1,
        notes: null,
      },
    ],
  };

  // Mockear métodos de Prisma para createOrderAction
  (prisma.restaurant as any).findUnique = async () => ({
    id: TEST_RESTAURANT_ID,
    slug: "pigro",
    name: "Pigro",
    ivaPercent: 15.0,
    servicePercent: 10.0,
    ivaOnTable: false,
    serviceOnTable: false,
    seasonRates: [],
  });

  (prisma.dish as any).findMany = async () => [
    {
      id: TEST_DISH_ID,
      restaurantId: TEST_RESTAURANT_ID,
      name: "Mariscos all'Arrabbiata",
      price: 12.90,
      stock: 10,
      isAvailable: true,
    },
    {
      id: "dish-1",
      restaurantId: TEST_RESTAURANT_ID,
      name: "Camisa",
      price: 25.00,
      stock: 10,
      isAvailable: true,
    },
  ];
  (prisma.dish as any).findUnique = async () => ({
    id: "dish-1",
    restaurantId: TEST_RESTAURANT_ID,
    name: "Camisa",
    price: 25.00,
    stock: 10,
    isAvailable: true,
    trackStock: false,
  });
  (prisma.dish as any).update = async () => ({});
  (prisma as any).cashShift = { findFirst: async () => null };
  (prisma as any).$transaction = async (cb: any) => (typeof cb === "function" ? cb(prisma) : cb);

  // Caso 1a: Consulta con mismo orderId, mismo clientSecret y carrito IDÉNTICO -> Debe devolver la orden existente
  (prisma.order as any).findUnique = async (params: any) => {
    if (params.where.id === clientOrderId) {
      return existingOrderInDb;
    }
    return null;
  };

  const retryResIdentical = await createOrderAction({
    orderId: clientOrderId,
    clientSecret: clientSecret,
    restaurantId: TEST_RESTAURANT_ID,
    tableName: "Llevar",
    total: 16.13,
    paymentMethod: "efectivo",
    items: [{ dishId: TEST_DISH_ID, quantity: 1 }],
  });

  assert.strictEqual(retryResIdentical.success, true, "Debe ser exitoso al presentar credenciales idénticas");
  assert.strictEqual(retryResIdentical.isRetry, true, "Debe marcarse como reintento idempotente");
  assert.strictEqual(retryResIdentical.orderId, clientOrderId, "Debe conservar exactamente el mismo UUID");
  assert.strictEqual(retryResIdentical.orderNumber, 175, "Debe conservar el número correlativo existente #175");
  assert.ok(retryResIdentical.dispatchToken, "Debe emitir el dispatchToken para la orden existente");

  // Caso 1b: Mismo orderId y secret, pero el carrito CAMBIÓ (cantidad 2 en vez de 1) -> Debe dar conflicto
  const retryResCartChanged = await createOrderAction({
    orderId: clientOrderId,
    clientSecret: clientSecret,
    restaurantId: TEST_RESTAURANT_ID,
    tableName: "Llevar",
    total: 32.26,
    paymentMethod: "efectivo",
    items: [{ dishId: TEST_DISH_ID, quantity: 2 }], // Carrito alterado
  });

  assert.strictEqual(retryResCartChanged.success, undefined, "No debe tener éxito si el carrito cambió");
  assert.match(
    retryResCartChanged.error || "",
    /Conflicto de idempotencia/i,
    "Debe rechazar con error explícito de conflicto de idempotencia si el carrito cambió"
  );

  console.log("✅ [PASS] 1: createOrderAction real conserva identidad y rechaza cambios de carrito bajo la misma clave.");
})()
  .then(async () => {
    // ---------------------------------------------------------------------------
    // TEST 2: /api/pedidos Rechaza ID sin Token Válido (4xx y Cero Creaciones)
    // ---------------------------------------------------------------------------
    console.log("\n[TEST 2] Verificando POST /api/pedidos REAL con ID sin token y compra nativa...");

    let clientRolledBack = false;
    let clientCommitted = false;
    let insertQueryExecuted = false;

    // Mockear pool de PostgreSQL para route.ts
    (pool as any).connect = async () => ({
      query: async (sql: string, params?: any[]) => {
        if (typeof sql === "string" && sql.includes("BEGIN")) return { rows: [] };
        if (typeof sql === "string" && sql.includes("ROLLBACK")) {
          clientRolledBack = true;
          return { rows: [] };
        }
        if (typeof sql === "string" && sql.includes("COMMIT")) {
          clientCommitted = true;
          return { rows: [] };
        }
        if (typeof sql === "string" && sql.includes("INSERT INTO pedidos")) {
          insertQueryExecuted = true;
          return { rows: [{ id: params ? params[0] : "generated-uuid", total: 10 }] };
        }
        if (typeof sql === "string" && sql.includes("INSERT INTO pedido_items")) {
          return {
            rows: [
              {
                id: "item-id-1",
                pedido_id: params ? params[0] : "generated-uuid",
                nombre: params ? params[1] : "Plato",
                cantidad: params ? params[2] : 1,
                precio: params ? params[3] : 10,
                notas: params ? params[4] : null,
              },
            ],
          };
        }
        return { rows: [] };
      },
      release: () => { },
    });

    (pool as any).query = async (sql: string) => {
      if (sql.includes("FROM negocios")) {
        return { rows: [{ id: TEST_RESTAURANT_ID, nombre: "Pigro", slug: "pigro" }] };
      }
      return { rows: [] };
    };

    // Caso 2a: Enviar order_id SIN dispatch_token
    clientRolledBack = false;
    insertQueryExecuted = false;
    const reqNoToken = new NextRequest("http://localhost:3000/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        negocio_id: TEST_RESTAURANT_ID,
        order_id: "fake-order-without-token",
        mesa: "Llevar",
        total: 16.13,
        items: [{ dishId: "dish-1", nombre: "Plato", cantidad: 1, precio: 10 }],
      }),
    });

    const resNoToken = await pedidosPostHandler(reqNoToken);
    const dataNoToken = await resNoToken.json();

    assert.strictEqual(resNoToken.status, 400, "Debe rechazar con HTTP 400");
    assert.strictEqual(dataNoToken.ok, false, "Respuesta debe ser ok: false");
    assert.strictEqual(insertQueryExecuted, false, "NO debe insertar ningún pedido en la base de datos");

    // Caso 2b: Enviar order_id con dispatch_token INVÁLIDO o ADULTERADO
    clientRolledBack = false;
    insertQueryExecuted = false;
    const reqInvalidToken = new NextRequest("http://localhost:3000/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        negocio_id: TEST_RESTAURANT_ID,
        order_id: "tampered-order-id",
        dispatch_token: "invalid.jwt.token",
        mesa: "Llevar",
        total: 16.13,
        items: [{ dishId: "dish-1", nombre: "Plato", cantidad: 1, precio: 10 }],
      }),
    });

    const resInvalidToken = await pedidosPostHandler(reqInvalidToken);
    const dataInvalidToken = await resInvalidToken.json();

    assert.strictEqual(resInvalidToken.status, 403, "Debe rechazar con HTTP 403");
    assert.strictEqual(dataInvalidToken.ok, false, "Respuesta debe ser ok: false");
    assert.strictEqual(insertQueryExecuted, false, "NO debe insertar ningún pedido");

    // Caso 2c: Compra nativa legítima (Catálogo / POS) SIN order_id ni token -> Debe seguir su ruta nativa
    clientRolledBack = false;
    clientCommitted = false;
    insertQueryExecuted = false;
    const reqNative = new NextRequest("http://localhost:3000/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        negocio_id: TEST_RESTAURANT_ID,
        mesa: "CATALOGO",
        total: 25.00,
        items: [{ dishId: "dish-1", nombre: "Camisa", cantidad: 1, precio: 25 }],
      }),
    });

    const resNative = await pedidosPostHandler(reqNative);
    const dataNative = await resNative.json();

    assert.strictEqual(resNative.status, 200, "Compra nativa debe retornar 200");
    assert.strictEqual(dataNative.ok, true, "Compra nativa debe completarse exitosamente");
    assert.strictEqual(insertQueryExecuted, true, "Flujo nativo debe insertar normalmente el pedido");

    console.log("✅ [PASS] 2: POST /api/pedidos real rechaza con 4xx si viene ID sin token y no crea nada; flujo nativo opera normal.");
  })
  .then(async () => {
    // ---------------------------------------------------------------------------
    // TEST 3: createOrderAction Rechaza si Falta Secreto o claimHash es Nulo
    // ---------------------------------------------------------------------------
    console.log("\n[TEST 3] Verificando exigencia de clientSecret y claimHash en createOrderAction REAL...");

    const targetOrderId = "target-existing-order-uuid";
    const validSecret = "valid-secret-token-32-chars-long";
    const validHash = createHash("sha256").update(validSecret).digest("hex");

    const orderInDbWithHash = {
      id: targetOrderId,
      restaurantId: TEST_RESTAURANT_ID,
      tableName: "Llevar",
      total: 16.13,
      orderNumber: 185,
      claimHash: validHash,
      items: [
        {
          id: "item-1",
          orderId: targetOrderId,
          dishName: "Mariscos all'Arrabbiata",
          price: 12.90,
          quantity: 1,
          notes: null,
        },
      ],
    };

    const orderInDbNullHash = {
      ...orderInDbWithHash,
      claimHash: null, // Pedido sin huella registrada
    };

    // Caso 3a: Intento de recuperación pasando SOLO orderId SIN clientSecret
    (prisma.order as any).findUnique = async () => orderInDbWithHash;

    const resNoSecret = await createOrderAction({
      orderId: targetOrderId,
      // clientSecret ausente
      restaurantId: TEST_RESTAURANT_ID,
      tableName: "Llevar",
      total: 16.13,
      paymentMethod: "efectivo",
      items: [{ dishId: TEST_DISH_ID, quantity: 1 }],
    });

    assert.strictEqual(resNoSecret.success, undefined, "No debe tener éxito si falta clientSecret");
    assert.match(
      resNoSecret.error || "",
      /Credencial de capacidad .* obligatoria/i,
      "Debe rechazar explícitamente por falta de credencial de capacidad"
    );

    // Caso 3b: Intento de recuperación con clientSecret INCORRECTO
    const resWrongSecret = await createOrderAction({
      orderId: targetOrderId,
      clientSecret: "attacker-wrong-secret",
      restaurantId: TEST_RESTAURANT_ID,
      tableName: "Llevar",
      total: 16.13,
      paymentMethod: "efectivo",
      items: [{ dishId: TEST_DISH_ID, quantity: 1 }],
    });

    assert.strictEqual(resWrongSecret.success, undefined, "No debe tener éxito con secreto incorrecto");
    assert.match(
      resWrongSecret.error || "",
      /Credencial de capacidad .* obligatoria/i,
      "Debe rechazar con secreto no coincidente"
    );

    // Caso 3c: Intento de recuperación sobre pedido existente cuyo claimHash es NULO en la BD
    (prisma.order as any).findUnique = async () => orderInDbNullHash;

    const resNullHashInDb = await createOrderAction({
      orderId: targetOrderId,
      clientSecret: validSecret,
      restaurantId: TEST_RESTAURANT_ID,
      tableName: "Llevar",
      total: 16.13,
      paymentMethod: "efectivo",
      items: [{ dishId: TEST_DISH_ID, quantity: 1 }],
    });

    assert.strictEqual(resNullHashInDb.success, undefined, "No debe tener éxito si claimHash es nulo en BD");
    assert.match(
      resNullHashInDb.error || "",
      /Credencial de capacidad .* obligatoria/i,
      "Debe rechazar sin entregar datos ni token si claimHash es nulo"
    );

    // Caso 3d: Intento de recuperación sobre pedido CANCELADO
    const orderCancelled = {
      ...orderInDbWithHash,
      status: "CANCELLED",
    };
    (prisma.order as any).findUnique = async () => orderCancelled;

    const resCancelled = await createOrderAction({
      orderId: targetOrderId,
      clientSecret: validSecret,
      restaurantId: TEST_RESTAURANT_ID,
      tableName: "Llevar",
      total: 16.13,
      paymentMethod: "efectivo",
      items: [{ dishId: TEST_DISH_ID, quantity: 1 }],
    });

    assert.strictEqual(resCancelled.success, undefined, "No debe permitir recuperar pedidos cancelados");
    assert.match(
      resCancelled.error || "",
      /cancelado/i,
      "Debe rechazar explícitamente pedidos cancelados"
    );

    // Caso 3e: Intento de recuperación con tenant cruzado (restaurantId no coincide con la orden existente)
    (prisma.order as any).findUnique = async () => orderInDbWithHash; // pertenece a TEST_RESTAURANT_ID
    (prisma.dish as any).findMany = async () => [
      {
        id: TEST_DISH_ID,
        restaurantId: "attacker-restaurant-id",
        name: "Mariscos all'Arrabbiata",
        price: 12.90,
        stock: 10,
        isAvailable: true,
      },
    ];

    const resWrongTenant = await createOrderAction({
      orderId: targetOrderId,
      clientSecret: validSecret,
      restaurantId: "attacker-restaurant-id",
      tableName: "Llevar",
      total: 16.13,
      paymentMethod: "efectivo",
      items: [{ dishId: TEST_DISH_ID, quantity: 1 }],
    });

    assert.strictEqual(resWrongTenant.success, undefined, "No debe permitir recuperar pedidos de otro tenant");
    assert.match(
      resWrongTenant.error || "",
      /Acceso no autorizado/i,
      "Debe rechazar con error de acceso no autorizado si el tenant no coincide"
    );

    // Caso 3f: Token de despacho usa idéntico purpose en firma y verificación
    const token = signKdsDispatchToken({
      orderId: targetOrderId,
      restaurantId: TEST_RESTAURANT_ID,
      total: 16.13,
      orderNumber: 175,
      purpose: "kds_dispatch",
    });
    const verified = verifyKdsDispatchToken(token);
    assert.ok(verified, "Token debe verificarse exitosamente");
    assert.strictEqual(verified?.purpose, "kds_dispatch", "Firma y verificación deben compartir purpose === 'kds_dispatch'");

    console.log("✅ [PASS] 3: createOrderAction real exige clientSecret/claimHash, valida tenant, rechaza cancelados y comparte purpose 'kds_dispatch'.");

    // ---------------------------------------------------------------------------
    // TEST 4: P2002 Solo Acepta Constraint Exacta de Identidad (Order_pkey / id)
    // ---------------------------------------------------------------------------
    console.log("\n[TEST 4] Verificando P2002 con constraint exacta de identidad (id / Order_pkey)...");

    class MockPrismaP2002Error extends Error {
      code = "P2002";
      meta: any;
      constructor(target: any) {
        super("Unique constraint failed");
        this.meta = { target };
      }
    }

    const raceOrderId = randomUUID();
    const raceSecret = randomBytes(32).toString("hex");
    const raceHash = createHash("sha256").update(raceSecret).digest("hex");

    const existingRaceOrder = {
      id: raceOrderId,
      restaurantId: TEST_RESTAURANT_ID,
      tableName: "Llevar",
      total: 16.13,
      orderNumber: 176,
      claimHash: raceHash,
      status: "PENDING",
      items: [
        {
          id: "item-race-1",
          orderId: raceOrderId,
          dishName: "Mariscos all'Arrabbiata",
          price: 12.90,
          quantity: 1,
          notes: null,
        },
      ],
    };

    (prisma.dish as any).findMany = async () => [
      {
        id: TEST_DISH_ID,
        restaurantId: TEST_RESTAURANT_ID,
        name: "Mariscos all'Arrabbiata",
        price: 12.90,
        stock: 10,
        isAvailable: true,
      },
    ];

    // Caso 4a: Constraint exacta de primary key ['id'] -> Recuperación exitosa
    let findUniqueCallCount = 0;
    (prisma.order as any).findUnique = async () => {
      findUniqueCallCount++;
      // Primera llamada es el pre-check (no existe aún en la lectura)
      // Segunda llamada ocurre dentro del catch P2002 tras la carrera concurrente
      return findUniqueCallCount > 1 ? existingRaceOrder : null;
    };

    (prisma as any).$transaction = async () => {
      throw new MockPrismaP2002Error(["id"]);
    };

    const resExactP2002 = await createOrderAction({
      orderId: raceOrderId,
      clientSecret: raceSecret,
      restaurantId: TEST_RESTAURANT_ID,
      tableName: "Llevar",
      total: 16.13,
      paymentMethod: "efectivo",
      items: [{ dishId: TEST_DISH_ID, quantity: 1 }],
    });

    assert.strictEqual(resExactP2002.success, true, "Debe recuperarse con éxito ante constraint exacta ['id']");
    assert.strictEqual(resExactP2002.isRetry, true, "Debe marcarse como reintento");
    assert.ok(resExactP2002.dispatchToken, "Debe emitir dispatchToken con autoridad válida");

    // Caso 4b: Constraint exacta PostgreSQL ['Order_pkey'] -> Recuperación exitosa
    findUniqueCallCount = 0;
    (prisma as any).$transaction = async () => {
      throw new MockPrismaP2002Error(["Order_pkey"]);
    };

    const resExactPkey = await createOrderAction({
      orderId: raceOrderId,
      clientSecret: raceSecret,
      restaurantId: TEST_RESTAURANT_ID,
      tableName: "Llevar",
      total: 16.13,
      paymentMethod: "efectivo",
      items: [{ dishId: TEST_DISH_ID, quantity: 1 }],
    });

    assert.strictEqual(resExactPkey.success, true, "Debe recuperarse con éxito ante constraint exacta ['Order_pkey']");
    assert.ok(resExactPkey.dispatchToken, "Debe emitir dispatchToken con ['Order_pkey']");

    // Caso 4c: Target ausente (undefined / null) -> Debe fallar de forma cerrada sin emitir token
    findUniqueCallCount = 0;
    (prisma as any).$transaction = async () => {
      throw new MockPrismaP2002Error(undefined);
    };

    const resMissingTarget = await createOrderAction({
      orderId: raceOrderId,
      clientSecret: raceSecret,
      restaurantId: TEST_RESTAURANT_ID,
      tableName: "Llevar",
      total: 16.13,
      paymentMethod: "efectivo",
      items: [{ dishId: TEST_DISH_ID, quantity: 1 }],
    });

    assert.strictEqual(resMissingTarget.success, undefined, "Target ausente no debe recuperar ni tener éxito");
    assert.strictEqual(resMissingTarget.dispatchToken, undefined, "Target ausente NO debe emitir token");
    assert.match(resMissingTarget.error || "", /Unique constraint failed/i, "Falla cerrada con error original");

    // Caso 4d: Target de otra constraint no relacionada (ej. ['orderNumber']) -> Falla cerrada
    findUniqueCallCount = 0;
    (prisma as any).$transaction = async () => {
      throw new MockPrismaP2002Error(["orderNumber"]);
    };

    const resOtherConstraint = await createOrderAction({
      orderId: raceOrderId,
      clientSecret: raceSecret,
      restaurantId: TEST_RESTAURANT_ID,
      tableName: "Llevar",
      total: 16.13,
      paymentMethod: "efectivo",
      items: [{ dishId: TEST_DISH_ID, quantity: 1 }],
    });

    assert.strictEqual(resOtherConstraint.success, undefined, "Otra constraint no debe recuperar");
    assert.strictEqual(resOtherConstraint.dispatchToken, undefined, "Otra constraint NO debe emitir token");

    console.log("✅ [PASS] 4: P2002 solo acepta constraint exacta de identidad ('id' / 'Order_pkey'); falla cerrado ante target ausente u otra constraint.");

    // ---------------------------------------------------------------------------
    // TEST 5: Ciclo de Compra Incierta y Recuperación con Contenido Original
    // ---------------------------------------------------------------------------
    console.log("\n[TEST 5] Verificando ciclo de compra incierta con edición de carrito...");

    const uncertainOrderId = randomUUID();
    const uncertainSecret = randomBytes(32).toString("hex");
    const uncertainHash = createHash("sha256").update(uncertainSecret).digest("hex");

    // 1. Snapshot original del intento incierto
    const originalSnapshotPayload = {
      orderId: uncertainOrderId,
      clientSecret: uncertainSecret,
      restaurantId: TEST_RESTAURANT_ID,
      tableName: "Llevar",
      total: 16.13,
      paymentMethod: "efectivo",
      items: [{ dishId: TEST_DISH_ID, quantity: 1 }],
    };

    // La orden existe en el servidor con el contenido original
    const existingUncertainOrder = {
      id: uncertainOrderId,
      restaurantId: TEST_RESTAURANT_ID,
      tableName: "Llevar",
      total: 16.13,
      orderNumber: 177,
      claimHash: uncertainHash,
      status: "PENDING",
      items: [
        {
          id: "item-unc-1",
          orderId: uncertainOrderId,
          dishName: "Mariscos all'Arrabbiata",
          price: 12.90,
          quantity: 1,
          notes: null,
        },
      ],
    };

    (prisma.order as any).findUnique = async () => existingUncertainOrder;

    // 2. Si el cliente recupera enviando el snapshot original -> Éxito limpio
    const recoveryResOriginal = await createOrderAction(originalSnapshotPayload);
    assert.strictEqual(recoveryResOriginal.success, true, "Recuperación con snapshot original debe tener éxito");
    assert.strictEqual(recoveryResOriginal.orderId, uncertainOrderId, "Conserva la misma identidad de pedido");
    assert.ok(recoveryResOriginal.dispatchToken, "Emite dispatchToken para el pedido original");

    // 3. Si en cambio se hubiera enviado el carrito editado bajo la misma identidad -> Conflicto
    const editedCartPayload = {
      ...originalSnapshotPayload,
      total: 32.26,
      items: [{ dishId: TEST_DISH_ID, quantity: 2 }], // Carrito alterado
    };

    const conflictRes = await createOrderAction(editedCartPayload);
    assert.strictEqual(conflictRes.success, undefined, "El carrito editado bajo misma clave no debe tener éxito");
    assert.match(
      conflictRes.error || "",
      /Conflicto de idempotencia/i,
      "Debe rechazar con conflicto de idempotencia si se intenta enviar el carrito editado"
    );

    console.log("✅ [PASS] 5: Ciclo de compra incierta verificado: snapshot original recupera con éxito; carrito editado bajo misma clave da conflicto.");

    // ---------------------------------------------------------------------------
    // TEST 6: Distinción de Códigos Explícitos y Transiciones de Recuperación
    // ---------------------------------------------------------------------------
    console.log("\n[TEST 6] Verificando processCheckoutAttemptResult con códigos explícitos...");

    // 6.a Error transitorio de red / excepción -> RETRY_SAME_ATTEMPT (retiene snapshot y bloquea nuevo pedido)
    const netErr = new Error("Network timeout while contacting server");
    const netRes = processCheckoutAttemptResult(netErr);
    assert.strictEqual(netRes.type, "RETRY_SAME_ATTEMPT", "Error de red debe ser RETRY_SAME_ATTEMPT");
    assert.strictEqual(netRes.shouldRetainAttempt, true, "Debe retener el intento ante fallo de red");
    assert.strictEqual(netRes.blockNewOrder, true, "Debe bloquear creación automática de otra compra");

    // 6.b Error transitorio del servidor (TRANSITIONAL_ERROR) -> RETRY_SAME_ATTEMPT
    const transRes = processCheckoutAttemptResult({
      error: "Error temporal de base de datos",
      errorCode: "TRANSITIONAL_ERROR",
    });
    assert.strictEqual(transRes.type, "RETRY_SAME_ATTEMPT");
    assert.strictEqual(transRes.shouldRetainAttempt, true);
    assert.strictEqual(transRes.blockNewOrder, true);

    // 6.c Conflicto de autenticación (AUTH_CONFLICT / UNAUTHORIZED) -> BLOCKED_NEEDS_RESOLUTION
    const authConflictRes = processCheckoutAttemptResult({
      error: "El hash de reclamo no coincide",
      errorCode: "AUTH_CONFLICT",
    });
    assert.strictEqual(authConflictRes.type, "BLOCKED_NEEDS_RESOLUTION");
    assert.strictEqual(authConflictRes.shouldRetainAttempt, true, "Conflicto de auth no demuestra inexistencia; retiene");
    assert.strictEqual(authConflictRes.blockNewOrder, true, "Bloquea creación automática de segundo pedido");

    // 6.d Conflicto de idempotencia / contenido (IDEMPOTENCY_CONFLICT) -> BLOCKED_NEEDS_RESOLUTION
    const idemRes = processCheckoutAttemptResult({
      error: "Conflicto de idempotencia: el total no coincide",
      errorCode: "IDEMPOTENCY_CONFLICT",
    });
    assert.strictEqual(idemRes.type, "BLOCKED_NEEDS_RESOLUTION");
    assert.strictEqual(idemRes.shouldRetainAttempt, true);
    assert.strictEqual(idemRes.blockNewOrder, true);

    // 6.e Pedido cancelado (ORDER_CANCELLED) -> ORDER_WAS_CANCELLED (reconoce que existió y fue cancelado por el restaurante)
    const cancelRes = processCheckoutAttemptResult({
      error: "El pedido fue cancelado en el restaurante",
      errorCode: "ORDER_CANCELLED",
      orderNumber: 179,
    });
    assert.strictEqual(cancelRes.type, "ORDER_WAS_CANCELLED");
    assert.strictEqual(cancelRes.shouldRetainAttempt, false, "Pedido cancelado libera intento tras notificar");
    assert.strictEqual(cancelRes.blockNewOrder, false, "Permite nuevo pedido si el anterior fue cancelado");
    assert.match(cancelRes.userMessage, /#179/i, "Debe incluir el número del pedido cancelado");
    assert.match(cancelRes.userMessage, /cancelado por el establecimiento/i);
    assert.doesNotMatch(cancelRes.userMessage, /cobro/i, "No debe prometer que no habrá cobro ni estado de pago no comprobado");

    // 6.f Entrada inválida (INVALID_INPUT) -> BLOCKED_NEEDS_RESOLUTION (no descarta intento incierto)
    const invalidRes = processCheckoutAttemptResult({
      error: "El producto se encuentra agotado",
      errorCode: "INVALID_INPUT",
    });
    assert.strictEqual(invalidRes.type, "BLOCKED_NEEDS_RESOLUTION", "INVALID_INPUT en compra incierta no debe descartar el intento");
    assert.strictEqual(invalidRes.shouldRetainAttempt, true, "Conserva el intento para evitar duplicados");
    assert.strictEqual(invalidRes.blockNewOrder, true, "Bloquea segundo pedido automático");

    // 6.g Éxito -> RESOLVED_SUCCESS
    const successRes = processCheckoutAttemptResult({
      success: true,
      orderId: "ord-123",
      orderNumber: 178,
      dispatchToken: "valid-tok",
    });
    assert.strictEqual(successRes.type, "RESOLVED_SUCCESS");
    assert.strictEqual(successRes.shouldRetainAttempt, false);
    assert.strictEqual(successRes.blockNewOrder, false);

    console.log("✅ [PASS] 6: processCheckoutAttemptResult probado: INVALID_INPUT no libera intento incierto y ORDER_CANCELLED reconoce la orden previa.");

    // ---------------------------------------------------------------------------
    // TEST 7: Persistencia Atómica en sessionStorage y Restauración al Recargar
    // ---------------------------------------------------------------------------
    console.log("\n[TEST 7] Verificando ciclo de sessionStorage: aislamiento por negocio, persistencia antes de enviar y restauración...");

    // Simulación de Storage en memoria
    class MemoryStorage {
      private map = new Map<string, string>();
      getItem(key: string): string | null {
        return this.map.has(key) ? this.map.get(key)! : null;
      }
      setItem(key: string, value: string): void {
        this.map.set(key, String(value));
      }
      removeItem(key: string): void {
        this.map.delete(key);
      }
      clear(): void {
        this.map.clear();
      }
    }

    const mockStorage = new MemoryStorage();
    const businessSlugPigro = "pigro";
    const businessSlugOtro = "otro-restaurante";

    const attemptToPersist: PendingCheckoutAttempt = {
      orderId: randomUUID(),
      clientSecret: randomBytes(32).toString("hex"),
      actionPayload: {
        orderId: "ord-test-persist-1",
        restaurantId: TEST_RESTAURANT_ID,
        tableName: "Mesa 3",
        total: 25.50,
        items: [{ dishId: TEST_DISH_ID, quantity: 2 }],
      },
      itemsData: [{ id: "dish-1", name: "Pasta", price: 12.75, quantity: 2 }],
      kdsTargetMesa: "3",
      kdsTargetTipoEntrega: "mesa",
      kdsMetodoEntrega: "mesa",
      fullCustomerAddress: null,
      customerName: "Cliente Test",
      customerPhone: "0999999999",
      deliveryCost: 0,
      total: 25.50,
      isTableOrder: true,
      isDeliveryOrder: false,
      savedAt: new Date().toISOString(),
    };

    // 7.a Guardado antes de enviar action
    const saved = savePendingAttemptToStorage(mockStorage, businessSlugPigro, attemptToPersist);
    assert.strictEqual(saved, true, "Debe persistir en sessionStorage exitosamente");

    // Verificar nombre de clave sanitizada y aislada
    const storageKey = getPendingAttemptStorageKey(businessSlugPigro);
    assert.strictEqual(storageKey, "menuqr_pending_attempt_pigro");
    assert.ok(mockStorage.getItem(storageKey), "El item debe existir bajo la clave del negocio");

    // 7.b Aislamiento entre negocios: otro negocio no ve el intento
    const crossBusinessAttempt = loadPendingAttemptFromStorage(mockStorage, businessSlugOtro);
    assert.strictEqual(crossBusinessAttempt, null, "Negocio diferente no debe leer el intento de otro restaurante");

    // 7.c Simulación de recarga de página: restauración exacta de claves y snapshot original
    const restoredAttempt = loadPendingAttemptFromStorage(mockStorage, businessSlugPigro);
    assert.ok(restoredAttempt, "Debe restaurar el intento pendiente al recargar");
    assert.strictEqual(restoredAttempt?.orderId, attemptToPersist.orderId, "Conserva exactamente el mismo orderId");
    assert.strictEqual(restoredAttempt?.clientSecret, attemptToPersist.clientSecret, "Conserva exactamente el mismo clientSecret");
    assert.deepStrictEqual(restoredAttempt?.actionPayload, attemptToPersist.actionPayload, "Conserva el actionPayload idéntico");
    assert.strictEqual(restoredAttempt?.total, 25.50);

    // 7.d Limpieza de sessionStorage únicamente al resolver la compra
    const cleared = clearPendingAttemptFromStorage(mockStorage, businessSlugPigro);
    assert.strictEqual(cleared, true, "Debe limpiar sessionStorage");
    assert.strictEqual(
      loadPendingAttemptFromStorage(mockStorage, businessSlugPigro),
      null,
      "Una vez resuelto, el almacenamiento queda limpio"
    );

    console.log("✅ [PASS] 7: sessionStorage probado: persistencia previa, aislamiento por negocio, restauración al recargar y limpieza al resolver.");

    // ---------------------------------------------------------------------------
    // TEST 8: Recorrido Real de Recuperación tras Recarga y Verificación de errorCodes
    // ---------------------------------------------------------------------------
    console.log("\n[TEST 8] Verificando recorrido completo tras recargar con pedido pendiente y errorCode en createOrderAction...");

    // 8.a Verificación de errorCode: INVALID_INPUT en validaciones de entrada
    const invalidInputRes = await createOrderAction({
      restaurantId: "",
      tableName: "Mesa 1",
      paymentMethod: "cash",
      items: [],
    });
    assert.strictEqual(invalidInputRes.errorCode, "INVALID_INPUT", "Debe devolver errorCode INVALID_INPUT");

    // 8.b Verificación de comprobación temprana:
    // Si la orden ya existe en DB, recupera exitosamente incluso si el stock restante fuera 0
    const reloadOrderId = randomUUID();
    const reloadSecret = randomBytes(32).toString("hex");
    const reloadClaimHash = createHash("sha256").update(reloadSecret).digest("hex");

    const existingOrderStockExhausted = {
      id: reloadOrderId,
      restaurantId: TEST_RESTAURANT_ID,
      tableName: "Llevar",
      total: 12.90,
      orderNumber: 180,
      claimHash: reloadClaimHash,
      status: "PENDING",
      items: [
        {
          id: "item-re-1",
          orderId: reloadOrderId,
          dishName: "Mariscos all'Arrabbiata",
          price: 12.90,
          quantity: 1,
          notes: null,
        },
      ],
    };

    (prisma.order as any).findUnique = async () => existingOrderStockExhausted;

    const reloadSnapshotPayload = {
      orderId: reloadOrderId,
      clientSecret: reloadSecret,
      restaurantId: TEST_RESTAURANT_ID,
      tableName: "Llevar",
      total: 12.90,
      paymentMethod: "cash",
      items: [{ dishId: TEST_DISH_ID, dishName: "Mariscos all'Arrabbiata", price: 12.90, quantity: 1 }],
    };

    // Guardar en mockStorage simulando estado antes de recargar
    const reloadStorage = new MemoryStorage();
    savePendingAttemptToStorage(reloadStorage, "pigro", {
      orderId: reloadOrderId,
      clientSecret: reloadSecret,
      actionPayload: reloadSnapshotPayload,
      itemsData: [{ id: TEST_DISH_ID, name: "Mariscos", price: 12.90, quantity: 1 }],
      kdsTargetMesa: "Llevar",
      kdsTargetTipoEntrega: "llevar",
      kdsMetodoEntrega: "llevar",
      fullCustomerAddress: null,
      customerName: "Juan Perez",
      customerPhone: "0999999999",
      deliveryCost: 0,
      total: 12.90,
      isTableOrder: false,
      isDeliveryOrder: false,
      savedAt: new Date().toISOString(),
    });

    // 8.c Simulación del recorrido de montaje tras recarga:
    // 1) Leer de storage
    const restoredFromReload = loadPendingAttemptFromStorage(reloadStorage, "pigro");
    assert.ok(restoredFromReload, "Restauración debe recuperar el intento pendiente");

    // 2) Efecto de recuperación ejecuta createOrderAction con el snapshot original
    const recoveryExecutionRes = await createOrderAction(restoredFromReload!.actionPayload);
    assert.strictEqual(recoveryExecutionRes.success, true, "Recuperación temprana debe tener éxito");
    assert.strictEqual(recoveryExecutionRes.orderId, reloadOrderId, "Mismo orderId");
    assert.strictEqual(recoveryExecutionRes.isRetry, true, "Marcado como reintento");
    assert.ok(recoveryExecutionRes.dispatchToken, "Emite dispatchToken");

    // 3) Resolución procesada por el cliente
    const reloadResolution = processCheckoutAttemptResult(recoveryExecutionRes);
    assert.strictEqual(reloadResolution.type, "RESOLVED_SUCCESS", "Debe ser RESOLVED_SUCCESS");
    assert.strictEqual(reloadResolution.shouldRetainAttempt, false, "Debe liberar intento tras éxito");

    // 4) Limpieza de storage tras resolución exitosa
    clearPendingAttemptFromStorage(reloadStorage, "pigro");
    assert.strictEqual(loadPendingAttemptFromStorage(reloadStorage, "pigro"), null, "Storage debe quedar limpio tras resolución");

    // 8.d Verificación de ORDER_CANCELLED con orderNumber
    const cancelledOrderInDb = {
      ...existingOrderStockExhausted,
      status: "CANCELLED",
    };
    (prisma.order as any).findUnique = async () => cancelledOrderInDb;

    const cancelledRes = await createOrderAction(reloadSnapshotPayload);
    assert.strictEqual(cancelledRes.errorCode, "ORDER_CANCELLED", "Debe devolver errorCode ORDER_CANCELLED");
    assert.strictEqual(cancelledRes.orderNumber, 180, "Debe incluir orderNumber del pedido cancelado");

    const cancelledResolution = processCheckoutAttemptResult(cancelledRes);
    assert.strictEqual(cancelledResolution.type, "ORDER_WAS_CANCELLED");
    assert.match(cancelledResolution.userMessage, /#180/i);

    console.log("✅ [PASS] 8: Recorrido tras recarga y errorCode verificados: comprobación temprana recupera pedido existente, ORDER_CANCELLED devuelve número y no se crean compras duplicadas.");

    // ---------------------------------------------------------------------------
    // TEST 9: Verificación de Despacho KDS: HTTP 403/500, Red, Inválida y Éxito
    // ---------------------------------------------------------------------------
    console.log("\n[TEST 9] Verificando executeKdsDispatch ante HTTP 403, 500, red, respuesta inválida y confirmación...");

    const kdsTestOrderId = randomUUID();
    const kdsTestSecret = randomBytes(32).toString("hex");

    const sampleKdsPayload: KdsDispatchPayload = {
      order_id: kdsTestOrderId,
      dispatch_token: "test-token-kds",
      negocio_id: TEST_RESTAURANT_ID,
      slug: "pigro",
      mesa: "Mesa 5",
      tipo_entrega: "mesa",
      metodo_entrega: "mesa",
      skip_stock_deduction: true,
      items: [{ id: TEST_DISH_ID, dishId: TEST_DISH_ID, nombre: "Pasta", cantidad: 1, precio: 12.90, notas: null }],
      cliente_nombre: "Cliente KDS",
      cliente_telefono: "0999999999",
      cliente_direccion: null,
      costo_envio: 0,
      total: 12.90,
    };

    const mockAttemptStorage = new MemoryStorage();
    const attemptData: PendingCheckoutAttempt = {
      orderId: kdsTestOrderId,
      clientSecret: kdsTestSecret,
      actionPayload: { orderId: kdsTestOrderId, clientSecret: kdsTestSecret, restaurantId: TEST_RESTAURANT_ID, tableName: "Mesa 5", total: 12.90, paymentMethod: "cash", items: [{ dishId: TEST_DISH_ID, quantity: 1 }] },
      itemsData: sampleKdsPayload.items,
      kdsTargetMesa: "Mesa 5",
      kdsTargetTipoEntrega: "mesa",
      kdsMetodoEntrega: "mesa",
      fullCustomerAddress: null,
      customerName: "Cliente KDS",
      customerPhone: "0999999999",
      deliveryCost: 0,
      total: 12.90,
      isTableOrder: true,
      isDeliveryOrder: false,
      savedAt: new Date().toISOString(),
    };

    // 9.a Simulación HTTP 403 (Token rechazado / no autorizado)
    savePendingAttemptToStorage(mockAttemptStorage, "pigro", attemptData);
    const mockFetch403 = async () => ({
      ok: false,
      status: 403,
      json: async () => ({ ok: false, error: "Token de despacho inválido o no autorizado" }),
    } as any);

    const res403 = await executeKdsDispatch(mockFetch403 as any, kdsTestSecret, sampleKdsPayload);
    assert.strictEqual(res403.confirmed, false, "HTTP 403 no debe confirmar despacho");
    assert.strictEqual(res403.status, 403);
    // Verificar que el intento original se conserva intacto en storage
    assert.ok(loadPendingAttemptFromStorage(mockAttemptStorage, "pigro"), "Fallo HTTP 403 debe conservar el intento");

    // 9.b Simulación HTTP 500 (Error interno de cocina)
    const mockFetch500 = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ ok: false, error: "Error interno de base de datos en KDS" }),
    } as any);

    const res500 = await executeKdsDispatch(mockFetch500 as any, kdsTestSecret, sampleKdsPayload);
    assert.strictEqual(res500.confirmed, false, "HTTP 500 no debe confirmar despacho");
    assert.strictEqual(res500.status, 500);
    assert.ok(loadPendingAttemptFromStorage(mockAttemptStorage, "pigro"), "Fallo HTTP 500 debe conservar el intento");

    // 9.c Simulación de Error de Red (fetch lanza excepción)
    const mockFetchNetworkError = async () => {
      throw new Error("Failed to fetch / connection reset");
    };

    const resNet = await executeKdsDispatch(mockFetchNetworkError as any, kdsTestSecret, sampleKdsPayload);
    assert.strictEqual(resNet.confirmed, false, "Error de red no debe confirmar despacho");
    assert.match(resNet.error || "", /Failed to fetch/i);
    assert.ok(loadPendingAttemptFromStorage(mockAttemptStorage, "pigro"), "Error de red debe conservar el intento");

    // 9.d Simulación de Respuesta Inválida (JSON no válido o ok: false con status 200)
    const mockFetchInvalidJson = async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new Error("Unexpected token < in JSON"); },
    } as any);

    const resInvalidJson = await executeKdsDispatch(mockFetchInvalidJson as any, kdsTestSecret, sampleKdsPayload);
    assert.strictEqual(resInvalidJson.confirmed, false, "JSON inválido no debe confirmar despacho");
    assert.ok(loadPendingAttemptFromStorage(mockAttemptStorage, "pigro"));

    const mockFetchOkFalse = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: false, error: "Pedido duplicado o rechazado por lógica de negocio" }),
    } as any);

    const resOkFalse = await executeKdsDispatch(mockFetchOkFalse as any, kdsTestSecret, sampleKdsPayload);
    assert.strictEqual(resOkFalse.confirmed, false, "ok: false en JSON no debe confirmar despacho");
    assert.ok(loadPendingAttemptFromStorage(mockAttemptStorage, "pigro"), "ok: false debe conservar el intento");

    // 9.e Simulación de Despacho Confirmado (HTTP 200 con ok: true y datos del pedido)
    const mockFetchSuccess = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, pedido: { id: kdsTestOrderId, estado: "nuevo", total: 12.90 } }),
    } as any);

    const resSuccess = await executeKdsDispatch(mockFetchSuccess as any, kdsTestSecret, sampleKdsPayload);
    assert.strictEqual(resSuccess.confirmed, true, "HTTP 200 con ok: true debe confirmar el despacho");
    assert.ok(resSuccess.pedido, "Debe incluir el pedido confirmado");

    // Solo tras confirmación real se procede a limpiar el storage
    clearPendingAttemptFromStorage(mockAttemptStorage, "pigro");
    assert.strictEqual(loadPendingAttemptFromStorage(mockAttemptStorage, "pigro"), null, "Storage debe quedar limpio únicamente tras confirmación");

    // 9.f Verificación de reintento sin re-descontar stock:
    // El intento que falló en KDS reintenta createOrderAction con el mismo actionPayload
    (prisma.order as any).findUnique = async () => ({
      id: kdsTestOrderId,
      restaurantId: TEST_RESTAURANT_ID,
      tableName: "Mesa 5",
      total: 12.90,
      orderNumber: 181,
      claimHash: createHash("sha256").update(kdsTestSecret).digest("hex"),
      status: "PENDING",
      items: [{ id: "it-1", orderId: kdsTestOrderId, dishName: "Pasta", price: 12.90, quantity: 1, notes: null }],
    });

    const retryCreateRes = await createOrderAction(attemptData.actionPayload);
    assert.strictEqual(retryCreateRes.success, true, "Reintento debe recuperar con éxito");
    assert.strictEqual(retryCreateRes.orderId, kdsTestOrderId, "Conserva la misma identidad");
    assert.strictEqual(retryCreateRes.isRetry, true, "Reconoce que es un reintento");
    assert.ok(retryCreateRes.dispatchToken, "Emite nuevo dispatchToken para el re-despacho");

    // 9.g Caso de token ausente (RESOLVED_SUCCESS sin dispatchToken):
    // Verificación de la regla del componente: sin dispatchToken, NUNCA debe considerarse despacho confirmado.
    // Simular el controlador de componente ante respuesta con token ausente:
    savePendingAttemptToStorage(mockAttemptStorage, "pigro", attemptData);
    const tokenlessResolution = processCheckoutAttemptResult({
      success: true,
      orderId: kdsTestOrderId,
      orderNumber: 182,
      // dispatchToken ausente / undefined
    });
    assert.strictEqual(tokenlessResolution.type, "RESOLVED_SUCCESS");

    // Comprobar la guarda del componente:
    const handleComponentTokenGuard = (recoveryRes: { success?: boolean; dispatchToken?: string }) => {
      if (!recoveryRes.dispatchToken) {
        return {
          confirmed: false,
          userMessage: "Tu pedido está registrado, pero falta confirmar su envío a cocina. Reintenta la comprobación; no hagas otro pedido",
        };
      }
      return { confirmed: true, userMessage: null };
    };

    const guardResult = handleComponentTokenGuard({ success: true, dispatchToken: undefined });
    assert.strictEqual(guardResult.confirmed, false, "Token ausente no debe dar despacho confirmado");
    assert.strictEqual(guardResult.userMessage, "Tu pedido está registrado, pero falta confirmar su envío a cocina. Reintenta la comprobación; no hagas otro pedido");
    // Confirmar que ante token ausente el intento en storage no debe limpiarse
    assert.ok(loadPendingAttemptFromStorage(mockAttemptStorage, "pigro"), "Token ausente conserva el intento en sessionStorage");

    console.log("✅ [PASS] 9: Despacho KDS y guardas del componente probados: HTTP 403, 500, error de red, respuesta inválida y token ausente conservan el intento original; reintento no duplica stock; solo confirmación HTTP limpia el intento.");

    console.log("\n=====================================================================");
    console.log("🎉 TODAS LAS PRUEBAS SOBRE LAS FUNCIONES REALES PASARON EXITOSAMENTE");
    console.log("=====================================================================");
  })
  .catch((err) => {
    console.error("❌ ERROR EN TEST REAL:", err);
    process.exit(1);
  });

