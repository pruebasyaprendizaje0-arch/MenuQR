import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

// 1. Cargar configuración del entorno de pruebas aislado (puerto 5434)
// Totalmente configurable mediante variables de entorno externas documentadas
const creds = {
  host: process.env.ISOLATED_TEST_HOST || "127.0.0.1",
  port: Number(process.env.ISOLATED_TEST_PORT || 5434),
  database: process.env.ISOLATED_TEST_DATABASE || "menuqr_isolated_test",
  user: process.env.ISOLATED_TEST_USER || "isolated_tester",
  password: process.env.ISOLATED_TEST_PASSWORD || "",
};

if (!creds.password && process.env.TEST_CONFIG_PATH && fs.existsSync(process.env.TEST_CONFIG_PATH)) {
  Object.assign(creds, JSON.parse(fs.readFileSync(process.env.TEST_CONFIG_PATH, "utf8")));
} else if (!creds.password) {
  const localCred = path.join(process.cwd(), "scratch/.isolated_test_credentials.json");
  if (fs.existsSync(localCred)) {
    Object.assign(creds, JSON.parse(fs.readFileSync(localCred, "utf8")));
  }
}

if (!creds.password) {
  throw new Error(
    "Contraseña de prueba no configurada. Defina la variable de entorno ISOLATED_TEST_PASSWORD antes de ejecutar la suite aislada."
  );
}

// 2. Acreditación estricta de destino (Fijo: 127.0.0.1:5434 / menuqr_isolated_test / isolated_tester)
assert.strictEqual(creds.host, "127.0.0.1", "Host debe ser estrictamente 127.0.0.1");
assert.strictEqual(Number(creds.port), 5434, "Puerto debe ser estrictamente 5434");
assert.strictEqual(creds.database, "menuqr_isolated_test", "Base debe ser estrictamente menuqr_isolated_test");
assert.strictEqual(creds.user, "isolated_tester", "Usuario debe ser estrictamente isolated_tester");

const ISOLATED_DATABASE_URL = `postgresql://${creds.user}:${encodeURIComponent(creds.password)}@${creds.host}:${creds.port}/${creds.database}?schema=public`;

(process.env as any).NODE_ENV = "test";
process.env.DATABASE_URL = ISOLATED_DATABASE_URL;
process.env.CONTROL_DATABASE_URL = ISOLATED_DATABASE_URL;
process.env.TENANT_DATABASE_URL = ISOLATED_DATABASE_URL;
process.env.JWT_SECRET = process.env.TEST_JWT_SECRET || "isolated_test_jwt_secret_key_2026";

// Mock de next/headers y next/cache para ejecución de server actions reales (cookies y revalidación)
const nextHeadersPath = require.resolve("next/headers");
const nextHeaders = require("next/headers");
const nextCache = require("next/cache");
nextCache.revalidatePath = () => {};
nextCache.revalidateTag = () => {};

const superAdminToken = jwt.sign(
  { userId: "99999999-0000-0000-0000-000000000002", email: "tester-isolated@menuqr.local", role: "superadmin" },
  process.env.JWT_SECRET
);

const mockCookies = async () => ({
  get: (name: string) => {
    if (name === "super_admin_session" || name === "session_token") {
      return { name, value: superAdminToken };
    }
    return undefined;
  },
  set: () => {},
  delete: () => {},
});

nextHeaders.cookies = mockCookies;
require.cache[nextHeadersPath] = {
  id: nextHeadersPath,
  filename: nextHeadersPath,
  loaded: true,
  exports: {
    ...nextHeaders,
    cookies: mockCookies,
  },
} as any;

console.log("===============================================================================");
console.log("🔒 ACREDITACIÓN DE AISLAMIENTO ESTRICTO Y FUNCIONES REALES DEL PRODUCTO");
console.log("===============================================================================");
console.log(`- SERVIDOR DESTINO : ${creds.host}:${creds.port}`);
console.log(`- BASE DE DATOS    : ${creds.database}`);
console.log(`- ROL AUTENTICADO  : ${creds.user}`);
console.log(`- ETIQUETA         : [TEST AISLADO - CERO CONTACTO CON 5432 NI PRODUCCIÓN]`);
console.log("===============================================================================\n");

const prisma = new PrismaClient({
  datasources: { db: { url: ISOLATED_DATABASE_URL } },
});

const pool = new Pool({
  host: creds.host,
  port: creds.port,
  database: creds.database,
  user: creds.user,
  password: creds.password,
});

(globalThis as any).prismaMain = prisma;
(globalThis as any).pgPool = pool;

