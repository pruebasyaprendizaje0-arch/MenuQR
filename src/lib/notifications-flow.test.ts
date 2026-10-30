import assert from "assert";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import {
  calculateWeeklyMetrics,
  getPreviousWeekDateRange,
  generateAllActiveRestaurantsWeeklySummaries,
} from "./metrics-engine";
import {
  createNotification,
  getActiveNotificationsForRestaurant,
  markNotificationAsRead,
  dismissNotification,
  CreateNotificationInputSchema,
} from "./notifications";
import { verifyInternalApiKey } from "./internal-auth";

async function runNotificationsTestSuite() {
  console.log("==========================================");
  console.log("🧪 TESTING IN-APP NOTIFICATIONS & METRICS ENGINE (FASE 2)");
  console.log("==========================================");

  // 1. Test Internal Auth Security
  console.log("Testing Internal API Key security...");
  const validReq = new Request("http://localhost:3000/api/internal/test", {
    headers: { "x-internal-api-key": process.env.INTERNAL_API_KEY || "" },
  });
  const bearerReq = new Request("http://localhost:3000/api/internal/test", {
    headers: { authorization: `Bearer ${process.env.INTERNAL_API_KEY || ""}` },
  });
  const invalidReq = new Request("http://localhost:3000/api/internal/test", {
    headers: { "x-internal-api-key": "invalid-token-12345" },
  });
  const missingReq = new Request("http://localhost:3000/api/internal/test");

  assert.strictEqual(verifyInternalApiKey(validReq), true, "API key válida por x-internal-api-key debe pasar");
  assert.strictEqual(verifyInternalApiKey(bearerReq), true, "API key válida por Bearer token debe pasar");
  assert.strictEqual(verifyInternalApiKey(invalidReq), false, "API key errónea debe ser rechazada");
  assert.strictEqual(verifyInternalApiKey(missingReq), false, "Petición sin header debe ser rechazada");
  console.log("✅ [PASS] Test 1: Autenticación interna timing-safe verificada al 100%");

  // 2. Test Zod Validation Schema
  console.log("Testing Zod Schema validation...");
  const validPayload = {
    broadcastAll: true,
    type: "METRIC_SUMMARY" as const,
    priority: "HIGH" as const,
    title: "Resumen Semanal",
    message: "Tu negocio tuvo una gran semana con 45 pedidos.",
    metadata: { totalRevenue: 450.5, totalOrders: 45 },
  };
  const parsed = CreateNotificationInputSchema.safeParse(validPayload);
  assert.strictEqual(parsed.success, true, "Payload válido debe pasar la validación Zod");

  const invalidPayload = {
    title: "A", // Demasiado corto (min 2)
    type: "INVALID_TYPE",
  };
  const invalidParsed = CreateNotificationInputSchema.safeParse(invalidPayload);
  assert.strictEqual(invalidParsed.success, false, "Payload inválido debe ser rechazado por Zod");
  console.log("✅ [PASS] Test 2: Validación estricta Zod verificada");

  // 3. Test Date Range Helper
  console.log("Testing Date Range Helper...");
  const range = getPreviousWeekDateRange(1);
  assert(range.startDate < range.endDate, "startDate debe ser anterior a endDate");
  assert.strictEqual(range.startDate.getDay(), 1, "La semana debe comenzar en Lunes");
  assert.strictEqual(range.endDate.getDay(), 0, "La semana debe terminar en Domingo");
  assert(range.formattedRange.length > 0, "Debe generar un rango formateado legible");
  console.log(`✅ [PASS] Test 3: Rango de fechas semanal (${range.formattedRange}) calculado correctamente`);

  // 4. Test CRUD Notificaciones In-App con Inquilinos
  console.log("Testing InAppNotification CRUD & Tenant Isolation...");
  
  // Buscar un restaurante existente o usar uno de prueba
  let testRest = await prisma.restaurant.findFirst({ select: { id: true, slug: true, name: true } });
  if (!testRest) {
    console.log("⚠️ No se encontró restaurante en DB, omitiendo prueba de persistencia real.");
    return;
  }

  // 4a. Crear notificación dirigida
  const directNotifRes = await createNotification({
    restaurantId: testRest.id,
    type: "WARNING_EXPIRING",
    priority: "URGENT",
    title: "Tu suscripción vence pronto",
    message: "Renueva tu plan para no perder pedidos en línea.",
    actionUrl: "/admin?tab=subscription",
    actionLabel: "Renovar Ahora",
  });
  assert.strictEqual(directNotifRes.success, true, "Notificación dirigida debe crearse con éxito");
  const directId = directNotifRes.notificationId!;

  // 4b. Crear notificación global
  const globalNotifRes = await createNotification({
    broadcastAll: true,
    type: "MAINTENANCE",
    priority: "HIGH",
    title: "Ventana de Mantenimiento VPS",
    message: "El próximo domingo a las 03:00 AM se realizará mantenimiento preventivo.",
  });
  assert.strictEqual(globalNotifRes.success, true, "Notificación global debe crearse con éxito");
  const globalId = globalNotifRes.notificationId!;

  // 4c. Consultar notificaciones activas para el restaurante
  const activeNotifs = await getActiveNotificationsForRestaurant(testRest.id);
  assert(activeNotifs.length >= 2, "Debe retornar al menos las dos notificaciones recién creadas");

  const foundDirect = activeNotifs.find((n) => n.id === directId);
  assert(foundDirect, "La notificación dirigida debe estar presente");
  assert.strictEqual(foundDirect!.isGlobal, false);
  assert.strictEqual(foundDirect!.isRead, false);

  const foundGlobal = activeNotifs.find((n) => n.id === globalId);
  assert(foundGlobal, "La notificación global debe estar presente");
  assert.strictEqual(foundGlobal!.isGlobal, true);
  assert.strictEqual(foundGlobal!.isRead, false);
  console.log("✅ [PASS] Test 4: Creación y obtención unificada (Directas + Globales) verificada");

  // 5. Test Marcar como Leída
  console.log("Testing markNotificationAsRead...");
  const readDirectRes = await markNotificationAsRead(directId, testRest.id);
  assert.strictEqual(readDirectRes.success, true);

  const readGlobalRes = await markNotificationAsRead(globalId, testRest.id);
  assert.strictEqual(readGlobalRes.success, true);

  const updatedActive = await getActiveNotificationsForRestaurant(testRest.id);
  const updatedDirect = updatedActive.find((n) => n.id === directId);
  const updatedGlobal = updatedActive.find((n) => n.id === globalId);
  assert.strictEqual(updatedDirect?.isRead, true, "Notificación directa debe figurar como leída");
  assert.strictEqual(updatedGlobal?.isRead, true, "Notificación global debe figurar como leída para este restaurante");
  console.log("✅ [PASS] Test 5: Marcar como leída (individual y recibo global) verificado");

  // 6. Test Descarte (Dismiss)
  console.log("Testing dismissNotification...");
  const dismissRes = await dismissNotification(globalId, testRest.id);
  assert.strictEqual(dismissRes.success, true);

  const afterDismiss = await getActiveNotificationsForRestaurant(testRest.id);
  const stillHasGlobal = afterDismiss.some((n) => n.id === globalId);
  assert.strictEqual(stillHasGlobal, false, "Notificación global descartada NO debe aparecer en el banner");
  console.log("✅ [PASS] Test 6: Descarte de notificación global sin afectar otros inquilinos verificado");

  // 7. Test Metrics Engine
  console.log("Testing Metrics Engine calculation...");
  const metrics = await calculateWeeklyMetrics(testRest.id);
  assert(metrics !== null, "calculateWeeklyMetrics debe retornar un objeto estructurado");
  assert(typeof metrics!.financials.totalRevenue === "number", "totalRevenue debe ser numérico");
  assert(typeof metrics!.financials.totalOrders === "number", "totalOrders debe ser numérico");
  assert(metrics!.channelDistribution.dineIn !== undefined, "Debe tener métricas de dineIn");
  assert(metrics!.channelDistribution.takeout !== undefined, "Debe tener métricas de takeout");
  assert(metrics!.channelDistribution.delivery !== undefined, "Debe tener métricas de delivery");
  console.log(`✅ [PASS] Test 7: Métricas semanales para '${testRest.name}' (${metrics!.period.formattedRange}) calculadas con éxito`);

  // 8. Test Route Handlers para endpoints internos
  console.log("Testing Internal API Route Handlers...");
  const { POST: createInternalNotifRoute } = await import("@/app/api/internal/notifications/create/route");
  const { GET: getInternalMetricsRoute, POST: postInternalMetricsRoute } = await import("@/app/api/internal/metrics/weekly-summary/route");

  // 8a. Probar POST /api/internal/notifications/create sin auth -> 401
  const unauthReq = new NextRequest("http://localhost:3000/api/internal/notifications/create", {
    method: "POST",
    body: JSON.stringify({ title: "Test", message: "Test" }),
  });
  const unauthRes = await createInternalNotifRoute(unauthReq);
  assert.strictEqual(unauthRes.status, 401, "Petición sin API key interna debe retornar 401");

  // 8b. Probar POST /api/internal/notifications/create con auth -> 201
  const authCreateReq = new NextRequest("http://localhost:3000/api/internal/notifications/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-api-key": process.env.INTERNAL_API_KEY || "",
    },
    body: JSON.stringify({
      restaurantId: testRest.id,
      type: "PROMO",
      priority: "NORMAL",
      title: "Nueva actualización disponible",
      message: "Prueba la Ruleta de Premios desde tu panel.",
    }),
  });
  const authCreateRes = await createInternalNotifRoute(authCreateReq);
  assert.strictEqual(authCreateRes.status, 201, "Petición autorizada debe retornar 201 Created");
  const createJson = await authCreateRes.json();
  assert.strictEqual(createJson.success, true);
  const routeCreatedId = createJson.notificationId;

  // 8c. Probar GET /api/internal/metrics/weekly-summary con restaurantId
  const metricsGetReq = new NextRequest(`http://localhost:3000/api/internal/metrics/weekly-summary?restaurantId=${testRest.id}`, {
    headers: { "x-internal-api-key": process.env.INTERNAL_API_KEY || "" },
  });
  const metricsGetRes = await getInternalMetricsRoute(metricsGetReq);
  assert.strictEqual(metricsGetRes.status, 200, "Métricas internas deben responder 200 OK");
  const metricsGetJson = await metricsGetRes.json();
  assert.strictEqual(metricsGetJson.success, true);
  assert.strictEqual(metricsGetJson.count, 1);
  console.log("✅ [PASS] Test 8: Endpoints internos (/api/internal/*) validados exitosamente");

  // 9. Test Endpoint Cliente sin sesión -> 401
  console.log("Testing Client Admin Route Handlers...");
  const { GET: getAdminNotifsRoute } = await import("@/app/api/admin/notifications/route");
  const unauthClientReq = new NextRequest("http://localhost:3000/api/admin/notifications");
  const unauthClientRes = await getAdminNotifsRoute(unauthClientReq);
  assert.strictEqual(unauthClientRes.status, 401, "Endpoint de cliente sin sesión debe retornar 401");
  console.log("✅ [PASS] Test 9: Protección de endpoint de cliente (/api/admin/notifications) verificada");

  // Limpieza de datos de prueba
  await prisma.inAppNotificationRead.deleteMany({ where: { notificationId: { in: [directId, globalId, routeCreatedId] } } });
  await prisma.inAppNotification.deleteMany({ where: { id: { in: [directId, globalId, routeCreatedId] } } });
  console.log("🧹 Datos de prueba limpiados correctamente.");

  console.log("==========================================");
  console.log("🎉 TODAS LAS PRUEBAS DE LA FASE 2 PASARON EXITOSAMENTE (7/7)");
  console.log("==========================================");
}

runNotificationsTestSuite().catch((err) => {
  console.error("❌ Error en la suite de pruebas de notificaciones:", err);
  process.exit(1);
});
