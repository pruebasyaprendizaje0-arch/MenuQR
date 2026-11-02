import assert from "assert";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { CreateNotificationInputSchema } from "./notifications";
import { GET as getSubscriptionsCheckRoute, POST as postSubscriptionsCheckRoute } from "@/app/api/internal/subscriptions/check-status/route";

async function runSubscriptionsCheckTestSuite() {
  console.log("==================================================");
  console.log("🧪 TESTING INTERNAL SUBSCRIPTIONS CHECK ENDPOINT");
  console.log("==================================================");

  // 1. Probar rechazo sin API Key (401)
  console.log("1. Probando rechazo sin token de autorización...");
  const unauthReq = new NextRequest("http://localhost:3000/api/internal/subscriptions/check-status");
  const unauthRes = await getSubscriptionsCheckRoute(unauthReq);
  assert.strictEqual(unauthRes.status, 401, "GET sin auth debe retornar 401");
  console.log("✅ [PASS] 1: Endpoint protegido contra accesos no autorizados");

  // 2. Probar GET con API Key válida
  console.log("2. Probando GET con x-internal-api-key válida...");
  const authGetReq = new NextRequest("http://localhost:3000/api/internal/subscriptions/check-status?status=ALL", {
    headers: {
      "x-internal-api-key": process.env.INTERNAL_API_KEY || "",
    },
  });
  const authGetRes = await getSubscriptionsCheckRoute(authGetReq);
  assert.strictEqual(authGetRes.status, 200, "GET con auth debe retornar 200");
  const getJson = await authGetRes.json();
  assert.strictEqual(getJson.success, true);
  assert(getJson.summary !== undefined, "Debe incluir resumen de métricas");
  assert(typeof getJson.summary.total === "number");
  assert(Array.isArray(getJson.data), "Debe incluir array de data");
  console.log(`✅ [PASS] 2: GET exitoso. Encontrados ${getJson.summary.total} restaurantes en DB.`);

  // 3. Probar POST con filtros en JSON
  console.log("3. Probando POST con cuerpo JSON (días = 10, status = ACTION_REQUIRED)...");
  const authPostReq = new NextRequest("http://localhost:3000/api/internal/subscriptions/check-status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-api-key": process.env.INTERNAL_API_KEY || "",
    },
    body: JSON.stringify({
      daysThreshold: 10,
      status: "ACTION_REQUIRED",
    }),
  });
  const authPostRes = await postSubscriptionsCheckRoute(authPostReq);
  assert.strictEqual(authPostRes.status, 200, "POST con auth debe retornar 200");
  const postJson = await authPostRes.json();
  assert.strictEqual(postJson.success, true);
  assert.strictEqual(postJson.filterApplied.daysThreshold, 10);
  console.log(`✅ [PASS] 3: POST exitoso. ${postJson.count} restaurantes requieren acción.`);

  // 4. Probar resiliencia de CreateNotificationInputSchema
  console.log("4. Probando resiliencia de CreateNotificationInputSchema...");

  // 4a. Normalización de alias 'EXPIRING' y priority 'medium'
  const aliasPayload = {
    broadcastAll: true,
    type: "EXPIRING",
    priority: "medium",
    title: "Alerta de prueba",
    body: "Mensaje en body en lugar de message",
  };
  const parsedAlias = CreateNotificationInputSchema.safeParse(aliasPayload);
  assert.strictEqual(parsedAlias.success, true, "Alias debe ser normalizado exitosamente");
  if (parsedAlias.success) {
    assert.strictEqual(parsedAlias.data.type, "WARNING_EXPIRING");
    assert.strictEqual(parsedAlias.data.priority, "NORMAL");
    assert.strictEqual(parsedAlias.data.message, "Mensaje en body en lugar de message");
  }

  // 4b. Slug enviado en restaurantId se reubica a restaurantSlug automáticamente
  const slugInIdPayload = {
    restaurantId: "mi-negocio-slug",
    type: "WARNING_EXPIRING",
    title: "Vencimiento",
    message: "Tu cuenta vence pronto",
  };
  const parsedSlugInId = CreateNotificationInputSchema.safeParse(slugInIdPayload);
  assert.strictEqual(parsedSlugInId.success, true, "Slug en restaurantId no debe reventar por UUID");
  if (parsedSlugInId.success) {
    assert.strictEqual(parsedSlugInId.data.restaurantSlug, "mi-negocio-slug");
    assert.strictEqual(parsedSlugInId.data.restaurantId, null);
  }
  console.log("✅ [PASS] 4: Normalización defensiva de Zod verificada al 100%");

  console.log("==================================================");
  console.log("🎉 TODAS LAS PRUEBAS DE SUBSCRIPCIONES PASARON (4/4)");
  console.log("==================================================");
}

runSubscriptionsCheckTestSuite().catch((err) => {
  console.error("❌ Error en la suite de pruebas de suscripciones:", err);
  process.exit(1);
});