async function runSuite() {
  const { syncSinglePedidoToPrisma, syncPedidosToPrismaOrders, reconcileUndispatchedOrders, __testOrderSyncHooks } = await import("./order-sync");
  const { openCashShift, settleOrderInCashShiftAction, processCajaSaleAction } = await import("./caja-actions");
  const { createTableSessionAction, calculateProductSplitAction, calculateEqualSplitAction } = await import("./split-bill-actions");
  const { createOrderAction } = await import("./actions");
  const { POST: pedidosPostHandler, GET: pedidosGetHandler } = await import("@/app/api/pedidos/route");
  const { __testDispatchHooks } = await import("./caja-test-hooks");
  const { NextRequest } = await import("next/server");

  // Acreditación activa contra PostgreSQL
  const dbCheck = await pool.query("SELECT inet_server_port(), current_database(), current_user");
  assert.strictEqual(dbCheck.rows[0].current_database, "menuqr_isolated_test");
  assert.strictEqual(dbCheck.rows[0].current_user, "isolated_tester");

  const restId = "99999999-0000-0000-0000-000000000001";
  const userId = "99999999-0000-0000-0000-000000000002";
  const catId = "99999999-0000-0000-0000-000000000003";
  const dishGourmetId = "99999999-0000-0000-0000-000000000004";

  // Limpiar únicamente datos de ensayo ficticios generados por esta suite específica
  await pool.query("DELETE FROM pedido_items WHERE pedido_id IN (SELECT id FROM pedidos WHERE negocio_id = $1)", [restId]);
  await pool.query("DELETE FROM pedidos WHERE negocio_id = $1", [restId]);
  await pool.query("DELETE FROM negocios WHERE id = $1", [restId]);
  await prisma.orderItem.deleteMany({ where: { order: { restaurantId: restId } } });
  await prisma.order.deleteMany({ where: { restaurantId: restId } });
  await prisma.customer.deleteMany({ where: { restaurantId: restId } });
  await prisma.dish.deleteMany({ where: { restaurantId: restId } });
  await prisma.category.deleteMany({ where: { restaurantId: restId } });
  await prisma.cashMovement.deleteMany({ where: { shift: { restaurantId: restId } } });
  await prisma.cashShift.deleteMany({ where: { restaurantId: restId } });
  await prisma.restaurant.deleteMany({ where: { id: restId } });
  await prisma.user.deleteMany({ where: { id: userId } });

  // Crear restaurante de ensayo con política tributaria: 15% IVA y 10% Servicio en salón
  await pool.query(
    `INSERT INTO negocios (id, nombre, slug, numero_mesas)
     VALUES ($1, 'Restaurante Ensayo E2E', 'restaurante-ensayo-e2e', 10)`,
    [restId]
  );

  await prisma.user.create({
    data: {
      id: userId,
      email: "tester-isolated@menuqr.local",
      name: "Tester Aislado",
      password: "dummy_password_hash",
    },
  });

  await prisma.restaurant.create({
    data: {
      id: restId,
      name: "Restaurante Ensayo E2E",
      slug: "restaurante-ensayo-e2e",
      whatsapp: "593999999999",
      userId: userId,
      testMode: true,
      ivaPercent: 15.0,
      servicePercent: 10.0,
      ivaOnTable: false,
      serviceOnTable: false,
      ivaOnTakeout: false,
      serviceOnTakeout: false,
    },
  });

  // Crear categoría y plato con control de inventario (trackStock)
  await prisma.category.create({
    data: { id: catId, name: "Carnes y Cortes", restaurantId: restId },
  });

  await prisma.dish.create({
    data: {
      id: dishGourmetId,
      name: "Milanesa Stock Gourmet",
      price: 16.90,
      stock: 10,
      trackStock: true,
      isAvailable: true,
      categoryId: catId,
      restaurantId: restId,
    },
  });

  // Abrir Turno de Caja real para cobros oficiales
  const openShiftRes = await openCashShift({
    restaurantId: restId,
    openedById: "tester-isolated",
    openedByName: "Cajero E2E Tester",
    initialCash: 100.0,
  });
  assert.ok(openShiftRes.shift, "El turno de caja debe abrirse exitosamente");
  const activeShiftId = openShiftRes.shift.id;

  console.log("✅ Entorno de ensayo inicializado con Turno de Caja Abierto e impuestos configurados (IVA: 15%, Servicio: 10%).\n");

  // ---------------------------------------------------------------------------
  // ESCENARIO 1: RECORRIDO COMPLETO: CREACIÓN REAL -> KDS -> COBRO REAL EN CAJA -> RESYNC
  // 1 Milanesa 16.90 / Término medio -> KDS (preparando/listo) -> settleOrderInCashShiftAction -> Resync
  // DEBE CONSERVARSE: Exactamente 1 línea / 1 unidad, Total $21.13, cobro y cashShift vinculados
  // ---------------------------------------------------------------------------
  console.log("▶ Escenario 1: Recorrido completo con KDS, cobro real por Caja (settleOrderInCashShiftAction) y resync");
  const ped1Id = "e2e00001-0000-0000-0000-000000000001";
  const item1Id = "e2e10001-0000-0000-0000-000000000001";

  await pool.query(
    `INSERT INTO pedidos (id, negocio_id, mesa, estado, total, metadata, cliente_nombre)
     VALUES ($1, $2, 'Mesa 4', 'solicitado', 21.13, '{"metodo_pago":"efectivo"}', 'Comensal Pigro 204')`,
    [ped1Id, restId]
  );

  await pool.query(
    `INSERT INTO pedido_items (id, pedido_id, nombre, cantidad, precio, notas, es_añadido, estado_item)
     VALUES ($1, $2, 'Milanesa Especial', 1, 16.90, 'Término medio', false, 'solicitado')`,
    [item1Id, ped1Id]
  );

  // Sincronización 1: Ingesta inicial
  await syncSinglePedidoToPrisma(ped1Id, restId);

  let order1 = await prisma.order.findUnique({
    where: { id: ped1Id },
    include: { items: true },
  });
  assert.ok(order1, "La orden debe existir en Prisma");
  assert.strictEqual(order1.items.length, 1, "Debe tener exactamente 1 ítem");
  assert.strictEqual(order1.items[0].quantity, 1, "La cantidad debe ser 1");
  assert.strictEqual(order1.items[0].notes, "Término medio", "Las notas deben conservarse íntegras");
  assert.strictEqual(order1.items[0].sourcePedidoItemId, item1Id, "sourcePedidoItemId debe estar vinculado 1:1");
  assert.strictEqual(order1.items[0].lineStatus, "ACTIVE", "lineStatus debe ser ACTIVE");
  assert.strictEqual(Number(order1.subtotal).toFixed(2), "16.90");
  assert.strictEqual(Number(order1.iva).toFixed(2), "2.54");
  assert.strictEqual(Number(order1.serviceCharge).toFixed(2), "1.69");
  assert.strictEqual(Number(order1.total).toFixed(2), "21.13");
  assert.strictEqual(order1.customerName, "Comensal Pigro 204");

  // Transición KDS: pasa a 'preparando' y luego 'listo'
  await pool.query("UPDATE pedidos SET estado = 'preparando' WHERE id = $1", [ped1Id]);
  await pool.query("UPDATE pedido_items SET estado_item = 'preparando' WHERE id = $1", [item1Id]);
  await syncSinglePedidoToPrisma(ped1Id, restId);

  await pool.query("UPDATE pedidos SET estado = 'listo' WHERE id = $1", [ped1Id]);
  await pool.query("UPDATE pedido_items SET estado_item = 'listo' WHERE id = $1", [item1Id]);
  await syncSinglePedidoToPrisma(ped1Id, restId);

  order1 = await prisma.order.findUnique({
    where: { id: ped1Id },
    include: { items: true },
  });
  assert.strictEqual(order1!.status, "READY", "Estado en Prisma debe reflejar READY de cocina");

  // COBRO REAL POR CAJA mediante función oficial del producto: settleOrderInCashShiftAction
  const settleRes = await settleOrderInCashShiftAction(restId, {
    orderId: ped1Id,
    total: 21.13,
    paymentMethod: "EFECTIVO",
    mesa: "Mesa 4",
    customerName: "Comensal Pigro 204",
  });
  assert.strictEqual(settleRes.success, true, "Cobro por Caja debe retornar éxito");

  // Verificar estado post-cobro en base de datos
  order1 = await prisma.order.findUnique({
    where: { id: ped1Id },
    include: { items: true },
  });
  assert.strictEqual(order1!.status, "COMPLETED", "La orden debe marcarse COMPLETED");
  assert.strictEqual(order1!.cashShiftId, activeShiftId, "La orden debe estar vinculada al turno de caja activo");

  const shiftAfterSettle = await prisma.cashShift.findUnique({ where: { id: activeShiftId } });
  assert.strictEqual(Number(shiftAfterSettle!.totalSales).toFixed(2), "21.13", "El turno debe registrar venta de $21.13");
  assert.strictEqual(Number(shiftAfterSettle!.totalCash).toFixed(2), "21.13", "El total en efectivo debe ser $21.13");

  // Resync masivo múltiple (simulando recargas de página y eventos concurrentes post-cobro)
  await syncPedidosToPrismaOrders(restId);
  await syncSinglePedidoToPrisma(ped1Id, restId);

  order1 = await prisma.order.findUnique({
    where: { id: ped1Id },
    include: { items: true },
  });
  assert.strictEqual(order1!.items.length, 1, "CRÍTICO: Tras KDS/cobro por Caja/recargas sigue habiendo exactamente 1 línea");
  assert.strictEqual(order1!.items[0].quantity, 1, "CRÍTICO: La cantidad sigue siendo 1 (NO duplicada)");
  assert.strictEqual(Number(order1!.total).toFixed(2), "21.13", "Total inmutable en $21.13");
  assert.strictEqual(order1!.status, "COMPLETED", "Estado permanece COMPLETED sin retroceder");
  console.log("  ✅ [PASS] Escenario 1: Recorrido completo superado con cobro real en Caja y 1 línea conservada ($21.13).\n");

  // ---------------------------------------------------------------------------
  // ESCENARIO 2: DOS LÍNEAS LEGÍTIMAS DISTINTAS ($33.80 base -> $42.25)
  // 1 Milanesa 'Término medio' ($16.90) + 1 Milanesa 'Bien cocida' ($16.90)
  // Comparación entre ruta de sincronización y ruta de venta directa en Caja POS
  // ---------------------------------------------------------------------------
  console.log("▶ Escenario 2: Dos líneas distintas y comparativa con venta directa ($33.80 -> $42.25)");
  const ped2Id = "e2e00002-0000-0000-0000-000000000002";
  const item2AId = "e2e20001-0000-0000-0000-000000000001";
  const item2BId = "e2e20002-0000-0000-0000-000000000002";

  await pool.query(
    `INSERT INTO pedidos (id, negocio_id, mesa, estado, total, metadata)
     VALUES ($1, $2, 'Mesa 5', 'solicitado', 42.25, '{"metodo_pago":"efectivo"}')`,
    [ped2Id, restId]
  );

  await pool.query(
    `INSERT INTO pedido_items (id, pedido_id, nombre, cantidad, precio, notas, es_añadido, estado_item) VALUES
     ($1, $3, 'Milanesa Especial', 1, 16.90, 'Término medio', false, 'solicitado'),
     ($2, $3, 'Milanesa Especial', 1, 16.90, 'Bien cocida', false, 'solicitado')`,
    [item2AId, item2BId, ped2Id]
  );

  await syncSinglePedidoToPrisma(ped2Id, restId);
  await syncPedidosToPrismaOrders(restId);

  const order2 = await prisma.order.findUnique({
    where: { id: ped2Id },
    include: { items: { orderBy: { sourcePedidoItemId: "asc" } } },
  });
  assert.strictEqual(order2!.items.length, 2, "Deben existir 2 líneas independientes");
  assert.strictEqual(order2!.items[0].notes, "Término medio");
  assert.strictEqual(order2!.items[1].notes, "Bien cocida");
  assert.strictEqual(order2!.items[0].sourcePedidoItemId, item2AId, "Línea 2A enlazada a sourcePedidoItemId");
  assert.strictEqual(order2!.items[0].lineStatus, "ACTIVE", "Línea 2A activa");
  assert.strictEqual(order2!.items[1].sourcePedidoItemId, item2BId, "Línea 2B enlazada a sourcePedidoItemId");
  assert.strictEqual(order2!.items[1].lineStatus, "ACTIVE", "Línea 2B activa");
  assert.strictEqual(order2!.items[0].quantity, 1);
  assert.strictEqual(order2!.items[1].quantity, 1);
  assert.strictEqual(Number(order2!.subtotal).toFixed(2), "33.80");
  assert.strictEqual(Number(order2!.iva).toFixed(2), "5.07");
  assert.strictEqual(Number(order2!.serviceCharge).toFixed(2), "3.38");
  assert.strictEqual(Number(order2!.total).toFixed(2), "42.25");
  console.log("  ✅ [PASS] Escenario 2: Sincronización de 2 líneas separadas verificada en $42.25 ($33.80 + $5.07 + $3.38).\n");

  // ---------------------------------------------------------------------------
  // ESCENARIO 3: RONDAS REPETIDAS (2 ítems idénticos pedidos en rondas sucesivas)
  // Ronda 1: 1 Cerveza Corona
  // Ronda 2: 1 Cerveza Corona añadida 20 min después
  // NO DEBEN FUSIONARSE AUTOMÁTICAMENTE EN 1 LÍNEA DE CANTIDAD 2
  // ---------------------------------------------------------------------------
  console.log("▶ Escenario 3: Rondas repetidas (Ronda 1 y Ronda 2 no se fusionan en comanda)");
  const ped3Id = "e2e00003-0000-0000-0000-000000000003";
  const item3Ronda1 = "e2e30001-0000-0000-0000-000000000001";
  const item3Ronda2 = "e2e30002-0000-0000-0000-000000000002";

  // Ronda 1
  await pool.query(
    `INSERT INTO pedidos (id, negocio_id, mesa, estado, total, metadata)
     VALUES ($1, $2, 'Mesa 6', 'solicitado', 4.00, '{"metodo_pago":"efectivo"}')`,
    [ped3Id, restId]
  );
  await pool.query(
    `INSERT INTO pedido_items (id, pedido_id, nombre, cantidad, precio, notas, es_añadido, estado_item)
     VALUES ($1, $2, 'Cerveza Corona', 1, 3.20, null, false, 'entregado')`,
    [item3Ronda1, ped3Id]
  );
  await syncSinglePedidoToPrisma(ped3Id, restId);

  // Ronda 2: El comensal pide otra Cerveza Corona idéntica (es_añadido = true)
  await pool.query(
    `INSERT INTO pedido_items (id, pedido_id, nombre, cantidad, precio, notas, es_añadido, estado_item)
     VALUES ($1, $2, 'Cerveza Corona', 1, 3.20, null, true, 'solicitado')`,
    [item3Ronda2, ped3Id]
  );
  await pool.query("UPDATE pedidos SET total = 8.00 WHERE id = $1", [ped3Id]);
  await syncSinglePedidoToPrisma(ped3Id, restId);

  const order3 = await prisma.order.findUnique({
    where: { id: ped3Id },
    include: { items: { orderBy: { sourcePedidoItemId: "asc" } } },
  });
  assert.strictEqual(order3!.items.length, 2, "Ronda 1 y Ronda 2 deben coexistir como 2 líneas separadas");
  assert.strictEqual(order3!.items[0].sourcePedidoItemId, item3Ronda1, "Ronda 1 enlazada a su ID");
  assert.strictEqual(order3!.items[1].sourcePedidoItemId, item3Ronda2, "Ronda 2 enlazada a su ID");
  assert.strictEqual(order3!.items[0].lineStatus, "ACTIVE", "Ronda 1 activa");
  assert.strictEqual(order3!.items[1].lineStatus, "ACTIVE", "Ronda 2 activa");
  assert.strictEqual(order3!.items[0].quantity, 1, "Ronda 1 permanece con cantidad 1");
  assert.strictEqual(order3!.items[1].quantity, 1, "Ronda 2 permanece con cantidad 1");
  console.log("  ✅ [PASS] Escenario 3: Rondas sucesivas de ítems idénticos conservan líneas independientes.\n");

  // ---------------------------------------------------------------------------
  // ESCENARIO 4: CANCELACIÓN POSTERIOR, CONSERVACIÓN HISTÓRICA Y PROTECCIÓN DE COBRADOS
  // 1. Cancelación posterior en pedido abierto: NO borra líneas de OrderItem (conserva trazabilidad para Historial/CRM)
  //    y actualiza importes activos/cobrables ($21.13).
  // 2. Cobro real en Caja (settleOrderInCashShiftAction) -> Turno vinculado y status COMPLETED.
  // 3. Cancelación posterior en origen tras el cobro: PROTECCIÓN ESTRICTA. No borra líneas,
  //    no cambia importe, no desvincula turno ni altera datos de pago.
  // 4. Compatibilidad con OrderItem de ID antiguo/legado sin duplicación.
  // ---------------------------------------------------------------------------
  console.log("▶ Escenario 4: Cancelación posterior, trazabilidad sin borrado ciego y protección de cobrados");
  const ped4Id = "e2e00004-0000-0000-0000-000000000004";
  const item4AId = "e2e40001-0000-0000-0000-000000000001";
  const item4BId = "e2e40002-0000-0000-0000-000000000002";

  // Paso A: Crear pedido con 2 líneas activas ($16.90 c/u, total $42.25)
  await pool.query(
    `INSERT INTO pedidos (id, negocio_id, mesa, estado, total, metadata)
     VALUES ($1, $2, 'Mesa 7', 'solicitado', 42.25, '{"metodo_pago":"efectivo"}')`,
    [ped4Id, restId]
  );
  await pool.query(
    `INSERT INTO pedido_items (id, pedido_id, nombre, cantidad, precio, notas, es_añadido, estado_item) VALUES
     ($1, $3, 'Plato A', 1, 16.90, 'Sin sal', false, 'solicitado'),
     ($2, $3, 'Plato B', 1, 16.90, 'Extra salsa', false, 'solicitado')`,
    [item4AId, item4BId, ped4Id]
  );

  // Sincronización inicial: 2 líneas activas
  await syncSinglePedidoToPrisma(ped4Id, restId);
  let order4 = await prisma.order.findUnique({
    where: { id: ped4Id },
    include: { items: true },
  });
  assert.strictEqual(order4!.items.length, 2, "Paso A: Deben sincronizarse 2 líneas activas inicialmente");
  assert.strictEqual(Number(order4!.subtotal).toFixed(2), "33.80");
  assert.strictEqual(Number(order4!.total).toFixed(2), "42.25");

  // Paso B: Cancelar Plato B posteriormente en origen (pedido_items)
  await pool.query("UPDATE pedido_items SET estado_item = 'cancelado' WHERE id = $1", [item4BId]);

  // Resincronizar múltiples veces consecutivas (single y batch)
  await syncSinglePedidoToPrisma(ped4Id, restId);
  await syncPedidosToPrismaOrders(restId);
  await syncSinglePedidoToPrisma(ped4Id, restId);

  order4 = await prisma.order.findUnique({
    where: { id: ped4Id },
    include: { items: true },
  });
  // Se conservan las líneas históricas en OrderItem (NO se borran ciegamente para mantener trazabilidad en Historial/CRM)
  assert.strictEqual(order4!.items.length, 2, "Paso B: Las líneas en OrderItem no se borran ciegamente, preservando el detalle histórico");
  const item4A = order4!.items.find((i) => i.dishName === "Plato A");
  const item4B = order4!.items.find((i) => i.dishName === "Plato B");
  assert.ok(item4A && item4B, "Ambas líneas deben existir");
  assert.strictEqual(item4A!.lineStatus, "ACTIVE", "Plato A activo");
  assert.strictEqual(item4A!.sourcePedidoItemId, item4AId, "Plato A enlazado a su ID de origen");
  assert.strictEqual(item4B!.lineStatus, "CANCELLED", "Plato B marcado CANCELLED");
  assert.strictEqual(item4B!.sourcePedidoItemId, item4BId, "Plato B enlazado a su ID de origen");

  // Pero el importe cobrable/activo se recalcula con las líneas activas
  assert.strictEqual(Number(order4!.subtotal).toFixed(2), "16.90", "Subtotal activo debe actualizarse a $16.90");
  assert.strictEqual(Number(order4!.iva).toFixed(2), "2.54", "IVA activo debe actualizarse a $2.54");
  assert.strictEqual(Number(order4!.serviceCharge).toFixed(2), "1.69", "Servicio activo debe actualizarse a $1.69");
  assert.strictEqual(Number(order4!.total).toFixed(2), "21.13", "Total cobrable debe ser $21.13");

  // Verificar rechazo estricto en split bill (cuenta dividida):
  const tableSessionRes = await createTableSessionAction(restId, "Mesa 7");
  assert.ok(tableSessionRes.success && tableSessionRes.session, "Sesión de mesa creada para Mesa 7");
  const splitAttempt = await calculateProductSplitAction(restId, tableSessionRes.session.id, [
    { orderItemId: item4B!.id, quantity: 1 },
  ]);
  assert.ok(splitAttempt.error, "La línea cancelada no debe poder repartirse en cuenta dividida");
  assert.ok(
    String(splitAttempt.error).includes("cancelado"),
    "El mensaje de error debe indicar que el producto está cancelado"
  );

  // Comprobar que en PostgreSQL la fila cancelada SIGUE existiendo para auditoría
  const checkPostgresItems = await pool.query("SELECT id, estado_item FROM pedido_items WHERE pedido_id = $1", [ped4Id]);
  assert.strictEqual(checkPostgresItems.rows.length, 2, "En PostgreSQL se conservan ambas filas para trazabilidad");
  const cancelRow = checkPostgresItems.rows.find((r) => r.id === item4BId);
  assert.strictEqual(cancelRow.estado_item, "cancelado", "Plato B conserva estado_item cancelado en PG");

  // Paso C: Cobro real en Caja del pedido activo ($21.13)
  const settleRes4 = await settleOrderInCashShiftAction(restId, {
    orderId: ped4Id,
    total: 21.13,
    paymentMethod: "EFECTIVO",
    mesa: "Mesa 7",
    customerName: "Comensal Mesa 7",
  });
  assert.strictEqual(settleRes4.success, true, "El pedido debe cobrarse exitosamente en Caja");

  order4 = await prisma.order.findUnique({
    where: { id: ped4Id },
    include: { items: true },
  });
  assert.strictEqual(order4!.status, "COMPLETED", "La orden cobrada debe tener status COMPLETED");
  assert.strictEqual(order4!.cashShiftId, activeShiftId, "La orden cobrada debe estar vinculada al turno");
  assert.strictEqual(Number(order4!.total).toFixed(2), "21.13", "Total cobrado verificado en $21.13");

  // Paso D: INTENTO DE CANCELACIÓN POSTERIOR EN ORIGEN TRAS EL COBRO
  // Simular que en PostgreSQL se cancelan todos los ítems o el pedido después de haber sido cobrado
  await pool.query("UPDATE pedido_items SET estado_item = 'cancelado' WHERE pedido_id = $1", [ped4Id]);
  await pool.query("UPDATE pedidos SET estado = 'cancelado' WHERE id = $1", [ped4Id]);

  // Resincronizar múltiples veces
  await syncSinglePedidoToPrisma(ped4Id, restId);
  await syncPedidosToPrismaOrders(restId);
  await syncSinglePedidoToPrisma(ped4Id, restId);

  order4 = await prisma.order.findUnique({
    where: { id: ped4Id },
    include: { items: true },
  });
  // PROTECCIÓN ESTRICTA: La orden cobrada NO altera sus importes, turno ni estado financiero
  assert.strictEqual(order4!.status, "COMPLETED", "PROTECCIÓN: La orden cobrada no cambia a CANCELLED");
  assert.strictEqual(order4!.items.length, 2, "PROTECCIÓN: No se borran líneas de una orden ya cobrada");
  assert.strictEqual(Number(order4!.total).toFixed(2), "21.13", "PROTECCIÓN: El importe cobrado permanece inmutable en $21.13");
  assert.strictEqual(Number(order4!.subtotal).toFixed(2), "16.90", "PROTECCIÓN: Subtotal cobrado intacto");
  assert.strictEqual(order4!.cashShiftId, activeShiftId, "PROTECCIÓN: El turno de caja no se desvincula");
  assert.strictEqual(order4!.paymentMethod, "EFECTIVO", "PROTECCIÓN: El método de pago no se altera");

  // Pero para trazabilidad en comanda/KDS, la línea cancelada operativamente se refleja como CANCELLED
  const item4APost = order4!.items.find((i) => i.dishName === "Plato A");
  assert.strictEqual(item4APost!.lineStatus, "CANCELLED", "Operativamente se marca CANCELLED para comanda");

  // Paso E: Compatibilidad con OrderItem preexistente de ID distinto al origen (enlace inequívoco 1:1)
  const pedLegacyId = "e2e00004-0000-0000-0000-00000000004d";
  const itemLegacyOriginId = "e2e40003-0000-0000-0000-000000000001";
  const itemLegacyPrismaId = "legacy-prisma-random-uuid-001";

  await pool.query(
    `INSERT INTO pedidos (id, negocio_id, mesa, estado, total, metadata)
     VALUES ($1, $2, 'Mesa 8', 'solicitado', 21.13, '{"metodo_pago":"efectivo"}')`,
    [pedLegacyId, restId]
  );
  await pool.query(
    `INSERT INTO pedido_items (id, pedido_id, nombre, cantidad, precio, notas, es_añadido, estado_item)
     VALUES ($1, $2, 'Plato Legado', 1, 16.90, 'Nota Legada', false, 'solicitado')`,
    [itemLegacyOriginId, pedLegacyId]
  );

  // Crear preexistente en Prisma con ID diferente
  await prisma.order.create({
    data: {
      id: pedLegacyId,
      restaurantId: restId,
      tableName: "Mesa 8",
      subtotal: 16.90,
      iva: 2.54,
      serviceCharge: 1.69,
      tip: 0.0,
      total: 21.13,
      paymentMethod: "efectivo",
      status: "PENDING",
      items: {
        create: [
          {
            id: itemLegacyPrismaId,
            dishName: "Plato Legado",
            price: 16.90,
            quantity: 1,
            notes: "Nota Legada",
          },
        ],
      },
    },
  });

  // Resincronizar: no debe duplicar la línea, debe reutilizar la preexistente y enlazar sourcePedidoItemId
  await syncSinglePedidoToPrisma(pedLegacyId, restId);
  const orderLegacy = await prisma.order.findUnique({
    where: { id: pedLegacyId },
    include: { items: true },
  });
  assert.strictEqual(orderLegacy!.items.length, 1, "Paso E: Preexistente con ID distinto no debe duplicarse");
  assert.strictEqual(orderLegacy!.items[0].id, itemLegacyPrismaId, "Conserva el ID preexistente");
  assert.strictEqual(orderLegacy!.items[0].sourcePedidoItemId, itemLegacyOriginId, "Enlace inequívoco 1:1 asigna sourcePedidoItemId");
  assert.strictEqual(orderLegacy!.items[0].lineStatus, "ACTIVE", "Línea inequívoca permanece ACTIVE");

  // Si se cancela en origen antes de cobro, la orden pasa a CANCELLED con total $0.00 sin borrar el histórico
  await pool.query("UPDATE pedido_items SET estado_item = 'cancelado' WHERE id = $1", [itemLegacyOriginId]);
  await syncSinglePedidoToPrisma(pedLegacyId, restId);
  const orderLegacyAfterCancel = await prisma.order.findUnique({
    where: { id: pedLegacyId },
    include: { items: true },
  });
  assert.strictEqual(orderLegacyAfterCancel!.items.length, 1, "Conserva la línea en OrderItem para trazabilidad histórica");
  assert.strictEqual(orderLegacyAfterCancel!.items[0].lineStatus, "CANCELLED", "Línea cancelada pasa a CANCELLED");
  assert.strictEqual(orderLegacyAfterCancel!.status, "CANCELLED", "Al cancelarse todas las líneas, la orden pasa a CANCELLED");
  assert.strictEqual(Number(orderLegacyAfterCancel!.total).toFixed(2), "0.00", "Total pasa a $0.00");

  // Paso F: Manejo de ambigüedad en legados (múltiples ítems existentes con la misma firma)
  // REGLA: "Si hay ambigüedad, marca UNRESOLVED y no fusiones ni asignes por orden del array"
  const pedAmbId = "e2e00004-0000-0000-0000-00000000004f";
  const itemAmbOrigin1 = "e2e40003-0000-0000-0000-00000000000f";
  const itemAmbPrisma1 = "amb-prisma-001";
  const itemAmbPrisma2 = "amb-prisma-002";

  await pool.query(
    `INSERT INTO pedidos (id, negocio_id, mesa, estado, total, metadata)
     VALUES ($1, $2, 'Mesa 9', 'solicitado', 33.80, '{"metodo_pago":"efectivo"}')`,
    [pedAmbId, restId]
  );
  await pool.query(
    `INSERT INTO pedido_items (id, pedido_id, nombre, cantidad, precio, notas, es_añadido, estado_item)
     VALUES ($1, $2, 'Postre Ambiguo', 1, 16.90, 'Sin gluten', false, 'solicitado')`,
    [itemAmbOrigin1, pedAmbId]
  );

  // Crear orden con 2 ítems legados idénticos en firma pero sin sourcePedidoItemId
  await prisma.order.create({
    data: {
      id: pedAmbId,
      restaurantId: restId,
      tableName: "Mesa 9",
      subtotal: 33.80,
      iva: 5.07,
      serviceCharge: 3.38,
      tip: 0.0,
      total: 42.25,
      paymentMethod: "efectivo",
      status: "PENDING",
      items: {
        create: [
          {
            id: itemAmbPrisma1,
            dishName: "Postre Ambiguo",
            price: 16.90,
            quantity: 1,
            notes: "Sin gluten",
            sourcePedidoItemId: null,
            lineStatus: "ACTIVE",
          },
          {
            id: itemAmbPrisma2,
            dishName: "Postre Ambiguo",
            price: 16.90,
            quantity: 1,
            notes: "Sin gluten",
            sourcePedidoItemId: null,
            lineStatus: "ACTIVE",
          },
        ],
      },
    },
  });

  await syncSinglePedidoToPrisma(pedAmbId, restId);
  const orderAmb = await prisma.order.findUnique({
    where: { id: pedAmbId },
    include: { items: true },
  });
  // 1. TOTAL de filas en OrderItem debe ser exactamente 2 (sin creación espuria de una tercera línea ACTIVE)
  assert.strictEqual(orderAmb!.items.length, 2, "Paso F: TOTAL de filas debe ser exactamente 2 (sin tercera línea activa)");
  const idsInAmb = orderAmb!.items.map((i) => i.id).sort();
  assert.deepStrictEqual(idsInAmb, [itemAmbPrisma1, itemAmbPrisma2].sort(), "Paso F: Se preservan los IDs existentes sin reasignar");
  const unres = orderAmb!.items.filter((i) => i.lineStatus === "UNRESOLVED");
  assert.strictEqual(unres.length, 2, "Paso F: Ítems ambiguos deben marcarse UNRESOLVED sin asignar por orden de array");
  const activeInAmb = orderAmb!.items.filter((i) => i.lineStatus === "ACTIVE");
  assert.strictEqual(activeInAmb.length, 0, "Paso F: Ausencia total de líneas ACTIVE en caso ambiguo");
  assert.strictEqual(Number(orderAmb!.total).toFixed(2), "0.00", "Total cobrable activo en caso ambiguo es $0.00");

  // 2. Rechazo efectivo de cobro oficial (settleOrderInCashShiftAction) ante ambigüedad
  const settleAmbRes = await settleOrderInCashShiftAction(restId, {
    orderId: pedAmbId,
    total: 42.25,
    paymentMethod: "EFECTIVO",
    mesa: "Mesa 9",
  });
  assert.ok(settleAmbRes.error, "Cobro oficial debe ser rechazado si hay líneas UNRESOLVED");
  assert.ok(
    String(settleAmbRes.error).includes("UNRESOLVED"),
    "Mensaje de error debe citar líneas no conciliadas (UNRESOLVED)"
  );

  // 3. Rechazo efectivo de reparto en mesa (split bill) ante ambigüedad
  const tableSessionAmb = await createTableSessionAction(restId, "Mesa 9");
  assert.ok(tableSessionAmb.success && tableSessionAmb.session, "Sesión creada para Mesa 9");
  const eqSplitAmb = await calculateEqualSplitAction(restId, tableSessionAmb.session.id, 2);
  assert.ok(eqSplitAmb.error, "Reparto equitativo debe ser rechazado si hay líneas UNRESOLVED");
  assert.ok(
    String(eqSplitAmb.error).includes("UNRESOLVED"),
    "Error de reparto equitativo debe citar líneas no conciliadas (UNRESOLVED)"
  );

  const prodSplitAmb = await calculateProductSplitAction(restId, tableSessionAmb.session.id, [
    { orderItemId: itemAmbPrisma1, quantity: 1 },
  ]);
  assert.ok(prodSplitAmb.error, "Reparto por producto debe ser rechazado si hay líneas UNRESOLVED");
  assert.ok(
    String(prodSplitAmb.error).includes("UNRESOLVED"),
    "Error de reparto por producto debe citar líneas no conciliadas (UNRESOLVED)"
  );

  // Paso G: Compatibilidad de cantidad en legado (cantidad 2 en legado vs cantidad 1 en origen)
  // REGLA: "El enlace legacy 1a1 tampoco debe sobrescribir cantidad 2 con cantidad 1 por coincidir solo nombre/precio/notas.
  // Comprueba compatibilidad de cantidad y ronda; si no se puede demostrar, queda No conciliado."
  const pedQtyDiscId = "e2e00004-0000-0000-0000-000000000050";
  const itemQtyOrigin1 = "e2e40003-0000-0000-0000-000000000010";
  const itemQtyPrisma1 = "qtydisc-prisma-001";

  await pool.query(
    `INSERT INTO pedidos (id, negocio_id, mesa, estado, total, metadata)
     VALUES ($1, $2, 'Mesa 10', 'solicitado', 16.90, '{"metodo_pago":"efectivo"}')`,
    [pedQtyDiscId, restId]
  );
  await pool.query(
    `INSERT INTO pedido_items (id, pedido_id, nombre, cantidad, precio, notas, es_añadido, estado_item)
     VALUES ($1, $2, 'Plato Discrepante', 1, 16.90, 'Sin cebolla', false, 'solicitado')`,
    [itemQtyOrigin1, pedQtyDiscId]
  );

  // Crear en Prisma con cantidad 2
  await prisma.order.create({
    data: {
      id: pedQtyDiscId,
      restaurantId: restId,
      tableName: "Mesa 10",
      subtotal: 33.80,
      iva: 5.07,
      serviceCharge: 3.38,
      tip: 0.0,
      total: 42.25,
      paymentMethod: "efectivo",
      status: "PENDING",
      items: {
        create: [
          {
            id: itemQtyPrisma1,
            dishName: "Plato Discrepante",
            price: 16.90,
            quantity: 2,
            notes: "Sin cebolla",
            sourcePedidoItemId: null,
            lineStatus: "ACTIVE",
          },
        ],
      },
    },
  });

  await syncSinglePedidoToPrisma(pedQtyDiscId, restId);
  const orderQtyDisc = await prisma.order.findUnique({
    where: { id: pedQtyDiscId },
    include: { items: true },
  });
  assert.strictEqual(orderQtyDisc!.items.length, 1, "Paso G: Debe conservarse exactamente 1 ítem (sin fila nueva)");
  assert.strictEqual(orderQtyDisc!.items[0].quantity, 2, "Paso G: Cantidad 2 NO debe ser sobrescrita por cantidad 1");
  assert.strictEqual(orderQtyDisc!.items[0].lineStatus, "UNRESOLVED", "Paso G: Queda como UNRESOLVED por incompatibilidad de cantidad");

  // Paso H: Productor real de rondas (createOrderAction), despacho y cancelación de línea POS ya despachada
  // REGLA: "Prueba dos rondas legítimas idénticas desde el productor real y cancelación de una línea POS ya despachada:
  // debe marcarse la línea correcta sin cambiar el importe cobrado."
  const round1 = await createOrderAction({
    restaurantId: restId,
    tableName: "Mesa 11",
    customerName: "Comensal Rondas",
    paymentMethod: "efectivo",
    items: [{ dishId: dishGourmetId, quantity: 1, notes: "Ronda 1" }],
  });
  assert.ok(round1.success && round1.orderId, "Ronda 1 debe crearse exitosamente");

  let ordRondas = await prisma.order.findUnique({
    where: { id: round1.orderId },
    include: { items: true },
  });
  assert.strictEqual(ordRondas!.items.length, 1, "Ronda 1: Exactamente 1 ítem inicial");
  assert.strictEqual(ordRondas!.items[0].sourcePedidoItemId, null, "Ronda 1: sourcePedidoItemId es null antes de despacho");
  assert.strictEqual(ordRondas!.items[0].lineStatus, "ACTIVE", "Ronda 1: lineStatus es ACTIVE");
  assert.strictEqual(ordRondas!.kdsDispatched, false, "Ronda 1: kdsDispatched es false antes de despacho");

  // Despacho de Ronda 1 inicial a cocina
  const rec1 = await reconcileUndispatchedOrders(restId);
  assert.ok(rec1 > 0, "Ronda 1 inicial debe ser despachada a cocina");

  // Añadir Ronda 2 idéntica en la misma comanda mediante el productor real
  const round2 = await createOrderAction({
    restaurantId: restId,
    tableName: "Mesa 11",
    parentOrderId: round1.orderId,
    tableSessionToken: round1.tableSessionToken,
    isRound: true,
    paymentMethod: "efectivo",
    items: [{ dishId: dishGourmetId, quantity: 1, notes: "Ronda 2" }],
  });
  assert.ok(round2.success, "Ronda 2 debe crearse exitosamente");

  ordRondas = await prisma.order.findUnique({
    where: { id: round1.orderId },
    include: { items: true },
  });
  assert.strictEqual(ordRondas!.items.length, 2, "Deben coexistir 2 ítems para las 2 rondas sin fusionarse");
  const round1Item = ordRondas!.items.find((i) => i.notes?.includes("Ronda 1"))!;
  const round2Item = ordRondas!.items.find((i) => i.notes?.includes("Ronda 2"))!;
  assert.ok(round1Item.sourcePedidoItemId, "Ronda 1: tiene sourcePedidoItemId por su despacho previo");
  assert.strictEqual(round2Item.sourcePedidoItemId, null, "Ronda 2: sourcePedidoItemId es null antes de despacho");
  assert.strictEqual(round2Item.lineStatus, "ACTIVE", "Ronda 2: lineStatus es ACTIVE");

  // Ejecutar despacho de Ronda 2 hacia KDS mediante reconcileUndispatchedOrders
  const recCount = await reconcileUndispatchedOrders(restId);
  assert.ok(recCount > 0, "reconcileUndispatchedOrders debe despachar la orden a KDS");

  ordRondas = await prisma.order.findUnique({
    where: { id: round1.orderId },
    include: { items: true },
  });
  const round1Dispatched = ordRondas!.items.find((i) => i.notes?.includes("Ronda 1"))!;
  const round2Dispatched = ordRondas!.items.find((i) => i.notes?.includes("Ronda 2"))!;
  assert.strictEqual(ordRondas!.kdsDispatched, true, "kdsDispatched debe ser true tras el despacho");
  assert.ok(round1Dispatched.sourcePedidoItemId, "Ronda 1 debe tener sourcePedidoItemId vinculado");
  assert.ok(round2Dispatched.sourcePedidoItemId, "Ronda 2 debe tener sourcePedidoItemId vinculado");
  assert.notStrictEqual(
    round1Dispatched.sourcePedidoItemId,
    round2Dispatched.sourcePedidoItemId,
    "Ambas rondas deben tener sourcePedidoItemId distintos"
  );

  // Comprobar filas en PostgreSQL pedido_items
  const pgItemsRondas = await pool.query(
    "SELECT id, es_añadido FROM pedido_items WHERE pedido_id = $1 ORDER BY id",
    [round1.orderId]
  );
  assert.strictEqual(pgItemsRondas.rows.length, 2, "En PostgreSQL deben existir exactamente 2 filas para las 2 rondas");
  const addedRow = pgItemsRondas.rows.find((r) => r.es_añadido === true);
  assert.ok(addedRow, "La ronda 2 debe registrar es_añadido = true");

  // Venta directa POS con 2 ítems despachada y cancelación operativa posterior:
  const posSale3Res = await processCajaSaleAction(restId, {
    items: [
      { dishId: dishGourmetId, quantity: 1, price: 16.90, name: "Milanesa POS A" },
      { dishId: dishGourmetId, quantity: 1, price: 16.90, name: "Milanesa POS B" },
    ],
    paymentMethod: "EFECTIVO",
    customerName: "Cliente POS Despachado",
    iva: 5.07,
    serviceCharge: 3.38,
    total: 42.25,
  });
  assert.ok(posSale3Res.success && posSale3Res.orderId, "Venta POS debe crearse exitosamente");

  let orderPos3 = await prisma.order.findUnique({
    where: { id: posSale3Res.orderId },
    include: { items: { orderBy: { id: "asc" } } },
  });
  assert.strictEqual(orderPos3!.items.length, 2, "La orden POS tiene 2 ítems");
  assert.ok(orderPos3!.items[0].sourcePedidoItemId, "Línea POS A vinculada con sourcePedidoItemId tras despacho");
  assert.ok(orderPos3!.items[1].sourcePedidoItemId, "Línea POS B vinculada con sourcePedidoItemId tras despacho");
  assert.strictEqual(orderPos3!.status, "COMPLETED");
  assert.strictEqual(Number(orderPos3!.total).toFixed(2), "42.25");

  // Cancelación operativa en origen de la línea POS B ya despachada:
  const posItemB = orderPos3!.items.find((i) => i.dishName === "Milanesa POS B")!;
  await pool.query("UPDATE pedido_items SET estado_item = 'cancelado' WHERE id = $1", [posItemB.sourcePedidoItemId]);

  // Sincronizar
  await syncSinglePedidoToPrisma(orderPos3!.id, restId);

  orderPos3 = await prisma.order.findUnique({
    where: { id: posSale3Res.orderId },
    include: { items: { orderBy: { id: "asc" } } },
  });
  const updatedPosItemA = orderPos3!.items.find((i) => i.dishName === "Milanesa POS A")!;
  const updatedPosItemB = orderPos3!.items.find((i) => i.dishName === "Milanesa POS B")!;

  assert.strictEqual(updatedPosItemA.lineStatus, "ACTIVE", "Línea POS A permanece ACTIVE");
  assert.strictEqual(updatedPosItemB.lineStatus, "CANCELLED", "Línea POS B se marca CANCELLED para trazabilidad en comanda");
  assert.strictEqual(orderPos3!.status, "COMPLETED", "PROTECCIÓN: Estado de orden cobrada permanece COMPLETED");
  assert.strictEqual(Number(orderPos3!.total).toFixed(2), "42.25", "PROTECCIÓN: Total cobrado inmutable en $42.25");
  assert.strictEqual(Number(orderPos3!.subtotal).toFixed(2), "33.80", "PROTECCIÓN: Subtotal cobrado inmutable en $33.80");
  assert.strictEqual(orderPos3!.cashShiftId, activeShiftId, "PROTECCIÓN: Turno de caja permanece vinculado");

  // ---------------------------------------------------------------------------
  // Paso I: CAMINO REAL DEL CLIENTE MEDIANTE /api/pedidos (Despacho Normal y 2ª Ronda Idéntica)
  // REGLA: "Camino real del cliente: crear pedido, enviar por /api/pedidos y añadir una segunda ronda
  // con el MISMO plato, precio y notas. Deben quedar exactamente dos líneas, con IDs conservados y vínculos distintos.
  // Cancela una antes del cobro, resincroniza y comprueba que solo la otra se puede repartir/cobrar.
  // Después del cobro, una cancelación operativa no cambia el importe, pago ni turno ya registrados."
  // ---------------------------------------------------------------------------
  console.log("    • Paso I: Camino real del cliente (/api/pedidos), 2ª ronda idéntica, cancelación pre/post-cobro");

  // 1. Crear comanda inicial (Ronda 1) desde el productor real
  const normalOrder1 = await createOrderAction({
    restaurantId: restId,
    tableName: "Mesa 12",
    customerName: "Comensal Ruta Normal",
    paymentMethod: "efectivo",
    items: [{ dishId: dishGourmetId, quantity: 1, notes: "Término medio" }],
  });
  assert.ok(normalOrder1.success && normalOrder1.orderId, "Paso I: Pedido inicial debe crearse en Prisma");
  assert.ok(normalOrder1.dispatchToken, "Paso I: createOrderAction debe emitir dispatchToken");
  assert.strictEqual(normalOrder1.items?.length, 1, "Paso I: 1 ítem inicial en comanda");
  const initialOrderItemId = normalOrder1.items![0].id;

  let checkOrdI = await prisma.order.findUnique({
    where: { id: normalOrder1.orderId },
    include: { items: true },
  });
  assert.strictEqual(checkOrdI!.kdsDispatched, false, "Paso I: kdsDispatched es false antes de llamar /api/pedidos");
  assert.strictEqual(checkOrdI!.items[0].sourcePedidoItemId, null, "Paso I: sourcePedidoItemId es null antes de /api/pedidos");

  // 2. Despacho normal del cliente hacia /api/pedidos
  const reqDispatch1 = new NextRequest("http://localhost:3000/api/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      negocio_id: restId,
      order_id: normalOrder1.orderId,
      dispatch_token: normalOrder1.dispatchToken,
      mesa: "Mesa 12",
      tipo_entrega: "MESA",
      metodo_entrega: "MESA",
      table_session_token: normalOrder1.tableSessionToken,
      items: [
        {
          dishId: dishGourmetId,
          orderItemId: initialOrderItemId,
          nombre: "Milanesa Stock Gourmet",
          cantidad: 1,
          precio: 16.90,
          notas: "Término medio",
        },
      ],
      total: 21.13,
    }),
  });

  const resDispatch1 = await pedidosPostHandler(reqDispatch1);
  const dataDispatch1 = await resDispatch1.json();
  assert.strictEqual(resDispatch1.status, 200, "Paso I: Despacho normal debe retornar HTTP 200");
  assert.strictEqual(dataDispatch1.ok, true, "Paso I: Respuesta de /api/pedidos debe ser ok: true");

  checkOrdI = await prisma.order.findUnique({
    where: { id: normalOrder1.orderId },
    include: { items: true },
  });
  assert.strictEqual(checkOrdI!.kdsDispatched, true, "Paso I: kdsDispatched pasa a true tras /api/pedidos");
  assert.ok(checkOrdI!.items[0].sourcePedidoItemId, "Paso I: OrderItem inicial vinculado con sourcePedidoItemId");
  const piRound1Id = checkOrdI!.items[0].sourcePedidoItemId!;

  // Verificar en PostgreSQL pedido_items
  const pgPi1 = await pool.query(
    "SELECT id, es_añadido FROM pedido_items WHERE pedido_id = $1",
    [normalOrder1.orderId]
  );
  assert.strictEqual(pgPi1.rows.length, 1, "En PostgreSQL existe exactamente 1 fila para Ronda 1");
  assert.strictEqual(String(pgPi1.rows[0].id), piRound1Id, "ID en PostgreSQL coincide con sourcePedidoItemId");
  assert.strictEqual(pgPi1.rows[0].es_añadido, false, "Ronda 1 tiene es_añadido = false");

  // 3. Añadir segunda ronda con el MISMO plato, precio y notas
  const normalOrder2 = await createOrderAction({
    restaurantId: restId,
    tableName: "Mesa 12",
    parentOrderId: normalOrder1.orderId,
    tableSessionToken: normalOrder1.tableSessionToken,
    isRound: true,
    paymentMethod: "efectivo",
    items: [{ dishId: dishGourmetId, quantity: 1, notes: "Término medio" }],
  });
  assert.ok(normalOrder2.success, "Paso I: Ronda 2 debe añadirse exitosamente en comanda");
  assert.ok(normalOrder2.dispatchToken, "Paso I: Ronda 2 debe emitir dispatchToken");
  assert.strictEqual(normalOrder2.items?.length, 1, "Paso I: 1 ítem creado para Ronda 2");
  const round2OrderItemId = normalOrder2.items![0].id;

  checkOrdI = await prisma.order.findUnique({
    where: { id: normalOrder1.orderId },
    include: { items: true },
  });
  assert.strictEqual(checkOrdI!.items.length, 2, "Paso I: Coexisten 2 líneas en comanda");
  const item1PreDispatch = checkOrdI!.items.find((i) => i.id === initialOrderItemId)!;
  const item2PreDispatch = checkOrdI!.items.find((i) => i.id === round2OrderItemId)!;
  assert.strictEqual(item1PreDispatch.sourcePedidoItemId, piRound1Id, "Ronda 1 conserva su vínculo previo");
  assert.strictEqual(item2PreDispatch.sourcePedidoItemId, null, "Ronda 2 tiene sourcePedidoItemId = null antes de despacho");

  // 4. Despacho normal de Ronda 2 mediante /api/pedidos
  const reqDispatch2 = new NextRequest("http://localhost:3000/api/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      negocio_id: restId,
      order_id: normalOrder1.orderId,
      dispatch_token: normalOrder2.dispatchToken,
      is_round: true,
      round_attempt_id: "round-attempt-mesa12-r2",
      mesa: "Mesa 12",
      tipo_entrega: "MESA",
      metodo_entrega: "MESA",
      table_session_token: normalOrder1.tableSessionToken,
      items: [
        {
          dishId: dishGourmetId,
          orderItemId: round2OrderItemId,
          nombre: "Milanesa Stock Gourmet",
          cantidad: 1,
          precio: 16.90,
          notas: "Término medio",
        },
      ],
      total: 42.25,
    }),
  });

  const resDispatch2 = await pedidosPostHandler(reqDispatch2);
  const dataDispatch2 = await resDispatch2.json();
  assert.strictEqual(resDispatch2.status, 200, "Paso I: Despacho de Ronda 2 debe retornar HTTP 200");
  assert.strictEqual(dataDispatch2.ok, true, "Paso I: Respuesta de Ronda 2 debe ser ok: true");

  checkOrdI = await prisma.order.findUnique({
    where: { id: normalOrder1.orderId },
    include: { items: true },
  });
  assert.strictEqual(checkOrdI!.items.length, 2, "Paso I: Exactamente 2 líneas en comanda");
  const item1PostDispatch = checkOrdI!.items.find((i) => i.id === initialOrderItemId)!;
  const item2PostDispatch = checkOrdI!.items.find((i) => i.id === round2OrderItemId)!;

  assert.strictEqual(item1PostDispatch.id, initialOrderItemId, "ID de Ronda 1 conservado");
  assert.strictEqual(item2PostDispatch.id, round2OrderItemId, "ID de Ronda 2 conservado");
  assert.ok(item1PostDispatch.sourcePedidoItemId, "Ronda 1 tiene vínculo");
  assert.ok(item2PostDispatch.sourcePedidoItemId, "Ronda 2 tiene vínculo");
  assert.notStrictEqual(
    item1PostDispatch.sourcePedidoItemId,
    item2PostDispatch.sourcePedidoItemId,
    "Ambas rondas legítimas idénticas tienen vínculos distintos"
  );
  assert.strictEqual(item1PostDispatch.lineStatus, "ACTIVE", "Ronda 1 es ACTIVE (conciliada)");
  assert.strictEqual(item2PostDispatch.lineStatus, "ACTIVE", "Ronda 2 es ACTIVE (conciliada, no UNRESOLVED)");
  const piRound2Id = item2PostDispatch.sourcePedidoItemId!;

  // Verificar en PostgreSQL pedido_items
  const pgPiRondas = await pool.query(
    "SELECT id, es_añadido FROM pedido_items WHERE pedido_id = $1 ORDER BY id",
    [normalOrder1.orderId]
  );
  assert.strictEqual(pgPiRondas.rows.length, 2, "En PostgreSQL existen exactamente 2 filas para las 2 rondas");
  const round2PgRow = pgPiRondas.rows.find((r) => String(r.id) === piRound2Id)!;
  assert.strictEqual(round2PgRow.es_añadido, true, "Ronda 2 registra es_añadido = true en PostgreSQL");

  // Resincronización normal
  await syncSinglePedidoToPrisma(normalOrder1.orderId, restId);
  checkOrdI = await prisma.order.findUnique({
    where: { id: normalOrder1.orderId },
    include: { items: true },
  });
  assert.strictEqual(Number(checkOrdI!.total).toFixed(2), "42.25", "Total de ambas rondas activas es $42.25");

  // 5. Cancelar una línea antes del cobro, resincronizar y comprobar que solo la otra se puede repartir/cobrar
  await pool.query("UPDATE pedido_items SET estado_item = 'cancelado' WHERE id = $1", [piRound2Id]);
  await syncSinglePedidoToPrisma(normalOrder1.orderId, restId);

  checkOrdI = await prisma.order.findUnique({
    where: { id: normalOrder1.orderId },
    include: { items: true },
  });
  const item1AfterCancel = checkOrdI!.items.find((i) => i.id === initialOrderItemId)!;
  const item2AfterCancel = checkOrdI!.items.find((i) => i.id === round2OrderItemId)!;
  assert.strictEqual(item1AfterCancel.lineStatus, "ACTIVE", "Línea 1 permanece ACTIVE");
  assert.strictEqual(item2AfterCancel.lineStatus, "CANCELLED", "Línea 2 se marca CANCELLED");
  assert.strictEqual(Number(checkOrdI!.total).toFixed(2), "21.13", "Total se actualiza a $21.13");

  // Comprobar reparto: sólo la línea activa se puede repartir
  const sessionMesa12 = await createTableSessionAction(restId, "Mesa 12");
  assert.ok(sessionMesa12.success && sessionMesa12.session, "Sesión de mesa 12 creada");

  const splitCancelledRes = await calculateProductSplitAction(restId, sessionMesa12.session.id, [
    { orderItemId: round2OrderItemId, quantity: 1 },
  ]);
  assert.ok(splitCancelledRes.error, "Línea cancelada NO debe poder repartirse");
  assert.ok(String(splitCancelledRes.error).includes("cancelado"), "Mensaje debe citar que está cancelado");

  const splitActiveRes = await calculateProductSplitAction(restId, sessionMesa12.session.id, [
    { orderItemId: initialOrderItemId, quantity: 1 },
  ]);
  assert.ok(!splitActiveRes.error && splitActiveRes.success && splitActiveRes.total > 0, "Línea activa SÍ se puede repartir");

  // Cobro oficial en Caja por $21.13
  const settleResI = await settleOrderInCashShiftAction(restId, {
    orderId: normalOrder1.orderId,
    total: 21.13,
    paymentMethod: "EFECTIVO",
    mesa: "Mesa 12",
  });
  assert.ok(settleResI.success, "Cobro oficial de la orden debe completarse con éxito");

  checkOrdI = await prisma.order.findUnique({
    where: { id: normalOrder1.orderId },
    include: { items: true },
  });
  assert.strictEqual(checkOrdI!.status, "COMPLETED", "Orden pasa a COMPLETED");
  assert.strictEqual(Number(checkOrdI!.total).toFixed(2), "21.13", "Total registrado $21.13");

  // 6. Después del cobro, una cancelación operativa no cambia el importe, pago ni turno ya registrados
  await pool.query("UPDATE pedido_items SET estado_item = 'cancelado' WHERE id = $1", [piRound1Id]);
  await syncSinglePedidoToPrisma(normalOrder1.orderId, restId);

  checkOrdI = await prisma.order.findUnique({
    where: { id: normalOrder1.orderId },
    include: { items: true },
  });
  const item1PostCobroCancel = checkOrdI!.items.find((i) => i.id === initialOrderItemId)!;
  assert.strictEqual(item1PostCobroCancel.lineStatus, "CANCELLED", "Línea 1 se marca CANCELLED para trazabilidad");
  assert.strictEqual(checkOrdI!.status, "COMPLETED", "PROTECCIÓN: Estado de la orden cobrada sigue COMPLETED");
  assert.strictEqual(Number(checkOrdI!.total).toFixed(2), "21.13", "PROTECCIÓN: Total cobrado inmutable en $21.13");
  assert.strictEqual(Number(checkOrdI!.subtotal).toFixed(2), "16.90", "PROTECCIÓN: Subtotal cobrado inmutable en $16.90");
  assert.strictEqual(checkOrdI!.cashShiftId, activeShiftId, "PROTECCIÓN: Turno de caja permanece vinculado");
  assert.strictEqual(checkOrdI!.paymentMethod?.toUpperCase(), "EFECTIVO", "PROTECCIÓN: Método de pago permanece inmutable");

  // ---------------------------------------------------------------------------
  // Paso J: FALLO CONTROLADO EN DESPACHO (/api/pedidos), ESTADO PERSISTIDO Y RECUPERACIÓN
  // REGLA: "Fallo controlado durante el despacho, después de la primera línea y antes de confirmar la segunda:
  // comprueba el estado persistido de ambas tablas. No debe quedar ningún vínculo a una fila inexistente.
  // Reintenta el mismo despacho y comprueba exactamente dos líneas, sin duplicados y con vínculos válidos.
  // Cubre tanto el envío normal como la recuperación."
  // ---------------------------------------------------------------------------
  console.log("    • Paso J: Fallo controlado en despacho (/api/pedidos), estado persistido y recuperación reintentada");

  // Reponer stock para las pruebas de fallo controlado
  await prisma.dish.update({
    where: { id: dishGourmetId },
    data: { stock: 50 },
  });

  // 1. Crear comanda con 2 productos desde el productor real
  const failOrder = await createOrderAction({
    restaurantId: restId,
    tableName: "Mesa 13",
    customerName: "Comensal Fallo Controlado",
    paymentMethod: "efectivo",
    items: [
      { dishId: dishGourmetId, quantity: 1, notes: "Paso J Ítem 1" },
      { dishId: dishGourmetId, quantity: 1, notes: "Paso J Ítem 2" },
    ],
  });
  assert.ok(failOrder.success && failOrder.orderId, "Paso J: Orden de 2 ítems creada");
  assert.strictEqual(failOrder.items?.length, 2, "Paso J: Exactamente 2 ítems en la comanda");
  const failItem1Id = failOrder.items![0].id;
  const failItem2Id = failOrder.items![1].id;

  // 2. Inyectar fallo controlado tras insertar la primera línea y antes de confirmar la segunda
  let failureInjectedJ = false;
  __testDispatchHooks.afterItemInsert = async (itemIdx) => {
    if (itemIdx === 1) {
      failureInjectedJ = true;
      throw new Error("ERROR_CONTROLADO_DESPACHO_TRAS_PRIMERA_LINEA");
    }
  };

  const reqFail = new NextRequest("http://localhost:3000/api/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      negocio_id: restId,
      order_id: failOrder.orderId,
      dispatch_token: failOrder.dispatchToken,
      mesa: "Mesa 13",
      tipo_entrega: "MESA",
      metodo_entrega: "MESA",
      items: [
        {
          dishId: dishGourmetId,
          orderItemId: failItem1Id,
          nombre: "Milanesa Stock Gourmet",
          cantidad: 1,
          precio: 16.90,
          notas: "Paso J Ítem 1",
        },
        {
          dishId: dishGourmetId,
          orderItemId: failItem2Id,
          nombre: "Milanesa Stock Gourmet",
          cantidad: 1,
          precio: 16.90,
          notas: "Paso J Ítem 2",
        },
      ],
      total: 42.25,
    }),
  });

  const resFail = await pedidosPostHandler(reqFail);
  assert.strictEqual(resFail.status, 500, "Paso J: El endpoint debe retornar HTTP 500 ante fallo en transacción");
  assert.strictEqual(failureInjectedJ, true, "Paso J: El hook de fallo controlado fue ejecutado");

  // 3. Comprobar el estado persistido de AMBAS tablas:
  // a) En PostgreSQL pedido_items: CERO filas (rollback atómico)
  const pgPiAfterFail = await pool.query(
    "SELECT id FROM pedido_items WHERE pedido_id = $1",
    [failOrder.orderId]
  );
  assert.strictEqual(pgPiAfterFail.rows.length, 0, "Paso J: pedido_items en PostgreSQL tiene 0 filas (rollback confirmado)");

  // b) En Prisma OrderItem: CERO vínculos a filas inexistentes (rollback atómico)
  const prismaItemsAfterFail = await prisma.orderItem.findMany({
    where: { orderId: failOrder.orderId },
  });
  assert.strictEqual(prismaItemsAfterFail.length, 2, "Paso J: OrderItem conserva sus 2 filas");
  assert.strictEqual(prismaItemsAfterFail[0].sourcePedidoItemId, null, "Paso J: Ítem 1 NO conserva vínculo a fila inexistente");
  assert.strictEqual(prismaItemsAfterFail[1].sourcePedidoItemId, null, "Paso J: Ítem 2 NO conserva vínculo a fila inexistente");

  // c) En Prisma Order: kdsDispatched sigue en false
  const prismaOrderAfterFail = await prisma.order.findUnique({
    where: { id: failOrder.orderId },
  });
  assert.strictEqual(prismaOrderAfterFail!.kdsDispatched, false, "Paso J: kdsDispatched permanece false");

  // 4. Reintentar el mismo despacho (recuperación limpia)
  __testDispatchHooks.reset();

  const reqRetry = new NextRequest("http://localhost:3000/api/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      negocio_id: restId,
      order_id: failOrder.orderId,
      dispatch_token: failOrder.dispatchToken,
      mesa: "Mesa 13",
      tipo_entrega: "MESA",
      metodo_entrega: "MESA",
      items: [
        {
          dishId: dishGourmetId,
          orderItemId: failItem1Id,
          nombre: "Milanesa Stock Gourmet",
          cantidad: 1,
          precio: 16.90,
          notas: "Paso J Ítem 1",
        },
        {
          dishId: dishGourmetId,
          orderItemId: failItem2Id,
          nombre: "Milanesa Stock Gourmet",
          cantidad: 1,
          precio: 16.90,
          notas: "Paso J Ítem 2",
        },
      ],
      total: 42.25,
    }),
  });

  const resRetry = await pedidosPostHandler(reqRetry);
  const dataRetry = await resRetry.json();
  assert.strictEqual(resRetry.status, 200, "Paso J: Reintento debe responder HTTP 200");
  assert.strictEqual(dataRetry.ok, true, "Paso J: Reintento debe responder ok: true");

  // 5. Comprobar exactamente dos líneas, sin duplicados y con vínculos válidos
  const pgPiAfterRetry = await pool.query(
    "SELECT id, nombre, notas FROM pedido_items WHERE pedido_id = $1 ORDER BY id",
    [failOrder.orderId]
  );
  assert.strictEqual(pgPiAfterRetry.rows.length, 2, "Paso J: En PostgreSQL existen exactamente 2 líneas (sin duplicados)");

  const prismaItemsAfterRetry = await prisma.orderItem.findMany({
    where: { orderId: failOrder.orderId },
    orderBy: { id: "asc" },
  });
  assert.strictEqual(prismaItemsAfterRetry.length, 2, "Paso J: En Prisma existen exactamente 2 líneas (sin duplicados)");
  assert.ok(prismaItemsAfterRetry[0].sourcePedidoItemId, "Paso J: Ítem 1 tiene vínculo válido");
  assert.ok(prismaItemsAfterRetry[1].sourcePedidoItemId, "Paso J: Ítem 2 tiene vínculo válido");
  assert.notStrictEqual(
    prismaItemsAfterRetry[0].sourcePedidoItemId,
    prismaItemsAfterRetry[1].sourcePedidoItemId,
    "Paso J: Ambos vínculos son distintos"
  );

  // Verificar que los vínculos apunten a filas que realmente existen en PostgreSQL
  const pgIds = pgPiAfterRetry.rows.map((r) => String(r.id));
  assert.ok(pgIds.includes(prismaItemsAfterRetry[0].sourcePedidoItemId!), "Vínculo 1 apunta a fila existente en PostgreSQL");
  assert.ok(pgIds.includes(prismaItemsAfterRetry[1].sourcePedidoItemId!), "Vínculo 2 apunta a fila existente en PostgreSQL");

  const prismaOrderAfterRetry = await prisma.order.findUnique({
    where: { id: failOrder.orderId },
  });
  assert.strictEqual(prismaOrderAfterRetry!.kdsDispatched, true, "Paso J: kdsDispatched es true tras recuperación exitosa");

  // ---------------------------------------------------------------------------
  // Paso K: REGRESIÓN DE REINTENTO CON ORÍGENES EN ORDEN INVERTIDO (AMBAS RAMAS)
  // REGLA: "Repite un despacho ya confirmado con los orígenes devueltos en orden invertido:
  // los vínculos e IDs existentes no cambian y no aparecen duplicados."
  // ---------------------------------------------------------------------------
  console.log("    • Paso K: Reintento confirmado con orígenes invertidos (sin cambios de vínculo ni duplicados)");

  // 1. Rama A: Pedido inicial confirmado (failOrder)
  const origItemsFail = await prisma.orderItem.findMany({
    where: { orderId: failOrder.orderId },
  });
  const linkFail1 = origItemsFail.find((i) => i.id === failItem1Id)!.sourcePedidoItemId!;
  const linkFail2 = origItemsFail.find((i) => i.id === failItem2Id)!.sourcePedidoItemId!;
  assert.ok(linkFail1 && linkFail2, "Paso K: Ambos ítems del pedido inicial deben tener vínculo previo");

  // Reintento enviando los items en orden inverso en el body
  const reqK1 = new NextRequest("http://localhost:3000/api/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      negocio_id: restId,
      order_id: failOrder.orderId,
      dispatch_token: failOrder.dispatchToken,
      mesa: "Mesa 13",
      tipo_entrega: "MESA",
      metodo_entrega: "MESA",
      items: [
        { dishId: dishGourmetId, orderItemId: failItem2Id, nombre: "Milanesa Stock Gourmet", cantidad: 1, precio: 16.90 },
        { dishId: dishGourmetId, orderItemId: failItem1Id, nombre: "Milanesa Stock Gourmet", cantidad: 1, precio: 16.90 },
      ],
      total: 42.25,
    }),
  });
  const resK1 = await pedidosPostHandler(reqK1);
  const dataK1 = await resK1.json();
  assert.strictEqual(resK1.status, 200, "Paso K: Reintento de pedido inicial responde HTTP 200");
  assert.strictEqual(dataK1.ok, true, "Paso K: Reintento responde ok: true");
  assert.strictEqual(dataK1.is_retry, true, "Paso K: Confirmado como reintento idempotente");

  // Verificar que los vínculos e IDs NO cambiaron y no hay duplicados
  const postItemsFail = await prisma.orderItem.findMany({
    where: { orderId: failOrder.orderId },
    orderBy: { id: "asc" },
  });
  assert.strictEqual(postItemsFail.length, 2, "Paso K: Siguen existiendo exactamente 2 OrderItem (cero duplicados)");
  const postFail1 = postItemsFail.find((i) => i.id === failItem1Id)!;
  const postFail2 = postItemsFail.find((i) => i.id === failItem2Id)!;
  assert.strictEqual(postFail1.sourcePedidoItemId, linkFail1, "Vínculo de Ítem 1 intacto tras inversión de orden");
  assert.strictEqual(postFail2.sourcePedidoItemId, linkFail2, "Vínculo de Ítem 2 intacto tras inversión de orden");

  const pgPiK1 = await pool.query("SELECT id FROM pedido_items WHERE pedido_id = $1", [failOrder.orderId]);
  assert.strictEqual(pgPiK1.rows.length, 2, "Paso K: En PostgreSQL siguen existiendo exactamente 2 filas (cero duplicados)");

  // 2. Rama B: Ronda ya procesada (normalOrder1 con round_attempt_id)
  const origItemsRound = await prisma.orderItem.findMany({
    where: { orderId: normalOrder1.orderId },
    orderBy: { id: "asc" },
  });
  const linkR1 = origItemsRound.find((i) => i.id === initialOrderItemId)!.sourcePedidoItemId!;
  const linkR2 = origItemsRound.find((i) => i.id === round2OrderItemId)!.sourcePedidoItemId!;

  const reqK2 = new NextRequest("http://localhost:3000/api/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      negocio_id: restId,
      order_id: normalOrder1.orderId,
      dispatch_token: normalOrder2.dispatchToken,
      is_round: true,
      round_attempt_id: "round-attempt-mesa12-r2",
      mesa: "Mesa 12",
      tipo_entrega: "MESA",
      metodo_entrega: "MESA",
      items: [
        { dishId: dishGourmetId, orderItemId: round2OrderItemId, nombre: "Milanesa Stock Gourmet", cantidad: 1, precio: 16.90 },
      ],
      total: 42.25,
    }),
  });
  const resK2 = await pedidosPostHandler(reqK2);
  const dataK2 = await resK2.json();
  assert.strictEqual(resK2.status, 200, "Paso K: Reintento de ronda procesada responde HTTP 200");
  assert.strictEqual(dataK2.ok, true, "Paso K: Reintento de ronda responde ok: true");

  const postItemsRound = await prisma.orderItem.findMany({
    where: { orderId: normalOrder1.orderId },
    orderBy: { id: "asc" },
  });
  assert.strictEqual(postItemsRound.length, 2, "Paso K: Coexisten exactamente 2 OrderItem en ronda (cero duplicados)");
  assert.strictEqual(postItemsRound.find((i) => i.id === initialOrderItemId)!.sourcePedidoItemId, linkR1, "Vínculo Ronda 1 conservado");
  assert.strictEqual(postItemsRound.find((i) => i.id === round2OrderItemId)!.sourcePedidoItemId, linkR2, "Vínculo Ronda 2 conservado");

  // ---------------------------------------------------------------------------
  // Paso L: SIMULACIÓN DE VÍNCULOS AUSENTES, UNRESOLVED PERSISTIDO Y REPARACIÓN EXPLÍCITA
  // REGLA: "Simula vínculos ausentes en un pedido y en una ronda ya procesada.
  // Con identidad explícita verificable se reparan correctamente aunque cambie el orden;
  // sin ella quedan UNRESOLVED persistidos y el nuevo cobro/reparto se rechaza."
  // ---------------------------------------------------------------------------
  console.log("    • Paso L: Vínculos ausentes: UNRESOLVED persistido / reparación con identidad explícita");

  // 1. Simulación en Pedido Inicial (failOrder):
  // Desvincular el ítem 2 en Prisma para simular desconexión o fallo previo
  await prisma.orderItem.update({
    where: { id: failItem2Id },
    data: { sourcePedidoItemId: null, lineStatus: "ACTIVE" },
  });

  // Intento A: Reintento sin identidad explícita (body sin sourcePedidoItemId)
  const reqL1_NoIdent = new NextRequest("http://localhost:3000/api/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      negocio_id: restId,
      order_id: failOrder.orderId,
      dispatch_token: failOrder.dispatchToken,
      mesa: "Mesa 13",
      tipo_entrega: "MESA",
      metodo_entrega: "MESA",
      items: [
        { dishId: dishGourmetId, orderItemId: failItem1Id, cantidad: 1, precio: 16.90 },
        { dishId: dishGourmetId, orderItemId: failItem2Id, cantidad: 1, precio: 16.90 },
      ],
      total: 42.25,
    }),
  });
  const resL1_NoIdent = await pedidosPostHandler(reqL1_NoIdent);
  assert.strictEqual(resL1_NoIdent.status, 409, "Paso L: Reintento sin identidad explícita debe retornar HTTP 409 (Conciliación Pendiente)");
  const dataL1_NoIdent = await resL1_NoIdent.json();
  assert.strictEqual(dataL1_NoIdent.ok, false, "Paso L: ok es false");
  assert.strictEqual(dataL1_NoIdent.pendingReconciliation, true, "Paso L: pendingReconciliation es true");

  // Verificar persistencia de UNRESOLVED en la base de datos
  let checkL1 = await prisma.orderItem.findUnique({ where: { id: failItem2Id } });
  assert.strictEqual(checkL1!.lineStatus, "UNRESOLVED", "Paso L: Línea afectada queda persistida como UNRESOLVED");
  assert.strictEqual(checkL1!.sourcePedidoItemId, null, "Paso L: No se inventa ningún vínculo espurio");

  let checkOrdFail = await prisma.order.findUnique({ where: { id: failOrder.orderId } });
  assert.strictEqual(checkOrdFail!.kdsDispatched, false, "Paso L: Despacho incompleto NO se marca como kdsDispatched: true");

  // Comprobar bloqueo estricto en Cobro de Caja y Reparto:
  const settleFailRes = await settleOrderInCashShiftAction(restId, {
    orderId: failOrder.orderId,
    total: 42.25,
    paymentMethod: "EFECTIVO",
    mesa: "Mesa 13",
  });
  assert.ok(settleFailRes.error, "Cobro en Caja debe ser rechazado si contiene UNRESOLVED");
  assert.ok(String(settleFailRes.error).includes("UNRESOLVED"), "Error de cobro cita líneas no conciliadas (UNRESOLVED)");

  const sessionMesa13 = await createTableSessionAction(restId, "Mesa 13");
  const splitFailRes = await calculateProductSplitAction(restId, sessionMesa13.session.id, [
    { orderItemId: failItem1Id, quantity: 1 },
  ]);
  assert.ok(splitFailRes.error, "Reparto de comanda debe ser rechazado si contiene UNRESOLVED");
  assert.ok(String(splitFailRes.error).includes("UNRESOLVED"), "Error de reparto cita líneas no conciliadas (UNRESOLVED)");

  // Intento B: Reintento con identidad explícita verificable (en orden invertido)
  const reqL1_Explicit = new NextRequest("http://localhost:3000/api/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      negocio_id: restId,
      order_id: failOrder.orderId,
      dispatch_token: failOrder.dispatchToken,
      mesa: "Mesa 13",
      tipo_entrega: "MESA",
      metodo_entrega: "MESA",
      items: [
        // Orden invertido y con sourcePedidoItemId explícito
        { dishId: dishGourmetId, orderItemId: failItem2Id, sourcePedidoItemId: linkFail2, cantidad: 1, precio: 16.90 },
        { dishId: dishGourmetId, orderItemId: failItem1Id, sourcePedidoItemId: linkFail1, cantidad: 1, precio: 16.90 },
      ],
      total: 42.25,
    }),
  });
  const resL1_Explicit = await pedidosPostHandler(reqL1_Explicit);
  assert.strictEqual(resL1_Explicit.status, 200, "Paso L: Reintento con identidad explícita retorna HTTP 200");
  const dataL1_Explicit = await resL1_Explicit.json();
  assert.strictEqual(dataL1_Explicit.ok, true, "Paso L: ok es true tras reparación explícita");

  checkL1 = await prisma.orderItem.findUnique({ where: { id: failItem2Id } });
  assert.strictEqual(checkL1!.lineStatus, "ACTIVE", "Paso L: Línea reparada pasa a ACTIVE");
  assert.strictEqual(checkL1!.sourcePedidoItemId, linkFail2, "Paso L: Vínculo reparado con su origen explícito verificado");

  checkOrdFail = await prisma.order.findUnique({ where: { id: failOrder.orderId } });
  assert.strictEqual(checkOrdFail!.kdsDispatched, true, "Paso L: kdsDispatched pasa a true tras reparación completa");

  // 2. Simulación en Ronda Ya Procesada (normalOrder1):
  // Desvincular ronda 2 en Prisma
  await prisma.orderItem.update({
    where: { id: round2OrderItemId },
    data: { sourcePedidoItemId: null, lineStatus: "ACTIVE" },
  });

  // Intento A: Reintento de ronda sin identidad explícita
  const reqL2_NoIdent = new NextRequest("http://localhost:3000/api/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      negocio_id: restId,
      order_id: normalOrder1.orderId,
      dispatch_token: normalOrder2.dispatchToken,
      is_round: true,
      round_attempt_id: "round-attempt-mesa12-r2",
      mesa: "Mesa 12",
      tipo_entrega: "MESA",
      metodo_entrega: "MESA",
      items: [{ dishId: dishGourmetId, orderItemId: round2OrderItemId, cantidad: 1, precio: 16.90 }],
      total: 42.25,
    }),
  });
  const resL2_NoIdent = await pedidosPostHandler(reqL2_NoIdent);
  assert.strictEqual(resL2_NoIdent.status, 409, "Paso L: Reintento de ronda sin identidad retorna HTTP 409");
  let checkL2 = await prisma.orderItem.findUnique({ where: { id: round2OrderItemId } });
  assert.strictEqual(checkL2!.lineStatus, "UNRESOLVED", "Paso L: Ronda desvinculada queda UNRESOLVED");
  assert.strictEqual(checkL2!.sourcePedidoItemId, null, "Paso L: Ronda desvinculada no inventa enlace");

  // Intento B: Reintento de ronda con identidad explícita verificable
  const reqL2_Explicit = new NextRequest("http://localhost:3000/api/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      negocio_id: restId,
      order_id: normalOrder1.orderId,
      dispatch_token: normalOrder2.dispatchToken,
      is_round: true,
      round_attempt_id: "round-attempt-mesa12-r2",
      mesa: "Mesa 12",
      tipo_entrega: "MESA",
      metodo_entrega: "MESA",
      items: [
        { dishId: dishGourmetId, orderItemId: round2OrderItemId, sourcePedidoItemId: linkR2, cantidad: 1, precio: 16.90 },
      ],
      total: 42.25,
    }),
  });
  const resL2_Explicit = await pedidosPostHandler(reqL2_Explicit);
  assert.strictEqual(resL2_Explicit.status, 200, "Paso L: Reintento de ronda con identidad explícita retorna HTTP 200");
  checkL2 = await prisma.orderItem.findUnique({ where: { id: round2OrderItemId } });
  assert.strictEqual(checkL2!.lineStatus, "ACTIVE", "Paso L: Ronda reparada pasa a ACTIVE");
  assert.strictEqual(checkL2!.sourcePedidoItemId, linkR2, "Paso L: Ronda reparada con su origen verificado");

  // ---------------------------------------------------------------------------
  // Paso M: UN ORIGEN COMO MÁXIMO UNA VEZ Y CANCELACIÓN SELECTIVA 1A1
  // REGLA: "Comprueba que cada origen se usa como máximo una vez y que cancelar una línea
  // afecta únicamente a la que le corresponde."
  // ---------------------------------------------------------------------------
  console.log("    • Paso M: Cada origen se usa como máximo 1 vez y cancelación selectiva 1a1");

  // 1. Simular desvinculación de ambas líneas en failOrder
  await prisma.orderItem.updateMany({
    where: { orderId: failOrder.orderId },
    data: { sourcePedidoItemId: null, lineStatus: "ACTIVE" },
  });

  // Intentar asignar el MISMO sourcePedidoItemId (linkFail1) a ambas líneas
  const reqM_DuplicateOrigin = new NextRequest("http://localhost:3000/api/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      negocio_id: restId,
      order_id: failOrder.orderId,
      dispatch_token: failOrder.dispatchToken,
      mesa: "Mesa 13",
      tipo_entrega: "MESA",
      metodo_entrega: "MESA",
      items: [
        { dishId: dishGourmetId, orderItemId: failItem1Id, sourcePedidoItemId: linkFail1, cantidad: 1, precio: 16.90 },
        { dishId: dishGourmetId, orderItemId: failItem2Id, sourcePedidoItemId: linkFail1, cantidad: 1, precio: 16.90 }, // MISMO ORIGEN INTENCIONAL
      ],
      total: 42.25,
    }),
  });

  const resM_Dup = await pedidosPostHandler(reqM_DuplicateOrigin);
  assert.strictEqual(resM_Dup.status, 409, "Paso M: Intento de reutilizar mismo origen debe dejar conciliación pendiente (HTTP 409)");

  const itemsAfterDup = await prisma.orderItem.findMany({
    where: { orderId: failOrder.orderId },
    orderBy: { id: "asc" },
  });
  const item1Dup = itemsAfterDup.find((i) => i.id === failItem1Id)!;
  const item2Dup = itemsAfterDup.find((i) => i.id === failItem2Id)!;

  // Un ítem reclama linkFail1, el segundo NO puede reclamarlo y queda UNRESOLVED
  assert.strictEqual(item1Dup.sourcePedidoItemId, linkFail1, "Ítem 1 reclama el origen disponible");
  assert.strictEqual(item2Dup.sourcePedidoItemId, null, "Ítem 2 no puede reclamar el origen duplicado");
  assert.strictEqual(item2Dup.lineStatus, "UNRESOLVED", "Ítem 2 queda UNRESOLVED");

  // Reparar limpiamente el ítem 2 con su origen real (linkFail2)
  const reqM_Fix = new NextRequest("http://localhost:3000/api/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      negocio_id: restId,
      order_id: failOrder.orderId,
      dispatch_token: failOrder.dispatchToken,
      mesa: "Mesa 13",
      tipo_entrega: "MESA",
      metodo_entrega: "MESA",
      items: [
        { dishId: dishGourmetId, orderItemId: failItem2Id, sourcePedidoItemId: linkFail2, cantidad: 1, precio: 16.90 },
      ],
      total: 42.25,
    }),
  });
  const resM_Fix = await pedidosPostHandler(reqM_Fix);
  assert.strictEqual(resM_Fix.status, 200, "Paso M: Reparación con origen único no reclamado responde HTTP 200");

  const itemsFixed = await prisma.orderItem.findMany({
    where: { orderId: failOrder.orderId },
    orderBy: { id: "asc" },
  });
  const fixedItem1 = itemsFixed.find((i) => i.id === failItem1Id)!;
  const fixedItem2 = itemsFixed.find((i) => i.id === failItem2Id)!;
  assert.strictEqual(fixedItem1.sourcePedidoItemId, linkFail1, "Ítem 1 vinculado a linkFail1");
  assert.strictEqual(fixedItem2.sourcePedidoItemId, linkFail2, "Ítem 2 vinculado a linkFail2");
  assert.notStrictEqual(fixedItem1.sourcePedidoItemId, fixedItem2.sourcePedidoItemId, "Orígenes estrictamente distintos");

  // 2. Comprobar que cancelar una línea afecta ÚNICAMENTE a la que le corresponde:
  await pool.query("UPDATE pedido_items SET estado_item = 'cancelado' WHERE id = $1", [linkFail1]);
  await syncSinglePedidoToPrisma(failOrder.orderId, restId);

  const itemsAfterCancel1 = await prisma.orderItem.findMany({
    where: { orderId: failOrder.orderId },
    orderBy: { id: "asc" },
  });
  const item1Cancelled = itemsAfterCancel1.find((i) => i.id === failItem1Id)!;
  const item2Cancelled = itemsAfterCancel1.find((i) => i.id === failItem2Id)!;

  assert.strictEqual(item1Cancelled.lineStatus, "CANCELLED", "Línea cancelada en origen pasa a CANCELLED");
  assert.strictEqual(item2Cancelled.lineStatus, "ACTIVE", "Línea no cancelada permanece estrictamente ACTIVE");
  assert.strictEqual(item1Cancelled.sourcePedidoItemId, linkFail1, "Vínculo de línea 1 se conserva");
  assert.strictEqual(item2Cancelled.sourcePedidoItemId, linkFail2, "Vínculo de línea 2 se conserva");

  // ---------------------------------------------------------------------------
  // Paso N: REGRESIÓN DE RECUPERADOR AUTOMÁTICO ANTE COMANDAS CON CONCILIACIÓN PENDIENTE (UNRESOLVED)
  // Y CONTROL DE COMANDA LEGÍTIMA ACTIVE SIN DESPACHAR
  // ---------------------------------------------------------------------------
  console.log("    • Paso N: Recuperador automático protege UNRESOLVED y no bloquea pedidos legítimos");

  // 1. Crear comanda para Paso N y despacharla inicialmente
  const orderN = await createOrderAction({
    restaurantId: restId,
    tableName: "Mesa 14",
    customerName: "Comensal Paso N Recuperador",
    paymentMethod: "efectivo",
    items: [
      { dishId: dishGourmetId, quantity: 1, notes: "Paso N Ítem 1" },
      { dishId: dishGourmetId, quantity: 1, notes: "Paso N Ítem 2" },
    ],
  });
  assert.ok(orderN.success && orderN.orderId, "Paso N: Comanda creada");
  const nItem1Id = orderN.items![0].id;
  const nItem2Id = orderN.items![1].id;

  // Despacho inicial exitoso
  const reqN_Init = new NextRequest("http://localhost:3000/api/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      negocio_id: restId,
      order_id: orderN.orderId,
      dispatch_token: orderN.dispatchToken,
      mesa: "Mesa 14",
      tipo_entrega: "MESA",
      metodo_entrega: "MESA",
      items: [
        { dishId: dishGourmetId, orderItemId: nItem1Id, cantidad: 1, precio: 16.90 },
        { dishId: dishGourmetId, orderItemId: nItem2Id, cantidad: 1, precio: 16.90 },
      ],
      total: 42.25,
    }),
  });
  const resN_Init = await pedidosPostHandler(reqN_Init);
  assert.strictEqual(resN_Init.status, 200, "Paso N: Despacho inicial exitoso HTTP 200");

  const origNItems = await prisma.orderItem.findMany({
    where: { orderId: orderN.orderId },
    orderBy: { id: "asc" },
  });
  const originN1 = origNItems.find((i) => i.id === nItem1Id)!.sourcePedidoItemId!;
  const originN2 = origNItems.find((i) => i.id === nItem2Id)!.sourcePedidoItemId!;
  assert.ok(originN1 && originN2, "Paso N: Ambos orígenes asignados inicialmente");

  // Subpaso 1: Provocar reintento sin identidad:
  // Desvinculamos el ítem 2 en Prisma para simular pérdida de vínculo/ambigüedad
  await prisma.orderItem.update({
    where: { id: nItem2Id },
    data: { sourcePedidoItemId: null, lineStatus: "ACTIVE" },
  });

  // Reintento sin identidad explícita para la línea desvinculada
  const reqN_RetryNoId = new NextRequest("http://localhost:3000/api/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      negocio_id: restId,
      order_id: orderN.orderId,
      dispatch_token: orderN.dispatchToken,
      mesa: "Mesa 14",
      tipo_entrega: "MESA",
      metodo_entrega: "MESA",
      items: [
        { dishId: dishGourmetId, orderItemId: nItem1Id, sourcePedidoItemId: originN1, cantidad: 1, precio: 16.90 },
        { dishId: dishGourmetId, cantidad: 1, precio: 16.90 }, // Sin identidad explícita para nItem2Id
      ],
      total: 42.25,
    }),
  });
  const resN_RetryNoId = await pedidosPostHandler(reqN_RetryNoId);
  assert.strictEqual(resN_RetryNoId.status, 409, "Paso N (1): Reintento sin identidad responde HTTP 409");
  const dataN_RetryNoId = await resN_RetryNoId.json();
  assert.strictEqual(dataN_RetryNoId.pendingReconciliation, true, "Paso N (1): pendingReconciliation es true");

  // Verificar persistencia de UNRESOLVED y kdsDispatched: false
  const itemN2_Unres = await prisma.orderItem.findUnique({ where: { id: nItem2Id } });
  assert.strictEqual(itemN2_Unres!.lineStatus, "UNRESOLVED", "Paso N (1): Línea queda persistida como UNRESOLVED");
  assert.strictEqual(itemN2_Unres!.sourcePedidoItemId, null, "Paso N (1): Sin vínculo inventado");

  const ordN_Unres = await prisma.order.findUnique({ where: { id: orderN.orderId } });
  assert.strictEqual(ordN_Unres!.kdsDispatched, false, "Paso N (1): Comanda tiene kdsDispatched = false");

  // Snapshot previo a la consulta GET
  const pgPiBeforeGet = await pool.query("SELECT id FROM pedido_items WHERE pedido_id = $1 ORDER BY id", [orderN.orderId]);
  const pgPiCountBefore = pgPiBeforeGet.rows.length;
  const pgPiIdsBefore = pgPiBeforeGet.rows.map((r) => String(r.id));
  assert.strictEqual(pgPiCountBefore, 2, "Paso N: Exactamente 2 filas previas en pedido_items");

  // Subpaso 2: Consulta GET /api/pedidos y ejecución/espera del recuperador pasivo
  const reqGet1 = new NextRequest(`http://localhost:3000/api/pedidos?negocio_id=${restId}`, {
    headers: { authorization: `Bearer ${superAdminToken}` },
  });
  const resGet1 = await pedidosGetHandler(reqGet1);
  assert.strictEqual(resGet1.status, 200, "Paso N (2): Primera consulta GET responde HTTP 200");

  // Ejecución / espera explícita del recuperador
  const recPass1 = await reconcileUndispatchedOrders(restId);
  assert.strictEqual(recPass1, 0, "Paso N (2): Recuperador omite comanda con UNRESOLVED (0 recuperados para comanda ambigua)");

  // Comprobar estado en ambas tablas tras GET:
  // a) PostgreSQL: mismos IDs y conteos, cero orígenes nuevos
  const pgPiAfterGet1 = await pool.query("SELECT id FROM pedido_items WHERE pedido_id = $1 ORDER BY id", [orderN.orderId]);
  assert.strictEqual(pgPiAfterGet1.rows.length, pgPiCountBefore, "Paso N (2): Mismo conteo de orígenes en PostgreSQL");
  assert.deepStrictEqual(pgPiAfterGet1.rows.map((r) => String(r.id)), pgPiIdsBefore, "Paso N (2): Mismos IDs de origen en PostgreSQL (cero orígenes nuevos)");

  // b) Prisma: mismos IDs y conteos, línea todavía UNRESOLVED sin vínculo inventado, despacho pendiente
  const prismaItemsAfterGet1 = await prisma.orderItem.findMany({
    where: { orderId: orderN.orderId },
    orderBy: { id: "asc" },
  });
  assert.strictEqual(prismaItemsAfterGet1.length, 2, "Paso N (2): Mismo conteo en OrderItem");
  const itemN2_AfterGet1 = prismaItemsAfterGet1.find((i) => i.id === nItem2Id)!;
  assert.strictEqual(itemN2_AfterGet1.lineStatus, "UNRESOLVED", "Paso N (2): Línea sigue siendo estrictamente UNRESOLVED");
  assert.strictEqual(itemN2_AfterGet1.sourcePedidoItemId, null, "Paso N (2): Sigue sin vínculo espurio");

  const ordN_AfterGet1 = await prisma.order.findUnique({ where: { id: orderN.orderId } });
  assert.strictEqual(ordN_AfterGet1!.kdsDispatched, false, "Paso N (2): Despacho continúa pendiente (kdsDispatched: false)");

  // Repetir la consulta GET para verificar que el estado se conserva intacto
  const reqGet2 = new NextRequest(`http://localhost:3000/api/pedidos?negocio_id=${restId}`, {
    headers: { authorization: `Bearer ${superAdminToken}` },
  });
  const resGet2 = await pedidosGetHandler(reqGet2);
  assert.strictEqual(resGet2.status, 200, "Paso N (2): Segunda consulta GET responde HTTP 200");
  const recPass2 = await reconcileUndispatchedOrders(restId);
  assert.strictEqual(recPass2, 0, "Paso N (2): Segundo pase del recuperador sigue omitiendo comanda ambigua");

  const pgPiAfterGet2 = await pool.query("SELECT id FROM pedido_items WHERE pedido_id = $1 ORDER BY id", [orderN.orderId]);
  assert.strictEqual(pgPiAfterGet2.rows.length, pgPiCountBefore, "Paso N (2): Repetición conserva conteo exacto en PostgreSQL");
  const ordN_AfterGet2 = await prisma.order.findUnique({ where: { id: orderN.orderId } });
  assert.strictEqual(ordN_AfterGet2!.kdsDispatched, false, "Paso N (2): Repetición conserva despacho pendiente");

  // Subpaso 3: Comprobar que Caja y reparto sigan rechazando la comanda
  const settleN_Fail = await settleOrderInCashShiftAction(restId, {
    orderId: orderN.orderId,
    total: 42.25,
    paymentMethod: "EFECTIVO",
    mesa: "Mesa 14",
  });
  assert.ok(settleN_Fail.error, "Paso N (3): Caja debe rechazar comanda con conciliación pendiente");
  assert.ok(String(settleN_Fail.error).includes("UNRESOLVED"), "Paso N (3): Error de cobro cita líneas no conciliadas (UNRESOLVED)");

  const sessionMesa14 = await createTableSessionAction(restId, "Mesa 14");
  const splitN_Fail = await calculateProductSplitAction(restId, sessionMesa14.session.id, [
    { orderItemId: nItem1Id, quantity: 1 },
  ]);
  assert.ok(splitN_Fail.error, "Paso N (3): Reparto debe rechazar comanda con conciliación pendiente");
  assert.ok(String(splitN_Fail.error).includes("UNRESOLVED"), "Paso N (3): Error de reparto cita líneas no conciliadas (UNRESOLVED)");

  // Subpaso 4: Resolver con identidad explícita válida y verificar que el flujo continúe sin duplicar orígenes
  const reqN_Resolve = new NextRequest("http://localhost:3000/api/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      negocio_id: restId,
      order_id: orderN.orderId,
      dispatch_token: orderN.dispatchToken,
      mesa: "Mesa 14",
      tipo_entrega: "MESA",
      metodo_entrega: "MESA",
      items: [
        { dishId: dishGourmetId, orderItemId: nItem1Id, sourcePedidoItemId: originN1, cantidad: 1, precio: 16.90 },
        { dishId: dishGourmetId, orderItemId: nItem2Id, sourcePedidoItemId: originN2, cantidad: 1, precio: 16.90 },
      ],
      total: 42.25,
    }),
  });
  const resN_Resolve = await pedidosPostHandler(reqN_Resolve);
  assert.strictEqual(resN_Resolve.status, 200, "Paso N (4): Resolución con identidad explícita responde HTTP 200");
  const dataN_Resolve = await resN_Resolve.json();
  assert.strictEqual(dataN_Resolve.ok, true, "Paso N (4): ok: true tras resolución");

  // Verificar que la comanda pasa a kdsDispatched: true y ambas líneas están ACTIVE
  const ordN_Resolved = await prisma.order.findUnique({ where: { id: orderN.orderId } });
  assert.strictEqual(ordN_Resolved!.kdsDispatched, true, "Paso N (4): kdsDispatched pasa a true");

  const itemsN_Resolved = await prisma.orderItem.findMany({
    where: { orderId: orderN.orderId },
    orderBy: { id: "asc" },
  });
  assert.strictEqual(itemsN_Resolved[0].lineStatus, "ACTIVE", "Paso N (4): Ítem 1 ACTIVE");
  assert.strictEqual(itemsN_Resolved[1].lineStatus, "ACTIVE", "Paso N (4): Ítem 2 pasa a ACTIVE");
  assert.strictEqual(itemsN_Resolved[0].sourcePedidoItemId, originN1, "Paso N (4): Ítem 1 vinculado a originN1");
  assert.strictEqual(itemsN_Resolved[1].sourcePedidoItemId, originN2, "Paso N (4): Ítem 2 vinculado a originN2");

  // Verificar en PostgreSQL: CERO orígenes duplicados (siguen existiendo exactamente las 2 filas originales)
  const pgPiAfterResolve = await pool.query("SELECT id FROM pedido_items WHERE pedido_id = $1 ORDER BY id", [orderN.orderId]);
  assert.strictEqual(pgPiAfterResolve.rows.length, 2, "Paso N (4): Exactamente 2 filas en pedido_items (CERO duplicados)");
  assert.deepStrictEqual(pgPiAfterResolve.rows.map((r) => String(r.id)), pgPiIdsBefore, "Paso N (4): Mismos orígenes confirmados sin duplicación");

  // Control: Pedido legítimo ACTIVE con source null sin despachar no queda bloqueado
  console.log("    • Paso N (Control): Pedido legítimo ACTIVE con source null es despachado normalmente");
  const legitOrder = await prisma.order.create({
    data: {
      restaurantId: restId,
      tableName: "Mesa 15",
      customerName: "Comensal Legítimo POS/Web",
      paymentMethod: "EFECTIVO",
      status: "PENDING",
      subtotal: 16.90,
      iva: 2.54,
      serviceCharge: 1.69,
      tip: 0.0,
      total: 21.13,
      kdsDispatched: false,
      items: {
        create: [
          {
            dishName: "Milanesa Stock Gourmet",
            price: 16.90,
            quantity: 1,
            lineStatus: "ACTIVE",
            sourcePedidoItemId: null,
          },
        ],
      },
    },
    include: { items: true },
  });

  assert.strictEqual(legitOrder.kdsDispatched, false, "Control: Pedido legítimo inicialmente sin despachar");
  assert.strictEqual(legitOrder.items[0].lineStatus, "ACTIVE", "Control: Línea legítima tiene lineStatus = ACTIVE");
  assert.strictEqual(legitOrder.items[0].sourcePedidoItemId, null, "Control: Línea legítima inicialmente sourcePedidoItemId = null");

  // Ejecutar el recuperador automático
  const recLegitCount = await reconcileUndispatchedOrders(restId);
  assert.ok(recLegitCount >= 1, "Control: El recuperador procesa y despacha la orden legítima ACTIVE");

  const legitOrderAfterRec = await prisma.order.findUnique({
    where: { id: legitOrder.id },
    include: { items: true },
  });
  assert.strictEqual(legitOrderAfterRec!.kdsDispatched, true, "Control: Orden legítima marcada como kdsDispatched: true");
  assert.strictEqual(legitOrderAfterRec!.items[0].lineStatus, "ACTIVE", "Control: Línea legítima permanece ACTIVE");
  assert.ok(legitOrderAfterRec!.items[0].sourcePedidoItemId, "Control: Línea legítima recibe su vínculo a pedido_items");

  const pgPiLegit = await pool.query("SELECT id, pedido_id, nombre FROM pedido_items WHERE pedido_id = $1", [legitOrder.id]);
  assert.strictEqual(pgPiLegit.rows.length, 1, "Control: Exactamente 1 fila creada en pedido_items para la orden legítima");
  assert.strictEqual(String(pgPiLegit.rows[0].id), legitOrderAfterRec!.items[0].sourcePedidoItemId, "Control: sourcePedidoItemId coincide con la fila creada en PostgreSQL");

  const pgPlegit = await pool.query("SELECT id, total FROM pedidos WHERE id = $1", [legitOrder.id]);
  assert.strictEqual(pgPlegit.rows.length, 1, "Control: Fila creada en pedidos de PostgreSQL para la orden legítima");

  console.log("  ✅ [PASS] Escenario 4: Cancelación posterior progresiva, protección de cobrados, ambigüedad estricta, compatibilidad de cantidad y rondas reales verificadas.\n");

  // ---------------------------------------------------------------------------
  // ESCENARIO 5: REINTENTO CON FALLO REAL INDUCIDO E IDEMPOTENCIA CONCURRENTE
  // Induce un fallo real de red/DB durante la sincronización y verifica recuperación idempotente
  // ---------------------------------------------------------------------------
  console.log("▶ Escenario 5: Reintento con fallo real inducido e idempotencia");
  let failureInjected = true;
  __testOrderSyncHooks.beforeSingleSyncLock = async () => {
    if (failureInjected) {
      throw new Error("ERROR_TRANSITORIO_CONEXION_INDUCIDO: Fallo simulado de red en hook");
    }
  };

  let caughtError: any = null;
  try {
    await syncSinglePedidoToPrisma(ped1Id, restId);
  } catch (err: any) {
    caughtError = err;
  }
  assert.ok(caughtError, "El intento de sincronización debió fallar por el error inducido");
  assert.ok(
    String(caughtError.message).includes("ERROR_TRANSITORIO_CONEXION_INDUCIDO"),
    "El error capturado debe ser el inducido"
  );

  // Desactivar inyección de fallo y reintentar 5 veces consecutivas
  failureInjected = false;
  __testOrderSyncHooks.beforeSingleSyncLock = null;

  for (let i = 0; i < 5; i++) {
    await syncSinglePedidoToPrisma(ped1Id, restId);
  }

  const order1Reintento = await prisma.order.findUnique({
    where: { id: ped1Id },
    include: { items: true },
  });
  assert.strictEqual(order1Reintento!.items.length, 1, "Cinco reintentos consecutivos conservan exactamente 1 línea");
  assert.strictEqual(order1Reintento!.status, "COMPLETED", "Conserva estado cobrado");
  assert.strictEqual(Number(order1Reintento!.total).toFixed(2), "21.13", "Conserva total exacto");
  console.log("  ✅ [PASS] Escenario 5: Fallo real inducido manejado exitosamente y 5 reintentos 100% idempotentes.\n");

  // ---------------------------------------------------------------------------
  // ESCENARIO 6: VENTA DIRECTA REAL EN CAJA (processCajaSaleAction): STOCK + COBRO + CRM
  // Descuento estricto de bodega, registro contable de cobro en CashShift y fidelización CRM
  // ---------------------------------------------------------------------------
  console.log("▶ Escenario 6: Venta directa en Caja (processCajaSaleAction): 1 descuento stock, 1 cobro, 1 CRM y $42.25");

  // Restablecer stock del plato para Escenario 6
  const dishGourmet = await prisma.dish.update({
    where: { id: dishGourmetId },
    data: {
      stock: 10,
      trackStock: true,
      isAvailable: true,
    },
  });

  // Crear cliente CRM para auditar fidelización y estadísticas
  const testPhone = "0998887777";
  await prisma.customer.create({
    data: {
      restaurantId: restId,
      name: "Cliente CRM Ensayo",
      phone: testPhone,
      totalOrders: 0,
      totalSpent: 0.0,
    },
  });

  const shiftBeforeSale = await prisma.cashShift.findUnique({ where: { id: activeShiftId } });
  const initialSales = Number(shiftBeforeSale!.totalSales);

  // Venta POS 1: 1 unidad de $16.90 (IVA 15% = 2.54, Servicio 10% = 1.69 -> Total $21.13)
  const posSale1Res = await processCajaSaleAction(restId, {
    items: [{ dishId: dishGourmet.id, quantity: 1, price: 16.90, name: "Milanesa Stock Gourmet" }],
    paymentMethod: "EFECTIVO",
    customerPhone: testPhone,
    customerName: "Cliente CRM Ensayo",
    iva: 2.54,
    serviceCharge: 1.69,
    total: 21.13,
  });
  assert.strictEqual(posSale1Res.success, true, "Venta directa en Caja debe ser exitosa");

  // Verificación 1: 1 descuento de stock en bodega
  const dishAfterSale1 = await prisma.dish.findUnique({ where: { id: dishGourmet.id } });
  assert.strictEqual(dishAfterSale1!.stock, 9, "Stock debe haberse descontado de 10 a 9");

  // Verificación 2: 1 cobro en Caja / CashShift
  const shiftAfterSale1 = await prisma.cashShift.findUnique({ where: { id: activeShiftId } });
  const expectedSales1 = Math.round((initialSales + 21.13) * 100) / 100;
  assert.strictEqual(Number(shiftAfterSale1!.totalSales).toFixed(2), expectedSales1.toFixed(2), "CashShift.totalSales debe incrementarse en $21.13");

  // Verificación 3: 1 actualización en CRM
  const custAfterSale1 = await prisma.customer.findFirst({ where: { restaurantId: restId, phone: testPhone } });
  assert.strictEqual(custAfterSale1!.totalOrders, 1, "CRM: totalOrders debe incrementar de 0 a 1");
  assert.strictEqual(Number(custAfterSale1!.totalSpent).toFixed(2), "21.13", "CRM: totalSpent debe incrementar en $21.13");

  // Venta POS 2: 2 unidades de $16.90 ($33.80 base, IVA $5.07, Servicio $3.38 -> Total $42.25)
  const posSale2Res = await processCajaSaleAction(restId, {
    items: [{ dishId: dishGourmet.id, quantity: 2, price: 16.90, name: "Milanesa Stock Gourmet" }],
    paymentMethod: "EFECTIVO",
    customerPhone: testPhone,
    customerName: "Cliente CRM Ensayo",
    iva: 5.07,
    serviceCharge: 3.38,
    total: 42.25,
  });
  assert.strictEqual(posSale2Res.success, true, "Venta directa de 2 unidades debe ser exitosa");

  // Verificación de stock para venta 2: debe descontar 2 unidades más (queda en 7)
  const dishAfterSale2 = await prisma.dish.findUnique({ where: { id: dishGourmet.id } });
  assert.strictEqual(dishAfterSale2!.stock, 7, "Stock debe haberse descontado de 9 a 7 tras vender 2 unidades");

  // Verificación de CRM para venta 2: 2 órdenes, gasto acumulado $21.13 + $42.25 = $63.38
  const custAfterSale2 = await prisma.customer.findFirst({ where: { restaurantId: restId, phone: testPhone } });
  assert.strictEqual(custAfterSale2!.totalOrders, 2, "CRM: totalOrders debe ser 2");
  assert.strictEqual(Number(custAfterSale2!.totalSpent).toFixed(2), "63.38", "CRM: totalSpent acumulado debe ser $63.38");

  // Verificación de importe monetario exacto de la venta 2 en Order y persistencia de items POS
  const orderSale1 = await prisma.order.findUnique({
    where: { id: posSale1Res.orderId },
    include: { items: true },
  });
  assert.ok(orderSale1!.items[0].sourcePedidoItemId, "POS directo despachado tiene correspondencia explícita en sourcePedidoItemId");
  assert.strictEqual(orderSale1!.items[0].lineStatus, "ACTIVE", "POS directo tiene lineStatus = ACTIVE");

  const orderSale2 = await prisma.order.findUnique({
    where: { id: posSale2Res.orderId },
    include: { items: true },
  });
  assert.strictEqual(Number(orderSale2!.subtotal).toFixed(2), "33.80", "Venta directa subtotal debe ser $33.80");
  assert.strictEqual(Number(orderSale2!.iva).toFixed(2), "5.07", "Venta directa IVA debe ser $5.07");
  assert.strictEqual(Number(orderSale2!.serviceCharge).toFixed(2), "3.38", "Venta directa Servicio debe ser $3.38");
  assert.strictEqual(Number(orderSale2!.total).toFixed(2), "42.25", "Venta directa Total debe ser exactamente $42.25");
  assert.ok(orderSale2!.items[0].sourcePedidoItemId, "POS directo venta 2 tiene correspondencia explícita en sourcePedidoItemId");
  assert.strictEqual(orderSale2!.items[0].lineStatus, "ACTIVE", "POS directo venta 2 tiene lineStatus = ACTIVE");

  console.log("  ✅ [PASS] Escenario 6: Venta directa en Caja ejecutada con funciones reales certificando stock (10->9->7), cobro ($21.13 y $42.25) y CRM (1->2 órdenes, $63.38).\n");

  console.log("===============================================================================");
  console.log("🎉 RECORRIDO COMPLETO E2E EN BASE AISLADA SUPERADO CON ÉXITO");
  console.log("===============================================================================");

  await prisma.$disconnect();
  await pool.end();
}

runSuite().catch((err) => {
  console.error("❌ ERROR EN SUITE E2E AISLADA:", err);
  process.exit(1);
});
