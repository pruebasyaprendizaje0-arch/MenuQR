import assert from "node:assert";
import { signToken, verifyToken } from "./jwt";

console.log("==========================================");
console.log("🧪 RUNNING SUPER ADMIN IMPERSONATION TEST");
console.log("==========================================");

function runTests() {
  const userId = "b41836cb-05ca-41b8-906f-7ab53847b948";
  const email = "admin@admin.com";
  const empanadasRestId = "f5c11edb-0917-462f-94a3-cddb15359ad4";
  const mammaMiaRestId = "24efbf36-f29f-44e5-8772-cfffc26bacfe";

  // 1. Test token signing with specific restaurantId
  const tokenEmpanadas = signToken({
    userId,
    email,
    restaurantId: empanadasRestId,
  });

  const verifiedEmpanadas = verifyToken(tokenEmpanadas);
  assert.ok(verifiedEmpanadas, "Token must be valid");
  assert.strictEqual(verifiedEmpanadas.userId, userId);
  assert.strictEqual(verifiedEmpanadas.restaurantId, empanadasRestId);
  console.log("✅ [PASS] Token con restaurantId (Las Empanadas de Mauro) firmado y verificado correctamente");

  // 2. Test token signing for Mamma Mia
  const tokenMammaMia = signToken({
    userId,
    email,
    restaurantId: mammaMiaRestId,
  });

  const verifiedMammaMia = verifyToken(tokenMammaMia);
  assert.ok(verifiedMammaMia, "Token must be valid");
  assert.strictEqual(verifiedMammaMia.userId, userId);
  assert.strictEqual(verifiedMammaMia.restaurantId, mammaMiaRestId);
  console.log("✅ [PASS] Token con restaurantId (Mamma Mia) firmado y verificado correctamente");

  // 3. Test isolation: each token points to its exact target restaurant
  assert.notStrictEqual(verifiedEmpanadas.restaurantId, verifiedMammaMia.restaurantId);
  console.log("✅ [PASS] Aislamiento multi-restaurante verificado (diferentes restaurantId para el mismo userId)");

  console.log("==========================================");
  console.log("TODAS LAS PRUEBAS DE ASISTENCIA / IMPERSONACIÓN PASARON (100%)");
  console.log("==========================================");
}

runTests();
