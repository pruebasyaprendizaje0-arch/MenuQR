import assert from "node:assert";
import { sendTelegramAlert } from "./telegram-alert";

console.log("==========================================");
console.log("🧪 TESTING TELEGRAM N8N ALERT SERVICE");
console.log("==========================================");

async function runTests() {
  // Test 1: Fallback silencioso y seguro si el fetch falla o la URL no responde
  const fakePayload = {
    mensaje: "🧪 Test de prueba unitaria MenuQR Pro",
    cliente: "Frank Developer",
    negocio: "Restaurante Demo",
  };

  // Interceptar o probar llamada con timeout
  console.log("Test 1: Envío con payload estructurado...");
  const result = await sendTelegramAlert(fakePayload);
  // Debe retornar un booleano (true si n8n respondió 200, false si falló o no hay red) sin lanzar excepciones
  assert.strictEqual(typeof result, "boolean", "sendTelegramAlert debe retornar boolean y nunca lanzar excepciones");
  console.log(`✅ [PASS] Test 1 completado (Resultado webhook: ${result ? "Enviado con éxito" : "Manejado silenciosamente sin bloquear"})`);

  // Test 2: Fallback con cliente opcional
  console.log("Test 2: Envío sin cliente especificado...");
  const resultOptional = await sendTelegramAlert({
    mensaje: "Alerta sin cliente explícito",
  });
  assert.strictEqual(typeof resultOptional, "boolean", "Debe aceptar cliente opcional sin error");
  console.log("✅ [PASS] Test 2 completado exitosamente");

  console.log("==========================================");
  console.log("🎉 TODAS LAS PRUEBAS DE TELEGRAM N8N PASARON");
  console.log("==========================================");
}

runTests().catch((err) => {
  console.error("❌ Falló la prueba de telegram alert:", err);
  process.exit(1);
});
